"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { VERSAO_TERMOS } from "@/lib/termos";

// Pede o aceite dos Termos e da Privacidade (uma vez por versão) e guarda o registro
export function AceiteTermos() {
  const sb = supabaseNavegador();
  const [mostrar, setMostrar] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("aceites_plataforma").select("documento").eq("user_id", user.id).eq("versao", VERSAO_TERMOS);
      const docs = new Set((data || []).map((d: any) => d.documento));
      if (!docs.has("termos") || !docs.has("privacidade")) setMostrar(true);
    })();
  }, []); // eslint-disable-line

  async function aceitar() {
    const nav = navigator.userAgent.slice(0, 150);
    await sb.from("aceites_plataforma").upsert([
      { documento: "termos", versao: VERSAO_TERMOS, navegador: nav },
      { documento: "privacidade", versao: VERSAO_TERMOS, navegador: nav },
    ], { onConflict: "user_id,documento,versao" });
    setMostrar(false);
  }

  if (!mostrar) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-painel p-6 shadow-2xl">
        <h2 className="text-3xl font-extrabold">Antes de continuar</h2>
        <p className="text-suave">Para usar o app, leia e aceite os documentos abaixo. Eles explicam as regras de uso e como seus dados são protegidos.</p>
        <div className="flex flex-col gap-2">
          <a href="/termos" target="_blank" className="btn-sec">📄 Termos de Uso</a>
          <a href="/privacidade" target="_blank" className="btn-sec">🔒 Política de Privacidade</a>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>Li e concordo com os Termos de Uso e a Política de Privacidade (versão {VERSAO_TERMOS}).</span>
        </label>
        <button className="btn w-full" disabled={!ok} onClick={aceitar}>Aceitar e continuar</button>
      </div>
    </div>
  );
}
