"use client";
import { useRef, useState } from "react";

// Botão "Colar imagem": usa a imagem que está copiada (ex.: foto de perfil do
// WhatsApp Web → botão direito → Copiar imagem). Sem precisar salvar o arquivo.
// Se o navegador não deixar ler direto, abre um quadrinho para colar (Ctrl+V ou
// segurar o dedo → Colar).
function paraArquivo(b: Blob) {
  const ext = (b.type.split("/")[1] || "png").replace("jpeg", "jpg");
  return new File([b], `colada-${Date.now()}.${ext}`, { type: b.type || "image/png" });
}

export function ColarImagem({ onImagem, rotulo = "📋 Colar imagem", className = "btn-sec text-sm" }: {
  onImagem: (f: File) => void; rotulo?: string; className?: string;
}) {
  const [caixa, setCaixa] = useState(false);
  const [msg, setMsg] = useState("");
  const [sobre, setSobre] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  function usar(b: Blob) {
    onImagem(paraArquivo(b));
    setCaixa(false);
    setMsg("✓ Imagem colada");
    setTimeout(() => setMsg(""), 2500);
  }

  async function colar() {
    setMsg("");
    try {
      const itens = await (navigator.clipboard as any)?.read?.();
      for (const it of itens || []) {
        const tipo = it.types.find((t: string) => t.startsWith("image/"));
        if (tipo) return usar(await it.getType(tipo));
      }
      if (itens) setMsg("Não achei imagem copiada. Copie a foto e tente de novo.");
    } catch { /* sem permissão: usa o quadrinho */ }
    setCaixa(true);
    setTimeout(() => area.current?.focus(), 50);
  }

  function aoColar(e: React.ClipboardEvent) {
    e.preventDefault();
    const arq = Array.from(e.clipboardData.files || []).find((f) => f.type.startsWith("image/"))
      || Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (arq) usar(arq);
    else setMsg("O que foi colado não é uma imagem.");
  }

  // arrastar e soltar (computador): arraste a foto de outra janela até o botão
  function aoSoltar(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setSobre(false);
    const arq = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith("image/"));
    if (arq) usar(arq); else setMsg("Solte um arquivo de imagem.");
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={className} onClick={colar} title="Cole uma imagem copiada ou arraste uma foto até aqui"
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={aoSoltar}
        style={sobre ? { outline: "3px dashed var(--cor)", outlineOffset: 2 } : undefined}>{sobre ? "⬇️ Solte aqui" : rotulo}</button>
      {caixa && (
        <div ref={area} contentEditable suppressContentEditableWarning onPaste={aoColar} onDragOver={(e) => e.preventDefault()} onDrop={aoSoltar} onInput={(e) => { (e.target as HTMLDivElement).innerHTML = ""; }}
          className="min-h-14 rounded-xl border-2 border-dashed border-linha p-2 text-center text-xs text-suave outline-none focus:border-[var(--cor)]"
          aria-label="Cole a imagem aqui">
          Toque e segure aqui → <b>Colar</b> (no computador: Ctrl+V)
        </div>
      )}
      {msg && <span className="text-xs text-suave">{msg}</span>}
    </span>
  );
}
