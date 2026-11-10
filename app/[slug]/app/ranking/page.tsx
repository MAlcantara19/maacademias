"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { FAIXAS_ETARIAS, MESES, hojeISO, addDias } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Barra } from "@/components/Grafico";

const PERIODOS: Record<string, () => [string, string]> = {
  "Este mês": () => { const h = hojeISO(); return [h.slice(0, 8) + "01", h]; },
  "Mês passado": () => {
    const d = new Date(hojeISO() + "T12:00:00"); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const ini = d.toISOString().slice(0, 10); d.setMonth(d.getMonth() + 1); d.setDate(0);
    return [ini, d.toISOString().slice(0, 10)];
  },
  "Últimos 90 dias": () => [addDias(hojeISO(), -90), hojeISO()],
  "Este ano": () => [hojeISO().slice(0, 4) + "-01-01", hojeISO()],
};

export default function Ranking() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [periodo, setPeriodo] = useState("Este mês");
  const [modalidade, setModalidade] = useState("");
  const [turma, setTurma] = useState("");
  const [modo, setModo] = useState<"percentual" | "quantidade" | "faixa" | "hierarquia">("percentual");
  const [hier, setHier] = useState<any[]>([]);
  const [titulos, setTitulos] = useState<Record<string, string>>({});
  useEffect(() => {
    sb.from("titulos_alunos").select("membro_id, titulo_principal").eq("academia_id", ctx.academia.id)
      .then(({ data }) => setTitulos(Object.fromEntries((data || []).filter((t: any) => t.titulo_principal).map((t: any) => [t.membro_id, t.titulo_principal]))));
  }, []); // eslint-disable-line
  const [faixaEtaria, setFaixaEtaria] = useState("Adultos (18–29)");
  const [minimo, setMinimo] = useState(4);
  const [mods, setMods] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<any[]>([]);
  const meusIds = ctx.meusAlunos.map((a) => a.id);

  useEffect(() => {
    sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem").then(({ data }) => setMods(data || []));
    sb.from("turmas").select("id, nome, modalidade_id").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
  }, []); // eslint-disable-line

  useEffect(() => {
    const [de, ate] = PERIODOS[periodo]();
    sb.rpc("ranking_periodo", { p_acad: ctx.academia.id, p_de: de, p_ate: ate, p_modalidade: modalidade || null, p_turma: turma || null })
      .then(({ data }) => setLinhas(data || []));
  }, [periodo, modalidade, turma]); // eslint-disable-line

  // Hierarquia: faixa e grau, depois total de aulas
  useEffect(() => {
    if (modo !== "hierarquia") return;
    const m = modalidade || mods[0]?.id;
    if (!m) return;
    sb.rpc("ranking_hierarquia", { p_acad: ctx.academia.id, p_modalidade: m }).then(({ data }) => setHier(data || []));
  }, [modo, modalidade, mods]); // eslint-disable-line

  const lista = useMemo(() => {
    let l = linhas;
    if (modo !== "quantidade") l = l.filter((r) => r.aulas_possiveis >= minimo);
    if (modo === "faixa") l = l.filter((r) => r.faixa_etaria === faixaEtaria);
    const chave = modo === "quantidade" ? "posicao_quantidade" : modo === "faixa" ? "posicao_faixa_etaria" : "posicao_percentual";
    // recalcula a posição depois do filtro de mínimo (empates continuam empatados)
    const ord = [...l].sort((a, b) => modo === "quantidade" ? b.presencas - a.presencas : (b.pct ?? -1) - (a.pct ?? -1));
    let pos = 0, ultimo: any = null;
    return ord.map((r) => {
      const v = modo === "quantidade" ? r.presencas : r.pct;
      if (v !== ultimo) { pos++; ultimo = v; }
      return { ...r, pos, [chave]: pos };
    });
  }, [linhas, modo, minimo, faixaEtaria]);

  const podio = lista.filter((r) => r.pos <= 3);
  const valor = (r: any) => (modo === "quantidade" ? `${r.presencas} aulas` : `${r.pct ?? 0}%`);
  const medalha = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Ranking</h1>

      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        {([["percentual", "%"], ["quantidade", "Aulas"], ["faixa", "Idade"], ["hierarquia", "Hierarquia"]] as const).map(([k, v]) => (
          <button key={k} onClick={() => setModo(k)} className={`flex-1 rounded-xl py-2 font-semibold ${modo === k ? "bg-painel2" : "text-suave"}`}
            style={modo === k ? { boxShadow: "inset 0 -3px 0 var(--cor)" } : {}}>{v}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <select className="campo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período" disabled={modo === "hierarquia"}>
          {Object.keys(PERIODOS).map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="campo" value={modalidade} onChange={(e) => { setModalidade(e.target.value); setTurma(""); }} aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          {mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <select className="campo" value={turma} onChange={(e) => setTurma(e.target.value)} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {turmas.filter((t) => !modalidade || t.modalidade_id === modalidade).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {modo === "faixa" ? (
          <select className="campo" value={faixaEtaria} onChange={(e) => setFaixaEtaria(e.target.value)} aria-label="Faixa etária">
            {FAIXAS_ETARIAS.map((f) => <option key={f}>{f}</option>)}
          </select>
        ) : modo === "percentual" ? (
          <select className="campo" value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} aria-label="Mínimo de aulas">
            {[1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>Mínimo de {n} aula(s) no período</option>)}
          </select>
        ) : <span />}
      </div>
      {modo !== "quantidade" && (
        <p className="text-sm text-suave">
          Porcentagem = presenças ÷ aulas que a pessoa poderia ter feito. Faltas justificadas pelo professor não contam contra.
        </p>
      )}

      {modo === "hierarquia" && (() => {
        const eu = hier.findIndex((r) => meusIds.includes(r.membro_id));
        const mesmo = (a: any, b: any) => a && b && a.faixa === b.faixa && a.grau === b.grau;
        const frente = eu > 0 ? hier[eu - 1] : null, atras = eu >= 0 ? hier[eu + 1] : null;
        return (
          <div className="space-y-3">
            <p className="text-sm text-suave">Ordem: faixa mais alta → maior grau → mais aulas na carreira. Graduar sobe você de vez; aulas desempatam.</p>
            {eu >= 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--cor)" }}>
                <p className="numero text-3xl font-bold">Você está em {eu + 1}º</p>
                {frente && (mesmo(frente, hier[eu])
                  ? <p>Faltam <b>{frente.total_aulas - hier[eu].total_aulas + 1}</b> aulas para passar {frente.apelido || frente.nome.split(" ")[0]} 🔥</p>
                  : <p>Para passar {frente.apelido || frente.nome.split(" ")[0]}, o próximo passo é graduar. 🥋</p>)}
                {atras && mesmo(atras, hier[eu]) && <p className="text-sm opacity-90">{atras.apelido || atras.nome.split(" ")[0]} está {hier[eu].total_aulas - atras.total_aulas} aula(s) atrás de você. Não vacila! 👀</p>}
              </div>
            )}
            <ol className="space-y-2">
              {hier.map((r, i) => (
                <li key={r.membro_id} className={`flex items-center gap-3 rounded-2xl p-3 ${meusIds.includes(r.membro_id) ? "bg-painel2 ring-2 ring-[var(--cor)]" : "bg-painel"}`}>
                  <span className="numero w-8 text-center text-2xl font-bold">{r.posicao}º</span>
                  <Avatar foto={r.foto_url} nome={r.nome} cor={r.cor_faixa} grau={r.grau} tamanho={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.apelido || r.nome}</p>
                    <p className="text-xs text-suave">{r.faixa ? `Faixa ${r.faixa.toLowerCase()}${r.grau ? ` · ${r.grau}º grau` : ""}` : "Sem graduação"}{titulos[r.membro_id] ? ` · ${titulos[r.membro_id]}` : ""}</p>
                  </div>
                  <span className="text-right">
                    <span className="numero block text-xl font-bold">{r.total_aulas}</span>
                    <span className="text-xs text-suave">{i > 0 && mesmo(hier[i - 1], r) ? `−${hier[i - 1].total_aulas - r.total_aulas} do de cima` : "aulas"}</span>
                  </span>
                </li>
              ))}
              {!hier.length && <p className="text-suave">Ninguém com graduação nesta modalidade ainda.</p>}
            </ol>
          </div>
        );
      })()}

      {modo !== "hierarquia" && <>
      {/* Pódio */}
      {podio.length > 0 && (
        <div className="grid grid-cols-3 items-end gap-3">
          {[2, 1, 3].map((p) => {
            const doPos = podio.filter((r) => r.pos === p);
            return (
              <div key={p} className="text-center">
                <div className="mb-2 flex flex-wrap justify-center gap-1">
                  {doPos.slice(0, 3).map((r) => <Avatar key={r.membro_id} foto={r.foto_url} nome={r.nome} cor={r.cor_faixa} grau={r.grau} tamanho={p === 1 ? 64 : 48} />)}
                </div>
                <p className="truncate text-sm font-semibold">{doPos.map((r) => r.apelido || r.nome.split(" ")[0] + " " + (r.nome.split(" ")[1] || "")).join(", ") || "—"}</p>
                <div className="mt-2 rounded-t-2xl bg-painel pt-3" style={{ height: p === 1 ? 110 : p === 2 ? 80 : 60, borderTop: "4px solid var(--cor)" }}>
                  <p className="text-2xl">{medalha[p - 1]}</p>
                  {doPos[0] && <p className="numero text-xl font-bold">{valor(doPos[0])}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ol className="space-y-2">
        {lista.map((r) => (
          <li key={r.membro_id} className={`flex items-center gap-3 rounded-2xl p-3 ${meusIds.includes(r.membro_id) ? "bg-painel2 ring-2 ring-[var(--cor)]" : "bg-painel"}`}>
            <span className="numero w-8 text-center text-2xl font-bold">{r.pos}º</span>
            <Avatar foto={r.foto_url} nome={r.nome} cor={r.cor_faixa} grau={r.grau} tamanho={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.apelido || r.nome}</p>
              <p className="text-xs text-suave">{r.presencas} de {r.aulas_possiveis} aulas{r.faltas_justificadas ? ` · ${r.faltas_justificadas} justificada(s)` : ""} · {r.faixa_etaria}{titulos[r.membro_id] ? ` · ${titulos[r.membro_id]}` : ""}</p>
              <div className="mt-1"><Barra pct={r.pct} /></div>
            </div>
            <span className="numero text-xl font-bold">{valor(r)}</span>
          </li>
        ))}
        {lista.length === 0 && <p className="text-suave">Ninguém no ranking com esses filtros ainda.</p>}
      </ol>
      <p className="text-xs text-suave">{MESES[new Date().getMonth()]}: empates dividem a mesma posição.</p>
      </>}
    </div>
  );
}
