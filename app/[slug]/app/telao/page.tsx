"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, MESES, dataHoraBR, hojeISO, hora } from "@/lib/util";
import { Avatar } from "@/components/Avatar";

// Modo TV: quadro de avisos que passa sozinho (aniversariantes, ranking do mês,
// próximos eventos, avisos e as aulas de hoje). Ideal para a TV da recepção.
export default function Telao() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turma, setTurma] = useState("");
  const [d, setD] = useState<any>(null);
  const [i, setI] = useState(0);
  const [cheia, setCheia] = useState(false);
  const [tick, setTick] = useState(0);
  const cor = ctx.academia.cores?.primaria || "#7c3aed";

  useEffect(() => {
    sb.from("turmas").select("id, nome, horarios(*)").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
  }, []); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const hoje = hojeISO(), mes = Number(hoje.slice(5, 7));
      let ids: string[] | null = null;
      if (turma) ids = ((await sb.from("matriculas").select("membro_id").eq("turma_id", turma).eq("status", "ativa")).data || []).map((m: any) => m.membro_id);
      let qa = sb.from("painel_alunos").select("membro_id, nome, apelido, foto_url, cor_faixa, grau, nascimento").eq("academia_id", ctx.academia.id).eq("ativo", true);
      if (ids) qa = qa.in("membro_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const [{ data: al }, { data: rk }, { data: ev }, { data: av }] = await Promise.all([
        qa,
        sb.rpc("ranking_periodo", { p_acad: ctx.academia.id, p_de: hoje.slice(0, 8) + "01", p_ate: hoje, p_modalidade: null, p_turma: turma || null }),
        sb.from("eventos").select("*").eq("academia_id", ctx.academia.id).gte("inicio", new Date().toISOString()).order("inicio").limit(5),
        sb.from("avisos").select("*").eq("academia_id", ctx.academia.id).order("fixado", { ascending: false }).order("data", { ascending: false }).limit(4),
      ]);
      const aniv = (al || []).filter((a: any) => a.nascimento && Number(a.nascimento.slice(5, 7)) === mes)
        .sort((a: any, b: any) => a.nascimento.slice(8).localeCompare(b.nascimento.slice(8)));
      const ranking = (rk || []).filter((r: any) => r.aulas_possiveis >= 2).sort((a: any, b: any) => (b.pct ?? 0) - (a.pct ?? 0) || b.presencas - a.presencas).slice(0, 8);
      const dow = new Date(hoje + "T12:00:00").getDay();
      const aulas = turmas.filter((t) => !turma || t.id === turma).flatMap((t) => (t.horarios || []).filter((h: any) => h.dia_semana === dow).map((h: any) => ({ ...h, turma: t.nome })))
        .sort((a: any, b: any) => a.hora_inicio.localeCompare(b.hora_inicio));
      setD({ aniv, ranking, eventos: ev || [], avisos: (av || []).filter((a: any) => !a.expira_em || new Date(a.expira_em) > new Date()), aulas, mes, dow });
    })();
  }, [turma, turmas, tick]); // eslint-disable-line

  const telas = d ? [
    d.aulas.length && "aulas", d.aniv.length && "aniv", d.ranking.length && "ranking", d.eventos.length && "eventos", d.avisos.length && "avisos",
  ].filter(Boolean) as string[] : [];
  useEffect(() => {
    if (!telas.length) return;
    const t = setInterval(() => setI((x) => (x + 1) % telas.length), 12000);
    return () => clearInterval(t);
  }, [telas.length]);
  // a cada 10 minutos atualiza os dados
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 600000); return () => clearInterval(t); }, []);

  async function telaCheia() {
    try { await document.documentElement.requestFullscreen(); } catch { /* */ }
    setCheia(true);
  }
  useEffect(() => { const f = () => !document.fullscreenElement && setCheia(false); document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);

  const atual = telas[i % Math.max(1, telas.length)];
  const Titulo = ({ children }: { children: React.ReactNode }) => <h2 className="mb-[3vh] text-[5vh] font-extrabold leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{children}</h2>;

  const quadro = d && (
    <div className="flex h-full w-full flex-col p-[4vh]" style={{ background: `radial-gradient(circle at 85% 0%, ${cor}55, #0b0f1d 60%)`, color: "#fff" }}>
      <header className="mb-[3vh] flex items-center justify-between">
        <div className="flex items-center gap-[2vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ctx.academia.logo_url && <img src={ctx.academia.logo_url} alt="" className="h-[8vh] w-[8vh] object-contain" />}
          <div>
            <p className="text-[4vh] font-extrabold leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{ctx.academia.nome}</p>
            {turma && <p className="text-[2.2vh] opacity-80">{turmas.find((t) => t.id === turma)?.nome}</p>}
          </div>
        </div>
        <Relogio />
      </header>
      <div key={atual} className="telao-entrar min-h-0 flex-1 overflow-hidden">
        {atual === "aulas" && (<><Titulo>🥋 Aulas de hoje · {DIAS[d.dow]}</Titulo>
          <ul className="grid gap-[2vh] sm:grid-cols-2">{d.aulas.map((h: any) => (
            <li key={h.id} className="rounded-[2vh] bg-white/10 p-[2.5vh]"><p className="numero text-[6vh] font-bold leading-none">{hora(h.hora_inicio)}<span className="text-[3vh] opacity-70"> – {hora(h.hora_fim)}</span></p><p className="text-[3vh]">{h.turma}{h.tipo_treino ? ` · ${h.tipo_treino}` : ""}</p></li>
          ))}</ul></>)}
        {atual === "aniv" && (<><Titulo>🎂 Aniversariantes de {MESES[d.mes - 1]}</Titulo>
          <ul className="grid grid-cols-2 gap-[2.5vh] lg:grid-cols-4">{d.aniv.slice(0, 12).map((a: any) => (
            <li key={a.membro_id} className="flex flex-col items-center gap-[1vh] rounded-[2vh] bg-white/10 p-[2vh] text-center">
              <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={110} />
              <p className="text-[3vh] font-bold leading-tight">{a.apelido || a.nome.split(" ")[0]}</p>
              <p className="numero text-[2.6vh] opacity-80">dia {Number(a.nascimento.slice(8))}{a.nascimento.slice(5) === hojeISO().slice(5) ? " 🎉 HOJE" : ""}</p>
            </li>
          ))}</ul></>)}
        {atual === "ranking" && (<><Titulo>🏆 Presença do mês</Titulo>
          <ol className="grid gap-[1.5vh] lg:grid-cols-2">{d.ranking.map((r: any, k: number) => (
            <li key={r.membro_id} className="flex items-center gap-[2vh] rounded-[2vh] bg-white/10 p-[1.6vh]">
              <span className="w-[6vh] text-center text-[4vh]">{["🥇", "🥈", "🥉"][k] || `${k + 1}º`}</span>
              <Avatar foto={r.foto_url} nome={r.nome} cor={r.cor_faixa} grau={r.grau} tamanho={64} mostrarFaixa={false} />
              <span className="min-w-0 flex-1 truncate text-[3vh] font-semibold">{r.apelido || r.nome}</span>
              <span className="numero text-[3.6vh] font-bold">{r.pct ?? 0}%{r.pct === 100 ? " ✨" : ""}</span>
            </li>
          ))}</ol></>)}
        {atual === "eventos" && (<><Titulo>📅 Próximos eventos</Titulo>
          <ul className="space-y-[2vh]">{d.eventos.map((e: any) => (
            <li key={e.id} className="rounded-[2vh] bg-white/10 p-[2.5vh]"><p className="text-[4vh] font-bold leading-tight">{e.titulo}</p><p className="text-[2.6vh] opacity-80">{dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p></li>
          ))}</ul></>)}
        {atual === "avisos" && (<><Titulo>📢 Avisos</Titulo>
          <ul className="space-y-[2vh]">{d.avisos.map((a: any) => (
            <li key={a.id} className="rounded-[2vh] border-l-[1vh] bg-white/10 p-[2.5vh]" style={{ borderColor: cor }}><p className="text-[4vh] font-bold leading-tight">{a.titulo}</p>{a.texto && <p className="text-[2.6vh] opacity-85">{a.texto}</p>}</li>
          ))}</ul></>)}
        {!telas.length && <p className="text-[3vh] opacity-80">Sem novidades para mostrar agora.</p>}
      </div>
      <div className="mt-[2vh] flex justify-center gap-[1vh]">{telas.map((t, k) => <span key={t} className="h-[1vh] w-[4vh] rounded-full" style={{ background: k === i % telas.length ? cor : "#ffffff33" }} />)}</div>
    </div>
  );

  if (cheia) return <div className="fixed inset-0 z-[200]" onDoubleClick={() => document.exitFullscreen?.()}>{quadro}</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-extrabold">📺 Telão (modo TV)</h1>
      <p className="text-suave">Abra no computador ou na smart TV ligada na recepção. As telas passam sozinhas a cada 12 segundos e os dados se atualizam a cada 10 minutos.</p>
      <div className="flex flex-wrap gap-2">
        <select className="campo w-auto" value={turma} onChange={(e) => setTurma(e.target.value)} aria-label="Turma"><option value="">Academia toda</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
        <button className="btn" onClick={telaCheia}>⛶ Abrir em tela cheia</button>
        <Link href={`/${ctx.academia.slug}/app`} className="btn-sec">Voltar</Link>
      </div>
      <div className="aspect-video w-full overflow-hidden rounded-2xl">{quadro || <p className="p-4 text-suave">Carregando…</p>}</div>
    </div>
  );
}

function Relogio() {
  const [h, setH] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setH(new Date()), 1000 * 15); return () => clearInterval(t); }, []);
  return <p className="numero text-[6vh] font-bold leading-none">{h.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>;
}
