"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, hora, hojeISO } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Tour } from "@/components/Tour";

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
  const [msg, setMsg] = useState("");

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, modalidades(nome, cor), horarios(*)")
      .eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome")
      .then(({ data }) => {
        const l = (data || []).sort((a: any, b: any) => Number(b.professor_id === ctx.membroId) - Number(a.professor_id === ctx.membroId));
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

  async function todos() {
    const a = await garantirAula();
    if (!a) return;
    const faltam = alunos.filter((x) => !presentes.has(x.membro_id)).map((x) => ({ aula_id: a.id, membro_id: x.membro_id, metodo: "manual", confirmado_por: ctx.membroId }));
    if (!faltam.length) return;
    await sb.from("presencas").insert(faltam);
    setPresentes(new Map([...presentes, ...faltam.map((f) => [f.membro_id, f] as [string, any])]));
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
          <div className="flex gap-2">
            <button className="btn-sec text-sm" onClick={todos} disabled={cancelada}>Todos</button>
            <button className="btn-sec text-sm" onClick={cancelarAula}>{cancelada ? "Reabrir aula" : "Cancelar aula"}</button>
          </div>
        </div>
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
          <button className="btn-sec mt-2 text-sm" onClick={salvarObs}>Salvar anotação</button>
        </section>
      )}

      <p className="text-sm text-suave">
        Check-in pelo QR da parede: veja o código em <Link className="underline" href={`${base}/config`}>QR e ajustes</Link>.
      </p>
    </div>
  );
}

export default function Pagina() {
  return <Suspense><Chamada /></Suspense>;
}
