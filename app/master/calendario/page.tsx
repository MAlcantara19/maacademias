"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, dataHoraBR } from "@/lib/util";

const ICONE: Record<string, string> = { campeonato: "🥇", prova: "🎓", evento: "🎉", feriado: "🏖️", outro: "📅" };

// Calendário de todas as academias, qualquer mês (passado ou futuro)
export default function CalendarioMaster() {
  const sb = supabaseNavegador();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [lista, setLista] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const de = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
    const ate = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
    sb.rpc("calendario_master_periodo", { p_de: de, p_ate: ate }).then(({ data }) => setLista(data || []));
  }, [ano, mes]); // eslint-disable-line

  const mudar = (n: number) => { const d = new Date(ano, mes + n, 1); setAno(d.getFullYear()); setMes(d.getMonth()); };
  const academias = Array.from(new Set(lista.map((e) => e.academia)));
  const mostrados = lista.filter((e) => !filtro || e.academia === filtro);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-5 pb-16 pt-6">
      <Link href="/master" className="text-sm text-suave">← Painel master</Link>
      <h1 className="text-4xl font-extrabold">Calendário de todas as academias</h1>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-sec px-3" onClick={() => mudar(-1)} aria-label="Mês anterior">‹</button>
        <h2 className="min-w-44 text-center text-2xl font-bold">{MESES[mes]} {ano}</h2>
        <button className="btn-sec px-3" onClick={() => mudar(1)} aria-label="Próximo mês">›</button>
        <select className="campo ml-auto w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Academia">
          <option value="">Todas ({lista.length})</option>
          {academias.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <ul className="space-y-2">
        {mostrados.map((e, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-painel p-4">
            <div className="numero w-12 shrink-0 text-center">
              <p className="text-2xl font-bold">{new Date(e.inicio).toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" })}</p>
              <p className="text-xs text-suave">{new Date(e.inicio).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })}</p>
            </div>
            <div>
              <p className="font-semibold">{ICONE[e.tipo] || "📅"} {e.titulo}</p>
              <p className="text-sm text-suave"><Link className="underline" href={`/${e.slug}/app/calendario`}>{e.academia}</Link> · {dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
              {e.descricao && <p className="text-sm">{e.descricao}</p>}
            </div>
          </li>
        ))}
        {!mostrados.length && <p className="text-suave">Nenhum evento neste mês.</p>}
      </ul>
    </main>
  );
}
