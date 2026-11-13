"use client";
import { use, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { PlacarTelao, TelaVitoria, type Estado } from "@/components/PlacarTelao";

// Tela do placar (tablet/TV): recebe em tempo real o que o árbitro marca no celular
export default function TelaPlacar({ params }: { params: Promise<{ sala: string }> }) {
  const { sala } = use(params);
  const [e, setE] = useState<Estado | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const sb = supabaseNavegador();
    const ch = sb.channel(`placar-${sala}`, { config: { broadcast: { self: false }, presence: { key: `tela-${Math.random().toString(36).slice(2, 8)}` } } });
    ch.on("broadcast", { event: "estado" }, ({ payload }: any) => setE(payload))
      .subscribe((st: string) => {
        if (st === "SUBSCRIBED") {
          setConectado(true);
          ch.track({ papel: "tela" });
          ch.send({ type: "broadcast", event: "pedir", payload: {} }); // pede o placar atual
        }
      });
    // deixa a tela sempre acesa (quando o navegador permite)
    (navigator as any).wakeLock?.request?.("screen").catch(() => {});
    return () => { ch.unsubscribe(); };
  }, [sala]);

  async function telaCheia() { await document.documentElement.requestFullscreen?.().catch(() => {}); }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black p-4" onDoubleClick={telaCheia}>
      {e ? (
        <div className="w-full max-w-[1600px]"><PlacarTelao e={e} grande /></div>
      ) : (
        <div className="space-y-3 text-center text-white">
          <p className="text-3xl font-bold">Placar · sala {sala}</p>
          <p className="text-white/70">{conectado ? "Conectado. Esperando o árbitro…" : "Conectando…"}</p>
        </div>
      )}
      {e && <TelaVitoria e={e} />}
      <button onClick={telaCheia} className="fixed bottom-3 right-3 rounded-lg bg-white/10 px-3 py-1 text-xs text-white/70">⛶ Tela cheia</button>
    </main>
  );
}
