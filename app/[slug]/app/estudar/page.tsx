"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CLASSIFICACOES, corCategoria, embaralhar } from "@/lib/tecnicas";
import { RodaSorteio } from "@/components/RodaSorteio";
import { Tatame } from "@/components/Tatame";
import { BotaoFalar, EscolhaVoz } from "@/components/Falar";
import { Avatar } from "@/components/Avatar";
import { falar } from "@/lib/fala";
import { dataBR, hojeISO, addDias } from "@/lib/util";

type Modo = "roleta-palavra" | "roleta-significado" | "quiz-palavra" | "quiz-significado" | "quiz-tipo" | "quiz-traducao" | "flashcards" | "simulado";
const DIAS_CAIXA = [0, 1, 2, 4, 8, 16];
const MODOS: { id: Modo; titulo: string; texto: string; icone: string }[] = [
  { id: "roleta-palavra", titulo: "Roleta: palavra", texto: "Sai a palavra em japonês. Você fala o significado e confere.", icone: "🎯" },
  { id: "roleta-significado", titulo: "Roleta: significado", texto: "Sai o significado. Você diz a palavra em japonês.", icone: "🔄" },
  { id: "quiz-palavra", titulo: "Quiz A, B, C: palavras", texto: "Qual o significado desta palavra?", icone: "🅰️" },
  { id: "quiz-significado", titulo: "Quiz A, B, C: ao contrário", texto: "Qual palavra tem este significado?", icone: "🅱️" },
  { id: "quiz-tipo", titulo: "Quiz: tipo da técnica", texto: "Te-waza, koshi-waza, ashi-waza ou sutemi?", icone: "🥋" },
  { id: "quiz-traducao", titulo: "Quiz: tradução da técnica", texto: "O que quer dizer o nome da técnica?", icone: "📖" },
  { id: "flashcards", titulo: "Flashcards inteligentes", texto: "O app repete mais o que você erra. Poucos minutos por dia.", icone: "🃏" },
  { id: "simulado", titulo: "Simulado da prova de faixa", texto: "10 perguntas da matéria da sua próxima faixa.", icone: "📝" },
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
  const [tatame, setTatame] = useState(false);
  const [giros, setGiros] = useState(0);
  const [placar, setPlacar] = useState<any[]>([]);
  const [semanaAtual, setSemanaAtual] = useState<any[]>([]);
  const [semana, setSemana] = useState(0); // 0 = esta semana (para a meta)
  const [periodo, setPeriodo] = useState("semana");
  const [desafio, setDesafio] = useState<any>(null);
  const [respDesafio, setRespDesafio] = useState<string | null>(null);
  const [cartas, setCartas] = useState<any>(null);
  const [titulos, setTitulos] = useState<Record<string, string>>({});
  const meta = ctx.academia.meta_estudo_semanal || 3;
  const segunda = (() => { const h = hojeISO(); const d = new Date(h + "T12:00:00").getDay(); return addDias(h, -((d + 6) % 7)); })();
  const membro = ctx.equipe ? null : ctx.meusAlunos[0]?.id;

  useEffect(() => {
    sb.from("vocabulario").select("*").eq("academia_id", ctx.academia.id).order("ordem").then(({ data }) => setPalavras(data || []));
    sb.from("tecnicas").select("id, nome, nome_original, kana, classificacao, conjunto, faixa").eq("academia_id", ctx.academia.id)
      .not("nome_original", "is", null).not("grupo", "in", "(taiso,ukemi,kata)").then(({ data }) => setTecnicas(data || []));
    if (membro) sb.from("quiz_resultados").select("*").eq("membro_id", membro).order("criado_em", { ascending: false }).limit(10).then(({ data }) => setHistorico(data || []));
    carregarPlacar(0);
    carregarDesafio();
    sb.from("titulos_alunos").select("membro_id, titulo_principal").eq("academia_id", ctx.academia.id)
      .then(({ data }) => setTitulos(Object.fromEntries((data || []).filter((t: any) => t.titulo_principal).map((t: any) => [t.membro_id, t.titulo_principal]))));
  }, []); // eslint-disable-line

  // ---------- Desafio do dia ----------
  async function carregarDesafio() {
    const { data } = await sb.from("desafios_dia").select("*").eq("academia_id", ctx.academia.id).eq("data", hojeISO()).maybeSingle();
    setDesafio(data);
    if (data && membro) {
      const { data: feito } = await sb.from("quiz_resultados").select("acertos").eq("membro_id", membro).eq("modo", "desafio")
        .gte("criado_em", hojeISO() + "T00:00:00-03:00").limit(1);
      if (feito?.length) setRespDesafio(feito[0].acertos ? data.resposta : "__errou__");
    }
  }
  async function responderDesafio(op: string) {
    if (respDesafio) return;
    setRespDesafio(op);
    if (membro) {
      await sb.from("quiz_resultados").insert({ academia_id: ctx.academia.id, membro_id: membro, modo: "desafio", acertos: op === desafio.resposta ? 1 : 0, total: 1 });
      carregarPlacar(0);
    }
  }

  // ---------- Flashcards (método Leitner) ----------
  async function montarCartas() {
    const base = filtradas.length ? filtradas : palavras;
    let progresso: any[] = [];
    if (membro) {
      const { data } = await sb.from("flashcards").select("*").eq("membro_id", membro).eq("tipo", "palavra");
      progresso = data || [];
    }
    const mapa = new Map(progresso.map((p) => [p.item_id, p]));
    const hoje = hojeISO();
    const vencidas = base.filter((p) => mapa.has(p.id) && mapa.get(p.id).proxima <= hoje);
    const novas = embaralhar(base.filter((p) => !mapa.has(p.id))).slice(0, Math.max(0, 15 - vencidas.length));
    const fila = embaralhar([...vencidas, ...novas]).slice(0, 15);
    setCartas({ fila, i: 0, virada: false, acertos: 0, mapa, fim: !fila.length });
  }
  async function marcarCarta(acertou: boolean) {
    const c = cartas.fila[cartas.i];
    const atual = cartas.mapa.get(c.id)?.caixa || 0;
    const caixa = acertou ? Math.min(5, atual + 1) : 1;
    if (membro) {
      await sb.from("flashcards").upsert({ membro_id: membro, tipo: "palavra", item_id: c.id, caixa, proxima: addDias(hojeISO(), DIAS_CAIXA[caixa]), atualizado: new Date().toISOString() });
    }
    const acertos = cartas.acertos + (acertou ? 1 : 0);
    if (cartas.i + 1 >= cartas.fila.length) {
      setCartas({ ...cartas, acertos, fim: true });
      if (membro) { await sb.from("quiz_resultados").insert({ academia_id: ctx.academia.id, membro_id: membro, modo: "flashcards", acertos, total: cartas.fila.length }); carregarPlacar(0); }
      return;
    }
    setCartas({ ...cartas, i: cartas.i + 1, virada: false, acertos });
  }

  // ---------- Simulado da prova de faixa ----------
  async function montarSimulado() {
    let alvo = "";
    const { data: mods } = await sb.from("modalidades").select("id, graduacoes").eq("academia_id", ctx.academia.id).order("ordem").limit(1);
    const mod = mods?.[0];
    if (mod && membro) {
      const { data: g } = await sb.from("graduacoes").select("faixa").eq("membro_id", membro).eq("modalidade_id", mod.id).order("data", { ascending: false }).limit(1);
      const atual = g?.[0]?.faixa || mod.graduacoes?.[0];
      alvo = mod.graduacoes?.[(mod.graduacoes.indexOf(atual)) + 1] || "";
    }
    const { data: tec } = await sb.from("tecnicas").select("id, nome, nome_original, kana, classificacao, faixa").eq("academia_id", ctx.academia.id).not("nome_original", "is", null)
      .not("grupo", "in", "(taiso,ukemi,kata)");
    const todasT: any[] = tec || [];
    const daFaixa = alvo ? todasT.filter((t) => t.faixa === alvo) : todasT;
    const perguntas: any[] = embaralhar(daFaixa).slice(0, 10).map((t: any, k: number) => {
      if (k % 2 === 0 || !t.classificacao) {
        const erradas = embaralhar(todasT.filter((x) => x.id !== t.id && x.nome !== t.nome)).slice(0, 2);
        return { pergunta: t.nome_original, kana: t.kana, certo: t.nome, opcoes: embaralhar([t.nome, ...erradas.map((e) => e.nome)]), extra: "O que quer dizer?" };
      }
      const tipos = Object.keys(CLASSIFICACOES).filter((x) => x !== t.classificacao);
      const erradas = embaralhar(tipos).slice(0, 2);
      return { pergunta: t.nome_original, kana: t.kana, certo: CLASSIFICACOES[t.classificacao], opcoes: embaralhar([t.classificacao, ...erradas]).map((x) => CLASSIFICACOES[x]), extra: "Qual é o tipo?" };
    });
    // completa com palavras se a faixa tiver poucas técnicas
    embaralhar(palavras.filter((p) => p.lista === "basica")).slice(0, 10 - perguntas.length).forEach((p) => {
      const erradas = embaralhar(palavras.filter((x) => x.id !== p.id)).slice(0, 2);
      perguntas.push({ pergunta: p.termo, kana: p.kana, certo: p.significado, opcoes: embaralhar([p.significado, ...erradas.map((e) => e.significado)]), extra: "O que significa?" });
    });
    setQuiz({ perguntas: embaralhar(perguntas), i: 0, acertos: 0, escolha: null, fim: false, alvo });
  }

  // Períodos do placar: semana, mês e temporada (trimestre)
  function intervalo(p: string): [string, string] {
    const h = hojeISO(), ano = Number(h.slice(0, 4)), mes = Number(h.slice(5, 7)) - 1;
    const tri = mes < 6 ? 0 : 6; // temporada = semestre
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (p === "semana-passada") return [addDias(segunda, -7), addDias(segunda, -1)];
    if (p === "mes") return [h.slice(0, 8) + "01", h];
    if (p === "temporada") return [iso(new Date(Date.UTC(ano, tri, 1))), h];
    if (p === "temporada-passada") return [iso(new Date(Date.UTC(ano, tri - 6, 1))), iso(new Date(Date.UTC(ano, tri, 0)))];
    return [segunda, addDias(segunda, 6)];
  }
  const nomeTemporada = (() => { const h = hojeISO(); return `${Number(h.slice(5, 7)) <= 6 ? 1 : 2}º sem/${h.slice(2, 4)}`; })();
  const fimTemporada = (() => { const h = hojeISO(); const ano = Number(h.slice(0, 4)); return Number(h.slice(5, 7)) <= 6 ? `${ano}-06-30` : `${ano}-12-31`; })();

  async function carregarPlacar(sem: number, p?: string) {
    const per = p || (sem ? "semana-passada" : periodo);
    setSemana(per === "semana" ? 0 : 1);
    setPeriodo(per);
    const [de, ate] = intervalo(per);
    const { data } = await sb.rpc("placar_estudo", { p_acad: ctx.academia.id, p_de: de, p_ate: ate });
    setPlacar(data || []);
    if (per === "semana") setSemanaAtual(data || []);
  }

  // Roleta conta como 1 atividade a cada 5 giros
  async function contarGiro(tipo: string) {
    const n = giros + 1;
    setGiros(n);
    if (n % 5 === 0 && membro) {
      await sb.from("quiz_resultados").insert({ academia_id: ctx.academia.id, membro_id: membro, modo: tipo, acertos: 0, total: 0 });
      carregarPlacar(0);
    }
  }

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
        return { pergunta: m === "quiz-palavra" ? p.termo : p.significado, kana: m === "quiz-palavra" ? p.kana : null, certo, opcoes, extra: p.grafia_antiga ? `(grafia antiga: ${p.grafia_antiga})` : "" };
      });
    } else if (m === "quiz-tipo") {
      const comTipo = tecnicas.filter((t) => t.classificacao && ["te-waza", "koshi-waza", "ashi-waza", "ma-sutemi", "yoko-sutemi"].includes(t.classificacao));
      const tipos = ["te-waza", "koshi-waza", "ashi-waza", "ma-sutemi", "yoko-sutemi"];
      base = embaralhar(comTipo).slice(0, 10).map((t) => {
        const erradas = embaralhar(tipos.filter((x) => x !== t.classificacao)).slice(0, 2);
        return { pergunta: t.nome_original, kana: t.kana, certo: CLASSIFICACOES[t.classificacao], opcoes: embaralhar([t.classificacao, ...erradas]).map((x) => CLASSIFICACOES[x]), extra: t.conjunto || "" };
      });
    } else if (m === "quiz-traducao") {
      base = embaralhar(tecnicas).slice(0, 10).map((t) => {
        const erradas = embaralhar(tecnicas.filter((x) => x.id !== t.id)).slice(0, 2);
        return { pergunta: t.nome_original, kana: t.kana, certo: t.nome, opcoes: embaralhar([t.nome, ...erradas.map((e) => e.nome)]), extra: t.conjunto || "" };
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
        carregarPlacar(0);
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
    setModo(m); setSorteada(null); setRevelado(false); setCartas(null);
    if (m.startsWith("quiz")) montarQuiz(m);
    else if (m === "simulado") montarSimulado();
    else { setQuiz(null); if (m === "flashcards") montarCartas(); }
  }

  const Filtros = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {([["basica", "60 palavras"], ["ampliada", "Ampliada"], ["todas", "Todas"]] as const).map(([k, v]) => (
          <button key={k} className="chip text-xs" onClick={() => setLista(k)} style={lista === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{v}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className="chip text-xs" onClick={() => setCategoria("")} style={!categoria ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>Todas</button>
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
        {desafio && (
          <section className="rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--color-alerta)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-alerta)" }}>⚡ Desafio do dia · vale 3 pontos</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-bold">{desafio.pergunta}</p>
              {desafio.falar && <BotaoFalar texto={desafio.falar} />}
            </div>
            <div className="mt-3 grid gap-2">
              {desafio.opcoes.map((op: string, k: number) => {
                const respondeu = !!respDesafio;
                const certa = respondeu && op === desafio.resposta, marcada = respDesafio === op;
                return (
                  <button key={op} disabled={respondeu} onClick={() => responderDesafio(op)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${certa ? "border-ok bg-ok/15" : marcada ? "border-erro bg-erro/15" : "border-linha"}`}>
                    <span className="numero flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-painel2 font-bold">{"ABC"[k]}</span>{op}
                  </button>
                );
              })}
            </div>
            {respDesafio && <p className="mt-2 text-sm">{respDesafio === desafio.resposta ? "Acertou! +3 pontos 🎉" : `A resposta era: ${desafio.resposta}. Amanhã tem outro!`}</p>}
          </section>
        )}
        {membro && (() => {
          const feitas = semanaAtual.find((p) => p.membro_id === membro)?.atividades || 0;
          return (
            <section className="rounded-2xl p-4 text-white" style={{ background: "var(--cor)" }}>
              <p className="text-sm opacity-90">Meta da semana</p>
              <p className="numero text-3xl font-bold">{Math.min(feitas, meta)} de {meta} atividades {feitas >= meta ? "✅" : ""}</p>
              <div className="mt-2 flex gap-1.5">{Array.from({ length: meta }).map((_, i) => <span key={i} className="h-3 flex-1 rounded-full" style={{ background: i < feitas ? "#fff" : "rgba(255,255,255,.3)" }} />)}</div>
              <p className="mt-1 text-xs opacity-90">Cada quiz conta 1. Na roleta, cada 5 giros contam 1. Pontos = acertos no quiz + 2 por roleta.</p>
            </section>
          );
        })()}
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
        <section className="rounded-2xl bg-painel p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">🏆 Placar de estudo</h2>
            <select className="campo w-auto py-1.5 text-sm" value={periodo} onChange={(e) => carregarPlacar(0, e.target.value)} aria-label="Período do placar">
              <option value="semana">Esta semana</option>
              <option value="semana-passada">Semana passada</option>
              <option value="mes">Este mês</option>
              <option value="temporada">Temporada {nomeTemporada}</option>
              <option value="temporada-passada">Temporada passada</option>
            </select>
          </div>
          <ol className="space-y-1.5">
            {placar.map((p) => (
              <li key={p.membro_id} className={`flex items-center gap-3 rounded-xl p-2 ${p.membro_id === membro ? "bg-painel2 ring-2 ring-[var(--cor)]" : ""}`}>
                <span className="numero w-7 text-center text-xl font-bold">{p.posicao}º</span>
                <Avatar foto={p.foto_url} nome={p.nome} tamanho={32} mostrarFaixa={false} />
                <span className="min-w-0 flex-1 truncate">{p.apelido || p.nome} {p.meta_ok && "✅"}{titulos[p.membro_id] && <span className="block truncate text-xs text-suave">{titulos[p.membro_id]}</span>}</span>
                <span className="text-xs text-suave">{p.atividades} ativ.</span>
                <span className="numero w-12 text-right text-lg font-bold">{p.pontos}</span>
              </li>
            ))}
            {!placar.length && <p className="text-sm text-suave">Ninguém estudou neste período ainda. Seja o primeiro!</p>}
          </ol>
          <p className="mt-2 text-xs text-suave">
            ✅ = bateu a meta de {meta} atividades na semana. {periodo === "temporada" && <>A temporada {nomeTemporada} termina em {fimTemporada.split("-").reverse().join("/")}: os 3 primeiros ganham título de campeão! 🏆</>}
          </p>
        </section>

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <EscolhaVoz />
            <button className="btn-sec text-sm" onClick={() => setTatame(true)}>⛶ Modo tatame (tela cheia)</button>
          </div>
          <Tatame ativo={tatame} onSair={() => setTatame(false)}>
            <RodaSorteio grande={tatame}
              itens={filtradas.map((p) => ({ id: p.id, rotulo: modo === "roleta-palavra" ? p.termo : p.significado, cor: corCategoria(p.categoria) }))}
              onSorteio={(i) => { const p = filtradas.slice(0, 40)[i]; setSorteada(p); setRevelado(false); contarGiro(modo); if (modo === "roleta-palavra") falar(p.termo, p.kana); }}
            />
            {sorteada && (
              <div className={`mx-auto w-full rounded-3xl bg-painel p-6 text-center shadow-2xl ${tatame ? "max-w-2xl" : "max-w-sm"}`} style={{ borderTop: `8px solid ${corCategoria(sorteada.categoria)}` }}>
                <p className="text-xs uppercase tracking-wide text-suave">{sorteada.categoria}</p>
                <div className="mt-1 flex items-center justify-center gap-3">
                  <p className={`font-extrabold ${tatame ? "text-7xl" : "text-4xl"}`}>{modo === "roleta-palavra" ? sorteada.termo : sorteada.significado}</p>
                  {modo === "roleta-palavra" && <BotaoFalar texto={sorteada.termo} kana={sorteada.kana} grande={tatame} />}
                </div>
                {modo === "roleta-palavra" && sorteada.grafia_antiga && <p className="text-sm text-suave">grafia antiga: {sorteada.grafia_antiga}</p>}
                {revelado ? (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <p className={`font-bold ${tatame ? "text-5xl" : "text-2xl"}`} style={{ color: "var(--color-ok)" }}>{modo === "roleta-palavra" ? sorteada.significado : sorteada.termo}</p>
                    {modo === "roleta-significado" && <BotaoFalar texto={sorteada.termo} kana={sorteada.kana} grande={tatame} />}
                  </div>
                ) : (
                  <button className={`btn mt-4 ${tatame ? "px-8 py-4 text-2xl" : ""}`} onClick={() => setRevelado(true)}>Mostrar resposta</button>
                )}
              </div>
            )}
          </Tatame>
        </>
      )}

      {modo === "flashcards" && cartas && (
        <>
          {cartas.i === 0 && !cartas.virada && <Filtros />}
          {cartas.i === 0 && !cartas.virada && <button className="btn-sec text-sm" onClick={montarCartas}>Montar com esses filtros</button>}
          {cartas.fim ? (
            <div className="rounded-3xl bg-painel p-6 text-center">
              {cartas.fila.length ? (
                <>
                  <p className="numero text-6xl font-extrabold">{cartas.acertos}/{cartas.fila.length}</p>
                  <p className="mt-2">Revisão feita! As que você errou voltam amanhã; as que acertou demoram mais para voltar.</p>
                </>
              ) : <p className="text-xl">Nada para revisar hoje. Volte amanhã! ✅</p>}
              <button className="btn mt-4" onClick={montarCartas}>Revisar de novo</button>
            </div>
          ) : (() => {
            const c = cartas.fila[cartas.i];
            const caixa = cartas.mapa.get(c.id)?.caixa || 0;
            return (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-suave"><span>Carta {cartas.i + 1} de {cartas.fila.length}</span><span>{caixa ? `nível ${caixa} de 5` : "nova"}</span></div>
                <button onClick={() => setCartas({ ...cartas, virada: !cartas.virada })}
                  className="flex min-h-56 w-full flex-col items-center justify-center gap-2 rounded-3xl bg-painel p-6 text-center shadow-2xl" style={{ borderTop: `8px solid ${corCategoria(c.categoria)}` }}>
                  {!cartas.virada ? (
                    <>
                      <span className="flex items-center gap-2 text-4xl font-extrabold">{c.termo} <BotaoFalar texto={c.termo} kana={c.kana} /></span>
                      <span className="text-sm text-suave">Toque para virar</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-suave">{c.termo}</span>
                      <span className="text-3xl font-bold" style={{ color: "var(--color-ok)" }}>{c.significado}</span>
                    </>
                  )}
                </button>
                {cartas.virada && (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-sec py-4 text-lg" onClick={() => marcarCarta(false)}>😅 Errei</button>
                    <button className="btn py-4 text-lg" onClick={() => marcarCarta(true)}>💪 Acertei</button>
                  </div>
                )}
              </div>
            );
          })()}
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
              {modo === "simulado" && (
                <p className="mt-2 text-sm text-suave">
                  {quiz.acertos >= 7 ? `Você está pronto na teoria para a faixa ${quiz.alvo || "seguinte"}! O professor vê seu resultado.` : "No simulado, 7 acertos é o objetivo. Estude a matéria e tente de novo."}
                </p>
              )}
              <button className="btn mt-4" onClick={() => (modo === "simulado" ? montarSimulado() : montarQuiz(modo))}>Jogar de novo</button>
            </div>
          ) : (() => {
            const p = quiz.perguntas[quiz.i];
            return (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-suave"><span>{modo === "simulado" && quiz.alvo ? `Simulado faixa ${quiz.alvo} · ` : ""}Pergunta {quiz.i + 1} de {quiz.perguntas.length}</span><span>✓ {quiz.acertos}</span></div>
                <div className="rounded-3xl bg-painel p-6 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-3xl font-extrabold">{p.pergunta}</p>
                    {modo !== "quiz-significado" && <BotaoFalar texto={p.pergunta} kana={p.kana} />}
                  </div>
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
