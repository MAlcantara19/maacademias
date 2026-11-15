"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR, primeiroNome } from "@/lib/util";

// Aluno inscrito: contagem regressiva do campeonato e o que falta para estar pronto
export function ContagemCampeonato({ alunos, base }: { alunos: { id: string; nome?: string; apelido?: string; eu?: boolean }[]; base: string }) {
  const sb = supabaseNavegador();
  const [l, setL] = useState<any[]>([]);
  useEffect(() => {
    const ids = alunos.map((a) => a.id);
    if (!ids.length) return;
    (async () => {
      const { data: ins } = await sb.from("inscricoes_evento")
        .select("id, membro_id, status, categoria_peso, peso_inscricao, eventos!inner(id, titulo, inicio, pesagem_em, local)")
        .in("membro_id", ids).neq("status", "recusada").gte("eventos.inicio", new Date().toISOString());
      const lista = (ins || []).sort((a: any, b: any) => a.eventos.inicio.localeCompare(b.eventos.inicio)).slice(0, 3);
      if (!lista.length) return setL([]);
      const [{ data: pend }, { data: pa }] = await Promise.all([
        sb.from("pendencias").select("membro_id, evento_id, tipo, titulo").in("membro_id", ids).neq("status", "resolvida").eq("visivel_aluno", true),
        sb.from("painel_alunos").select("membro_id, carteirinha_ok").in("membro_id", ids),
      ]);
      setL(lista.map((i: any) => ({
        ...i,
        pendencias: (pend || []).filter((p: any) => p.membro_id === i.membro_id && (p.evento_id === i.eventos.id || ["documento", "carteirinha", "peso"].includes(p.tipo))),
        carteirinha: (pa || []).find((p: any) => p.membro_id === i.membro_id)?.carteirinha_ok,
      })));
    })().catch(() => {});
  }, [alunos.map((a) => a.id).join()]); // eslint-disable-line

  if (!l.length) return null;
  return (
    <>
      {l.map((i) => {
        const al = alunos.find((a) => a.id === i.membro_id);
        const dias = Math.ceil((new Date(i.eventos.inicio).getTime() - Date.now()) / 86400000);
        const itens: [boolean, string][] = [
          [i.status === "confirmada", i.status === "confirmada" ? "Inscrição confirmada" : "Inscrição esperando o professor aprovar"],
          [!!i.eventos.pesagem_em, i.eventos.pesagem_em ? `Pesagem: ${dataHoraBR(i.eventos.pesagem_em)}` : "Horário da pesagem ainda não saiu"],
          [!!i.categoria_peso, i.categoria_peso ? `Categoria ${i.categoria_peso}${i.peso_inscricao ? ` · inscrito com ${Number(i.peso_inscricao)} kg` : ""}` : "Categoria de peso a definir"],
          [i.carteirinha !== false, i.carteirinha === false ? "Carteirinha da academia em falta" : "Carteirinha em dia"],
          [!i.pendencias.length, i.pendencias.length ? `${i.pendencias.length} pendência(s): ${i.pendencias.map((p: any) => p.titulo).join(", ")}` : "Sem pendências"],
        ];
        const prontos = itens.filter(([ok]) => ok).length;
        return (
          <section key={i.id} className="overflow-hidden rounded-2xl bg-painel">
            <div className="flex items-center gap-4 p-4 text-white" style={{ background: "linear-gradient(135deg, var(--cor), #111827)" }}>
              <div className="text-center">
                <p className="numero text-5xl font-extrabold leading-none">{dias <= 0 ? "🥇" : dias}</p>
                <p className="text-xs opacity-90">{dias === 1 ? "dia" : dias <= 0 ? "é hoje!" : "dias"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm opacity-90">{al && !al.eu ? `🧒 ${primeiroNome(al.apelido || al.nome)} · ` : ""}Campeonato</p>
                <p className="truncate text-2xl font-bold">{i.eventos.titulo}</p>
                <p className="text-sm opacity-90">{dataHoraBR(i.eventos.inicio)}{i.eventos.local ? ` · ${i.eventos.local}` : ""}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="mb-2 text-sm font-semibold">Pronto para lutar: {prontos} de {itens.length}</p>
              <ul className="space-y-1 text-sm">
                {itens.map(([ok, t]) => <li key={t}>{ok ? "✅" : "⚠️"} {t}</li>)}
                <li>📄 Levar documento com foto no dia</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={`${base}/campeonatos/${i.eventos.id}`} className="underline">Ver campeonato e cronograma</Link>
                {i.pendencias.length > 0 && <Link href={`${base}/pendencias`} className="underline">Resolver pendências</Link>}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
