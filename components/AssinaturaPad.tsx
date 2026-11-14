"use client";
import { useEffect, useRef, useState } from "react";

// Quadro para assinar com o dedo (celular) ou o mouse. Devolve a imagem PNG.
export function AssinaturaPad({ onChange }: { onChange: (png: Blob | null) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const c = tela.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * 2; c.height = r.height * 2;
      const g = c.getContext("2d")!;
      g.scale(2, 2); g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#111";
    };
    ajustar();
  }, []);

  const ponto = (e: React.PointerEvent) => { const r = tela.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function inicio(e: React.PointerEvent) {
    e.preventDefault(); desenhando.current = true;
    tela.current!.setPointerCapture(e.pointerId);
    const g = tela.current!.getContext("2d")!; const [x, y] = ponto(e); g.beginPath(); g.moveTo(x, y);
  }
  function mover(e: React.PointerEvent) {
    if (!desenhando.current) return;
    const g = tela.current!.getContext("2d")!; const [x, y] = ponto(e); g.lineTo(x, y); g.stroke();
    if (vazio) setVazio(false);
  }
  function fim() {
    if (!desenhando.current) return;
    desenhando.current = false;
    tela.current!.toBlob((b) => onChange(b), "image/png");
  }
  function limpar() {
    const c = tela.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setVazio(true); onChange(null);
  }

  return (
    <div className="space-y-1">
      <canvas ref={tela} className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-linha bg-white"
        onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerLeave={fim} aria-label="Área para assinar" />
      <div className="flex items-center justify-between text-xs text-suave">
        <span>{vazio ? "Assine com o dedo ou o mouse" : "Assinatura feita"}</span>
        <button type="button" className="underline" onClick={limpar}>limpar</button>
      </div>
    </div>
  );
}
