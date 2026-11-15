"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, DIAS_CURTOS, MESES, hora, hojeISO, dataHoraBR } from "@/lib/util";
import { EditarEvento } from "@/components/EditarEvento";
import { BotaoAgenda } from "@/components/BotaoAgenda";
import Link from "next/link";

const ICONE: Record<string, string> = { campeonato: "🥇", prova: "🎓", evento: "🎉", feriado: "🏖️", outro: "📅" };

export default function Calendario() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const hoje = hojeISO();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)) - 1);
  const [dia, setDia] = useState(hoje);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [canceladas, setCanceladas] = useState<any[]>([]);
  const [feriados, setFeriados] = useState<any[]>([]);
  const [mods, setMods] = useState<any[]>([]);
  const [modalidade, setModalidade] = useState("");
  const [novo, setNovo] = useState<any>(null);
  const [planos, setPlanos] = useState<any[]>([]);

  async function carregarEventos() {
    const ini = new Date(ano, mes, 1).toISOString(), fim = new Date(ano, mes + 1, 1).toISOString();
    const { data } = await sb.from("eventos").select("*").eq("academia_id", ctx.academia.id).gte("inicio", ini).lt("inicio", fim).order("inicio");
    setEventos(data || []);
    const { data: c } = await sb.from("aulas").select("data, hora_inicio, turma_id, status, turmas!inner(academia_id)")
      .eq("turmas.academia_id", ctx.academia.id).eq("status", "cancelada")
      .gte("data", `${ano}-${String(mes + 1).padStart(2, "0")}-01`).lt("data", new Date(ano, mes + 1, 1).toISOString().slice(0, 10));
    setCanceladas(c || []);
    const { data: pl } = await sb.from("planos_aula").select("id, titulo, data, turma_id, blocos").eq("academia_id", ctx.academia.id)
      .gte("data", `${ano}-${String(mes + 1).padStart(2, "0")}-01`).lt("data", new Date(ano, mes + 1, 1).toISOString().slice(0, 10));
    setPlanos(pl || []);
  }

  useEffect(() => {
    sb.from("turmas").select("id, nome, modalidade_id, modalidades(nome, cor), horarios(*)").eq("academia_id", ctx.academia.id).eq("ativa", true)
      .then(({ data }) => setHorarios((data || []).flatMap((t: any) => (t.horarios || []).map((h: any) => ({ ...h, turma: t.nome, modalidade_id: t.modalidade_id, mod: t.modalidades })))));
    sb.from("modalidades").select("id, nome, cor").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem").then(({ data }) => setMods(data || []));
  }, []); // eslint-disable-line

  useEffect(() => { carregarEventos(); }, [ano, mes]); // eslint-disable-line
  useEffect(() => {
    fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`).then((r) => r.json()).then((d) => setFeriados(Array.isArray(d) ? d : [])).catch(() => setFeriados([]));
  }, [ano]);

  const diasDoMes = useMemo(() => {
    const primeiro = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    return [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  }, [ano, mes]);

  function doDia(iso: string) {
    const dow = new Date(iso + "T12:00:00").getDay();
    const feriado = feriados.find((f) => f.date === iso);
    const evs = eventos.filter((e) => new Date(e.inicio).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) === iso);
    const semAula = !!feriado || evs.some((e) => e.cancela_aulas);
    const aulas = semAula ? [] : horarios
      .filter((h) => h.dia_semana === dow && (!modalidade || h.modalidade_id === modalidade) && iso >= (h.vale_de || "") && (!h.vale_ate || iso <= h.vale_ate))
      .map((h) => ({ ...h, cancelada: canceladas.some((c) => c.data === iso && c.turma_id === h.turma_id && c.hora_inicio === h.hora_inicio) }))
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    return { feriado, evs, aulas, semAula };
  }

  function mudarMes(n: number) {
    const d = new Date(ano, mes + n, 1);
    setAno(d.getFullYear()); setMes(d.getMonth());
  }

  const sel = doDia(dia);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Calendário</h1>
        {ctx.equipe && <button className="btn" onClick={() => setNovo({})}>Novo evento</button>}
      </div>

      {novo && (
        <EditarEvento key={novo.id || "novo"} academiaId={ctx.academia.id} evento={novo.id ? novo : undefined} dataPadrao={dia} mods={mods}
          onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); carregarEventos(); }} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-sec px-3" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <h2 className="min-w-44 text-center text-3xl font-bold">{MESES[mes]} {ano}</h2>
        <button className="btn-sec px-3" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
        <select className="campo ml-auto w-auto" value={modalidade} onChange={(e) => setModalidade(e.target.value)} aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          {mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_CURTOS.map((d) => <div key={d} className="py-1 text-xs text-suave">{d}</div>)}
        {diasDoMes.map((iso, i) => {
          if (!iso) return <div key={"v" + i} />;
          const d = doDia(iso);
          const cores = Array.from(new Set(d.aulas.filter((a) => !a.cancelada).map((a) => a.mod?.cor || "var(--cor)"))).slice(0, 4);
          return (
            <button key={iso} onClick={() => setDia(iso)}
              className={`flex aspect-square flex-col items-center justify-start rounded-xl p-1 sm:aspect-auto sm:min-h-20 ${iso === dia ? "bg-painel2 ring-2 ring-[var(--cor)]" : "bg-painel"} ${d.semAula ? "opacity-70" : ""}`}>
              <span className={`numero text-lg font-bold ${iso === hoje ? "rounded-full px-2" : ""}`} style={iso === hoje ? { background: "var(--cor)" } : {}}>{Number(iso.slice(8))}</span>
              <span className="text-xs leading-none">{d.feriado ? "🏖️" : ""}{d.evs.map((e) => ICONE[e.tipo]).join("")}</span>
              <span className="mt-auto flex gap-0.5 pb-1">{cores.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl bg-painel p-4">
        <h2 className="text-2xl font-bold">{DIAS[new Date(dia + "T12:00:00").getDay()]}, {dia.slice(8)}/{dia.slice(5, 7)}</h2>
        {sel.feriado && <p className="mt-2 text-alerta">🏖️ {sel.feriado.name} — sem aula</p>}
        <ul className="mt-3 space-y-2">
          {sel.evs.map((e) => (
            <li key={e.id} className="rounded-xl bg-painel2 p-3">
              <p className="font-semibold">{ICONE[e.tipo]} {e.titulo}{e.repetir_anual ? " 🔁" : ""}</p>
              <p className="text-sm text-suave">{dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}{e.cancela_aulas ? " · sem aula" : ""}</p>
              {e.descricao && <p className="text-sm">{e.descricao}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {e.tipo === "campeonato" && <Link className="underline" href={`/${ctx.academia.slug}/app/campeonatos/${e.id}`}>abrir campeonato</Link>}
                {e.maps_url && <a className="underline" href={e.maps_url} target="_blank" rel="noreferrer">📍 mapa</a>}
                <BotaoAgenda evento={e} academia={ctx.academia.nome} />
                {ctx.equipe && <button className="underline" onClick={() => { setNovo(e); window.scrollTo({ top: 0, behavior: "smooth" }); }}>✏️ editar / duplicar / apagar</button>}
              </div>
            </li>
          ))}
          {sel.aulas.map((a) => (
            <li key={a.id} className={`flex items-center gap-3 rounded-xl bg-painel2 p-3 ${a.cancelada ? "line-through opacity-60" : ""}`} style={{ borderLeft: `4px solid ${a.mod?.cor || "var(--cor)"}` }}>
              <span className="numero text-lg font-bold">{hora(a.hora_inicio)}–{hora(a.hora_fim)}</span>
              <span className="flex-1">{a.turma}{a.tipo_treino ? <span className="text-suave"> · {a.tipo_treino}</span> : null}</span>
              {a.cancelada && <span className="text-sm">cancelada</span>}
              {!a.cancelada && planos.find((p) => p.data === dia && p.turma_id === a.turma_id) && (
                <span className="text-xs text-suave">📝 {planos.find((p) => p.data === dia && p.turma_id === a.turma_id).titulo}</span>
              )}
            </li>
          ))}
          {!sel.evs.length && !sel.aulas.length && !sel.feriado && <p className="text-suave">Nada marcado neste dia.</p>}
        </ul>
      </section>
    </div>
  );
}
