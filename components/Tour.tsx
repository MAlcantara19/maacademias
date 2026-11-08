"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Tour guiado: aparece só na primeira vez em cada tela e fica salvo no perfil.
export function Tour({ id, passos, perfilId, vistos }: {
  id: string; passos: { titulo: string; texto: string }[]; perfilId?: string; vistos?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (perfilId && !(vistos || []).includes(id)) setAberto(true);
  }, [id, perfilId, vistos]);

  async function fechar() {
    setAberto(false);
    if (!perfilId) return;
    await supabaseNavegador()
      .from("perfis")
      .update({ tours_vistos: Array.from(new Set([...(vistos || []), id])) })
      .eq("id", perfilId);
  }

  if (!aberto) return null;
  const p = passos[i];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-2xl border border-linha bg-painel p-5 shadow-2xl">
        <div className="mb-3 flex gap-1.5">
          {passos.map((_, k) => (
            <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k <= i ? "var(--cor)" : "var(--color-linha)" }} />
          ))}
        </div>
        <h2 className="text-2xl font-bold">{p.titulo}</h2>
        <p className="mt-2 text-suave">{p.texto}</p>
        <div className="mt-5 flex justify-between gap-2">
          <button className="text-sm text-suave underline" onClick={fechar}>Pular tour</button>
          {i < passos.length - 1 ? (
            <button className="btn" onClick={() => setI(i + 1)}>Próximo</button>
          ) : (
            <button className="btn" onClick={fechar}>Entendi</button>
          )}
        </div>
      </div>
    </div>
  );
}
