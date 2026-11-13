"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PreCheckin } from "@/components/PreCheckin";
import { DIAS, addDias, hojeISO, hora, primeiroNome } from "@/lib/util";

// Uma turma: horários, professor, próxima aula (com "vou nessa aula") e colegas
export default function Turma({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [t, setT] = useState<any>(null);
  const [prof, setProf] = useState<any>(null);
  const [colegas, setColegas] = useState<any[]>([]);
  const [meuNaTurma, setMeuNaTurma] = useState<string | null>(null);
  const [freq, setFreq] = useState<any[]>([]);
  const [recado, setRecado] = useState<any>(null);
  const [textoRecado, setTextoRecado] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data }, { data: p }, { data: c }] = await Promise.all([
        sb.from("turmas").select("id, nome, publico, whatsapp_grupo, modalidades(nome, cor), horarios(id, dia_semana, hora_inicio, hora_fim, tipo_treino)").eq("id", id).maybeSingle(),
        sb.rpc("professor_da_turma", { p_turma: id }),
        sb.rpc("colegas_da_turma", { p_turma: id }),
      ]);
      setT(data);
      setProf(p?.[0] || null);
      setColegas(c || []);
      const meu = (c || []).find((x: any) => ctx.meusAlunos.some((m) => m.id === x.membro_id));
      setMeuNaTurma(meu?.membro_id || null);
      if (ctx.equipe) sb.rpc("presenca_turma", { p_turma: id }).then(({ data: f }) => setFreq(f || []));
    })();
  }, [id]); // eslint-disable-line

  // recado da próxima aula
  useEffect(() => {
    if (!t) return;
    const hj = hojeISO();
    const ag = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const ps: any[] = [];
    (t.horarios || []).forEach((h: any) => { for (let k = 0; k < 7; k++) { const d = addDias(hj, k); if (new Date(d + "T12:00:00").getDay() === h.dia_semana && (d > hj || h.hora_fim > ag)) ps.push(d); } });
    ps.sort();
    if (!ps[0]) return;
    sb.from("recados_aula").select("*").eq("turma_id", id).eq("data", ps[0]).maybeSingle().then(({ data }) => { setRecado(data || { data: ps[0] }); setTextoRecado(data?.texto || ""); });
  }, [t?.id]); // eslint-disable-line
  async function salvarRecado() {
    if (!recado) return;
    const r = textoRecado.trim()
      ? await sb.from("recados_aula").upsert({ academia_id: ctx.academia.id, turma_id: id, data: recado.data, texto: textoRecado.trim(), criado_por: ctx.membroId }, { onConflict: "turma_id,data" })
      : await sb.from("recados_aula").delete().eq("turma_id", id).eq("data", recado.data);
    setMsg(r.error ? r.error.message : textoRecado.trim() ? "Recado salvo. Os alunos recebem na véspera, às 18h." : "Recado apagado.");
    setRecado({ ...recado, texto: textoRecado.trim() || null });
  }

  if (!t) return <p className="text-suave">Carregando…</p>;

  // próxima aula desta turma
  const hoje = hojeISO();
  const agora = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const proximas: any[] = [];
  (t.horarios || []).forEach((h: any) => {
    for (let k = 0; k < 7; k++) {
      const dia = addDias(hoje, k);
      if (new Date(dia + "T12:00:00").getDay() === h.dia_semana && (dia > hoje || h.hora_fim > agora)) proximas.push({ ...h, dia });
    }
  });
  proximas.sort((a, b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
  const proxima = proximas[0];
  const diaProx = proxima?.dia;

  return (
    <div className="space-y-5">
      <Link href={`/${ctx.academia.slug}/app/turmas`} className="text-sm text-suave">← Turmas</Link>
      <div>
        <p className="text-sm uppercase tracking-wide text-suave">{t.modalidades?.nome}</p>
        <h1 className="text-4xl font-extrabold">{t.nome}</h1>
        {prof && (
          <p className="mt-2 flex items-center gap-2 text-sm"><Avatar foto={prof.foto_url} nome={prof.nome} tamanho={28} mostrarFaixa={false} /> Professor(a): <b>{prof.nome}</b></p>
        )}
      </div>

      {t.whatsapp_grupo && (meuNaTurma || ctx.equipe) && (
        <a href={t.whatsapp_grupo} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-2xl p-4 font-semibold text-white" style={{ background: "#25D366" }}>
          💬 Entrar no grupo da turma no WhatsApp
        </a>
      )}

      {proxima && (
        <section className="rounded-2xl p-5 text-white" style={{ background: t.modalidades?.cor || "var(--cor)" }}>
          <p className="text-sm opacity-90">Próxima aula</p>
          <p className="numero text-3xl font-bold">{proxima.dia === hoje ? "Hoje" : DIAS[proxima.dia_semana]} · {hora(proxima.hora_inicio)}</p>
          {proxima.tipo_treino && <p>Treino {proxima.tipo_treino}</p>}
          {recado?.texto && <p className="mt-2 rounded-lg bg-black/20 p-2 text-sm">📌 {recado.texto}</p>}
          {meuNaTurma && ctx.academia.modulos?.pre_checkin !== false && (
            <PreCheckin academiaId={ctx.academia.id} horarioId={proxima.id} data={proxima.dia} membroId={meuNaTurma} claro />
          )}
        </section>
      )}

      {ctx.equipe && recado && (
        <section className="space-y-2 rounded-2xl bg-painel p-4">
          <h2 className="text-xl font-bold">📌 Recado para a próxima aula ({String(recado.data).split("-").reverse().slice(0, 2).join("/")})</h2>
          <textarea className="campo min-h-16" placeholder="Ex.: Amanhã tem prova de faixa — tragam a faixa e a carteirinha. / Tragam a ficha do campeonato." value={textoRecado} onChange={(e) => setTextoRecado(e.target.value)} />
          <div className="flex items-center gap-2"><button className="btn text-sm" onClick={salvarRecado}>Salvar recado</button>{msg && <span className="text-sm text-suave">{msg}</span>}</div>
          <p className="text-xs text-suave">Na véspera às 18h: os alunos (e responsáveis) recebem o recado e você recebe quantos confirmaram presença.</p>
        </section>
      )}

      {ctx.equipe && freq.length > 0 && (
        <section className="rounded-2xl bg-painel p-4">
          <h2 className="mb-1 text-xl font-bold">📊 Presença nas últimas aulas</h2>
          <p className="mb-3 text-sm text-suave">Média: <b>{Math.round(freq.reduce((s2, f) => s2 + (f.matriculados ? (100 * f.presentes) / f.matriculados : 0), 0) / freq.length)}%</b> da turma por aula</p>
          <div className="flex h-36 items-end gap-1 overflow-x-auto">
            {freq.map((f) => {
              const pct = f.matriculados ? Math.round((100 * f.presentes) / f.matriculados) : 0;
              return (
                <div key={f.data} className="flex min-w-[18px] flex-1 flex-col items-center gap-1" title={`${String(f.data).split("-").reverse().join("/")}: ${f.presentes} de ${f.matriculados}`}>
                  <span className="text-[10px] text-suave">{f.presentes}</span>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(4, pct)}%`, background: pct >= 70 ? "var(--color-ok)" : pct >= 40 ? "var(--color-alerta)" : "var(--color-erro)" }} />
                  <span className="text-[9px] text-suave">{String(f.data).slice(8, 10)}/{String(f.data).slice(5, 7)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-painel p-4">
        <h2 className="mb-2 text-2xl font-bold">Horários</h2>
        <ul className="space-y-1">
          {[...(t.horarios || [])].sort((a: any, b: any) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)).map((h: any) => (
            <li key={h.id} className="flex justify-between"><span>{DIAS[h.dia_semana]}</span><span className="numero">{hora(h.hora_inicio)}–{hora(h.hora_fim)}{h.tipo_treino ? ` · ${h.tipo_treino}` : ""}</span></li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-painel p-4">
        <h2 className="mb-3 text-2xl font-bold">Turma ({colegas.length})</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {colegas.map((c) => (
            <div key={c.membro_id} className="flex flex-col items-center gap-1 text-center">
              <Avatar foto={c.foto_url} nome={c.nome} cor={c.cor_faixa} grau={c.grau} tamanho={56} />
              <span className="text-sm leading-tight">{c.apelido || primeiroNome(c.nome)}</span>
              {c.faixa && <span className="text-[11px] text-suave">{c.faixa}</span>}
            </div>
          ))}
          {!colegas.length && <p className="col-span-full text-sm text-suave">Só quem é da turma vê os colegas.</p>}
        </div>
      </section>
    </div>
  );
}
