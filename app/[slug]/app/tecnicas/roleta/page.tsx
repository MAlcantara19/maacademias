"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CLASSIFICACOES, corConjunto, nomeGrupo } from "@/lib/tecnicas";

// Roleta de técnicas para treinar: gira e sorteia uma técnica
export default function Roleta() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [mods, setMods] = useState<any[]>([]);
  const [modId, setModId] = useState("");
  const [todas, setTodas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<{ tipo: string; valor: string }>({ tipo: "", valor: "" });
  const [giro, setGiro] = useState(0);
  const [girando, setGirando] = useState(false);
  const [sorteada, setSorteada] = useState<any>(null);

  useEffect(() => {
    sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem")
      .then(({ data }) => { setMods(data || []); if (data?.[0]) setModId(data[0].id); });
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!modId) return;
    sb.from("tecnicas").select("*").eq("modalidade_id", modId).not("grupo", "in", "(taiso,ukemi,kata)").order("ordem")
      .then(({ data }) => setTodas(data || []));
  }, [modId]); // eslint-disable-line

  const conjuntos = Array.from(new Set(todas.map((t) => t.conjunto).filter(Boolean)));
  const classes = Array.from(new Set(todas.map((t) => t.classificacao).filter(Boolean)));
  const faixas = Array.from(new Set(todas.map((t) => t.faixa).filter(Boolean)));
  const lista = useMemo(() => todas.filter((t) =>
    !filtro.tipo || (filtro.tipo === "conjunto" ? t.conjunto === filtro.valor : filtro.tipo === "classe" ? t.classificacao === filtro.valor : t.faixa === filtro.valor)
  ).slice(0, 40), [todas, filtro]);

  function girar() {
    if (!lista.length || girando) return;
    const i = Math.floor(Math.random() * lista.length);
    const fatia = 360 / lista.length;
    // várias voltas e para com a fatia sorteada embaixo do ponteiro (no topo)
    const alvo = 360 * 6 + (360 - (i * fatia + fatia / 2));
    setSorteada(null); setGirando(true);
    setGiro((g) => g - (g % 360) + alvo);
    setTimeout(() => { setGirando(false); setSorteada(lista[i]); }, 4200);
  }

  const R = 150, C = 160;
  const fatia = lista.length ? 360 / lista.length : 360;
  const ponto = (ang: number, r = R) => [C + r * Math.sin((ang * Math.PI) / 180), C - r * Math.cos((ang * Math.PI) / 180)];

  const Chip = ({ tipo, valor, rotulo, cor }: any) => {
    const on = filtro.tipo === tipo && filtro.valor === valor;
    return (
      <button className="chip text-xs" onClick={() => setFiltro(on ? { tipo: "", valor: "" } : { tipo, valor })}
        style={on ? { background: cor || "var(--cor)", borderColor: cor || "var(--cor)", color: cor === "#facc15" ? "#000" : undefined } : { borderColor: cor }}>
        {rotulo}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-extrabold">Roleta de técnicas</h1>
        <Link href={`/${ctx.academia.slug}/app/tecnicas`} className="btn-sec text-sm">← Técnicas</Link>
      </div>
      {mods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {mods.map((m) => (
            <button key={m.id} className="chip py-2" onClick={() => setModId(m.id)} style={m.id === modId ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{m.nome}</button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {conjuntos.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Grupo:</span>{conjuntos.map((c) => <Chip key={c} tipo="conjunto" valor={c} rotulo={c} cor={corConjunto(c)} />)}</div>}
        {classes.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Tipo:</span>{classes.map((c) => <Chip key={c} tipo="classe" valor={c} rotulo={(CLASSIFICACOES[c] || c).split(" (")[0]} />)}</div>}
        {faixas.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Faixa:</span>{faixas.map((f) => <Chip key={f} tipo="faixa" valor={f} rotulo={f} />)}</div>}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full max-w-[340px]">
          <svg viewBox="0 0 320 320" className="w-full drop-shadow-2xl" role="img" aria-label="Roleta de técnicas">
            <g style={{ transform: `rotate(${giro}deg)`, transformOrigin: "160px 160px", transition: girando ? "transform 4s cubic-bezier(.17,.67,.21,1)" : "none" }}>
              {lista.map((t, i) => {
                const a0 = i * fatia, a1 = (i + 1) * fatia;
                const [x0, y0] = ponto(a0), [x1, y1] = ponto(a1);
                const cor = corConjunto(t.conjunto);
                const [tx, ty] = ponto(a0 + fatia / 2, R * 0.62);
                return (
                  <g key={t.id}>
                    <path
                      d={lista.length === 1 ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z` : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${fatia > 180 ? 1 : 0} 1 ${x1} ${y1} Z`}
                      fill={cor} stroke="#0b0b12" strokeWidth="1.5" opacity={i % 2 ? 0.88 : 1}
                    />
                    {lista.length <= 24 && (
                      <text x={tx} y={ty} fill={cor === "#facc15" ? "#000" : "#fff"} fontSize={lista.length > 14 ? 7 : 9} fontWeight="700"
                        textAnchor="middle" dominantBaseline="middle" transform={`rotate(${a0 + fatia / 2 - 90} ${tx} ${ty})`}>
                        {(t.nome_original || t.nome).slice(0, 18)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
            <circle cx={C} cy={C} r="22" fill="#0b0b12" stroke="#fff" strokeWidth="3" />
            <polygon points={`${C - 12},4 ${C + 12},4 ${C},30`} fill="#fff" stroke="#0b0b12" strokeWidth="2" />
          </svg>
        </div>
        <button className="btn px-10 py-4 text-xl" onClick={girar} disabled={girando || !lista.length}>{girando ? "Girando…" : "🎯 Girar"}</button>
        <p className="text-sm text-suave">{lista.length} técnica(s) na roleta</p>

        {sorteada && (
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-painel text-center shadow-2xl" style={{ borderTop: `8px solid ${corConjunto(sorteada.conjunto)}` }}>
            {sorteada.imagem_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sorteada.imagem_url} alt="" className="max-h-56 w-full object-cover" />
            )}
            <div className="space-y-1 p-5">
              <p className="text-4xl font-extrabold">{sorteada.nome_original || sorteada.nome}</p>
              {sorteada.nome_original && <p className="text-suave">{sorteada.nome}</p>}
              <p className="text-sm text-suave">
                {[sorteada.conjunto, CLASSIFICACOES[sorteada.classificacao] || nomeGrupo(sorteada.grupo), sorteada.faixa && `faixa ${sorteada.faixa.toLowerCase()}`].filter(Boolean).join(" · ")}
              </p>
              {sorteada.video_url && <a href={sorteada.video_url} target="_blank" className="btn-sec mt-2 text-sm">▶️ Ver vídeo</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
