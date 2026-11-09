"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, dinheiro, hojeISO } from "@/lib/util";
import { Barra } from "@/components/Grafico";

// Relatório do mês para o dono: alunos, frequência, financeiro e funil
export default function Relatorio() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const acad = ctx.academia.id;
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setD(null);
      const [a, m] = mes.split("-").map(Number);
      const ini = `${mes}-01`;
      const fim = new Date(a, m, 0).toISOString().slice(0, 10);
      const fimHoje = fim > hojeISO() ? hojeISO() : fim;
      const [membros, freq, ranking, idades, cob, exp, turmas, aus] = await Promise.all([
        sb.from("membros").select("id, ativo, entrou_em, saiu_em, motivo_saida, perfis(nome)").eq("academia_id", acad).eq("papel", "aluno"),
        sb.from("frequencia_aulas").select("turma_id, membro_id, presente, justificada").eq("academia_id", acad).gte("data", ini).lte("data", fim),
        sb.rpc("ranking_periodo", { p_acad: acad, p_de: ini, p_ate: fimHoje }),
        sb.rpc("estatisticas_frequencia", { p_acad: acad, p_de: ini, p_ate: fimHoje }),
        sb.from("cobrancas").select("status, valor, valor_pago, vencimento, forma").eq("academia_id", acad).eq("competencia", ini),
        sb.from("aulas_experimentais").select("status").eq("academia_id", acad).gte("criado_em", ini).lte("criado_em", fim + "T23:59:59"),
        sb.from("turmas").select("id, nome").eq("academia_id", acad),
        sb.from("ausencias").select("status, membros!membro_id!inner(academia_id)").eq("membros.academia_id", acad).gte("de", ini).lte("de", fim),
      ]);
      const ms = membros.data || [];
      const novos = ms.filter((x: any) => x.entrou_em >= ini && x.entrou_em <= fim);
      const saidas = ms.filter((x: any) => x.saiu_em && x.saiu_em >= ini && x.saiu_em <= fim);
      const ativosFim = ms.filter((x: any) => x.entrou_em <= fim && (!x.saiu_em || x.saiu_em > fim)).length;

      const porTurma = (turmas.data || []).map((t: any) => {
        const l = (freq.data || []).filter((f: any) => f.turma_id === t.id);
        const poss = l.filter((f: any) => f.presente || !f.justificada).length;
        const pres = l.filter((f: any) => f.presente).length;
        return { nome: t.nome, poss, pres, pct: poss ? Math.round((100 * pres) / poss) : null, alunos: new Set(l.map((f: any) => f.membro_id)).size };
      }).filter((t: any) => t.poss > 0).sort((x: any, y: any) => (y.pct ?? 0) - (x.pct ?? 0));

      const c = cob.data || [];
      const hoje = hojeISO();
      const fin = {
        previsto: c.filter((x: any) => x.status !== "isenta" && x.status !== "cancelada").reduce((s: number, x: any) => s + Number(x.valor), 0),
        recebido: c.filter((x: any) => x.status === "paga").reduce((s: number, x: any) => s + Number(x.valor_pago || x.valor), 0),
        atrasado: c.filter((x: any) => x.status === "aberta" && x.vencimento < hoje).reduce((s: number, x: any) => s + Number(x.valor), 0),
        porForma: ["pix", "cartao", "dinheiro", "outro"].map((f) => ({ f, v: c.filter((x: any) => x.status === "paga" && x.forma === f).reduce((s: number, x: any) => s + Number(x.valor_pago || x.valor), 0) })),
      };
      const ex = exp.data || [];
      setD({
        novos, saidas, ativosFim, porTurma, fin,
        top: (ranking.data || []).filter((r: any) => r.aulas_possiveis >= 4).slice(0, 5),
        idades: idades.data || [],
        exp: { total: ex.length, matriculou: ex.filter((x: any) => x.status === "matriculou").length },
        aus: { just: (aus.data || []).filter((x: any) => x.status === "justificada").length, nao: (aus.data || []).filter((x: any) => x.status === "nao_justificada").length },
      });
    })();
  }, [mes]); // eslint-disable-line

  const [a, m] = mes.split("-").map(Number);
  const formaNome: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", outro: "Outro" };

  return (
    <div className="space-y-5">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Relatório do mês</h1>
        <div className="flex gap-2">
          <input type="month" className="campo w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
          <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>

      <header className="imprimir-claro">
        <h2 className="text-3xl font-extrabold">{ctx.academia.nome}</h2>
        <p className="text-suave">Relatório de {MESES[m - 1]} de {a}</p>
      </header>

      {!d ? <p className="text-suave">Montando o relatório…</p> : (
        <>
          <section className="imprimir-claro grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[d.ativosFim, "alunos ativos"], [d.novos.length, "entraram"], [d.saidas.length, "saíram"], [`${d.exp.matriculou}/${d.exp.total}`, "experimentais → alunos"]].map(([v, r]) => (
              <div key={r as string} className="rounded-2xl bg-painel p-4"><p className="numero text-4xl font-bold">{v}</p><p className="text-sm text-suave">{r}</p></div>
            ))}
          </section>

          {ctx.academia.tipo !== "projeto_social" && ctx.academia.modulos?.mensalidades !== false && (
          <section className="imprimir-claro rounded-2xl bg-painel p-4">
            <h3 className="mb-3 text-2xl font-bold">Financeiro</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="numero text-2xl font-bold">{dinheiro(d.fin.previsto)}</p><p className="text-sm text-suave">previsto</p></div>
              <div><p className="numero text-2xl font-bold text-ok">{dinheiro(d.fin.recebido)}</p><p className="text-sm text-suave">recebido</p></div>
              <div><p className="numero text-2xl font-bold text-erro">{dinheiro(d.fin.atrasado)}</p><p className="text-sm text-suave">atrasado</p></div>
            </div>
            <div className="mt-3"><Barra pct={d.fin.previsto ? (100 * d.fin.recebido) / d.fin.previsto : 0} cor="var(--color-ok)" /></div>
            <p className="mt-2 text-sm text-suave">{d.fin.porForma.filter((x: any) => x.v).map((x: any) => `${formaNome[x.f]}: ${dinheiro(x.v)}`).join(" · ") || "Nenhum pagamento registrado."}</p>
          </section>
          )}

          <section className="imprimir-claro rounded-2xl bg-painel p-4">
            <h3 className="mb-3 text-2xl font-bold">Frequência por turma</h3>
            <ul className="space-y-2">
              {d.porTurma.map((t: any) => (
                <li key={t.nome}>
                  <div className="flex justify-between text-sm"><span>{t.nome} <span className="text-suave">({t.alunos} alunos)</span></span><span className="numero font-bold">{t.pct ?? "—"}%</span></div>
                  <Barra pct={t.pct} />
                </li>
              ))}
              {!d.porTurma.length && <p className="text-suave">Sem chamadas neste mês.</p>}
            </ul>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="imprimir-claro rounded-2xl bg-painel p-4">
              <h3 className="mb-3 text-2xl font-bold">Mais assíduos</h3>
              <ol className="space-y-1">
                {d.top.map((r: any) => <li key={r.membro_id} className="flex justify-between"><span>{r.posicao_percentual}º {r.apelido || r.nome}</span><span className="numero">{r.pct}%</span></li>)}
                {!d.top.length && <p className="text-suave">Ainda sem dados suficientes.</p>}
              </ol>
            </section>
            <section className="imprimir-claro rounded-2xl bg-painel p-4">
              <h3 className="mb-3 text-2xl font-bold">Presença por idade</h3>
              <ul className="space-y-1">
                {d.idades.map((x: any) => <li key={x.faixa_etaria} className="flex justify-between"><span>{x.faixa_etaria} <span className="text-suave">({x.alunos})</span></span><span className="numero">{x.pct_presenca ?? "—"}%</span></li>)}
              </ul>
              <p className="mt-2 text-xs text-suave">Ausências avisadas no mês: {d.aus.just} justificadas, {d.aus.nao} não justificadas.</p>
            </section>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="imprimir-claro rounded-2xl bg-painel p-4">
              <h3 className="mb-2 text-2xl font-bold">Entraram</h3>
              {d.novos.map((x: any) => <p key={x.id} className="text-sm">{x.perfis?.nome}</p>)}
              {!d.novos.length && <p className="text-sm text-suave">Ninguém.</p>}
            </section>
            <section className="imprimir-claro rounded-2xl bg-painel p-4">
              <h3 className="mb-2 text-2xl font-bold">Saíram</h3>
              {d.saidas.map((x: any) => <p key={x.id} className="text-sm">{x.perfis?.nome}{x.motivo_saida ? <span className="text-suave"> — {x.motivo_saida}</span> : null}</p>)}
              {!d.saidas.length && <p className="text-sm text-suave">Ninguém. 🎉</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
