"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CLASSIFICACOES, corCategoria, embaralhar } from "@/lib/tecnicas";
import { RodaSorteio } from "@/components/RodaSorteio";
import { dataBR } from "@/lib/util";

type Modo = "roleta-palavra" | "roleta-significado" | "quiz-palavra" | "quiz-significado" | "quiz-tipo" | "quiz-traducao";
const MODOS: { id: Modo; titulo: string; texto: string; icone: string }[] = [
  { id: "roleta-palavra", titulo: "Roleta: palavra", texto: "Sai a palavra em japonês. Você fala o significado e confere.", icone: "🎯" },
  { id: "roleta-significado", titulo: "Roleta: significado", texto: "Sai o significado. Você diz a palavra em japonês.", icone: "🔄" },
  { id: "quiz-palavra", titulo: "Quiz A, B, C: palavras", texto: "Qual o significado desta palavra?", icone: "🅰️" },
  { id: "quiz-significado", titulo: "Quiz A, B, C: ao contrário", texto: "Qual palavra tem este significado?", icone: "🅱️" },
  { id: "quiz-tipo", titulo: "Quiz: tipo da técnica", texto: "Te-waza, koshi-waza, ashi-waza ou sutemi?", icone: "🥋" },
  { id: "quiz-traducao", titulo: "Quiz: tradução da técnica", texto: "O que quer dizer o nome da técnica?", icone: "📖" },
];

