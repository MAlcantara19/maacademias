"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, hora, hojeISO } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Tour } from "@/components/Tour";
import { minhasTurmas } from "@/lib/turmas";
import { liberado } from "@/lib/planos";
import { reconhecer, rostosDaFoto } from "@/lib/rosto";

function Chamada() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const base = `/${ctx.academia.slug}/app`;

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState(params.get("turma") || "");
  const [data, setData] = useState(hojeISO());
  const [horarioId, setHorarioId] = useState(params.get("horario") || "");
  const [aula, setAula] = useState<any>(null);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [presentes, setPresentes] = useState<Map<string, any>>(new Map());
  const [obs, setObs] = useState("");
  const [nomes, setNomes] = useState<Record<string, string[]>>({});
  const [perfisDe, setPerfisDe] = useState<Record<string, string>>({});
  const [facial, setFacial] = useState<any>(null);
  const [plano, setPlano] = useState<any>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [ouvido, setOuvido] = useState("");
  const [porVoz, setPorVoz] = useState<string[]>([]);
  const rec = useRef<any>(null);
  const ouvindoRef = useRef(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, modalidades(nome, cor), horarios(*)")
      .eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome")
      .then(({ data }) => {
        const l = minhasTurmas(ctx, data || []).sort((a: any, b: any) => Number(b.professor_id === ctx.professorId) - Number(a.professor_id === ctx.professorId));
        setTurmas(l);
        if (!turmaId && l[0]) setTurmaId(l[0].id);
      });
  }, []); // eslint-disable-line

  const turma = turmas.find((t) => t.id === turmaId);
  const dow = new Date(data + "T12:00:00").getDay();
  const horariosDoDia = useMemo(
    () => (turma?.horarios || []).filter((h: any) => h.dia_semana === dow).sort((a: any, b: any) => a.hora_inicio.localeCompare(b.hora_inicio)),
    [turma, dow]
  );

  useEffect(() => {
    if (horariosDoDia.length && !horariosDoDia.find((h: any) => h.id === horarioId)) setHorarioId(horariosDoDia[0].id);
    if (!horariosDoDia.length) setHorarioId("");
  }, [horariosDoDia]); // eslint-disable-line

  // Carrega (sem criar) a aula e a lista de alunos com alertas
  useEffect(() => {
    if (!turmaId) return;
    setAula(null); setPresentes(new Map()); setMsg("");
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    (async () => {
      const { data: lista } = await sb.rpc("alertas_chamada", { p_turma: turmaId, p_data: data });
      setAlunos(lista || []);
      // nomes e apelidos para a chamada por voz
      const ids = (lista || []).map((x: any) => x.membro_id);
      if (ids.length) {
        const { data: pn } = await sb.from("painel_alunos").select("membro_id, perfil_id, nome, apelido").in("membro_id", ids);
        setNomes(Object.fromEntries((pn || []).map((x: any) => [x.membro_id, [x.nome, x.apelido].filter(Boolean)])));
        setPerfisDe(Object.fromEntries((pn || []).map((x: any) => [x.membro_id, x.perfil_id])));
      }
      const { data: pl } = await sb.from("planos_aula").select("*").eq("turma_id", turmaId).eq("data", data).limit(1);
      setPlano(pl?.[0] || null);
      if (!h) return;
      const { data: a } = await sb.from("aulas").select("*").eq("turma_id", turmaId).eq("data", data).eq("hora_inicio", h.hora_inicio).maybeSingle();
      if (a) {
        setAula(a); setObs(a.observacao || "");
        const { data: pres } = await sb.from("presencas").select("*").eq("aula_id", a.id);
        setPresentes(new Map((pres || []).map((p: any) => [p.membro_id, p])));
      }
    })();
  }, [turmaId, horarioId, data]); // eslint-disable-line

  async function garantirAula() {
    if (aula) return aula;
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    if (!h) { setMsg("Escolha um horário desta turma para o dia."); return null; }
    const { data: a, error } = await sb.from("aulas").upsert(
      { turma_id: turmaId, horario_id: h.id, data, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, tipo_treino: h.tipo_treino },
      { onConflict: "turma_id,data,hora_inicio" }
    ).select().single();
    if (error) { setMsg("Não foi possível abrir a chamada: " + error.message); return null; }
    setAula(a);
    return a;
  }

  async function alternar(membroId: string) {
    const a = await garantirAula();
    if (!a) return;
    const novo = new Map(presentes);
    if (novo.has(membroId)) {
      novo.delete(membroId); setPresentes(novo);
      await sb.from("presencas").delete().eq("aula_id", a.id).eq("membro_id", membroId);
    } else {
      const p = { aula_id: a.id, membro_id: membroId, metodo: "manual", confirmado_por: ctx.membroId };
      novo.set(membroId, p); setPresentes(novo);
      await sb.from("presencas").insert(p);
    }
  }

  // ---------- Chamada por voz ----------
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b0+(\d)/g, "$1").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const NUM: Record<string, string> = { um: "1", dois: "2", tres: "3", quatro: "4", cinco: "5", seis: "6", sete: "7", oito: "8", nove: "9", dez: "10", onze: "11", doze: "12", treze: "13", quatorze: "14", catorze: "14", quinze: "15", dezesseis: "16" };

  function quemFoiDito(texto: string) {
    const falado = " " + norm(texto).split(" ").map((w) => NUM[w] || w).join(" ") + " ";
    const achados = new Set<string>();
    // 1º nome completo e apelido; depois primeiro nome, só se for único na turma
    const primeiros: Record<string, string[]> = {};
    for (const a of alunos) {
      const ns = (nomes[a.membro_id] || [a.nome]).map(norm);
      if (ns.some((n) => n && falado.includes(" " + n + " "))) achados.add(a.membro_id);
      const p = ns[0]?.split(" ")[0];
      if (p) (primeiros[p] ||= []).push(a.membro_id);
    }
    for (const [p, ids] of Object.entries(primeiros)) {
      if (ids.length === 1 && falado.includes(" " + p + " ")) achados.add(ids[0]);
    }
    return Array.from(achados);
  }

  async function marcarVarios(ids: string[]) {
    const a = await garantirAula();
    if (!a) return;
    const novos = ids.filter((id) => !presentes.has(id));
    if (!novos.length) return;
    const linhas = novos.map((id) => ({ aula_id: a.id, membro_id: id, metodo: "manual", confirmado_por: ctx.membroId }));
    await sb.from("presencas").upsert(linhas, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
    setPresentes((atual) => new Map([...atual, ...linhas.map((l) => [l.membro_id, l] as [string, any])]));
    setPorVoz((v) => [...v, ...novos]);
  }

  function alternarVoz() {
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!R) return setMsg("Este navegador não tem reconhecimento de voz. Use o Chrome no Android.");
    if (ouvindoRef.current) { ouvindoRef.current = false; setOuvindo(false); rec.current?.stop(); return; }
    const r = new R();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const texto = e.results[i][0].transcript;
        setOuvido(texto);
        const ids = quemFoiDito(texto);
        if (ids.length) marcarVarios(ids);
      }
    };
    r.onend = () => { if (ouvindoRef.current) r.start(); };
    r.onerror = (e: any) => { if (e.error === "not-allowed") { ouvindoRef.current = false; setOuvindo(false); setMsg("Libere o microfone para usar a chamada por voz."); } };
    rec.current = r; ouvindoRef.current = true; setOuvindo(true); setPorVoz([]); r.start();
  }
  useEffect(() => () => { ouvindoRef.current = false; rec.current?.stop(); }, []);

  async function todos() {
    const a = await garantirAula();
    if (!a) return;
    const faltam = alunos.filter((x) => !presentes.has(x.membro_id)).map((x) => ({ aula_id: a.id, membro_id: x.membro_id, metodo: "manual", confirmado_por: ctx.membroId }));
    if (!faltam.length) return;
    await sb.from("presencas").insert(faltam);
    setPresentes(new Map([...presentes, ...faltam.map((f) => [f.membro_id, f] as [string, any])]));
  }

  // ---------- Chamada por reconhecimento facial ----------
  async function chamadaPorFoto(arquivo?: File) {
    if (!arquivo) return;
    setFacial({ carregando: true, arquivo });
    try {
      const perfis = Object.values(perfisDe);
      const { data: cad } = perfis.length ? await sb.from("rostos").select("perfil_id, descritor").in("perfil_id", perfis) : { data: [] as any[] };
      const porPerfil = new Map<string, number[]>((cad || []).map((c: any) => [c.perfil_id, c.descritor as number[]]));
      const cadastrados = alunos.filter((a) => porPerfil.has(perfisDe[a.membro_id])).map((a) => ({ id: a.membro_id, descritor: porPerfil.get(perfisDe[a.membro_id]) }));
      const rostos = await rostosDaFoto(arquivo, true);
      const { achados, semNome } = reconhecer(rostos, cadastrados);
      setFacial({
        arquivo, rostos: rostos.length, semNome, semCadastro: alunos.length - cadastrados.length,
        marcados: new Set(achados.map((x) => x.id)), achados,
      });
    } catch (e: any) {
      setFacial(null);
      setMsg("Não foi possível analisar a foto neste aparelho: " + (e?.message || e));
    }
  }
  async function confirmarFacial(postar: boolean) {
    const ids = Array.from(facial.marcados as Set<string>);
    const a = await garantirAula();
    if (!a) return;
    const novos = ids.filter((id) => !presentes.has(id));
    if (novos.length) {
      const linhas = novos.map((id) => ({ aula_id: a.id, membro_id: id, metodo: "facial", confirmado_por: ctx.membroId }));
      await sb.from("presencas").upsert(linhas, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
      setPresentes((atual) => new Map([...atual, ...linhas.map((l) => [l.membro_id, l] as [string, any])]));
    }
    if (postar) {
      const dt = new DataTransfer(); dt.items.add(facial.arquivo);
      await fotoDoTreino(dt.files);
    }
    setMsg(`🤳 ${novos.length} presença(s) marcada(s) pela foto.`);
    setFacial(null);
  }

  // Foto do treino → vai para o feed da academia, marcando quem estava presente
  async function fotoDoTreino(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const a = await garantirAula();
    if (!a) return;
    setMsg("Enviando a foto para o feed…");
    const postId = crypto.randomUUID();
    const { error } = await sb.from("posts").insert({
      id: postId, academia_id: ctx.academia.id, autor_id: ctx.membroId, aula_id: a.id,
      legenda: `Treino de hoje · ${turma?.nome}${obs ? ` — ${obs}` : ""} 🥋`,
    });
    if (error) return setMsg("Não foi possível postar: " + error.message);
    let ordem = 0;
    for (const arq of Array.from(arquivos)) {
      const caminho = `${ctx.academia.id}/feed/${postId}-${ordem}.${arq.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, arq);
      if (!up.error) await sb.from("post_midias").insert({ post_id: postId, tipo: arq.type.startsWith("video") ? "video" : "foto", url: "privado:" + caminho, ordem: ordem++ });
    }
    if (presentes.size) await sb.from("post_marcacoes").insert(Array.from(presentes.keys()).map((m) => ({ post_id: postId, membro_id: m })));
    setMsg(`📸 Foto postada no feed com ${presentes.size} aluno(s) marcados.`);
  }

  async function salvarObs() {
    const a = await garantirAula();
    if (!a) return;
    await sb.from("aulas").update({ observacao: obs }).eq("id", a.id);
    setMsg("Anotação salva.");
  }

  async function cancelarAula() {
    const a = await garantirAula();
    if (!a || !confirm("Cancelar esta aula? Ela não conta na frequência de ninguém.")) return;
    await sb.from("presencas").delete().eq("aula_id", a.id);
    const { data: n } = await sb.from("aulas").update({ status: a.status === "cancelada" ? "normal" : "cancelada" }).eq("id", a.id).select().single();
    setAula(n); setPresentes(new Map());
  }

  const cancelada = aula?.status === "cancelada";

  return (
    <div className="space-y-5">
      <Tour id="chamada" perfilId={ctx.perfil?.id} vistos={ctx.perfil?.tours_vistos} passos={[
        { titulo: "Chamada", texto: "Escolha a turma, o dia e o horário. A chamada abre sozinha no primeiro toque." },
        { titulo: "Toque no aluno", texto: "Um toque marca presente; outro desmarca. Quem fez check-in pelo QR já aparece marcado com o horário de chegada." },
        { titulo: "Fique de olho nos ícones", texto: "📌 pendência · 📨 aluno respondeu · 🙋 avisou ausência · 🎂 aniversário · 💳 mensalidade · ⚖️ peso para campeonato." },
      ]} />
      <h1 className="text-4xl font-extrabold">Chamada</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo">Turma</label>
          <select className="campo" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Dia</label>
          <input type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Horário ({DIAS[dow]})</label>
          <select className="campo" value={horarioId} onChange={(e) => setHorarioId(e.target.value)} disabled={!horariosDoDia.length}>
            {!horariosDoDia.length && <option>Sem aula nesse dia</option>}
            {horariosDoDia.map((h: any) => <option key={h.id} value={h.id}>{hora(h.hora_inicio)}–{hora(h.hora_fim)} {h.tipo_treino ? `· ${h.tipo_treino}` : ""}</option>)}
          </select>
        </div>
      </div>

      {horariosDoDia.length > 0 && (
        <div className="sticky top-[60px] z-10 flex items-center justify-between gap-3 rounded-2xl bg-painel p-4 lg:top-2">
          <p className="numero text-3xl font-bold">
            {presentes.size}<span className="text-lg text-suave"> de {alunos.length} presentes</span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {(ctx.academia.modos_chamada || []).includes("facial") && liberado(ctx.academia.plano, "chamada_facial") && !cancelada && (
              <label className="btn-sec cursor-pointer text-sm">🤳 Pela foto
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => chamadaPorFoto(e.target.files?.[0])} />
              </label>
            )}
            <button className="btn-sec text-sm" onClick={alternarVoz} disabled={cancelada} style={ouvindo ? { background: "var(--color-erro)", borderColor: "var(--color-erro)" } : {}}>
              {ouvindo ? "⏹ Parar" : "🎤 Por voz"}
            </button>
            <button className="btn-sec text-sm" onClick={todos} disabled={cancelada}>Todos</button>
            <button className="btn-sec text-sm" onClick={cancelarAula}>{cancelada ? "Reabrir aula" : "Cancelar aula"}</button>
          </div>
        </div>
      )}
      {facial && (
        <div className="rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }}>
          {facial.carregando ? <p>🤳 Analisando a foto… (na primeira vez demora uns segundos)</p> : (
            <>
              <p className="font-semibold">Encontrei {facial.rostos} rosto(s): {facial.achados.length} reconhecido(s){facial.semNome ? `, ${facial.semNome} sem nome` : ""}.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {alunos.filter((a) => facial.achados.some((x: any) => x.id === a.membro_id)).map((a) => {
                  const on = facial.marcados.has(a.membro_id);
                  return (
                    <li key={a.membro_id}>
                      <button className="chip py-2" style={on ? { background: "var(--color-ok)", borderColor: "var(--color-ok)", color: "#fff" } : {}}
                        onClick={() => { const s = new Set(facial.marcados); on ? s.delete(a.membro_id) : s.add(a.membro_id); setFacial({ ...facial, marcados: s }); }}>
                        {on ? "✓ " : ""}{a.nome}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {facial.semCadastro > 0 && <p className="mt-2 text-xs text-suave">{facial.semCadastro} aluno(s) desta turma ainda não cadastraram o rosto (na ficha do aluno → Chamada por foto). Marque esses tocando no nome.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn" onClick={() => confirmarFacial(false)}>Confirmar presenças</button>
                {ctx.academia.modulos?.feed !== false && <button className="btn-sec" onClick={() => confirmarFacial(true)}>Confirmar e postar no feed</button>}
                <button className="btn-sec" onClick={() => setFacial(null)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
      {ouvindo && (
        <div className="rounded-2xl border-2 border-erro bg-painel p-4">
          <p className="font-semibold">🎤 Ouvindo… fale o nome ou apelido dos alunos</p>
          <p className="text-sm text-suave">Ouvi: “{ouvido || "…"}”</p>
          {porVoz.length > 0 && <p className="mt-1 text-sm text-ok">Marcados por voz: {porVoz.map((id) => alunos.find((a) => a.membro_id === id)?.nome).join(", ")}</p>}
        </div>
      )}
      {plano && (
        <details className="rounded-2xl bg-painel p-4" open>
          <summary className="cursor-pointer font-semibold">📝 Plano de hoje: {plano.titulo}</summary>
          <ol className="mt-2 space-y-1 text-sm">
            {(plano.blocos || []).map((b: any, i: number) => <li key={i}><b className="numero">{b.minutos}′</b> {b.tipo}{b.texto ? <span className="text-suave"> — {b.texto}</span> : null}</li>)}
          </ol>
        </details>
      )}
      {cancelada && <p className="rounded-xl bg-alerta/15 p-3 text-alerta">Aula cancelada. Ela não conta na frequência.</p>}
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {horariosDoDia.length > 0 && !cancelada && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {alunos.map((a) => {
            const p = presentes.get(a.membro_id);
            return (
              <li key={a.membro_id}>
                <button
                  onClick={() => alternar(a.membro_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${p ? "border-ok bg-ok/10" : "border-transparent bg-painel"}`}
                  aria-pressed={!!p}
                >
                  <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.nome}</p>
                    <div className="flex flex-wrap gap-1">
                      {(a.alertas || []).map((al: any, k: number) => (
                        <span key={k} className="text-xs text-suave" title={al.texto}>{al.icone} {al.texto}</span>
                      ))}
                      {p?.metodo && p.metodo !== "manual" && (
                        <span className="text-xs text-suave">📲 {p.metodo === "qr_fixo" ? "QR" : p.metodo}{p.atraso_min > 0 ? ` · ${p.atraso_min} min de atraso` : ""}</span>
                      )}
                    </div>
                  </div>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${p ? "bg-ok text-white" : "bg-painel2 text-suave"}`}>{p ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
          {alunos.length === 0 && <p className="text-suave">Nenhum aluno matriculado nesta turma.</p>}
        </ul>
      )}

      {horariosDoDia.length > 0 && !cancelada && (
        <section className="rounded-2xl bg-painel p-4">
          <label className="rotulo" htmlFor="obs">Anotação da aula</label>
          <textarea id="obs" className="campo min-h-20" placeholder="Ex.: treino de passagem de guarda, 6 rounds" value={obs} onChange={(e) => setObs(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-sec text-sm" onClick={salvarObs}>Salvar anotação</button>
            {ctx.academia.modulos?.feed !== false && (
              <label className="btn-sec cursor-pointer text-sm">📷 Foto do treino → feed
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => fotoDoTreino(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-suave">A foto vai para o feed já marcando quem está presente. Faça a chamada antes de postar.</p>
        </section>
      )}

      <p className="text-sm text-suave">
        Check-in pelo QR da parede: veja o código em <Link className="underline" href={`${base}/config`}>Personalizar academia</Link>.
      </p>
    </div>
  );
}

export default function Pagina() {
  return <Suspense><Chamada /></Suspense>;
}
