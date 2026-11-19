"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/util";

const NOMES: Record<string, string> = {
  perfis: "cadastro", membros: "vínculo", matriculas: "matrícula", turmas: "turma", horarios: "horário", modalidades: "modalidade",
  graduacoes: "graduação", cobrancas: "mensalidade", despesas: "despesa", eventos: "evento", avisos: "aviso", pendencias: "pendência",
  ausencias: "ausência", planos: "plano", assinaturas: "plano do aluno", solicitacoes_cadastro: "pedido de cadastro",
  aulas_experimentais: "aula experimental", exames_faixa: "exame", carteirinhas: "carteirinha", tecnicas: "técnica", academias: "academia",
  plataforma_contratos: "valor que paga para você", plataforma: "página principal / manutenção",
};
const CAMPOS: Record<string, string> = {
  plano: "plano", modulos: "módulos", ativa: "ativa", no_diretorio: "no diretório", dominio: "domínio", slug: "endereço",
  valor_mensal: "valor por mês", dia_vencimento: "dia do vencimento", feed_retencao_dias: "dias das fotos do feed",
  manutencao: "modo manutenção", demonstracao: "demonstração", professor_ve_mensalidades: "professor vê mensalidades",
};

const curto = (v: any) => { const t = typeof v === "string" ? v : JSON.stringify(v); return t && t.length > 60 ? t.slice(0, 60) + "…" : t; };
function resumo(h: any) {
  const d = h.detalhes || {};
  if (h.acao === "editou") return Object.entries(d).slice(0, 4).map(([k, v]: any) => {
    if (k === "modulos" && v?.de && v?.para && typeof v.para === "object") {
      const mud = Object.keys({ ...v.de, ...v.para }).filter((m) => v.de?.[m] !== v.para?.[m]).map((m) => `${m} ${v.para?.[m] === false ? "desligado" : "ligado"}`);
      return `módulos: ${mud.join(", ") || "—"}`;
    }
    return `${CAMPOS[k] || k}: ${curto(v?.de)} → ${curto(v?.para)}`;
  }).join(" · ");
  return d.nome || d.titulo || d.descricao || d.faixa || d.email || (d.valor_mensal != null ? `R$ ${d.valor_mensal}/mês` : "");
}
const navegadorCurto = (n?: string) => n?.split(")")[0]?.split("(")[1] || "";

