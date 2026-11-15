"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/util";
import { AtivarPush } from "@/components/AtivarPush";
import { destinoNotificacao as destino } from "@/lib/linkNotificacao";
import { PreferenciasAvisos } from "@/components/PreferenciasAvisos";

export default function Notificacoes() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const router = useRouter();
  const base = `/${ctx.academia.slug}/app`;
  const [lista, setLista] = useState<any[]>([]);

  async function carregar() {
    const { data } = await sb.from("notificacoes").select("*").order("criada_em", { ascending: false }).limit(60);
    setLista(data || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  async function todasLidas() {
    await sb.from("notificacoes").update({ lida: true }).eq("lida", false);
    carregar(); router.refresh();
  }
  async function abrir(n: any) {
    if (!n.lida) await sb.from("notificacoes").update({ lida: true }).eq("id", n.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Notificações</h1>
        {lista.some((n) => !n.lida) && <button className="btn-sec text-sm" onClick={todasLidas}>Marcar todas como lidas</button>}
      </div>
      {ctx.vendoComo && (
        <p className="rounded-xl bg-alerta/15 p-3 text-sm text-alerta">
          No modo “ver como aluno”, esta lista mostra as SUAS notificações. Cada aluno só vê as dele.
        </p>
      )}
      <AtivarPush perfilId={ctx.perfil?.id} />
      {!ctx.vendoComo && <PreferenciasAvisos perfilId={ctx.perfil?.id} equipe={ctx.equipe} />}
      <ul className="space-y-2">
        {lista.map((n) => (
          <li key={n.id}>
            <Link href={destino(base, n.link)} onClick={() => abrir(n)}
              className={`block rounded-2xl p-4 ${n.lida ? "bg-painel/60 text-suave" : "bg-painel"}`}
              style={!n.lida ? { borderLeft: "4px solid var(--cor)" } : {}}>
              <p className="font-semibold">{n.titulo}</p>
              {n.texto && <p className="text-sm">{n.texto}</p>}
              <p className="mt-1 text-xs text-suave">{dataHoraBR(n.criada_em)}</p>
            </Link>
            {Array.isArray(n.acoes) && n.acoes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2 pl-4">
                {n.acoes.map((a: any) => <Link key={a.link} href={destino(base, a.link)} className="btn-sec px-3 py-1 text-xs">{a.titulo}</Link>)}
              </div>
            )}
          </li>
        ))}
        {!lista.length && <p className="text-suave">Sem notificações por enquanto.</p>}
      </ul>
    </div>
  );
}
