"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { primeiroNome, whatsapp } from "@/lib/util";

// Abriu vaga numa turma com lista de espera: mostra o próximo da fila com a mensagem pronta
export function VagasComFila() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [l, setL] = useState<any[]>([]);
  async function carregar() {
    const { data: v } = await sb.from("turmas_vagas").select("turma_id, vagas, ocupadas, na_espera, lotada").eq("academia_id", ctx.academia.id).gt("na_espera", 0);
    const livres = (v || []).filter((x: any) => !x.lotada);
    if (!livres.length) return setL([]);
    const [{ data: t }, { data: f }] = await Promise.all([
      sb.from("turmas").select("id, nome").in("id", livres.map((x: any) => x.turma_id)),
      sb.from("lista_espera").select("*").in("turma_id", livres.map((x: any) => x.turma_id)).eq("status", "aguardando").order("criado_em"),
    ]);
    setL(livres.map((x: any) => ({ ...x, nome: (t || []).find((y: any) => y.id === x.turma_id)?.nome, proximo: (f || []).find((y: any) => y.turma_id === x.turma_id) })).filter((x: any) => x.proximo));
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  if (!l.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border-2 p-4" style={{ borderColor: "var(--color-ok)" }}>
      <h2 className="text-xl font-bold">🎟️ Abriu vaga — chame o próximo da fila</h2>
      {l.map((x) => {
        const vagas = x.vagas == null ? "vaga" : `${x.vagas - x.ocupadas} vaga(s)`;
        const w = whatsapp(x.proximo.telefone, `Oi, ${primeiroNome(x.proximo.nome)}! Aqui é da ${ctx.academia.nome}. Abriu ${x.vagas == null ? "uma vaga" : vagas} na turma ${x.nome}, e você é o(a) próximo(a) da lista de espera! 🥋 Ainda tem interesse? Para garantir, faça a matrícula por aqui: ${location.origin}/${ctx.academia.slug}/cadastro`);
        return (
          <div key={x.turma_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel p-3 text-sm">
            <span><b>{x.nome}</b> · {vagas} · fila: {x.na_espera}<span className="block">Próximo: <b>{x.proximo.nome}</b></span></span>
            <span className="flex flex-wrap gap-2">
              {w && <a className="btn px-3 py-1.5 text-xs" target="_blank" href={w} onClick={async () => { await sb.from("lista_espera").update({ status: "chamado", chamado_em: new Date().toISOString() }).eq("id", x.proximo.id); setTimeout(carregar, 800); }}>📲 Chamar no WhatsApp</a>}
              <Link className="btn-sec px-3 py-1.5 text-xs" href={`/${ctx.academia.slug}/app/gestao`}>Ver fila</Link>
            </span>
          </div>
        );
      })}
    </section>
  );
}
