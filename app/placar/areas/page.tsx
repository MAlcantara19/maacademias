"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { PlacarTelao, NOME, type Estado } from "@/components/PlacarTelao";

// Modo competição: duas áreas ao vivo, lado a lado (festival interno, campeonato da academia)
function Area({ sala, n }: { sala: string; n: number }) {
  const [e, setE] = useState<Estado | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!sala) return;
    const sb = supabaseNavegador();
    const ch = sb.channel(`placar-${sala}`, { config: { broadcast: { self: false }, presence: { key: `tela-${Math.random().toString(36).slice(2, 8)}` } } });
    ch.on("broadcast", { event: "estado" }, ({ payload }: any) => setE(payload))
      .subscribe((st: string) => { if (st === "SUBSCRIBED") { setOk(true); ch.track({ papel: "tela" }); ch.send({ type: "broadcast", event: "pedir", payload: {} }); } });
    return () => { ch.unsubscribe(); };
  }, [sala]);
  return (
    <section className="space-y-2">
      <p className="text-center text-2xl font-extrabold tracking-widest text-white">ÁREA {n} <span className="text-sm font-normal text-white/60">· sala {sala}</span></p>
      {e ? (
        <>
          <PlacarTelao e={e} />
          {e.fim && (
            <p className="rounded-xl p-3 text-center text-2xl font-extrabold" style={{ background: e.fim.lado === "azul" ? "#1d4ed8" : e.fim.lado === "branco" ? "#f8fafc" : "#334155", color: e.fim.lado === "branco" ? "#0f172a" : "#fff" }}>
              🏆 {e.fim.lado ? `${e[e.fim.lado].nome || NOME[e.fim.lado]} venceu` : "Empate"} · {e.fim.motivo}
            </p>
          )}
        </>
      ) : <p className="rounded-2xl bg-white/5 p-10 text-center text-white/70">{ok ? "Esperando o mesário…" : "Conectando…"}</p>}
    </section>
  );
}

function Areas() {
  const p = useSearchParams();
  const a = (p.get("a") || "").replace(/\D/g, ""), b = (p.get("b") || "").replace(/\D/g, "");
  useEffect(() => { (navigator as any).wakeLock?.request?.("screen").catch(() => {}); }, []);
  return (
    <main className="min-h-dvh bg-black p-3 sm:p-5" onDoubleClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Area sala={a} n={1} />
        <Area sala={b} n={2} />
      </div>
      <p className="mt-4 text-center text-xs text-white/40">Toque duas vezes para tela cheia</p>
    </main>
  );
}
export default function Pagina() { return <Suspense><Areas /></Suspense>; }
