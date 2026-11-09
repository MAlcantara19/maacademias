"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR } from "@/lib/util";

const PERIODOS: [string, number][] = [["3 meses", 90], ["6 meses", 180], ["1 ano", 365], ["Tudo", 99999]];

// Peso: antes × depois, estatísticas do período e a linha da categoria
export function ComparaPeso({ medidas, membroId }: { medidas: any[]; membroId: string }) {
  const [dias, setDias] = useState(180);
  const [cat, setCat] = useState<any>(null);

  useEffect(() => {
    supabaseNavegador().from("atletas_categoria").select("classe, categoria_peso, peso_kg").eq("membro_id", membroId).limit(1)
      .then(async ({ data }) => {
        const a = data?.[0];
        if (!a?.categoria_peso) return;
        const { data: k } = await supabaseNavegador().from("categorias_peso").select("limite_kg").eq("nome", a.categoria_peso).not("limite_kg", "is", null).limit(1);
        setCat({ ...a, limite: k?.[0]?.limite_kg ? Number(k[0].limite_kg) : null });
      });
  }, [membroId]);

  const lista = useMemo(() => {
    const corte = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    return medidas.filter((m) => m.data >= corte).map((m) => ({ data: m.data, v: Number(m.peso_kg) }));
  }, [medidas, dias]);

  if (!medidas.length) return <p className="text-sm text-suave">Nenhum peso registrado ainda.</p>;
  const ini = lista[0], fim = lista[lista.length - 1];
  const dif = ini && fim ? Math.round((fim.v - ini.v) * 10) / 10 : 0;
  const pct = ini && fim && ini.v ? Math.round(((fim.v - ini.v) / ini.v) * 1000) / 10 : 0;
  const vals = lista.map((x) => x.v);
  const min = vals.length ? Math.min(...vals) : 0, max = vals.length ? Math.max(...vals) : 0;
  const media = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;

  // gráfico
  const L = 320, A = 150, mg = 26;
  const ref = cat?.limite ? [...vals, cat.limite] : vals;
  const lo = Math.min(...ref) - 1, hi = Math.max(...ref) + 1;
  const x = (i: number) => mg + (lista.length > 1 ? (i * (L - mg * 2)) / (lista.length - 1) : (L - mg * 2) / 2);
  const y = (v: number) => A - mg - ((v - lo) / (hi - lo || 1)) * (A - mg * 2);
  const caminho = lista.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {PERIODOS.map(([r, d]) => (
          <button key={r} className="chip text-xs" onClick={() => setDias(d)} style={dias === d ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{r}</button>
        ))}
      </div>
      {lista.length >= 2 ? (
        <>
          <div className="grid grid-cols-3 items-center gap-2 text-center">
            <div className="rounded-xl bg-painel2 p-2"><p className="text-xs text-suave">Antes · {dataBR(ini.data).slice(0, 5)}</p><p className="numero text-2xl font-bold">{ini.v} kg</p></div>
            <div><p className={`numero text-2xl font-bold ${dif > 0 ? "text-alerta" : dif < 0 ? "text-ok" : ""}`}>{dif > 0 ? "+" : ""}{dif} kg</p><p className="text-xs text-suave">{pct > 0 ? "+" : ""}{pct}%</p></div>
            <div className="rounded-xl bg-painel2 p-2"><p className="text-xs text-suave">Agora · {dataBR(fim.data).slice(0, 5)}</p><p className="numero text-2xl font-bold">{fim.v} kg</p></div>
          </div>
          <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label="Gráfico de peso">
            {cat?.limite && (
              <g>
                <line x1={mg} x2={L - mg} y1={y(cat.limite)} y2={y(cat.limite)} stroke="var(--color-erro)" strokeDasharray="5 4" />
                <text x={L - mg} y={y(cat.limite) - 4} textAnchor="end" fontSize="9" className="fill-erro">limite {cat.categoria_peso}</text>
              </g>
            )}
            <path d={caminho} fill="none" stroke="var(--cor)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {lista.map((p, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.v)} r="3.5" fill="var(--cor)" />
                {(i === 0 || i === lista.length - 1 || lista.length <= 8) && <text x={x(i)} y={y(p.v) - 8} textAnchor="middle" fontSize="9" className="fill-texto">{p.v}</text>}
              </g>
            ))}
          </svg>
          <p className="text-xs text-suave">
            No período: menor {min} kg · maior {max} kg · média {media} kg · {lista.length} pesagens
            {cat?.limite && fim ? ` · ${fim.v <= cat.limite ? `${Math.round((cat.limite - fim.v) * 10) / 10} kg abaixo do limite da ${cat.categoria_peso}` : `${Math.round((fim.v - cat.limite) * 10) / 10} kg ACIMA do limite da ${cat.categoria_peso}`}` : ""}
          </p>
        </>
      ) : <p className="text-sm text-suave">Poucos registros neste período para comparar.</p>}
    </div>
  );
}
