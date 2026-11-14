"use client";
import { useEffect, useRef, useState } from "react";
import { Tatame } from "@/components/Tatame";
import { falar } from "@/lib/fala";
import { PlacarJudo, type PlacarApi } from "@/components/PlacarJudo";

type Fase = "parado" | "preparar" | "luta" | "descanso" | "fim";

// Cronômetro de randori/round em tela cheia, com bipe e "Hajime!"/"Matte!" falados
export default function Cronometro() {
  const [cfg, setCfg] = useState({ rounds: 5, luta: 240, descanso: 60, preparar: 10, voz: true });
  const [fase, setFase] = useState<Fase>("parado");
  const [round, setRound] = useState(1);
  const [resta, setResta] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [tela, setTela] = useState(false);
  const [modo, setModo] = useState<"rounds" | "luta">("rounds");
  const [estilo, setEstilo] = useState("placar");
  useEffect(() => { try { setEstilo(localStorage.getItem("ma_crono_estilo") || "placar"); } catch { /* */ } }, []);
  const escolherEstilo = (e: string) => { setEstilo(e); try { localStorage.setItem("ma_crono_estilo", e); } catch { /* */ } };
  const audio = useRef<AudioContext | null>(null);
  const placar = useRef<PlacarApi | null>(null);
  const [troca, setTroca] = useState<null | "rounds" | "luta">(null);
  const [placarCorrendo, setPlacarCorrendo] = useState(false);
  useEffect(() => { const t = setInterval(() => setPlacarCorrendo(!!placar.current?.correndo()), 1000); return () => clearInterval(t); }, []);
  const roundsCorrendo = fase !== "parado" && fase !== "fim" && !pausado;

  // trocar de aba: se o relógio da aba atual estiver correndo, pergunta o que fazer
  function irAba(m: "rounds" | "luta") {
    if (m === modo) return;
    const correndo = modo === "rounds" ? roundsCorrendo : !!placar.current?.correndo();
    if (correndo) setTroca(m); else setModo(m);
  }
  function decidir(acao: "pausar" | "continuar" | "levar") {
    const destino = troca!;
    if (acao !== "continuar") { if (modo === "rounds") setPausado(true); else placar.current?.pausar(); }
    if (acao === "levar") {
      if (modo === "rounds") placar.current?.definirTempo(fase === "luta" ? resta : cfg.luta);
      else if (fase !== "parado" && fase !== "fim") { setFase("luta"); setResta(placar.current?.tempo() ?? cfg.luta); setPausado(true); }
    }
    setTroca(null); setModo(destino);
  }

  const [som, setSom] = useState({ tipo: "bipe", volume: 0.7 });
  useEffect(() => { try { const x = JSON.parse(localStorage.getItem("ma_crono_som") || "null"); if (x) setSom(x); } catch { /* */ } }, []);
  const mudarSom = (x: any) => { const n = { ...som, ...x }; setSom(n); try { localStorage.setItem("ma_crono_som", JSON.stringify(n)); } catch { /* */ } };

  function ctxAudio() { audio.current ||= new AudioContext(); return audio.current; }
  // bipe simples (contagem regressiva e estilo "Bipe")
  function bipe(freq = 880, dur = 0.25, vezes = 1, vol = som.volume) {
    try {
      const ac = ctxAudio();
      for (let i = 0; i < vezes; i++) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime + i * (dur + 0.12);
        g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }
    } catch { /* sem áudio */ }
  }
  // apito de árbitro: som agudo com vibração
  function apito(dur = 0.6, vezes = 1) {
    try {
      const ac = ctxAudio();
      for (let i = 0; i < vezes; i++) {
        const t = ac.currentTime + i * (dur + 0.15);
        const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        o.type = "square"; o.frequency.value = 2900; lfo.frequency.value = 30; lg.gain.value = 180;
        lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * som.volume + 0.0001, t + 0.03);
        g.gain.setValueAtTime(0.22 * som.volume + 0.0001, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
      }
    } catch { /* */ }
  }
  // gongo: grave e longo
  function gongo(vezes = 1) {
    try {
      const ac = ctxAudio();
      for (let i = 0; i < vezes; i++) {
        const t = ac.currentTime + i * 1.2;
        [110, 220.5, 331, 523].forEach((f, k) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.frequency.value = f; o.connect(g); g.connect(ac.destination);
          g.gain.setValueAtTime((0.5 / (k + 1)) * som.volume + 0.0001, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
          o.start(t); o.stop(t + 3);
        });
      }
    } catch { /* */ }
  }
  function tocar(momento: "inicio" | "pausa" | "fim") {
    const vezes = momento === "inicio" ? 1 : momento === "pausa" ? 2 : 3;
    if (som.tipo === "apito") apito(momento === "inicio" ? 0.8 : 0.4, vezes);
    else if (som.tipo === "gongo") gongo(momento === "fim" ? 2 : 1);
    else if (som.tipo === "bipe") bipe(momento === "inicio" ? 1000 : momento === "pausa" ? 500 : 400, momento === "inicio" ? 0.5 : 0.35, vezes);
  }

  function irPara(f: Fase, r = round) {
    setFase(f); setRound(r);
    if (f === "preparar") setResta(cfg.preparar);
    if (f === "luta") { setResta(cfg.luta); tocar("inicio"); if (cfg.voz) falar("Hajime"); }
    if (f === "descanso") { setResta(cfg.descanso); tocar("pausa"); if (cfg.voz) falar("Matte"); }
    if (f === "fim") { tocar("fim"); if (cfg.voz) falar("Soremade"); }
  }

  useEffect(() => {
    if (fase === "parado" || fase === "fim" || pausado) return;
    const t = setInterval(() => setResta((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [fase, pausado]);

  useEffect(() => {
    if (fase === "parado" || fase === "fim") return;
    if (som.tipo !== "mudo" && resta === 10 && fase === "luta") bipe(700, 0.15, 1, som.volume * 0.6);
    if (som.tipo !== "mudo" && resta > 0 && resta <= 3) bipe(660, 0.1, 1, som.volume * 0.6);
    if (resta > 0) return;
    if (fase === "preparar") irPara("luta", 1);
    else if (fase === "luta") round >= cfg.rounds ? irPara("fim") : irPara("descanso");
    else if (fase === "descanso") irPara("luta", round + 1);
  }, [resta]); // eslint-disable-line

  function comecar() { setPausado(false); irPara(cfg.preparar ? "preparar" : "luta", 1); }
  function parar() { setFase("parado"); setPausado(false); setTela(false); }

  const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const cor = fase === "luta" ? "var(--color-ok)" : fase === "descanso" ? "var(--color-erro)" : fase === "preparar" ? "var(--color-alerta)" : "var(--cor)";
  const rotulo = { parado: "", preparar: "Preparar", luta: "HAJIME", descanso: "Descanso", fim: "Sore-made!" }[fase];

  const Campo = ({ k, r, passo = 1, seg = false }: any) => (
    <div className="rounded-2xl bg-painel p-3 text-center">
      <p className="text-sm text-suave">{r}</p>
      <div className="mt-1 flex items-center justify-center gap-3">
        <button className="btn-sec h-10 w-10 p-0 text-xl" onClick={() => setCfg({ ...cfg, [k]: Math.max(seg ? 0 : 1, (cfg as any)[k] - passo) })}>−</button>
        <span className="numero w-20 text-3xl font-bold">{seg ? mmss((cfg as any)[k]) : (cfg as any)[k]}</span>
        <button className="btn-sec h-10 w-10 p-0 text-xl" onClick={() => setCfg({ ...cfg, [k]: (cfg as any)[k] + passo })}>+</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Cronômetro</h1>
      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        <button onClick={() => irAba("rounds")} className={`flex-1 rounded-xl py-2 font-semibold ${modo === "rounds" ? "bg-painel2" : "text-suave"}`}>
          ⏱️ Rounds (treino){modo !== "rounds" && roundsCorrendo && <span className="ml-1 text-ok" title="correndo">●</span>}</button>
        <button onClick={() => irAba("luta")} className={`flex-1 rounded-xl py-2 font-semibold ${modo === "luta" ? "bg-painel2" : "text-suave"}`}>
          🥋 Luta com placar{modo !== "luta" && placarCorrendo && <span className="ml-1 text-ok" title="correndo">●</span>}</button>
      </div>
      {troca && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setTroca(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-painel p-5 sm:rounded-3xl" onClick={(x) => x.stopPropagation()}>
            <p className="text-lg font-bold">⏱️ O relógio {modo === "rounds" ? "dos rounds" : "da luta"} está correndo</p>
            <p className="text-sm text-suave">O que fazer com ele ao ir para {troca === "luta" ? "a luta com placar" : "os rounds"}?</p>
            {(modo === "rounds" || (fase !== "parado" && fase !== "fim")) && <button className="btn w-full" onClick={() => decidir("levar")}>🔁 Pausar e usar o mesmo tempo ({modo === "rounds" ? mmss(fase === "luta" ? resta : cfg.luta) : mmss(placar.current?.tempo() ?? 0)}) lá</button>}
            <button className="btn-sec w-full" onClick={() => decidir("pausar")}>⏸ Só pausar</button>
            <button className="btn-sec w-full" onClick={() => decidir("continuar")}>▶ Deixar correndo</button>
            <button className="w-full text-sm text-suave underline" onClick={() => setTroca(null)}>Ficar aqui</button>
          </div>
        </div>
      )}
      <div className={modo === "luta" ? "" : "hidden"}><PlacarJudo voz={cfg.voz} api={placar} /></div>
      {modo === "rounds" && (<>
      {fase === "parado" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo k="rounds" r="Rounds" />
            <Campo k="luta" r="Tempo de luta" passo={30} seg />
            <Campo k="descanso" r="Descanso" passo={15} seg />
            <Campo k="preparar" r="Preparar" passo={5} seg />
          </div>
          <div className="flex flex-wrap gap-2">
            {[["Kids", 3, 90, 60], ["Randori", 5, 240, 60], ["Competição", 4, 240, 90], ["Uchikomi", 6, 60, 30]].map(([n, r, l, d]) => (
              <button key={n as string} className="chip py-2" onClick={() => setCfg({ ...cfg, rounds: r as number, luta: l as number, descanso: d as number })}>{n}</button>
            ))}
          </div>
          <div className="space-y-3 rounded-2xl bg-painel p-4">
            <p className="font-semibold">Som</p>
            <div className="flex flex-wrap gap-2">
              {[["bipe", "🔔 Bipe"], ["apito", "🎵 Apito"], ["gongo", "🥁 Gongo"], ["mudo", "🔇 Sem som"]].map(([k, r]) => (
                <button key={k} className="chip py-2" onClick={() => { mudarSom({ tipo: k }); setTimeout(() => { if (k === "apito") apito(0.5); else if (k === "gongo") gongo(); else if (k === "bipe") bipe(1000, 0.4); }, 50); }}
                  style={som.tipo === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{r}</button>
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm">🔈 <input type="range" min={0.1} max={1} step={0.1} value={som.volume} className="flex-1" onChange={(e) => mudarSom({ volume: Number(e.target.value) })} /> 🔊</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.voz} onChange={(e) => setCfg({ ...cfg, voz: e.target.checked })} /> Falar “Hajime”, “Matte” e “Sore-made” junto</label>
          </div>
          <button className="btn w-full py-5 text-2xl" onClick={comecar}>▶ Começar</button>
        </>
      )}

      {fase === "parado" && (
        <div>
          <p className="mb-2 text-sm text-suave">Estilo do cronômetro</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ESTILOS.map((e) => (
              <button key={e.id} onClick={() => escolherEstilo(e.id)} className="rounded-xl border-2 p-3 text-left"
                style={{ borderColor: estilo === e.id ? "var(--cor)" : "var(--color-linha)" }}>
                <span className="block font-semibold">{e.icone} {e.nome}</span>
                <span className="text-xs text-suave">{e.texto}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Tatame ativo={tela && fase !== "parado"} onSair={() => setTela(false)}>
        {fase !== "parado" && (
          <div className="flex w-full flex-col items-center gap-4">
            <Visor estilo={estilo} fase={fase} rotulo={rotulo} cor={cor} tempo={mmss(resta)} resta={resta}
              total={fase === "luta" ? cfg.luta : fase === "descanso" ? cfg.descanso : fase === "preparar" ? cfg.preparar : 1}
              round={round} rounds={cfg.rounds} grande={tela} />
            <div className="flex flex-wrap justify-center gap-2">
              {fase !== "fim" && <button className="btn px-6 py-3 text-lg" onClick={() => setPausado(!pausado)}>{pausado ? "▶ Continuar" : "⏸ Pausar"}</button>}
              {!tela && <button className="btn-sec px-6 py-3 text-lg" onClick={() => setTela(true)}>⛶ Tela cheia</button>}
              <button className="btn-sec px-6 py-3 text-lg" onClick={parar}>⏹ Encerrar</button>
            </div>
          </div>
        )}
      </Tatame>
      </>)}
    </div>
  );
}

const ESTILOS = [
  { id: "placar", nome: "Placar", icone: "🔢", texto: "Números gigantes na cor da fase" },
  { id: "anel", nome: "Anel", icone: "⭕", texto: "Círculo que vai esvaziando" },
  { id: "led", nome: "Painel LED", icone: "📟", texto: "Como o placar de campeonato" },
  { id: "minimo", nome: "Minimalista", icone: "◻️", texto: "Fundo claro, só o essencial" },
];

function Visor({ estilo, fase, rotulo, cor, tempo, resta, total, round, rounds, grande }: any) {
  const tamanho = grande ? "min(34vw, 42vh)" : "min(26vw, 9rem)";
  const progresso = Math.max(0, Math.min(1, resta / Math.max(1, total)));
  const rodadas = fase !== "fim" && (
    <div className="flex gap-1.5">
      {Array.from({ length: rounds }).map((_, i) => (
        <span key={i} className="h-3 w-6 rounded-full" style={{ background: i < round ? cor : "rgba(127,127,127,.3)" }} />
      ))}
    </div>
  );

  if (estilo === "anel") {
    const r = 45, c = 2 * Math.PI * r;
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: grande ? "min(70vw, 70vh)" : "min(80vw, 22rem)", aspectRatio: "1" }}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(127,127,127,.2)" strokeWidth="6" />
            <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - progresso)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold" style={{ color: cor }}>{rotulo}</p>
            <p className="numero font-extrabold leading-none" style={{ fontSize: grande ? "min(16vw, 20vh)" : "4.5rem" }}>{tempo}</p>
            {fase !== "fim" && <p className="text-suave">Round {round}/{rounds}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (estilo === "led") {
    return (
      <div className="w-full max-w-4xl rounded-3xl border-4 border-black bg-black p-5 text-center shadow-2xl" style={{ boxShadow: `0 0 40px ${cor}55` }}>
        <div className="flex items-center justify-between font-mono text-lg uppercase tracking-widest" style={{ color: cor }}>
          <span>{rotulo}</span><span>R {round}/{rounds}</span>
        </div>
        <p className="font-mono font-bold leading-none" style={{ fontSize: tamanho, color: cor, textShadow: `0 0 18px ${cor}` }}>{tempo}</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full" style={{ width: `${progresso * 100}%`, background: cor, transition: "width 1s linear" }} /></div>
      </div>
    );
  }

  if (estilo === "minimo") {
    return (
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 text-center text-neutral-900 shadow-xl">
        <p className="text-lg font-semibold uppercase tracking-wide text-neutral-500">{rotulo}{fase !== "fim" ? ` · round ${round} de ${rounds}` : ""}</p>
        <p className="font-extralight leading-none tabular-nums" style={{ fontSize: tamanho }}>{tempo}</p>
        <div className="mx-auto mt-3 h-1.5 w-2/3 rounded-full bg-neutral-200"><div className="h-full rounded-full" style={{ width: `${progresso * 100}%`, background: cor }} /></div>
      </div>
    );
  }

  // placar (padrão)
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="titulo font-extrabold leading-none" style={{ color: cor, fontSize: grande ? "min(8vw, 4rem)" : "2.5rem" }}>{rotulo}</p>
      <p className="numero font-extrabold leading-none" style={{ fontSize: tamanho, color: cor }}>{tempo}</p>
      {fase !== "fim" && <p className="numero text-2xl">Round {round} de {rounds}</p>}
      {rodadas}
    </div>
  );
}
