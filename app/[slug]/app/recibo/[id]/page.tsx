"use client";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, dataBR, dinheiro } from "@/lib/util";

const FORMAS: Record<string, string> = { pix: "Pix", cartao: "cartão", dinheiro: "dinheiro", outro: "outro meio" };

// Recibo para imprimir ou salvar em PDF
export default function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [c, setC] = useState<any>(null);

  useEffect(() => {
    sb.from("cobrancas").select("*, membros!membro_id(perfis(nome))").eq("id", id).maybeSingle().then(({ data }) => setC(data || false));
  }, [id]); // eslint-disable-line

  if (c === false) return <p className="text-suave">Recibo não encontrado.</p>;
  if (!c) return <p className="text-suave">Carregando…</p>;
  if (c.status !== "paga") return <p className="text-suave">Esta mensalidade ainda não foi paga.</p>;

  const a = ctx.academia;
  const mes = `${MESES[Number(c.competencia.slice(5, 7)) - 1]}/${c.competencia.slice(0, 4)}`;

  return (
    <div className="space-y-4">
      <div className="nao-imprimir flex gap-2">
        <button className="btn" onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button className="btn-sec" onClick={() => history.back()}>Voltar</button>
      </div>
      <article className="imprimir-claro mx-auto max-w-xl rounded-2xl border border-linha bg-white p-8 text-black">
        <div className="flex items-start justify-between gap-4 border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold">{a.nome}</h1>
            <p className="text-sm text-gray-600">{[a.endereco, a.cidade].filter(Boolean).join(" · ")}</p>
            {a.cnpj && <p className="text-sm text-gray-600">CNPJ {a.cnpj}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">RECIBO</p>
            <p className="numero text-2xl font-bold">nº {String(c.recibo_numero).padStart(5, "0")}</p>
          </div>
        </div>
        <p className="mt-6 text-lg leading-relaxed">
          Recebemos de <b>{c.membros?.perfis?.nome}</b> a quantia de <b>{dinheiro(c.valor_pago || c.valor)}</b>,
          referente à mensalidade de <b>{mes}</b>, paga em <b>{dataBR(c.pago_em)}</b> por <b>{FORMAS[c.forma] || c.forma}</b>.
        </p>
        <div className="mt-14 border-t border-gray-400 pt-2 text-center text-sm text-gray-600">{a.nome}</div>
        <p className="mt-6 text-center text-xs text-gray-500">Recibo gerado pelo app da academia.</p>
      </article>
    </div>
  );
}
