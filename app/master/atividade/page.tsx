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
};

function resumo(h: any) {
  const d = h.detalhes || {};
  if (h.acao === "editou") return Object.entries(d).slice(0, 4).map(([k, v]: any) => `${k}: ${JSON.stringify(v?.de)} → ${JSON.stringify(v?.para)}`).join(" · ");
  return d.nome || d.titulo || d.descricao || d.faixa || d.email || "";
}

// O que aconteceu em cada academia + erros do app (para manutenção e suporte)
export default function Atividade() {
  const sb = supabaseNavegador();
  const [aba, setAba] = useState<"acoes" | "erros">("acoes");
  const [academias, setAcademias] = useState<any[]>([]);
  const [academia, setAcademia] = useState("");
  const [acoes, setAcoes] = useState<any[]>([]);
  const [erros, setErros] = useState<any[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => { sb.from("academias").select("id, nome").order("nome").then(({ data }) => setAcademias(data || [])); }, []); // eslint-disable-line
  useEffect(() => {
    sb.rpc("atividade_master", { p_academia: academia || null, p_limite: 500 }).then(({ data }) => setAcoes(data || []));
    sb.from("erros_app").select("*").order("criado_em", { ascending: false }).limit(200).then(({ data }) => setErros(data || []));
  }, [academia]); // eslint-disable-line

  const t = busca.toLowerCase();
  const acoesF = acoes.filter((h) => !t || JSON.stringify(h).toLowerCase().includes(t));

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-5 pb-16 pt-6">
      <Link href="/master" className="text-sm text-suave">← Painel master</Link>
      <h1 className="text-4xl font-extrabold">Atividade e erros</h1>
      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        <button onClick={() => setAba("acoes")} className={`flex-1 rounded-xl py-2 font-semibold ${aba === "acoes" ? "bg-painel2" : "text-suave"}`}>O que foi feito ({acoes.length})</button>
        <button onClick={() => setAba("erros")} className={`flex-1 rounded-xl py-2 font-semibold ${aba === "erros" ? "bg-painel2" : "text-suave"}`}>Erros ({erros.length})</button>
      </div>

      {aba === "acoes" ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="campo" value={academia} onChange={(e) => setAcademia(e.target.value)} aria-label="Academia">
              <option value="">Todas as academias</option>
              {academias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <input className="campo" placeholder="Buscar (nome, campo, valor…)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
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
            {!acoesF.length && <p className="p-4 text-suave">Nada registrado ainda.</p>}
          </ul>
        </>
      ) : (
        <ul className="space-y-2">
          {erros.map((e) => (
            <li key={e.id} className="rounded-2xl bg-painel p-3 text-sm">
              <p className="font-semibold text-erro">{e.mensagem}</p>
              <p className="text-xs text-suave">{dataHoraBR(e.criado_em)} · {e.pagina} · {e.navegador?.split(")")[0]?.split("(")[1] || ""}</p>
              {e.detalhe && <details className="mt-1"><summary className="cursor-pointer text-xs">detalhes técnicos</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-suave">{e.detalhe}</pre></details>}
            </li>
          ))}
          {!erros.length && <p className="text-suave">Nenhum erro registrado. 🎉</p>}
        </ul>
      )}
    </main>
  );
}
