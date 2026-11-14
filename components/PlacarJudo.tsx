"use client";
import { useEffect, useRef, useState } from "react";
import { falar, generoSalvo, salvarGenero, type Genero } from "@/lib/fala";
import { Tatame } from "@/components/Tatame";
import { PlacarTelao, TelaVitoria, corRelogio, iwy, mmss, NOME, type Estado, type Evento, type Lado } from "@/components/PlacarTelao";
import { supabaseNavegador } from "@/lib/supabase/client";
import { QR } from "@/components/QR";

// Placar de luta de judô (regras IJF 2025):
// - Ippon encerra; 2 waza-ari = ippon (waza-ari awasete ippon); yuko não soma.
// - Fim do tempo: vence quem tem mais waza-ari; empate, mais yuko; empate, Golden Score.
// - Golden Score: a primeira pontuação vence; shido não decide (só o 3º, hansoku-make).
// - 3 shidos = hansoku-make (o outro vence).
// - Osaekomi: 5–9 s yuko, 10–19 s waza-ari, 20 s ippon (no Golden Score, 5 s já encerra).
// - Visão do árbitro: AZUL à esquerda, BRANCO à direita.

const novo = (duracao: number, nomes?: { azul: string; branco: string }): Estado => ({
  duracao, resta: duracao, golden: false, gs: 0, correndo: false,
  azul: { nome: nomes?.azul || "", yuko: 0, waza: 0, shido: 0 },
  branco: { nome: nomes?.branco || "", yuko: 0, waza: 0, shido: 0 },
  osae: null, fim: null, eventos: [],
});
const outro = (l: Lado): Lado => (l === "azul" ? "branco" : "azul");


const FALAS = [["hajime", "Hajime"], ["matte", "Matte"], ["osaekomi", "Osaekomi"], ["toketa", "Toketa"], ["pontos", "Waza-ari / Yuko"], ["ippon", "Ippon"], ["soremade", "Sore-made (fim)"]] as const;
const ROTULO_EV: Record<Evento["tipo"], string> = { ippon: "Ippon", waza: "Waza-ari", yuko: "Yuko", shido: "Shido", hansoku: "Hansoku-make" };

// comandos que a página do cronômetro usa para manter os dois relógios coerentes
export type PlacarApi = { correndo: () => boolean; pausar: () => void; tempo: () => number; definirTempo: (seg: number) => void };
type Fala = (typeof FALAS)[number][0];

