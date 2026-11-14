"use client";
import { useEffect, useRef, useState } from "react";
import { ColarImagem } from "@/components/ColarImagem";

// Recorte da foto antes de salvar: arrasta para posicionar, zoom e girar.
// formato = largura/altura (1 = quadrada; 0.75 = 3x4 da carteirinha)
export function RecortarFoto({ arquivo, formato = 1, transparente = false, onPronto, onCancelar }: {
  arquivo: File; formato?: number; transparente?: boolean; onPronto: (f: File) => void; onCancelar: () => void;
}) {
  const [url, setUrl] = useState("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const quadro = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [tam, setTam] = useState({ w: 280, h: 280 });
  const original = useRef<HTMLImageElement | null>(null);
  const [fundo, setFundo] = useState<{ cor: string | null; carregando: boolean; erro?: string } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(arquivo); setUrl(u);
    const i = new Image(); i.onload = () => { setImg(i); original.current = i; }; i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  useEffect(() => {
    const medir = () => { const r = quadro.current?.getBoundingClientRect(); if (r) setTam({ w: r.width, h: r.height }); };
    medir(); window.addEventListener("resize", medir); return () => window.removeEventListener("resize", medir);
  }, [img]);

  // tamanho da imagem já girada
  const deitada = giro % 180 !== 0;
  const iw = img ? (deitada ? img.height : img.width) : 1, ih = img ? (deitada ? img.width : img.height) : 1;
  const base = Math.max(tam.w / iw, tam.h / ih);
  const escala = base * zoom;
  const limX = Math.max(0, (iw * escala - tam.w) / 2), limY = Math.max(0, (ih * escala - tam.h) / 2);
  const px = Math.max(-limX, Math.min(limX, pos.x)), py = Math.max(-limY, Math.min(limY, pos.y));

  // 🪄 tira o fundo da foto (pessoa) e põe uma cor lisa
  async function tirarFundo(cor: string | null) {
    if (!original.current) return;
    if (cor === "original") { setUrl(original.current.src); setImg(original.current); setFundo(null); return; }
    setFundo({ cor, carregando: true });
    try {
      const { removerFundo } = await import("@/lib/removerFundo");
      const c = await removerFundo(original.current, cor);
      const u = c.toDataURL(cor ? "image/jpeg" : "image/png", 0.92);
      const i = new Image(); i.onload = () => { setImg(i); setUrl(u); setFundo({ cor, carregando: false }); }; i.src = u;
    } catch (e: any) {
      setFundo({ cor, carregando: false, erro: "Não deu para tirar o fundo neste aparelho" + (e?.message ? ` (${e.message})` : "") + "." });
    }
  }

  function pronto() {
    if (!img) return;
    const W = formato >= 1 ? 800 : Math.round(800 * formato), H = Math.round(W / formato);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    const k = W / tam.w; // quadro na tela → canvas
    if (!transparente) { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
    g.translate(W / 2 + px * k, H / 2 + py * k);
    g.rotate((giro * Math.PI) / 180);
    const s = escala * k;
    g.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    const tipo = transparente ? "image/png" : "image/jpeg";
    c.toBlob((b) => b && onPronto(new File([b], `foto-${Date.now()}.${transparente ? "png" : "jpg"}`, { type: tipo })), tipo, 0.88);
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onCancelar}>
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-painel p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-bold">✂️ Ajustar a foto</p>
        <p className="text-xs text-suave">Arraste para posicionar e use o zoom. Só a parte dentro do quadro é salva.</p>
        <div ref={quadro} className={`relative mx-auto touch-none select-none overflow-hidden rounded-2xl ${transparente ? "bg-[repeating-conic-gradient(#ccc_0_25%,#fff_0_50%)] bg-[length:16px_16px]" : "bg-black"}`}
          style={{ width: formato >= 1 ? "min(80vw, 300px)" : "min(60vw, 225px)", aspectRatio: String(formato), cursor: "grab" }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); arrasto.current = { x: e.clientX, y: e.clientY, px, py }; }}
          onPointerMove={(e) => { const a = arrasto.current; if (a) setPos({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y }); }}
          onPointerUp={() => { arrasto.current = null; }}
          onWheel={(e) => setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.002)))}>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{ width: (img?.width || 0) * escala, height: (img?.height || 0) * escala, transform: `translate(-50%, -50%) translate(${px}px, ${py}px) rotate(${giro}deg)` }} />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-white/70" />
        </div>
        {!transparente && (
          <div className="space-y-1 rounded-xl bg-painel2 p-2 text-sm">
            <p className="font-semibold">🪄 Tirar o fundo da foto</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[["#ffffff", "Branco"], ["#e5e7eb", "Cinza"], ["#dbeafe", "Azul"], ["var", "Cor da academia"]].map(([c, r]) => {
                const cor = c === "var" ? (quadro.current ? getComputedStyle(quadro.current).getPropertyValue("--cor").trim() : "") || "#7c3aed" : c;
                const hex = /^#[0-9a-f]{6}$/i.test(cor) ? cor : "#7c3aed";
                return (
                  <button key={r} type="button" title={r} disabled={fundo?.carregando} onClick={() => tirarFundo(hex)}
                    className="h-8 w-8 rounded-full border-2" style={{ background: hex, borderColor: fundo?.cor === hex ? "var(--cor)" : "#0003" }} />
                );
              })}
              {fundo && !fundo.carregando && <button type="button" className="chip text-xs" onClick={() => tirarFundo("original")}>↩︎ Original</button>}
            </div>
            {fundo?.carregando && <p className="text-xs text-suave">Tirando o fundo… (na primeira vez demora um pouco)</p>}
            {fundo?.erro && <p className="text-xs text-alerta">{fundo.erro}</p>}
          </div>
        )}
        <label className="flex items-center gap-3 text-sm">🔍 <input type="range" min={1} max={4} step={0.01} value={zoom} className="flex-1" onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn flex-1" onClick={pronto} disabled={!img}>✓ Usar esta foto</button>
          <button type="button" className="btn-sec" onClick={() => { setGiro((g) => (g + 90) % 360); setPos({ x: 0, y: 0 }); }}>↻ Girar</button>
          <button type="button" className="btn-sec" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Escolher foto (arquivo, colar ou arrastar) + recorte antes de usar
export function SeletorFoto({ onPronto, formato = 1, transparente = false, rotulo = "📁 Escolher foto", className = "btn-sec text-sm" }: {
  onPronto: (f: File) => void; formato?: number; transparente?: boolean; rotulo?: string; className?: string;
}) {
  const [arq, setArq] = useState<File | null>(null);
  const [sobre, setSobre] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-xl p-1"
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/")); if (f) setArq(f); }}
      style={sobre ? { outline: "3px dashed var(--cor)" } : undefined}>
      <label className={`${className} cursor-pointer`}>{rotulo}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setArq(f); }} />
      </label>
      <ColarImagem onImagem={setArq} />
      <span className="hidden self-center text-xs text-suave sm:inline">ou arraste a foto aqui</span>
      {arq && <RecortarFoto arquivo={arq} formato={formato} transparente={transparente} onCancelar={() => setArq(null)} onPronto={(f) => { setArq(null); onPronto(f); }} />}
    </div>
  );
}
