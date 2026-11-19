"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { NOVIDADES } from "@/lib/novidades";

// 🆕 Novidades na tela inicial da equipe: aparece quando sai uma versão nova
// e some depois de lida (fica salvo no perfil, vale em todos os aparelhos).
export function AvisoNovidades({ perfilId, vistos }: { perfilId?: string; vistos?: string[] }) {
  const ultima = NOVIDADES[0];
  const id = `novidades:${ultima?.data}`;
  const recente = ultima && Date.now() - new Date(ultima.data + "T12:00:00").getTime() < 45 * 86400000;
  // quem acabou de chegar ainda vai ver o tour: não mostra novidade junto
  const [aberto, setAberto] = useState(!!perfilId && !!recente && (vistos || []).includes("inicio") && !(vistos || []).includes(id));
  if (!aberto) return null;

  async function lido() {
    setAberto(false);
    // guarda só as novidades mais recentes para a lista não crescer para sempre
    const outros = (vistos || []).filter((v) => !v.startsWith("novidades:"));
    await supabaseNavegador().from("perfis").update({ tours_vistos: [...outros, id] }).eq("id", perfilId!);
  }

  return (
    <section className="relative rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }} aria-label="Novidades do app">
      <button onClick={lido} className="absolute right-3 top-2 text-2xl leading-none text-suave" aria-label="Fechar novidades">×</button>
      <p className="text-sm font-semibold" style={{ color: "var(--cor)" }}>🆕 Novidades no app</p>
      <h2 className="pr-6 text-2xl font-bold">{ultima.titulo}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {ultima.itens.slice(0, 4).map((x) => <li key={x} className="flex gap-2"><span aria-hidden>✓</span><span>{x}</span></li>)}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn text-sm" onClick={lido}>Entendi 👍</button>
        <Link href="/novidades" className="btn-sec text-sm" onClick={lido}>Ver todas</Link>
      </div>
    </section>
  );
}
