"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Aluno/responsável: "👍 Ciente" no aviso (a equipe vê quem leu)
export function BotaoCiente({ avisoId, perfilId }: { avisoId: string; perfilId?: string | null }) {
  const sb = supabaseNavegador();
  const [lido, setLido] = useState<boolean | null>(null);
  useEffect(() => {
    if (!perfilId) return;
    sb.from("avisos_lidos").select("aviso_id").eq("aviso_id", avisoId).eq("perfil_id", perfilId).maybeSingle()
      .then(({ data, error }: any) => setLido(error ? null : !!data), () => setLido(null));
  }, [avisoId, perfilId]); // eslint-disable-line
  if (!perfilId || lido === null) return null;
  async function alternar() {
    const novo = !lido; setLido(novo);
    if (novo) await sb.from("avisos_lidos").insert({ aviso_id: avisoId, perfil_id: perfilId });
    else await sb.from("avisos_lidos").delete().eq("aviso_id", avisoId).eq("perfil_id", perfilId);
  }
  return (
    <button onClick={alternar} className={`mt-1 rounded-full border px-3 py-0.5 text-xs ${lido ? "font-semibold text-white" : "border-linha text-suave"}`}
      style={lido ? { background: "var(--color-ok)", borderColor: "var(--color-ok)" } : {}}>
      {lido ? "✓ Ciente" : "👍 Ciente"}
    </button>
  );
}

// Equipe: quantos deram ciente e quem falta
export function LeituraAviso({ avisoId }: { avisoId: string }) {
  const [l, setL] = useState<any[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    supabaseNavegador().rpc("leitura_aviso", { p_aviso: avisoId }).then(({ data, error }: any) => setL(error ? null : data || []), () => setL(null));
  }, [avisoId]);
  if (!l || !l.length) return null;
  const leram = l.filter((x) => x.leu);
  const faltam = l.filter((x) => !x.leu);
  return (
    <div className="mt-1 text-xs">
      <button className="text-suave underline" onClick={() => setAberto(!aberto)}>👍 {leram.length} de {l.length} deram ciente</button>
      {aberto && (
        <div className="mt-1 space-y-1 rounded-xl bg-painel2 p-2">
          {leram.length > 0 && <p><b>Leram:</b> {leram.map((x) => x.nome).join(", ")}</p>}
          {faltam.length > 0 && <p className="text-suave"><b>Ainda não:</b> {faltam.map((x) => x.nome).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
