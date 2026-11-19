"use client";
import { useEffect, useState } from "react";

// Mostrada no app das academias enquanto o master roda uma atualização grande.
// Confere sozinha a cada 30 segundos e volta quando a manutenção termina.
export function TelaManutencao({ ate, texto, nome, cor }: { ate?: string | null; texto?: string | null; nome?: string; cor?: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15000);
    const r = setInterval(() => location.reload(), 30000);
    return () => { clearInterval(t); clearInterval(r); };
  }, []);
  const falta = ate ? Math.ceil((new Date(ate).getTime() - agora) / 60000) : null;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6" style={{ ["--cor" as any]: cor || "#7c3aed" }}>
      <div className="max-w-md space-y-4 text-center">
        <p className="text-6xl" aria-hidden>🛠️</p>
        <h1 className="text-4xl font-extrabold">Estamos melhorando o app</h1>
        <p className="text-xl">
          {falta == null ? "Voltamos em alguns minutos." : falta > 1 ? `Voltamos em ${falta} minutos.` : "Está quase acabando, só mais um instante."}
        </p>
        {texto && <p className="text-suave">{texto}</p>}
        <p className="text-sm text-suave">{nome ? `O app da ${nome}` : "O app"} abre sozinho quando terminar. Seus dados estão seguros.</p>
        <button className="btn" onClick={() => location.reload()}>Tentar de novo</button>
      </div>
    </main>
  );
}
