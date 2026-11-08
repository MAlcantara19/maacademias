"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/util";

// Converte os links das notificações para as telas do app
function destino(base: string, link?: string) {
  if (!link) return base;
  if (link.startsWith("/eventos/")) return `${base}/campeonatos/${link.split("/")[2]}`;
  if (link.startsWith("/alunos/")) return `${base}${link}`;
  const mapa: Record<string, string> = {
    "/avisos": base, "/mensalidades": `${base}/meu`, "/materiais": base, "/aniversarios": `${base}/calendario`,
    "/alunos": `${base}/alunos`, "/experimentais": `${base}/experimentais`, "/pendencias": `${base}/pendencias`,
  };
  return mapa[link] || (link.startsWith("/pendencias") ? `${base}/pendencias` : base);
}

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
          </li>
        ))}
        {!lista.length && <p className="text-suave">Sem notificações por enquanto.</p>}
      </ul>
    </div>
  );
}
