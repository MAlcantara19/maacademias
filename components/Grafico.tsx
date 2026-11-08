// Gráfico de linha simples em SVG (peso, frequência...)
export function GraficoLinha({
  pontos, sufixo = "", cor = "var(--cor)",
}: { pontos: { rotulo: string; valor: number }[]; sufixo?: string; cor?: string }) {
  if (pontos.length < 2) return <p className="text-sm text-suave">Registre pelo menos dois valores para ver o gráfico.</p>;
  const L = 320, A = 140, m = 24;
  const vals = pontos.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals);
  const faixa = max - min || 1;
  const x = (i: number) => m + (i * (L - m * 2)) / (pontos.length - 1);
  const y = (v: number) => A - m - ((v - min) / faixa) * (A - m * 2);
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label="Gráfico">
      <path d={d} fill="none" stroke={cor} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.valor)} r="4" fill={cor} />
          <text x={x(i)} y={y(p.valor) - 9} textAnchor="middle" className="fill-texto" fontSize="10">
            {p.valor}{sufixo}
          </text>
          <text x={x(i)} y={A - 4} textAnchor="middle" className="fill-suave" fontSize="9">{p.rotulo}</text>
        </g>
      ))}
    </svg>
  );
}

export function Barra({ pct, cor = "var(--cor)" }: { pct: number | null; cor?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fundo">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct || 0)}%`, background: cor }} />
    </div>
  );
}