export default function Estudar() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [palavras, setPalavras] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [lista, setLista] = useState<"basica" | "ampliada" | "todas">("basica");
  const [categoria, setCategoria] = useState("");
  const [modo, setModo] = useState<Modo | null>(null);
  const [sorteada, setSorteada] = useState<any>(null);
  const [revelado, setRevelado] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const membro = ctx.equipe ? null : ctx.meusAlunos[0]?.id;

  useEffect(() => {
    sb.from("vocabulario").select("*").eq("academia_id", ctx.academia.id).order("ordem").then(({ data }) => setPalavras(data || []));
    sb.from("tecnicas").select("id, nome, nome_original, classificacao, conjunto, faixa").eq("academia_id", ctx.academia.id)
      .not("nome_original", "is", null).not("grupo", "in", "(taiso,ukemi,kata)").then(({ data }) => setTecnicas(data || []));
    if (membro) sb.from("quiz_resultados").select("*").eq("membro_id", membro).order("criado_em", { ascending: false }).limit(10).then(({ data }) => setHistorico(data || []));
  }, []); // eslint-disable-line

  const categorias = Array.from(new Set(palavras.map((p) => p.categoria).filter(Boolean)));
  const filtradas = useMemo(() => palavras.filter((p) => (lista === "todas" || p.lista === lista) && (!categoria || p.categoria === categoria)), [palavras, lista, categoria]);

  // ---------- Quiz ----------
  function montarQuiz(m: Modo) {
    let base: any[] = [];
    if (m === "quiz-palavra" || m === "quiz-significado") {
      base = embaralhar(filtradas).slice(0, 10).map((p) => {
        const erradas = embaralhar(filtradas.filter((x) => x.id !== p.id)).slice(0, 2);
        const certo = m === "quiz-palavra" ? p.significado : p.termo;
        const opcoes = embaralhar([certo, ...erradas.map((e) => (m === "quiz-palavra" ? e.significado : e.termo))]);
        return { pergunta: m === "quiz-palavra" ? p.termo : p.significado, certo, opcoes, extra: p.grafia_antiga ? `(grafia antiga: ${p.grafia_antiga})` : "" };
      });
    } else if (m === "quiz-tipo") {
      const comTipo = tecnicas.filter((t) => t.classificacao && ["te-waza", "koshi-waza", "ashi-waza", "ma-sutemi", "yoko-sutemi"].includes(t.classificacao));
      const tipos = ["te-waza", "koshi-waza", "ashi-waza", "ma-sutemi", "yoko-sutemi"];
      base = embaralhar(comTipo).slice(0, 10).map((t) => {
        const erradas = embaralhar(tipos.filter((x) => x !== t.classificacao)).slice(0, 2);
        return { pergunta: t.nome_original, certo: CLASSIFICACOES[t.classificacao], opcoes: embaralhar([t.classificacao, ...erradas]).map((x) => CLASSIFICACOES[x]), extra: t.conjunto || "" };
      });
    } else if (m === "quiz-traducao") {
      base = embaralhar(tecnicas).slice(0, 10).map((t) => {
        const erradas = embaralhar(tecnicas.filter((x) => x.id !== t.id)).slice(0, 2);
        return { pergunta: t.nome_original, certo: t.nome, opcoes: embaralhar([t.nome, ...erradas.map((e) => e.nome)]), extra: t.conjunto || "" };
      });
    }
    setQuiz({ perguntas: base, i: 0, acertos: 0, escolha: null, fim: false });
  }

  async function responder(op: string) {
    if (!quiz || quiz.escolha) return;
    const certo = op === quiz.perguntas[quiz.i].certo;
    setQuiz({ ...quiz, escolha: op, acertos: quiz.acertos + (certo ? 1 : 0) });
  }
  async function proxima() {
    if (quiz.i + 1 >= quiz.perguntas.length) {
      setQuiz({ ...quiz, fim: true });
      if (membro) {
        await sb.from("quiz_resultados").insert({ academia_id: ctx.academia.id, membro_id: membro, modo, acertos: quiz.acertos, total: quiz.perguntas.length });
        const { data } = await sb.from("quiz_resultados").select("*").eq("membro_id", membro).order("criado_em", { ascending: false }).limit(10);
        setHistorico(data || []);
      }
      return;
    }
    setQuiz({ ...quiz, i: quiz.i + 1, escolha: null });
  }

  // trocou o filtro antes de começar: refaz o quiz de palavras
  useEffect(() => {
    if ((modo === "quiz-palavra" || modo === "quiz-significado") && quiz && quiz.i === 0 && !quiz.escolha) montarQuiz(modo);
  }, [lista, categoria, palavras]); // eslint-disable-line

  function escolherModo(m: Modo) {
    setModo(m); setSorteada(null); setRevelado(false);
    if (m.startsWith("quiz")) montarQuiz(m); else setQuiz(null);
  }

  const Filtros = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {([["basica", "60 palavras"], ["ampliada", "Ampliada"], ["todas", "Todas"]] as const).map(([k, v]) => (
          <button key={k} className="chip text-xs" onClick={() => setLista(k)} style={lista === k ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{v}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className="chip text-xs" onClick={() => setCategoria("")} style={!categoria ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>Todas</button>
        {categorias.map((c) => <button key={c} className="chip text-xs" onClick={() => setCategoria(c)} style={categoria === c ? { background: corCategoria(c), borderColor: corCategoria(c) } : { borderColor: corCategoria(c) }}>{c}</button>)}
      </div>
    </div>
  );

  if (!modo) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-4xl font-extrabold">Estudar</h1>
          {ctx.equipe && <Link href={`/${ctx.academia.slug}/app/tecnicas/vocabulario`} className="btn-sec text-sm">Editar palavras</Link>}
        </div>
        <p className="text-suave">Treine em casa as palavras e as técnicas para chegar tranquilo nas aulas e nos exames.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODOS.map((m) => (
            <button key={m.id} onClick={() => escolherModo(m.id)} className="rounded-2xl bg-painel p-4 text-left transition hover:bg-painel2">
              <p className="text-3xl" aria-hidden>{m.icone}</p>
              <p className="mt-1 text-xl font-bold">{m.titulo}</p>
              <p className="text-sm text-suave">{m.texto}</p>
            </button>
          ))}
          <Link href={`/${ctx.academia.slug}/app/tecnicas/roleta`} className="rounded-2xl bg-painel p-4 transition hover:bg-painel2">
            <p className="text-3xl" aria-hidden>🌀</p><p className="mt-1 text-xl font-bold">Roleta de técnicas</p><p className="text-sm text-suave">Por grupo, tipo ou faixa.</p>
          </Link>
        </div>
        {historico.length > 0 && (
          <section className="rounded-2xl bg-painel p-4">
            <h2 className="mb-2 text-2xl font-bold">Seus últimos quizzes</h2>
            <ul className="space-y-1 text-sm">
              {historico.map((h) => <li key={h.id} className="flex justify-between"><span>{MODOS.find((m) => m.id === h.modo)?.titulo || h.modo} · {dataBR(h.criado_em)}</span><b className="numero">{h.acertos}/{h.total}</b></li>)}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const info = MODOS.find((m) => m.id === modo)!;
  return (
    <div className="space-y-5">
      <button className="text-sm text-suave" onClick={() => { setModo(null); setQuiz(null); }}>← Estudar</button>
      <h1 className="text-4xl font-extrabold">{info.icone} {info.titulo}</h1>

      {(modo === "roleta-palavra" || modo === "roleta-significado") && (
        <>
          <Filtros />
          <RodaSorteio
            itens={filtradas.map((p) => ({ id: p.id, rotulo: modo === "roleta-palavra" ? p.termo : p.significado, cor: corCategoria(p.categoria) }))}
            onSorteio={(i) => { setSorteada(filtradas.slice(0, 40)[i]); setRevelado(false); }}
          />
          {sorteada && (
            <div className="mx-auto w-full max-w-sm rounded-3xl bg-painel p-6 text-center shadow-2xl" style={{ borderTop: `8px solid ${corCategoria(sorteada.categoria)}` }}>
              <p className="text-xs uppercase tracking-wide text-suave">{sorteada.categoria}</p>
              <p className="mt-1 text-4xl font-extrabold">{modo === "roleta-palavra" ? sorteada.termo : sorteada.significado}</p>
              {modo === "roleta-palavra" && sorteada.grafia_antiga && <p className="text-sm text-suave">grafia antiga: {sorteada.grafia_antiga}</p>}
              {revelado ? (
                <p className="mt-4 text-2xl font-bold" style={{ color: "var(--color-ok)" }}>{modo === "roleta-palavra" ? sorteada.significado : sorteada.termo}</p>
              ) : (
                <button className="btn mt-4" onClick={() => setRevelado(true)}>Mostrar resposta</button>
              )}
            </div>
          )}
        </>
      )}

      {quiz && (
        <>
          {(modo === "quiz-palavra" || modo === "quiz-significado") && !quiz.i && !quiz.escolha && <Filtros />}
          {!quiz.perguntas.length ? (
            <p className="text-suave">Sem conteúdo suficiente para este quiz{modo.includes("tipo") || modo.includes("traducao") ? " (cadastre técnicas com nome original e tipo)" : ""}.</p>
          ) : quiz.fim ? (
            <div className="rounded-3xl bg-painel p-6 text-center">
              <p className="numero text-6xl font-extrabold">{quiz.acertos}/{quiz.perguntas.length}</p>
              <p className="mt-2 text-xl">{quiz.acertos === quiz.perguntas.length ? "Perfeito! Ippon! 🥇" : quiz.acertos >= quiz.perguntas.length * 0.7 ? "Muito bom! Waza-ari! 💪" : "Bora treinar mais um pouco! 🥋"}</p>
              <button className="btn mt-4" onClick={() => montarQuiz(modo)}>Jogar de novo</button>
            </div>
          ) : (() => {
            const p = quiz.perguntas[quiz.i];
            return (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-suave"><span>Pergunta {quiz.i + 1} de {quiz.perguntas.length}</span><span>✓ {quiz.acertos}</span></div>
                <div className="rounded-3xl bg-painel p-6 text-center">
                  <p className="text-3xl font-extrabold">{p.pergunta}</p>
                  {p.extra && <p className="mt-1 text-sm text-suave">{p.extra}</p>}
                </div>
                <div className="grid gap-2">
                  {p.opcoes.map((op: string, k: number) => {
                    const marcada = quiz.escolha === op, certa = quiz.escolha && op === p.certo;
                    return (
                      <button key={op + k} onClick={() => responder(op)} disabled={!!quiz.escolha}
                        className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left text-lg transition ${certa ? "border-ok bg-ok/15" : marcada ? "border-erro bg-erro/15" : "border-linha bg-painel"}`}>
                        <span className="numero flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-painel2 font-bold">{"ABC"[k]}</span>
                        {op}
                      </button>
                    );
                  })}
                </div>
                {quiz.escolha && <button className="btn w-full" onClick={proxima}>{quiz.i + 1 >= quiz.perguntas.length ? "Ver resultado" : "Próxima"}</button>}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
