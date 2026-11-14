"use client";
import { useEffect, useState } from "react";
import { falar, generoSalvo, salvarGenero, vozesDisponiveis, type Genero } from "@/lib/fala";

// Botão 🔊 que fala o termo em japonês
export function BotaoFalar({ texto, kana, grande = false }: { texto: string; kana?: string | null; grande?: boolean }) {
  return (
    <span role="button" tabIndex={0} aria-label={`Ouvir a pronúncia de ${texto}`}
      onClick={(e) => { e.stopPropagation(); falar(texto, kana); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); falar(texto, kana); } }}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-painel2 ${grande ? "h-14 w-14 text-2xl" : "h-8 w-8 text-sm"}`}>🔊</span>
  );
}

// Escolha da voz: feminina ou masculina
export function EscolhaVoz() {
  const [g, setG] = useState<Genero>("feminina");
  const [info, setInfo] = useState({ total: 0, masculina: false, feminina: false });
  useEffect(() => {
    setG(generoSalvo());
    const atualizar = () => setInfo(vozesDisponiveis());
    atualizar();
    window.speechSynthesis?.addEventListener?.("voiceschanged", atualizar);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", atualizar);
  }, []);
  const muda = (x: Genero) => { setG(x); salvarGenero(x); falar("Hajime", null, x); };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-suave">🔊 Voz:</span>
      {(["feminina", "masculina", "grave"] as Genero[]).map((x) => (
        <button key={x} className="chip text-xs" onClick={() => muda(x)} style={g === x ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{x === "feminina" ? "👩 Feminina" : x === "masculina" ? "👨 Masculina" : "🎙️ Grave (árbitro)"}</button>
      ))}
      {info.total === 0 && <span className="text-xs text-alerta">Sem voz em japonês neste aparelho. No Android: Configurações → Idioma → Saída de texto para fala → instale “Japonês”.</span>}
      {info.total > 0 && g !== "feminina" && !info.masculina && <span className="text-xs text-suave">(sem voz masculina instalada: usando tom mais grave)</span>}
    </div>
  );
}
