"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { addDias, hojeISO, primeiroNome } from "@/lib/util";

// Meta de treinos da semana (ex.: 2 por semana) com barra de progresso
export function segundaDaSemana(d = hojeISO()) {
  const dow = new Date(d + "T12:00:00").getDay();
  return addDias(d, -((dow + 6) % 7));
}

export function MetaSemana({ ids, nomes = {}, editavel = false, compacto = false }: { ids: string[]; nomes?: Record<string, string>; editavel?: boolean; compacto?: boolean }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [d, setD] = useState<Record<string, { feitos: number; meta: number; sequencia: number }>>({});
  const padrao = ctx.academia.meta_semanal_padrao || 2;

  async function carregar() {
    if (!ids.length) return;
    const seg = segundaDaSemana();
    const desde = addDias(seg, -7 * 7);
    const [{ data: ms }, { data: pr }] = await Promise.all([
      sb.from("membros").select("id, meta_semanal").in("id", ids),
      sb.from("presencas").select("membro_id, aulas!inner(data)").in("membro_id", ids).gte("aulas.data", desde),
    ]);
    const r: Record<string, any> = {};
    for (const id of ids) {
      const meta = (ms || []).find((m: any) => m.id === id)?.meta_semanal || padrao;
      const datas = (pr || []).filter((p: any) => p.membro_id === id).map((p: any) => p.aulas?.data as string);
      const naSemana = (s: string) => datas.filter((x) => x >= s && x < addDias(s, 7)).length;
      // semanas seguidas batendo a meta (sem contar a atual, que ainda não acabou)
      let seq = 0;
      for (let k = 1; k <= 7; k++) { if (naSemana(addDias(seg, -7 * k)) >= meta) seq++; else break; }
      r[id] = { feitos: naSemana(seg), meta, sequencia: seq + (naSemana(seg) >= meta ? 1 : 0) };
    }
    setD(r);
  }
  useEffect(() => { carregar(); }, [ids.join(",")]); // eslint-disable-line

  async function mudarMeta(id: string, v: number) {
    await sb.rpc("definir_meta", { p_membro: id, p_meta: v });
    carregar();
  }

  if (!ids.length || !Object.keys(d).length) return null;
  return (
    <div className={compacto ? "space-y-2" : "space-y-2 rounded-2xl bg-painel p-4"}>
      {!compacto && <p className="font-bold">🎯 Meta da semana</p>}
      {ids.map((id) => {
        const x = d[id]; if (!x) return null;
        const pct = Math.min(100, Math.round((x.feitos / x.meta) * 100));
        return (
          <div key={id} className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{nomes[id] ? <b>{primeiroNome(nomes[id])}: </b> : null}{x.feitos} de {x.meta} treino(s) {x.feitos >= x.meta ? "✅ meta batida!" : `· faltam ${x.meta - x.feitos}`}</span>
              <span className="flex items-center gap-2 text-xs text-suave">
                {x.sequencia >= 2 && <span title="Semanas seguidas batendo a meta">🔥 {x.sequencia} semanas</span>}
                {editavel && (
                  <select className="campo w-auto py-1 text-xs" value={x.meta} onChange={(e) => mudarMeta(id, Number(e.target.value))} aria-label="Meta por semana">
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}x/semana</option>)}
                  </select>
                )}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-painel2">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: x.feitos >= x.meta ? "var(--color-ok)" : "var(--cor)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