// O que aconteceu em cada academia + erros do app (para manutenção e suporte)
export default function Atividade() {
  const sb = supabaseNavegador();
  const [aba, setAba] = useState<"acoes" | "erros" | "config">("erros");
  const [academias, setAcademias] = useState<any[]>([]);
  const [academia, setAcademia] = useState("");
  const [acoes, setAcoes] = useState<any[] | null>(null);
  const [grupos, setGrupos] = useState<any[] | null>(null);
  const [errosSoltos, setErrosSoltos] = useState<any[] | null>(null); // banco sem a ATUALIZAÇÃO 27
  const [config, setConfig] = useState<any[] | null>(null);
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState("");
  const [verResolvidos, setVerResolvidos] = useState(false);

  useEffect(() => {
    const a = new URLSearchParams(location.search).get("aba");
    if (a === "acoes" || a === "config") setAba(a);
    sb.from("academias").select("id, nome").order("nome").then(({ data }) => setAcademias(data || []));
  }, []); // eslint-disable-line

  // carrega só a aba aberta (abre mais rápido)
  useEffect(() => {
    if (aba === "acoes") { setAcoes(null); sb.rpc("atividade_master", { p_academia: academia || null, p_limite: 500 }).then(({ data }) => setAcoes(data || [])); }
  }, [aba, academia]); // eslint-disable-line
  useEffect(() => { if (aba === "erros") carregarErros(); }, [aba, dias]); // eslint-disable-line
  useEffect(() => {
    if (aba === "config" && !config) sb.rpc("historico_config", { p_limite: 300 }).then(({ data, error }) => setConfig(error ? [] : data || []));
  }, [aba]); // eslint-disable-line

  async function carregarErros() {
    const { data, error } = await sb.rpc("erros_agrupados", { p_dias: dias });
    if (!error) { setGrupos(data || []); return; }
    const { data: soltos } = await sb.from("erros_app").select("*").order("criado_em", { ascending: false }).limit(200);
    setErrosSoltos(soltos || []); setGrupos([]);
  }
  async function resolver(g: any, sim: boolean) {
    setGrupos((l) => (l || []).map((x) => x.chave === g.chave ? { ...x, resolvido_em: sim ? new Date().toISOString() : null, voltou: false, depois: 0 } : x));
    const { error } = await sb.rpc("resolver_erro", { p_chave: g.chave, p_resolvido: sim });
    if (error) { alert("Não deu: " + error.message); carregarErros(); }
  }

  const t = busca.toLowerCase();
  const acoesF = (acoes || []).filter((h) => !t || JSON.stringify(h).toLowerCase().includes(t));
  const abertos = (grupos || []).filter((g) => !g.resolvido_em || g.voltou);
  const resolvidos = (grupos || []).filter((g) => g.resolvido_em && !g.voltou);
  const maxVezes = Math.max(1, ...abertos.map((g) => g.vezes));

  const Aba = ({ id, children }: { id: typeof aba; children: React.ReactNode }) => (
    <button onClick={() => { setAba(id); history.replaceState(null, "", `?aba=${id}`); }} className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold sm:text-base ${aba === id ? "bg-painel2" : "text-suave"}`}>{children}</button>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/master" className="text-sm text-suave">← Painel master</Link>
      <h1 className="text-4xl font-extrabold">Atividade e erros</h1>
      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        <Aba id="erros">🐞 Erros{grupos ? ` (${abertos.length})` : ""}</Aba>
        <Aba id="config">⚙️ Configurações</Aba>
        <Aba id="acoes">🧾 O que foi feito</Aba>
      </div>

      {aba === "erros" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-suave">Período:</span>
            {[7, 30, 90].map((d) => <button key={d} onClick={() => setDias(d)} className={`chip ${dias === d ? "border-[var(--cor)]" : ""}`}>{d} dias</button>)}
            <span className="ml-auto text-xs text-suave">Agrupados por tela, do mais frequente para o menos.</span>
          </div>
          {!grupos && <p className="text-suave">Carregando…</p>}
          {errosSoltos && (
            <>
              <p className="rounded-2xl bg-alerta/15 p-3 text-sm">Rode o <b>ATUALIZAR-27.sql</b> para ver os erros agrupados e usar o botão “já corrigi”. Por enquanto, a lista simples:</p>
              <ul className="space-y-2">
                {errosSoltos.map((e) => (
                  <li key={e.id} className="rounded-2xl bg-painel p-3 text-sm">
                    <p className="font-semibold text-erro">{e.mensagem}</p>
                    <p className="text-xs text-suave">{dataHoraBR(e.criado_em)} · {e.pagina} · {navegadorCurto(e.navegador)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {grupos && !errosSoltos && (
            <>
              {!abertos.length && <p className="rounded-2xl bg-painel p-4">Nenhum erro em aberto nos últimos {dias} dias. 🎉</p>}
              <ul className="space-y-2">
                {abertos.map((g, i) => (
                  <li key={g.chave} className="rounded-2xl bg-painel p-3 text-sm" style={g.voltou ? { outline: "2px solid var(--color-alerta)" } : undefined}>
                    <div className="flex items-start gap-3">
                      <div className="w-14 shrink-0 text-center">
                        <p className="numero text-2xl font-bold">{g.vezes}</p>
                        <p className="text-[10px] text-suave">vez{g.vezes === 1 ? "" : "es"}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-painel2"><div className="h-1.5 rounded-full bg-erro" style={{ width: `${(g.vezes / maxVezes) * 100}%` }} /></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-suave">{i === 0 ? "🔥 corrija primeiro · " : ""}<code>{g.tela || "/"}</code></p>
                        <p className="break-words font-semibold text-erro">{g.mensagem || "(sem mensagem)"}</p>
                        <p className="text-xs text-suave">
                          {g.voltou && <b className="text-alerta">🔁 voltou {g.depois}x depois de corrigido · </b>}
                          {g.vezes_7d} nos últimos 7 dias · {g.pessoas} pessoa(s) · {g.academias} academia(s) · última {dataHoraBR(g.ultima)}
                        </p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs">detalhes técnicos</summary>
                          <p className="mt-1 text-[11px] text-suave">Exemplo: {g.pagina} · {navegadorCurto(g.navegador)} · desde {dataHoraBR(g.primeira)}</p>
                          {g.detalhe && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-suave">{g.detalhe}</pre>}
                        </details>
                      </div>
                      <button className="btn-sec shrink-0 px-2 py-1 text-xs" onClick={() => resolver(g, true)} title="Some da lista. Se acontecer de novo, você recebe o alerta.">✅ Já corrigi</button>
                    </div>
                  </li>
                ))}
              </ul>
              {resolvidos.length > 0 && (
                <div>
                  <button className="text-sm underline" onClick={() => setVerResolvidos(!verResolvidos)}>{verResolvidos ? "Esconder" : "Ver"} os {resolvidos.length} já corrigidos</button>
                  {verResolvidos && (
                    <ul className="mt-2 space-y-1">
                      {resolvidos.map((g) => (
                        <li key={g.chave} className="flex items-center gap-2 rounded-xl bg-painel p-2 text-xs text-suave">
                          <span className="min-w-0 flex-1 truncate">✅ <code>{g.tela}</code> — {g.mensagem}</span>
                          <span>corrigido {dataHoraBR(g.resolvido_em)}</span>
                          <button className="underline" onClick={() => resolver(g, false)}>reabrir</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {aba === "config" && (
        <>
          <p className="text-sm text-suave">Mudanças de plano, módulos, preço, endereço, ativar/desativar academia e modo manutenção — quem fez e quando.</p>
          {!config && <p className="text-suave">Carregando…</p>}
          <ul className="divide-y divide-linha rounded-2xl bg-painel">
            {(config || []).map((h, i) => (
              <li key={i} className="p-3 text-sm">
                <p><b>{h.quem}</b> {h.acao} {NOMES[h.tabela] || h.tabela}<span className="text-suave"> · {h.academia || "plataforma"} · {dataHoraBR(h.quando)}</span></p>
                {resumo(h) && <p className="break-all text-xs text-suave">{resumo(h)}</p>}
              </li>
            ))}
            {config && !config.length && <p className="p-4 text-suave">Nada registrado ainda (ou falta rodar o ATUALIZAR-27.sql).</p>}
          </ul>
        </>
      )}

      {aba === "acoes" && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="campo" value={academia} onChange={(e) => setAcademia(e.target.value)} aria-label="Academia">
              <option value="">Todas as academias</option>
              {academias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <input className="campo" placeholder="Buscar (nome, campo, valor…)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {!acoes && <p className="text-suave">Carregando…</p>}
          <ul className="divide-y divide-linha rounded-2xl bg-painel">
            {acoesF.map((h, i) => (
              <li key={i} className="p-3 text-sm">
                <p>
                  <b>{h.quem}</b> {h.acao} {NOMES[h.tabela] || h.tabela}
                  <span className="text-suave"> · {h.academia || "—"} · {dataHoraBR(h.quando)}</span>
                </p>
                {resumo(h) && <p className="break-all text-xs text-suave">{resumo(h)}</p>}
              </li>
            ))}
            {acoes && !acoesF.length && <p className="p-4 text-suave">Nada registrado ainda.</p>}
          </ul>
        </>
      )}
    </main>
  );
}
