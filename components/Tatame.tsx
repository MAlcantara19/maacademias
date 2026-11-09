"use client";
import { useEffect } from "react";

// Modo tatame: ocupa a tela inteira (para mostrar no celular ou projetar na aula)
export function Tatame({ ativo, onSair, children }: { ativo: boolean; onSair: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!ativo) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const sair = () => { if (!document.fullscreenElement) onSair(); };
    document.addEventListener("fullscreenchange", sair);
    return () => { document.removeEventListener("fullscreenchange", sair); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, [ativo]); // eslint-disable-line
  if (!ativo) return <>{children}</>;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 overflow-auto bg-fundo p-6">
      <button className="btn-sec absolute right-4 top-4" onClick={onSair}>✕ Sair da tela cheia</button>
      {children}
    </div>
  );
}
