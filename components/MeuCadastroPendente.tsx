"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { primeiroNome } from "@/lib/util";

// Para o aluno ou responsável: mostra o que ainda falta no cadastro (dele e dos filhos)
export function MeuCadastroPendente() {
  const ctx = useCtx();
  const [lista, setLista] = useState<{ id: string; nome: string; itens: string[] }[]>([]);
  useEffect(() => {
    const sb = supabaseNavegador();
    Promise.all(ctx.meusAlunos.map(async (a: any) => {
      const { data } = await sb.rpc("status_cadastro", { p_membro: a.id });
      return data && !data.completo ? { id: a.id, nome: a.apelido || a.nome || "", itens: data.pendencias as string[] } : null;
    })).then((r) => setLista(r.filter(Boolean) as any));
  }, [ctx.meusAlunos]);
  if (!lista.length) return null;
  const base = `/${ctx.academia.slug}/app`;
  return (
    <section className="space-y-2 rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--color-alerta) 16%, transparent)" }}>
      <h2 className="text-xl font-bold">📋 Falta completar o cadastro</h2>
      {lista.map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel p-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{lista.length > 1 || x.id !== ctx.membroId ? primeiroNome(x.nome) : "Você"} · {x.itens.length} item(ns)</p>
            <p className="text-sm text-suave">{x.itens.slice(0, 4).join(", ")}{x.itens.length > 4 ? "…" : ""}</p>
          </div>
          <Link href={`${base}/alunos/${x.id}/cadastro`} className="btn text-sm">Completar</Link>
        </div>
      ))}
    </section>
  );
}
