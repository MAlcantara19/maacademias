"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import type { Ctx } from "@/lib/contexto";

// Contrato/termos da academia: o aluno (ou o responsável) aceita no app.
// Se a academia mudar o texto, pede o aceite de novo.
export function Contrato({ ctx }: { ctx: Ctx }) {
  const sb = supabaseNavegador();
  const [faltam, setFaltam] = useState<any[]>([]);
  const [li, setLi] = useState(false);
  const a = ctx.academia;

  useEffect(() => {
    if (ctx.equipe || ctx.vendoComo || !a.contrato_texto || !a.contrato_versao || !ctx.perfil?.boas_vindas_em || !ctx.meusAlunos.length) return;
    (async () => {
      const { data: ms } = await sb.from("membros").select("id, perfil_id, perfis(nome)").in("id", ctx.meusAlunos.map((m) => m.id));
      const { data: aceites } = await sb.from("consentimentos").select("perfil_id").eq("academia_id", a.id).eq("tipo", "contrato")
        .eq("versao_termo", a.contrato_versao).is("revogado_em", null);
      const ok = new Set((aceites || []).map((x: any) => x.perfil_id));
      setFaltam((ms || []).filter((m: any) => !ok.has(m.perfil_id)));
    })();
  }, []); // eslint-disable-line

  async function aceitar() {
    await sb.from("consentimentos").insert(faltam.map((m: any) => ({
      perfil_id: m.perfil_id, academia_id: a.id, tipo: "contrato", versao_termo: a.contrato_versao,
      aceito_por: ctx.perfil?.nome || "", e_responsavel: m.perfil_id !== ctx.perfil?.id,
    })));
    setFaltam([]);
  }

  if (!faltam.length) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-3xl bg-painel p-6 shadow-2xl">
        <h2 className="text-3xl font-extrabold">Termos da {a.nome}</h2>
        <p className="text-sm text-suave">
          {faltam.length > 1 || faltam[0]?.perfil_id !== ctx.perfil?.id ? `Aceite como responsável por: ${faltam.map((m: any) => m.perfis?.nome).join(", ")}` : "Leia e aceite para continuar."}
        </p>
        <div className="mt-3 flex-1 overflow-y-auto whitespace-pre-line rounded-xl bg-fundo p-4 text-sm leading-relaxed">{a.contrato_texto}</div>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={li} onChange={(e) => setLi(e.target.checked)} /> Li e aceito os termos acima.</label>
        <button className="btn mt-3 w-full" disabled={!li} onClick={aceitar}>Aceitar</button>
        <p className="mt-2 text-center text-xs text-suave">Versão de {a.contrato_versao?.slice(0, 10).split("-").reverse().join("/")}</p>
      </div>
    </div>
  );
}
