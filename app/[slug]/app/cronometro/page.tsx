"use client";
import { useEffect, useRef, useState } from "react";
import { Tatame } from "@/components/Tatame";
import { falar } from "@/lib/fala";

type Fase = "parado" | "preparar" | "luta" | "descanso" | "fim";

// Cronômetro de randori/round em tela cheia, com bipe e "Hajime!"/"Matte!" falados
export default function Cronometro() {
  const [cfg, setCfg] = useState({ rounds: 5, luta: 240, descanso: 60, preparar: 10, voz: true });
  const [fase, setFase] = useState<Fase>("parado");
  const [round, setRound] = useState(1);
  const [resta, setResta] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [tela, setTela] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  function bipe(freq = 880, dur = 0.25, vezes = 1) {
    try {
      audio.current ||= new AudioContext();
      for (let i = 0; i < vezes; i++) {
        const o = audio.current.createOscillator(), g = audio.current.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(audio.current.destination);
        const t = audio.current.currentTime + i * (dur + 0.12);
        g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }
    } catch { /* sem áudio */ }
  }

  function irPara(f: Fase, r = round) {
    setFase(f); setRound(r);
    if (f === "preparar") setResta(cfg.preparar);
    if (f === "luta") { setResta(cfg.luta); bipe(1000, 0.5); if (cfg.voz) falar("Hajime"); }
    if (f === "descanso") { setResta(cfg.descanso); bipe(500, 0.35, 2); if (cfg.voz) falar("Matte"); }
    if (f === "fim") { bipe(400, 0.6, 3); if (cfg.voz) falar("Soremade"); }
  }

  useEffect(() => {
    if (fase === "parado" || fase === "fim" || pausado) return;
    const t = setInterval(() => setResta((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [fase, pausado]);

  useEffect(() => {
    if (fase === "parado" || fase === "fim") return;
    if (resta === 10 && fase === "luta") bipe(700, 0.15);
    if (resta > 0 && resta <= 3) bipe(660, 0.1);
    if (resta > 0) return;
    if (fase === "preparar") irPara("luta", 1);
    else if (fase === "luta") round >= cfg.rounds ? irPara("fim") : irPara("descanso");
    else if (fase === "descanso") irPara("luta", round + 1);
  }, [resta]); // eslint-disable-line

  function comecar() { setPausado(false); setTela(true); irPara(cfg.preparar ? "preparar" : "luta", 1); }
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
      <h1 className="text-4xl font-extrabold">Cronômetro de randori</h1>
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.voz} onChange={(e) => setCfg({ ...cfg, voz: e.target.checked })} /> Falar “Hajime” e “Matte”</label>
          <button className="btn w-full py-5 text-2xl" onClick={comecar}>▶ Começar</button>
        </>
      )}

      <Tatame ativo={tela && fase !== "parado"} onSair={parar}>
        {fase !== "parado" && (
          <div className="flex w-full flex-col items-center gap-4 text-center">
            <p className="titulo text-[8vw] font-extrabold leading-none sm:text-6xl" style={{ color: cor }}>{rotulo}</p>
            <p className="numero font-extrabold leading-none" style={{ fontSize: "min(38vw, 45vh)", color: cor }}>{mmss(resta)}</p>
            {fase !== "fim" && <p className="numero text-3xl">Round {round} de {cfg.rounds}</p>}
            <div className="flex gap-3">
              {fase !== "fim" && <button className="btn px-8 py-4 text-xl" onClick={() => setPausado(!pausado)}>{pausado ? "▶ Continuar" : "⏸ Pausar"}</button>}
              <button className="btn-sec px-8 py-4 text-xl" onClick={parar}>⏹ Encerrar</button>
            </div>
          </div>
        )}
      </Tatame>
    </div>
  );
}
