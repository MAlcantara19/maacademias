import { Faixa } from "./Faixa";

// Foto com moldura na cor da faixa e os graus na ponteira logo abaixo.
// Sem foto, mostra o bonequinho padrão.
export function Avatar({
  foto, nome, cor, grau, tamanho = 48, mostrarFaixa = true,
}: { foto?: string | null; nome?: string | null; cor?: string | null; grau?: number | null; tamanho?: number; mostrarFaixa?: boolean }) {
  const borda = cor || "#4b5a8c";
  return (
    <div className="inline-flex shrink-0 flex-col items-center gap-1" style={{ width: tamanho }}>
      <div
        className="overflow-hidden rounded-full bg-painel2"
        style={{ width: tamanho, height: tamanho, boxShadow: `0 0 0 3px ${borda}` }}
        title={nome || ""}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={nome || "Foto"} className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 48 48" className="h-full w-full text-suave" aria-label="Sem foto">
            <circle cx="24" cy="18" r="9" fill="currentColor" opacity=".55" />
            <path d="M6 46c2-10 9-15 18-15s16 5 18 15" fill="currentColor" opacity=".55" />
          </svg>
        )}
      </div>
      {mostrarFaixa && cor && <Faixa cor={cor} graus={grau || 0} altura={Math.max(5, tamanho / 9)} className="w-[90%]" />}
    </div>
  );
}
