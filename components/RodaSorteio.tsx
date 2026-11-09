"use client";
import { useState } from "react";

// Roleta genérica: recebe itens com rótulo e cor, gira e devolve o sorteado
export function RodaSorteio({ itens, onSorteio, grande = false }: { itens: { id: string; rotulo: string; cor: string }[]; onSorteio: (i: number) => void; grande?: boolean }) {
  const [giro, setGiro] = useState(0);
  const [girando, setGirando] = useState(false);
  const lista = itens.slice(0, 40);
  const R = 150, C = 160;
  const fatia = lista.length ? 360 / lista.length : 360;
  const ponto = (ang: number, r = R) => [C + r * Math.sin((ang * Math.PI) / 180), C - r * Math.cos((ang * Math.PI) / 180)];

  function girar() {
    if (!lista.length || girando) return;
    const i = Math.floor(Math.random() * lista.length);
    const alvo = 360 * 6 + (360 - (i * fatia + fatia / 2));
    setGirando(true);
    setGiro((g) => g - (g % 360) + alvo);
    setTimeout(() => { setGirando(false); onSorteio(i); }, 4200);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={grande ? "w-[min(70vh,92vw)]" : "w-full max-w-[340px]"}>
        <svg viewBox="0 0 320 320" className="w-full drop-shadow-2xl" role="img" aria-label="Roleta">
          <g style={{ transform: `rotate(${giro}deg)`, transformOrigin: "160px 160px", transition: girando ? "transform 4s cubic-bezier(.17,.67,.21,1)" : "none" }}>
            {lista.map((t, i) => {
              const a0 = i * fatia, a1 = (i + 1) * fatia;
              const [x0, y0] = ponto(a0), [x1, y1] = ponto(a1);
              const [tx, ty] = ponto(a0 + fatia / 2, R * 0.62);
              return (
                <g key={t.id}>
                  <path d={lista.length === 1 ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z` : `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${fatia > 180 ? 1 : 0} 1 ${x1} ${y1} Z`}
                    fill={t.cor} stroke="#0b0b12" strokeWidth="1.5" opacity={i % 2 ? 0.88 : 1} />
                  {lista.length <= 24 && (
                    <text x={tx} y={ty} fill={t.cor === "#facc15" ? "#000" : "#fff"} fontSize={lista.length > 14 ? 7 : 9} fontWeight="700"
                      textAnchor="middle" dominantBaseline="middle" transform={`rotate(${a0 + fatia / 2 - 90} ${tx} ${ty})`}>{t.rotulo.slice(0, 18)}</text>
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={C} cy={C} r="22" fill="#0b0b12" stroke="#fff" strokeWidth="3" />
          <polygon points={`${C - 12},4 ${C + 12},4 ${C},30`} fill="#fff" stroke="#0b0b12" strokeWidth="2" />
        </svg>
      </div>
      <button className={`btn px-10 py-4 ${grande ? "text-3xl" : "text-xl"}`} onClick={girar} disabled={girando || !lista.length}>{girando ? "Girando…" : "🎯 Girar"}</button>
      {itens.length > 40 && <p className="text-xs text-suave">Mostrando 40 de {itens.length}. Use os filtros para escolher o grupo.</p>}
    </div>
  );
}
