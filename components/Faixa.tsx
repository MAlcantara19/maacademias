// A faixa: barra na cor da graduação com a ponteira preta e os graus.
// É o elemento visual que se repete no app inteiro.
export function Faixa({
  cor = "var(--cor)", graus = 0, altura = 10, className = "",
}: { cor?: string | null; graus?: number | null; altura?: number; className?: string }) {
  const corPonteira = cor === "#111111" ? "#c81e1e" : "#0a0a0a"; // faixa preta tem ponteira vermelha
  return (
    <div className={`flex w-full overflow-hidden rounded-sm ${className}`} style={{ height: altura }} aria-hidden>
      <div className="flex-1" style={{ background: cor || "var(--cor)" }} />
      <div className="flex items-stretch gap-[3px] px-[5px]" style={{ background: corPonteira, width: `${Math.max(18, 10 + (graus || 0) * 7)}%` }}>
        {Array.from({ length: graus || 0 }).map((_, i) => (
          <span key={i} className="block w-[3px] bg-white/90" />
        ))}
      </div>
      <div className="w-[6%]" style={{ background: cor || "var(--cor)" }} />
    </div>
  );
}