export function PlacarJudo({ voz = true, api }: { voz?: boolean; api?: React.MutableRefObject<PlacarApi | null> }) {
  // o que a voz fala (padrão: só Hajime e Sore-made) e o jeito do placar — lembrados no aparelho
  const [falas, setFalas] = useState<Record<Fala, boolean>>({ hajime: true, matte: false, osaekomi: false, toketa: false, pontos: false, ippon: true, soremade: true });
  const [genero, setGenero] = useState<Genero>("feminina");
  const [corrigir, setCorrigir] = useState(false);
  const [layout, setLayout] = useState<"arbitro" | "olimpico">("arbitro");
  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem("ma_placar_falas") || "null"); if (f) setFalas((x) => ({ ...x, ...f }));
      setGenero(generoSalvo());
      const l = localStorage.getItem("ma_placar_layout"); if (l === "olimpico" || l === "arbitro") setLayout(l);
    } catch { /* */ }
  }, []);
  const mudarFala = (k: Fala, v: boolean) => { const n = { ...falas, [k]: v }; setFalas(n); try { localStorage.setItem("ma_placar_falas", JSON.stringify(n)); } catch { /* */ } };
  const mudarLayout = (l: "arbitro" | "olimpico") => { setLayout(l); try { localStorage.setItem("ma_placar_layout", l); } catch { /* */ } };
  const falasRef = useRef(falas); falasRef.current = falas;
  const generoRef = useRef(genero); generoRef.current = genero;
  const diz = (k: Fala, texto: string, fila = false) => { if (voz && falasRef.current[k]) falar(texto, null, generoRef.current, { fila }); };
  const mudarGenero = (g: Genero) => { setGenero(g); salvarGenero(g); falar("Hajime", null, g); };
  const [e, setE] = useState<Estado>(novo(240));
  const [pilha, setPilha] = useState<Estado[]>([]);
  const [tela, setTela] = useState(false);
  const ref = useRef(e);
  ref.current = e;
  const audio = useRef<AudioContext | null>(null);

  function som(freq: number, dur: number, vezes = 1) {
    try {
      audio.current ||= new AudioContext();
      const ac = audio.current;
      for (let i = 0; i < vezes; i++) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime + i * (dur + 0.1);
        g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }
    } catch { /* sem áudio */ }
  }

  // registra cada pontuação (para o menu "Corrigir pontos")
  const quando = (x: Estado) => (x.golden ? `GS +${mmss(x.gs)}` : mmss(x.resta));
  function registrar(x: Estado, lado: Lado, tipo: Evento["tipo"], obs?: string) {
    x.eventos = [...(x.eventos || []), { id: Date.now() + Math.random(), lado, tipo, quando: quando(x), obs }];
  }

  // guarda o estado anterior para "Desfazer"
  function aplicar(f: (x: Estado) => Estado) {
    setPilha((p) => [...p.slice(-40), ref.current]);
    setE((x) => verificar(f(structuredClone(x))));
  }
  function desfazer() {
    setPilha((p) => { if (!p.length) return p; setE(p[p.length - 1]); return p.slice(0, -1); });
  }

  // decide se a luta acabou
  function verificar(x: Estado): Estado {
    if (x.fim) return x;
    for (const l of ["azul", "branco"] as Lado[]) {
      if (x[l].hansoku) return encerrar(x, outro(l), `Hansoku-make do ${NOME[l]}`);
      if (x[l].shido >= 3) return encerrar(x, outro(l), `Hansoku-make do ${NOME[l]} (3º shido)`);
      if (x[l].ippon) return encerrar(x, l, "Ippon");
      if (x[l].waza >= 2) return encerrar(x, l, "Waza-ari awasete ippon");
    }
    return x;
  }
  function encerrar(x: Estado, lado: Lado | null, motivo: string): Estado {
    x.fim = { lado, motivo }; x.correndo = false; x.osae = null;
    return x;
  }
  // fim do tempo normal (sem imobilização em andamento)
  function fimDoTempo(x: Estado): Estado {
    const a = x.azul, b = x.branco;
    if (a.waza !== b.waza) return encerrar(x, a.waza > b.waza ? "azul" : "branco", "Vitória por waza-ari");
    if (a.yuko !== b.yuko) return encerrar(x, a.yuko > b.yuko ? "azul" : "branco", "Vitória por yuko");
    x.golden = true; x.correndo = false;
    return x;
  }

  function pontuar(l: Lado, tipo: "ippon" | "waza" | "yuko" | "shido" | "hansoku") {
    if (e.fim) return;
    aplicar((x) => {
      registrar(x, l, tipo);
      if (tipo === "ippon") { x[l].ippon = 1; return encerrar(x, l, "Ippon"); }
      if (tipo === "hansoku") { x[l].hansoku = true; return encerrar(x, outro(l), `Hansoku-make direto do ${NOME[l]}`); }
      if (tipo === "shido") { x[l].shido++; return x; }
      if (tipo === "waza") { x[l].waza++; if (x.golden && x[l].waza < 2) return encerrar(x, l, "Waza-ari no Golden Score"); return x; }
      x[l].yuko++;
      if (x.golden) return encerrar(x, l, "Yuko no Golden Score");
      return x;
    });
    if (tipo !== "shido") som(tipo === "ippon" ? 1200 : 900, 0.25);
    if (tipo === "waza" && e[l].waza === 0) diz("pontos", "Waza-ari");
    if (tipo === "yuko") diz("pontos", "Yuko");
  }

  // menu de correção: tira UMA pontuação específica (ex.: o waza-ari que não valeu) sem mexer nas outras
  function removerEvento(ev: Evento) {
    aplicar((x) => {
      x.eventos = (x.eventos || []).filter((y) => y.id !== ev.id);
      const a = x[ev.lado];
      if (ev.tipo === "ippon") a.ippon = 0;
      else if (ev.tipo === "hansoku") a.hansoku = false;
      else a[ev.tipo] = Math.max(0, a[ev.tipo] - 1);
      x.fim = null; x.correndo = false;
      return x;
    });
  }
  // ajuste direto do número (para quando a pontuação não foi lançada na hora)
  function ajustar(l: Lado, tipo: "waza" | "yuko" | "shido" | "ippon", d: 1 | -1) {
    aplicar((x) => {
      const a = x[l];
      if (d > 0) registrar(x, l, tipo, "lançado na correção");
      else {
        const lista = x.eventos || [];
        const i = lista.map((y) => y.lado === l && y.tipo === tipo).lastIndexOf(true);
        if (i >= 0) x.eventos = lista.filter((_, k) => k !== i);
      }
      if (tipo === "ippon") a.ippon = d > 0 ? 1 : 0;
      else a[tipo] = Math.max(0, a[tipo] + d);
      if (d < 0) { x.fim = null; x.correndo = false; }
      return x;
    });
  }

  function osaekomi(l: Lado) {
    if (e.fim) return;
    aplicar((x) => { x.osae = { lado: l, seg: 0 }; x.correndo = true; return x; });
    diz("osaekomi", "Osaekomi");
  }
  // toketa: dá a pontuação pelo tempo de imobilização
  function toketa() {
    aplicar((x) => {
      if (!x.osae) return x;
      const { lado, seg } = x.osae;
      x.osae = null;
      if (seg >= 10) { x[lado].waza++; registrar(x, lado, "waza", `osaekomi ${seg}s`); if (x.golden && x[lado].waza < 2) return encerrar(x, lado, "Waza-ari no Golden Score (osaekomi)"); }
      else if (seg >= 5) { x[lado].yuko++; registrar(x, lado, "yuko", `osaekomi ${seg}s`); if (x.golden) return encerrar(x, lado, "Yuko no Golden Score (osaekomi)"); }
      const v = verificar(x);
      if (!v.fim && !v.golden && v.resta <= 0) return fimDoTempo(v);
      return v;
    });
    diz("toketa", "Toketa");
  }

  // relógio
  useEffect(() => {
    const t = setInterval(() => {
      const x = ref.current;
      if (x.fim || (!x.correndo && !x.osae)) return;
      setE((y0) => {
        const y = structuredClone(y0);
        if (y.fim) return y;
        if (y.osae) {
          y.osae.seg++;
          const { lado, seg } = y.osae;
          if (seg >= 20) { y[lado].ippon = 1; registrar(y, lado, "ippon", "osaekomi 20s"); som(1200, 0.6); return encerrar(y, lado, "Ippon (osaekomi 20 s)"); }
          if (y.golden && seg >= 5) { y[lado].yuko++; registrar(y, lado, "yuko", "osaekomi 5s"); som(900, 0.5); return encerrar(y, lado, "Yuko no Golden Score (osaekomi 5 s)"); }
          if (seg >= 10 && y[lado].waza === 1) { y[lado].waza++; registrar(y, lado, "waza", "osaekomi 10s"); som(1200, 0.6); return encerrar(y, lado, "Waza-ari awasete ippon (osaekomi)"); }
        }
        if (y.correndo) {
          if (y.golden) y.gs++;
          else if (y.resta > 0) {
            y.resta--;
            if (y.resta === 0) {
              som(400, 0.8, 2);
              if (!y.osae) return fimDoTempo(y);
              // com osaekomi correndo, o tempo para mas a imobilização continua
            }
          }
        }
        return y;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  function hajimeMatte() {
    if (e.fim) return;
    const vai = !e.correndo;
    setE((x) => ({ ...x, correndo: vai && (x.golden || x.resta > 0) }));
    if (vai) diz("hajime", "Hajime"); else diz("matte", "Matte");
  }

  // efeito de fim de luta
  // efeito de fim de luta: "Ippon" (se foi ippon) e depois "Sore-made"
  useEffect(() => {
    if (!e.fim) return;
    const ippon = /ippon/i.test(e.fim.motivo);
    if (ippon) diz("ippon", /awasete/i.test(e.fim.motivo) ? "Waza-ari awasete ippon" : "Ippon");
    diz("soremade", "Sore made", ippon && falasRef.current.ippon);
  }, [!!e.fim]); // eslint-disable-line

  // a página do cronômetro conversa com o placar por aqui
  useEffect(() => {
    if (!api) return;
    api.current = {
      correndo: () => !!(ref.current.correndo || ref.current.osae) && !ref.current.fim,
      pausar: () => setE((x) => ({ ...x, correndo: false })),
      tempo: () => ref.current.resta,
      definirTempo: (seg) => { setPilha((p) => [...p.slice(-40), ref.current]); setE((x) => ({ ...x, resta: Math.max(0, Math.min(seg, x.duracao)), correndo: false, golden: false, gs: 0, fim: null })); },
    };
    return () => { api.current = null; };
  }, [api]);

  // função (não componente) para o campo de nome não perder o foco a cada segundo
  const painel = (l: Lado) => {
    const a = e[l], azul = l === "azul";
    const fundo = azul ? "#1d4ed8" : "#f8fafc", texto = azul ? "#fff" : "#0f172a";
    return (
      <div className="flex flex-1 flex-col gap-3 rounded-3xl p-4" style={{ background: fundo, color: texto, outline: e.osae?.lado === l ? "4px solid #facc15" : undefined }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tracking-widest">{NOME[l]}</span>
          <input value={a.nome} placeholder="Nome do atleta" onChange={(x) => setE((y) => ({ ...y, [l]: { ...y[l], nome: x.target.value } }))}
            className="w-full min-w-0 rounded-lg bg-transparent px-2 py-1 text-right text-sm font-semibold outline-none placeholder:opacity-50" style={{ color: texto, border: `1px solid ${azul ? "#ffffff55" : "#0f172a33"}` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div><p className="numero text-6xl font-extrabold leading-none" style={{ fontSize: tela ? "min(14vw, 9rem)" : undefined }}>{a.ippon ? "I" : a.waza}</p><p className="text-xs font-semibold opacity-80">WAZA-ARI</p></div>
          <div><p className="numero text-6xl font-extrabold leading-none opacity-90" style={{ fontSize: tela ? "min(14vw, 9rem)" : undefined }}>{a.yuko}</p><p className="text-xs font-semibold opacity-80">YUKO</p></div>
        </div>
        <div className="flex h-8 items-center justify-center gap-1.5" aria-label={`${a.shido} shido`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-8 w-6 rounded" style={{ background: a.hansoku ? "#dc2626" : i < a.shido ? (a.shido >= 3 ? "#dc2626" : "#facc15") : azul ? "#ffffff22" : "#0f172a15", border: azul ? "1px solid #ffffff44" : "1px solid #0f172a22" }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([["yuko", "+ Yuko"], ["waza", "+ Waza-ari"], ["ippon", "IPPON"], ["shido", "Shido"]] as const).map(([t, r]) => (
            <button key={t} disabled={!!e.fim} onClick={() => pontuar(l, t)} className="rounded-xl py-3 text-base font-bold disabled:opacity-40"
              style={{ background: t === "ippon" ? (azul ? "#fff" : "#1d4ed8") : t === "shido" ? "#facc15" : azul ? "#ffffff26" : "#0f172a12", color: t === "ippon" ? (azul ? "#1d4ed8" : "#fff") : t === "shido" ? "#111" : texto }}>{r}</button>
          ))}
          <button disabled={!!e.fim || !!e.osae} onClick={() => osaekomi(l)} className="col-span-2 rounded-xl py-3 font-bold disabled:opacity-40"
            style={{ background: azul ? "#ffffff26" : "#0f172a12" }}>🤼 Osaekomi</button>
          <button disabled={!!e.fim} onClick={() => confirm(`Hansoku-make direto do ${NOME[l]}?`) && pontuar(l, "hansoku")} className="col-span-2 rounded-lg py-1.5 text-xs font-semibold opacity-80 disabled:opacity-40"
            style={{ border: "1px solid #dc2626", color: azul ? "#fecaca" : "#b91c1c" }}>Hansoku-make direto</button>
        </div>
      </div>
    );
  };

  // botões compactos de cada atleta (no modo olímpico, ficam embaixo do placar)
  const controles = (l: Lado) => {
    const azul = l === "azul";
    return (
      <div className="grid grid-cols-6 gap-1 rounded-2xl p-2" style={{ background: azul ? "#1d4ed8" : "#e2e8f0", color: azul ? "#fff" : "#0f172a" }}>
        <span className="col-span-6 text-xs font-bold">{NOME[l]}{e[l].nome ? ` · ${e[l].nome}` : ""}</span>
        {([["yuko", "Y"], ["waza", "W"], ["ippon", "IPPON"], ["shido", "S"]] as const).map(([t, r]) => (
          <button key={t} disabled={!!e.fim} onClick={() => pontuar(l, t)} className={`rounded-lg py-2 text-sm font-bold disabled:opacity-40 ${t === "ippon" ? "col-span-2" : ""}`}
            style={{ background: t === "shido" ? "#facc15" : azul ? "#ffffff26" : "#ffffff", color: t === "shido" ? "#111" : undefined }}>{r}</button>
        ))}
        <button disabled={!!e.fim || !!e.osae} onClick={() => osaekomi(l)} className="col-span-6 rounded-lg py-1.5 text-sm font-bold disabled:opacity-40" style={{ background: azul ? "#ffffff26" : "#ffffff" }}>🤼 Osaekomi</button>
      </div>
    );
  };

  // ---------- Transmitir para outra tela (tablet/TV) em tempo real ----------
  const [sala, setSala] = useState<string | null>(null);
  const [telas, setTelas] = useState(0);
  const canal = useRef<any>(null);
  function transmitir() {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const sb = supabaseNavegador();
    const ch = sb.channel(`placar-${codigo}`, { config: { broadcast: { self: false }, presence: { key: "arbitro" } } });
    ch.on("broadcast", { event: "pedir" }, () => ch.send({ type: "broadcast", event: "estado", payload: ref.current }))
      .on("presence", { event: "sync" }, () => setTelas(Object.keys(ch.presenceState()).filter((k) => k !== "arbitro").length))
      .subscribe((st: string) => { if (st === "SUBSCRIBED") ch.track({ papel: "arbitro" }); });
    canal.current = ch; setSala(codigo);
  }
  function pararTransmissao() { canal.current?.unsubscribe(); canal.current = null; setSala(null); setTelas(0); }
  useEffect(() => { if (canal.current) canal.current.send({ type: "broadcast", event: "estado", payload: e }); }, [e]);
  useEffect(() => () => { canal.current?.unsubscribe(); }, []);

  const vencedor = e.fim?.lado;
  return (
    <div className="space-y-4">
      {!tela && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-suave">Tempo:</span>
          {[120, 180, 240].map((s) => (
            <button key={s} className="chip" disabled={e.correndo} onClick={() => { setPilha([]); setE({ ...novo(s, { azul: e.azul.nome, branco: e.branco.nome }), info: e.info }); }}
              style={e.duracao === s ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{mmss(s)}</button>
          ))}
          <span className="text-xs text-suave">Visão do árbitro: azul à esquerda, branco à direita (regra IJF).</span>
        </div>
      )}
      {!tela && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-painel p-3 text-sm">
          <span className="font-semibold">Placar:</span>
          {([["arbitro", "👨‍⚖️ Lado a lado (árbitro)"], ["olimpico", "📺 Olímpico (telão)"]] as const).map(([k, r]) => (
            <button key={k} className="chip" onClick={() => mudarLayout(k)} style={layout === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{r}</button>
          ))}
          {sala
            ? <button className="chip" style={{ background: "#16a34a", borderColor: "#16a34a", color: "#fff" }} onClick={pararTransmissao}>📡 Transmitindo · sala {sala} · {telas} tela(s) — parar</button>
            : <button className="chip" onClick={transmitir}>📡 Transmitir para tablet/TV</button>}
          <span className="font-semibold">Voz:</span>
          {(["feminina", "masculina", "grave"] as Genero[]).map((g) => (
            <button key={g} className="chip text-xs" onClick={() => mudarGenero(g)} style={genero === g ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>
              {g === "feminina" ? "👩 Feminina" : g === "masculina" ? "👨 Masculina" : "🎙️ Grave"}</button>
          ))}
          <span className="font-semibold">Fala:</span>
          {FALAS.map(([k, r]) => (
            <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={falas[k]} onChange={(x) => mudarFala(k, x.target.checked)} /> {r}</label>
          ))}
        </div>
      )}
      {!tela && (
        <details className="rounded-2xl bg-painel p-3 text-sm">
          <summary className="cursor-pointer font-semibold">🏷️ Categoria e fase (opcional, aparece no placar)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className="campo" placeholder="Categoria (ex.: Sub-15 -50 kg)" value={e.info?.categoria || ""} onChange={(x) => setE((y) => ({ ...y, info: { ...y.info, categoria: x.target.value } }))} />
            <input className="campo" placeholder="Fase (ex.: Semifinal, Randori)" value={e.info?.fase || ""} onChange={(x) => setE((y) => ({ ...y, info: { ...y.info, fase: x.target.value } }))} />
          </div>
        </details>
      )}
      {sala && !tela && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-painel p-4">
          <QR texto={`${typeof window !== "undefined" ? window.location.origin : ""}/placar/${sala}`} tamanho={130} />
          <div className="space-y-1 text-sm">
            <p className="text-lg font-bold">Sala {sala}</p>
            <p>No tablet ou na TV, aponte a câmera para o QR ou abra <b>{typeof window !== "undefined" ? window.location.host : ""}/placar/{sala}</b>.</p>
            <p className="text-suave">Você comanda daqui (celular) e o placar aparece lá na hora. Deixe esta tela aberta.</p>
          </div>
        </div>
      )}
      <Tatame ativo={tela} onSair={() => setTela(false)}>
        <div className="w-full max-w-5xl space-y-3">
          <div className={`flex flex-wrap items-center justify-center gap-3 rounded-3xl bg-painel p-3 text-center ${layout === "olimpico" ? "hidden" : ""}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-suave">{e.golden ? "Golden Score" : "Tempo"}</p>
              <p className="numero font-extrabold leading-none" style={{ fontSize: tela ? "min(12vw, 7rem)" : "3.5rem", color: corRelogio(e) }}>{e.golden ? `+${mmss(e.gs)}` : mmss(e.resta)}</p>
            </div>
            {e.osae && (
              <div className="rounded-2xl px-4 py-2" style={{ background: "#facc15", color: "#111" }}>
                <p className="text-xs font-bold">OSAEKOMI · {NOME[e.osae.lado]}</p>
                <p className="numero text-4xl font-extrabold leading-none">{e.osae.seg}s</p>
                <p className="text-[11px]">{e.osae.seg >= 10 ? "waza-ari" : e.osae.seg >= 5 ? "yuko" : "—"}</p>
              </div>
            )}
          </div>
          {layout === "olimpico" ? (
            <>
              <PlacarTelao e={e} grande={tela} />
              <div className="grid gap-2 sm:grid-cols-2">{controles("azul")}{controles("branco")}</div>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              {painel("azul")}
              {painel("branco")}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn px-8 py-4 text-xl" disabled={!!e.fim} onClick={hajimeMatte}>{e.correndo ? "✋ Matte" : "▶ Hajime"}</button>
            {e.osae && <button className="btn-sec px-6 py-4 text-xl" onClick={toketa}>Toketa</button>}
            <button className="btn-sec px-4 py-4" disabled={!pilha.length} onClick={desfazer}>↩️ Desfazer</button>
            <button className="btn-sec px-4 py-4" onClick={() => setCorrigir(true)}>✏️ Corrigir pontos</button>
            {!tela && <button className="btn-sec px-4 py-4" onClick={() => setTela(true)}>⛶ Tela cheia</button>}
            <button className="btn-sec px-4 py-4" onClick={() => { if (confirm("Começar uma luta nova?")) { setPilha([]); setE({ ...novo(e.duracao), info: e.info }); } }}>🔄 Nova luta</button>
          </div>
        </div>
      </Tatame>

      <TelaVitoria e={e} onFechar={() => setE((x) => ({ ...x, fim: null }))}>
        <div className="mt-4 flex gap-2" onClick={(x) => x.stopPropagation()}>
          <button className="rounded-xl bg-black/20 px-5 py-3 font-semibold" onClick={desfazer}>↩️ Desfazer</button>
          <button className="rounded-xl bg-black/20 px-5 py-3 font-semibold" onClick={() => setCorrigir(true)}>✏️ Corrigir</button>
          <button className="rounded-xl bg-black/20 px-5 py-3 font-semibold" onClick={() => { setPilha([]); setE({ ...novo(e.duracao), info: e.info }); }}>🔄 Nova luta</button>
        </div>
      </TelaVitoria>

      {corrigir && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setCorrigir(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-3xl bg-painel p-4 sm:rounded-3xl" onClick={(x) => x.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold">✏️ Corrigir pontos</h2>
              <button className="btn-sec text-sm" onClick={() => setCorrigir(false)}>Fechar</button>
            </div>
            <p className="mb-3 text-sm text-suave">Toque em ✕ para tirar só aquela pontuação (as outras ficam). Ou ajuste os números com − e +. O relógio fica parado durante a correção.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["azul", "branco"] as Lado[]).map((l) => {
                const azul = l === "azul", a = e[l];
                const evs = (e.eventos || []).filter((y) => y.lado === l);
                return (
                  <div key={l} className="space-y-2 rounded-2xl p-3" style={{ background: azul ? "#1d4ed8" : "#f8fafc", color: azul ? "#fff" : "#0f172a" }}>
                    <p className="flex items-center justify-between font-bold"><span>{NOME[l]}{a.nome ? ` · ${a.nome}` : ""}</span><span className="numero text-2xl">{iwy(a).join("")}</span></p>
                    {([["ippon", "Ippon"], ["waza", "Waza-ari"], ["yuko", "Yuko"], ["shido", "Shido"]] as const).map(([t, r]) => (
                      <div key={t} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{r}</span>
                        <div className="flex items-center gap-2">
                          <button className="h-9 w-9 rounded-lg text-lg font-bold" style={{ background: azul ? "#ffffff26" : "#0f172a14" }} onClick={() => ajustar(l, t, -1)}>−</button>
                          <span className="numero w-6 text-center text-xl font-bold">{t === "ippon" ? (a.ippon ? 1 : 0) : a[t]}</span>
                          <button className="h-9 w-9 rounded-lg text-lg font-bold disabled:opacity-30" style={{ background: azul ? "#ffffff26" : "#0f172a14" }}
                            disabled={t === "ippon" && !!a.ippon} onClick={() => ajustar(l, t, 1)}>+</button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2" style={{ borderColor: azul ? "#ffffff33" : "#0f172a22" }}>
                      <p className="mb-1 text-xs font-semibold opacity-80">Pontuações na ordem</p>
                      {evs.length ? (
                        <ul className="space-y-1">
                          {evs.map((ev) => (
                            <li key={ev.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm" style={{ background: azul ? "#ffffff1a" : "#0f172a0d" }}>
                              <span><b>{ROTULO_EV[ev.tipo]}</b> <span className="numero opacity-70">{ev.quando}</span>{ev.obs ? <span className="opacity-70"> · {ev.obs}</span> : null}</span>
                              <button className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: "#dc2626", color: "#fff" }} onClick={() => removerEvento(ev)} aria-label={`Tirar ${ROTULO_EV[ev.tipo]}`}>✕ tirar</button>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-xs opacity-70">Nenhuma pontuação ainda.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {e.fim && <p className="mt-3 text-sm text-alerta">A luta está encerrada ({e.fim.motivo}). Tirar uma pontuação reabre a luta.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
