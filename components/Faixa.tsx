"use client";
import { corProxima, useEstiloFaixa, type Estilo } from "@/lib/estiloFaixa";

// A faixa com os graus. O jeito de mostrar os graus segue a academia:
// jiu-jitsu = ponteira preta com graus brancos; judô = graus na própria faixa
// (brancos ou na cor da próxima faixa), sem ponteira.
export function Faixa({
  cor = "var(--cor)", graus = 0, altura = 10, className = "", estilo,
}: { cor?: string | null; graus?: number | null; altura?: number; className?: string; estilo?: Estilo }) {
  const ctx = useEstiloFaixa();
  const modo = estilo || ctx.estilo;
  const n = Math.max(0, Math.min(10, graus || 0));
  const fundo = cor || "var(--cor)";
  const preta = (cor || "").toLowerCase() === "#111111";

  if (modo === "barra") {
    const corPonteira = preta ? "#c81e1e" : "#0a0a0a"; // faixa preta tem ponteira vermelha
    return (
      <div className={`flex w-full overflow-hidden rounded-sm ${className}`} style={{ height: altura }} aria-hidden>
        <div className="flex-1" style={{ background: fundo }} />
        <div className="flex items-stretch gap-[3px] px-[5px]" style={{ background: corPonteira, width: `${Math.max(18, 10 + n * 7)}%` }}>
          {Array.from({ length: n }).map((_, i) => <span key={i} className="block w-[3px] bg-white/90" />)}
        </div>
        <div className="w-[6%]" style={{ background: fundo }} />
      </div>
    );
  }

  // judô: listras finas direto na faixa, perto da ponta (faixa preta fica lisa)
  const corGrau = modo === "colorido" ? corProxima(cor, ctx.cores) : "#ffffff";
  return (
    <div className={`relative w-full overflow-hidden rounded-sm ${className}`} style={{ height: altura, background: fundo }} aria-hidden>
      {!preta && n > 0 && (
        <div className="absolute inset-y-0 right-[8%] flex items-stretch gap-[3px]">
          {Array.from({ length: n }).map((_, i) => (
            <span key={i} className="block w-[4px]" style={{ background: corGrau, boxShadow: "0 0 0 1px rgba(0,0,0,.35)" }} />
          ))}
        </div>
      )}
    </div>
  );
}
