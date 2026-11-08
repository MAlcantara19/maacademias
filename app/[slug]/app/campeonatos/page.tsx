"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/util";
import { Barra } from "@/components/Grafico";

export default function Campeonatos() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [lista, setLista] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: evs } = await sb.from("eventos").select("*").eq("academia_id", ctx.academia.id).eq("tipo", "campeonato").order("inicio", { ascending: false });
      const { data: ck } = await sb.from("checklist_campeonato").select("*").eq("academia_id", ctx.academia.id);
      const m = new Map((ck || []).map((c: any) => [c.evento_id, c]));
      setLista((evs || []).map((e: any) => ({ ...e, ck: m.get(e.id) })));
    })();
  }, []); // eslint-disable-line

  const agora = new Date().toISOString();
  const futuros = lista.filter((e) => e.inicio >= agora).reverse();
  const passados = lista.filter((e) => e.inicio < agora);

  const Item = ({ e }: { e: any }) => (
    <Link href={`${base}/campeonatos/${e.id}`} className="block rounded-2xl bg-painel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold">🥇 {e.titulo}</p>
          <p className="text-sm text-suave">{dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
        </div>
        {e.ck && <p className="numero shrink-0 text-2xl font-bold">{e.ck.prontos}/{e.ck.atletas}</p>}
      </div>
      {e.ck && e.inicio >= agora && <div className="mt-3"><Barra pct={e.ck.pct_prontos} cor="var(--color-ok)" /><p className="mt-1 text-xs text-suave">{e.ck.prontos} de {e.ck.atletas} atletas prontos</p></div>}
    </Link>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Campeonatos</h1>
      <p className="text-suave">Para criar um campeonato, use “Novo evento” no calendário com o tipo Campeonato.</p>
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Próximos</h2>
        {futuros.map((e) => <Item key={e.id} e={e} />)}
        {!futuros.length && <p className="text-suave">Nenhum campeonato marcado.</p>}
      </section>
      {passados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Já aconteceram</h2>
          {passados.map((e) => <Item key={e.id} e={e} />)}
        </section>
      )}
    </div>
  );
}
