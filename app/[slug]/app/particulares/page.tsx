"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, addDias, dinheiro, hojeISO, hora, primeiroNome, whatsapp } from "@/lib/util";
import { gerarPix } from "@/lib/pix";
import { QR } from "@/components/QR";
import { Avatar } from "@/components/Avatar";

// Aulas particulares: o professor deixa os horários livres; o aluno escolhe, pede e paga por Pix.
const ROT: Record<string, string> = { pedida: "⏳ aguardando o professor", confirmada: "✅ confirmada", paga: "💰 paga", cancelada: "❌ cancelada" };
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default function Particulares() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [profs, setProfs] = useState<any[]>([]);
  const [regras, setRegras] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [prof, setProf] = useState("");
  const [aluno, setAluno] = useState(ctx.meusAlunos[0]?.id || "");
  const [ocupados, setOcupados] = useState<{ inicio: string; fim: string }[]>([]);
  const [nova, setNova] = useState<any>(null);
  const [pix, setPix] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const souProf = ctx.equipe;
  const meuProf = ctx.professorId;

  async function carregar() {
    const [{ data: pp }, { data: rg }, { data: au }] = await Promise.all([
      sb.from("professores_publicos").select("membro_id, nome, foto_url").eq("academia_id", ctx.academia.id),
      sb.from("particular_horarios").select("*").eq("academia_id", ctx.academia.id).eq("ativo", true).order("dia_semana").order("hora_inicio"),
      sb.from("aulas_particulares").select("*").eq("academia_id", ctx.academia.id).gte("inicio", addDias(hojeISO(), -30)).order("inicio"),
    ]);
    const unicos = Array.from(new Map((pp || []).map((p: any) => [p.membro_id, p])).values());
    setProfs(unicos); setRegras(rg || []); setAulas(au || []);
    if (!prof) setProf(souProf && meuProf ? meuProf : (rg || [])[0]?.professor_id || "");
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!prof) return;
    sb.rpc("particular_ocupados", { p_prof: prof, p_de: new Date().toISOString(), p_ate: new Date(Date.now() + 15 * 86400000).toISOString() })
      .then(({ data }) => setOcupados(data || []));
  }, [prof, aulas.length]); // eslint-disable-line

  // horários livres dos próximos 14 dias, a partir das regras do professor
  const livres = useMemo(() => {
    const r = regras.filter((x) => x.professor_id === prof);
    const l: { inicio: string; fim: string; valor: number | null; dia: string }[] = [];
    for (let k = 0; k < 14; k++) {
      const dia = addDias(hojeISO(), k);
      const dow = new Date(dia + "T12:00:00").getDay();
      for (const x of r.filter((y) => y.dia_semana === dow)) {
        const [hi, mi] = x.hora_inicio.split(":").map(Number), [hf, mf] = x.hora_fim.split(":").map(Number);
        for (let t = hi * 60 + mi; t + x.duracao_min <= hf * 60 + mf; t += x.duracao_min) {
          const ini = new Date(`${dia}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00-03:00`);
          const fim = new Date(ini.getTime() + x.duracao_min * 60000);
          if (ini.getTime() < Date.now() + 2 * 3600000) continue; // pelo menos 2 h de antecedência
          if (ocupados.some((o) => new Date(o.inicio) < fim && new Date(o.fim) > ini)) continue;
          l.push({ inicio: ini.toISOString(), fim: fim.toISOString(), valor: x.valor, dia });
        }
      }
    }
    return l;
  }, [regras, prof, ocupados]);

  async function pedir(s: any) {
    if (!aluno) return setMsg("Escolha o aluno.");
    if (!confirm(`Pedir aula particular em ${quando(s.inicio)}${s.valor ? ` (${dinheiro(s.valor)})` : ""}?`)) return;
    const { data, error } = await sb.from("aulas_particulares").insert({ academia_id: ctx.academia.id, professor_id: prof, aluno_id: aluno, inicio: s.inicio, fim: s.fim, valor: s.valor, status: "pedida" }).select().single();
    if (error) return setMsg(error.message.includes("ux_particular") ? "Esse horário acabou de ser reservado. Escolha outro." : error.message);
    setMsg("✅ Pedido enviado! O professor confirma pelo app.");
    if (data?.valor && ctx.academia.pix_chave) abrirPix(data);
    carregar();
  }
  function abrirPix(a: any) {
    const ac = ctx.academia;
    setPix({ a, codigo: gerarPix({ chave: ac.pix_chave, nome: ac.pix_nome || ac.nome, cidade: ac.pix_cidade || ac.cidade || "BRASIL", valor: Number(a.valor), txid: "PART" + a.id.replace(/-/g, "").slice(0, 10) }) });
  }
  async function mudar(a: any, status: string) {
    if (status === "cancelada" && !confirm("Cancelar esta aula?")) return;
    const r = souProf ? await sb.from("aulas_particulares").update({ status }).eq("id", a.id) : await sb.rpc("cancelar_particular", { p_id: a.id });
    setMsg(r.error ? r.error.message : "Atualizado."); carregar();
  }
  async function salvarRegra() {
    if (!nova?.professor_id || nova.dia_semana === undefined || !nova.hora_inicio || !nova.hora_fim) return setMsg("Preencha professor, dia e horário.");
    const { error } = await sb.from("particular_horarios").insert({ academia_id: ctx.academia.id, professor_id: nova.professor_id, dia_semana: Number(nova.dia_semana), hora_inicio: nova.hora_inicio, hora_fim: nova.hora_fim, duracao_min: Number(nova.duracao_min || 60), valor: nova.valor ? Number(nova.valor) : null });
    setMsg(error ? error.message : "Horário livre salvo."); if (!error) { setNova(null); carregar(); }
  }
  async function tirarRegra(r: any) { await sb.from("particular_horarios").delete().eq("id", r.id); carregar(); }

  const nomeProf = (id: string) => profs.find((p) => p.membro_id === id)?.nome || "Professor(a)";
  const minhas = aulas.filter((a) => (souProf ? ctx.admin || a.professor_id === meuProf : ctx.meusAlunos.some((m) => m.id === a.aluno_id)));
  const profsComHorario = profs.filter((p) => regras.some((r) => r.professor_id === p.membro_id));

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">🗓️ Aulas particulares</h1>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {souProf && (
        <section className="space-y-2 rounded-2xl bg-painel p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">⏰ Horários livres para particular</h2>
            <button className="btn-sec text-sm" onClick={() => setNova(nova ? null : { professor_id: meuProf || profs[0]?.membro_id, duracao_min: 60 })}>{nova ? "Fechar" : "+ Horário"}</button></div>
          {nova && (
            <div className="grid gap-2 rounded-xl bg-painel2 p-3 sm:grid-cols-3">
              {ctx.admin && <select className="campo" value={nova.professor_id || ""} onChange={(e) => setNova({ ...nova, professor_id: e.target.value })}>{profs.map((p) => <option key={p.membro_id} value={p.membro_id}>{p.nome}</option>)}</select>}
              <select className="campo" value={nova.dia_semana ?? ""} onChange={(e) => setNova({ ...nova, dia_semana: e.target.value })}><option value="">Dia…</option>{DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
              <span className="flex items-center gap-1"><input type="time" className="campo" value={nova.hora_inicio || ""} onChange={(e) => setNova({ ...nova, hora_inicio: e.target.value })} /> às <input type="time" className="campo" value={nova.hora_fim || ""} onChange={(e) => setNova({ ...nova, hora_fim: e.target.value })} /></span>
              <select className="campo" value={nova.duracao_min} onChange={(e) => setNova({ ...nova, duracao_min: e.target.value })}>{[30, 45, 60, 90].map((m) => <option key={m} value={m}>Aula de {m} min</option>)}</select>
              <input className="campo" type="number" step="0.01" placeholder="Valor (R$)" value={nova.valor || ""} onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
              <button className="btn" onClick={salvarRegra}>Salvar horário</button>
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {regras.filter((r) => ctx.admin || r.professor_id === meuProf).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-painel2 p-2">
                <span>{ctx.admin ? `${nomeProf(r.professor_id)} · ` : ""}<b>{DIAS[r.dia_semana]}</b> {hora(r.hora_inicio)}–{hora(r.hora_fim)} · aulas de {r.duracao_min} min{r.valor ? ` · ${dinheiro(r.valor)}` : ""}</span>
                <button className="text-xs text-suave underline" onClick={() => tirarRegra(r)}>tirar</button>
              </li>
            ))}
            {!regras.length && <p className="text-suave">Coloque os horários em que você pode dar aula particular. Os alunos escolhem pelo app.</p>}
          </ul>
        </section>
      )}

      {!souProf && (
        <section className="space-y-3 rounded-2xl bg-painel p-4">
          <h2 className="text-xl font-bold">Marcar uma aula</h2>
          {!profsComHorario.length && <p className="text-sm text-suave">Os professores ainda não abriram horários para aula particular.</p>}
          <div className="flex flex-wrap gap-2">
            {profsComHorario.map((p) => (
              <button key={p.membro_id} className="chip flex items-center gap-2 py-1.5" onClick={() => setProf(p.membro_id)} style={prof === p.membro_id ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>
                <Avatar foto={p.foto_url} nome={p.nome} tamanho={22} mostrarFaixa={false} /> {p.nome}
              </button>
            ))}
          </div>
          {ctx.meusAlunos.length > 1 && (
            <select className="campo w-auto" value={aluno} onChange={(e) => setAluno(e.target.value)} aria-label="Para quem">
              {ctx.meusAlunos.map((m) => <option key={m.id} value={m.id}>Para: {m.eu ? "mim" : m.apelido || m.nome}</option>)}
            </select>
          )}
          {prof && (
            <div className="space-y-2">
              {Array.from(new Set(livres.map((s) => s.dia))).map((dia) => (
                <div key={dia}>
                  <p className="text-sm font-semibold">{dia === hojeISO() ? "Hoje" : `${DIAS[new Date(dia + "T12:00:00").getDay()]} ${dia.slice(8)}/${dia.slice(5, 7)}`}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {livres.filter((s) => s.dia === dia).map((s) => (
                      <button key={s.inicio} className="btn-sec px-3 py-1.5 text-sm" onClick={() => pedir(s)}>{new Date(s.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</button>
                    ))}
                  </div>
                </div>
              ))}
              {!livres.length && <p className="text-sm text-suave">Sem horário livre nos próximos 14 dias.</p>}
            </div>
          )}
        </section>
      )}

      {pix && (
        <section className="space-y-2 rounded-2xl border-2 bg-painel p-4 text-center" style={{ borderColor: "var(--cor)" }}>
          <p className="text-xl font-bold">Pagar {dinheiro(pix.a.valor)} com Pix</p>
          <div className="mx-auto w-fit rounded-xl bg-white p-2"><QR texto={pix.codigo} tamanho={200} /></div>
          <button className="btn-sec w-full break-all text-xs" onClick={() => navigator.clipboard.writeText(pix.codigo).then(() => setMsg("Código Pix copiado!"))}>📋 Copiar Pix copia e cola</button>
          <p className="text-xs text-suave">Depois de pagar, o professor marca como paga. <button className="underline" onClick={() => setPix(null)}>Fechar</button></p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-bold">{souProf ? "Pedidos e aulas" : "Minhas aulas particulares"}</h2>
        {minhas.map((a) => {
          const al = ctx.meusAlunos.find((m) => m.id === a.aluno_id);
          return (
            <div key={a.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-painel p-3 text-sm ${a.status === "cancelada" ? "opacity-60" : ""}`}>
              <span><b>{quando(a.inicio)}</b> · {souProf ? <AlunoNome id={a.aluno_id} /> : `${nomeProf(a.professor_id)}${al && !al.eu ? ` · ${primeiroNome(al.apelido || al.nome)}` : ""}`}{a.valor ? ` · ${dinheiro(a.valor)}` : ""} · {ROT[a.status]}</span>
              <span className="flex flex-wrap gap-2">
                {souProf && a.status === "pedida" && <button className="btn px-3 py-1 text-xs" onClick={() => mudar(a, "confirmada")}>✅ Confirmar</button>}
                {souProf && ["pedida", "confirmada"].includes(a.status) && a.valor && <button className="btn-sec px-3 py-1 text-xs" onClick={() => mudar(a, "paga")}>💰 Marcar paga</button>}
                {!souProf && a.valor && ["pedida", "confirmada"].includes(a.status) && ctx.academia.pix_chave && <button className="btn-sec px-3 py-1 text-xs" onClick={() => abrirPix(a)}>💠 Pagar com Pix</button>}
                {["pedida", "confirmada"].includes(a.status) && new Date(a.inicio) > new Date() && <button className="text-xs text-suave underline" onClick={() => mudar(a, "cancelada")}>cancelar</button>}
              </span>
            </div>
          );
        })}
        {!minhas.length && <p className="text-sm text-suave">Nenhuma aula particular marcada.</p>}
      </section>
    </div>
  );
}

// nome e WhatsApp do aluno (para o professor)
function AlunoNome({ id }: { id: string }) {
  const [a, setA] = useState<any>(null);
  useEffect(() => { supabaseNavegador().from("painel_alunos").select("nome, apelido, whatsapp").eq("membro_id", id).maybeSingle().then(({ data }) => setA(data)); }, [id]);
  if (!a) return <span>…</span>;
  const w = whatsapp(a.whatsapp, `Oi, ${primeiroNome(a.apelido || a.nome)}! Sobre a sua aula particular:`);
  return <span>{a.apelido || a.nome}{w && <> · <a className="underline" href={w} target="_blank">WhatsApp</a></>}</span>;
}
