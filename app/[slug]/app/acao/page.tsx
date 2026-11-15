"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DESCRICAO_ACAO, executarAcao } from "@/lib/acoes";

// Abre quando a pessoa toca no botão da notificação (ou no app, no iPhone)
function Acao() {
  const ctx = useCtx();
  const p = useSearchParams();
  const base = `/${ctx.academia.slug}/app`;
  const [r, setR] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const feito = useRef(false);
  async function fazer() {
    setOcupado(true);
    setR(await executarAcao(supabaseNavegador(), new URLSearchParams(p.toString())));
    setOcupado(false);
  }
  useEffect(() => { if (p.get("auto") === "1" && !feito.current) { feito.current = true; fazer(); } }, []); // eslint-disable-line
  const tipo = p.get("tipo") || "";
  return (
    <div className="mx-auto max-w-md space-y-4 pt-6 text-center">
      <h1 className="text-3xl font-extrabold">{tipo === "vieram" ? "✅ Marcar quem confirmou" : tipo === "nao-vou" ? "🙋 Não vou hoje" : "Ação"}</h1>
      {!r && <p className="text-suave">{DESCRICAO_ACAO[tipo] || ""}</p>}
      {!r && <button className="btn w-full" disabled={ocupado} onClick={fazer}>{ocupado ? "Aguarde…" : "Confirmar"}</button>}
      {r && <p className={`rounded-2xl p-4 text-lg ${r.ok ? "bg-painel" : "bg-alerta/15 text-alerta"}`}>{r.texto}</p>}
      <div className="flex justify-center gap-3 text-sm">
        {tipo === "vieram" && p.get("horario") && <Link className="btn-sec" href={`${base}/chamada?horario=${p.get("horario")}`}>Abrir a chamada</Link>}
        <Link className="btn-sec" href={base}>Início</Link>
      </div>
    </div>
  );
}
export default function Pagina() { return <Suspense><Acao /></Suspense>; }
