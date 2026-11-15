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
        .select("id, membro_id, status, classe, categoria_peso, peso_inscricao, eventos!inner(id, titulo, inicio, pesagem_em, local)")
        .in("membro_id", ids).neq("status", "recusada").gte("eventos.inicio", new Date().toISOString());
      const lista = (ins || []).sort((a: any, b: any) => a.eventos.inicio.localeCompare(b.eventos.inicio)).slice(0, 3);
      if (!lista.length) return setL([]);
      const [{ data: pend }, { data: pa }] = await Promise.all([
        sb.from("pendencias").select("membro_id, evento_id, tipo, titulo").in("membro_id", ids).neq("status", "resolvida").eq("visivel_aluno", true),
        sb.from("painel_alunos").select("membro_id, carteirinha_ok").in("membro_id", ids),
      ]);
      // no dia (ou na véspera): cronograma da categoria e quem da academia vai junto
      const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const amanha = new Date(Date.now() + 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const diaDe = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      const perto = Array.from(new Set(lista.filter((i: any) => [hoje, amanha].includes(diaDe(i.eventos.inicio))).map((i: any) => i.eventos.id))) as string[];
      const extras: Record<string, any> = {};
      for (const ev of perto) {
        const [{ data: cr }, { data: eq }] = await Promise.all([
          sb.from("cronograma_evento").select("tipo, titulo, classe, sexo, categorias, inicio, local").eq("evento_id", ev).order("inicio"),
          sb.rpc("equipe_no_campeonato", { p_evento: ev }),
        ]);
        extras[ev] = { cronograma: cr || [], equipe: eq || [] };
      }
      setL(lista.map((i: any) => ({
        hoje: diaDe(i.eventos.inicio) === hoje, amanha: diaDe(i.eventos.inicio) === amanha,
        meuCrono: (extras[i.eventos.id]?.cronograma || []).filter((c: any) => (!c.classe || c.classe === i.classe) && (!c.categorias?.length || c.categorias.includes(i.categoria_peso))),
        equipe: (extras[i.eventos.id]?.equipe || []).filter((x: any) => x.membro_id !== i.membro_id),
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
            {(i.hoje || i.amanha) && (
              <div className="space-y-3 border-b border-linha p-4">
                <p className="text-lg font-extrabold">{i.hoje ? "🔥 É hoje! Seu dia:" : "🌙 É amanhã! Seu cronograma:"}</p>
                {i.meuCrono.length > 0 ? (
                  <ul className="space-y-1.5">
                    {i.meuCrono.map((c: any, k: number) => (
                      <li key={k} className="flex items-center gap-3 rounded-xl bg-painel2 p-2">
                        <span className="numero text-xl font-bold">{new Date(c.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                        <span className="min-w-0 text-sm"><b>{{ pesagem: "⚖️ Pesagem", luta: "🥋 Lutas", premiacao: "🏅 Premiação", apresentacao: "🎤 Apresentação" }[c.tipo as string] || c.titulo || "Programação"}</b>
                          {c.titulo && c.tipo !== "outro" ? ` · ${c.titulo}` : ""}{c.local ? <span className="block text-xs text-suave">📍 {c.local}</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-suave">O professor ainda não colocou o horário da sua categoria. Fique de olho no cronograma.</p>}
                {i.equipe.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-semibold">🤝 Quem está com você ({i.equipe.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {i.equipe.slice(0, 16).map((x: any) => (
                        <span key={x.membro_id} className="flex items-center gap-1.5 rounded-full bg-painel2 py-1 pl-1 pr-3 text-xs">
                          {x.foto_url ? <img src={x.foto_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="flex h-6 w-6 items-center justify-center">🥋</span>}
                          {x.nome}{x.categoria ? <span className="text-suave"> · {x.categoria}</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
