"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// Efeitos de tela (como na MA Online Store): partículas leves por cima do app,
// que não atrapalham o toque. A academia escolhe; cada pessoa pode desligar.
export const EFEITOS = [
  { id: "nenhum", nome: "Nenhum" },
  { id: "neve", nome: "❄️ Neve" },
  { id: "confete", nome: "🎊 Confete" },
  { id: "estrelas", nome: "✨ Estrelas" },
  { id: "folhas", nome: "🍂 Folhas" },
  { id: "logo", nome: "🌀 Logo flutuando" },
  { id: "logo_passeio", nome: "🏀 Logo passeando pela tela" },
  { id: "logo_chuva", nome: "🌧️ Chuva de logos" },
  { id: "logo_orbita", nome: "🪐 Logos em órbita" },
  { id: "logo_toque", nome: "👆 Logo explode ao tocar" },
  { id: "natal", nome: "🎄 Natal" },
  { id: "ano_novo", nome: "🎆 Ano-novo" },
  { id: "carnaval", nome: "🎭 Carnaval" },
  { id: "junina", nome: "🌽 Festa junina" },
  { id: "criancas", nome: "🎈 Dia das crianças" },
] as const;

// Temporada automática pela data
export function efeitoDaTemporada(d = new Date()) {
  const m = d.getMonth() + 1, dia = d.getDate();
  if (m === 12 && dia <= 25) return "natal";
  if ((m === 12 && dia > 25) || (m === 1 && dia <= 6)) return "ano_novo";
  if (m === 2) return "carnaval";
  if (m === 6) return "junina";
  if (m === 10 && dia <= 12) return "criancas";
  return null;
}

const CORES = ["#facc15", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ffffff"];
const SIMBOLOS: Record<string, string[]> = {
  neve: ["❄", "❅", "❆", "•"], estrelas: ["✦", "✧", "★", "·"], folhas: ["🍂", "🍁", "🍃"],
  natal: ["❄", "❅", "🎄", "⭐", "🎁"], ano_novo: ["✨", "🎆", "🥂", "⭐"], carnaval: ["🎭", "🎉"],
  junina: ["🌽", "🔥", "🎈"], criancas: ["🎈", "🎈", "🪁", "⭐"],
};

export function EfeitosTela({ tipo, logo }: { tipo: string; logo?: string | null }) {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let off = false;
    try { off = localStorage.getItem("ma_efeitos") === "off"; } catch { /* */ }
    setLigado(!quieto && !off);
    const muda = () => { try { setLigado(localStorage.getItem("ma_efeitos") !== "off" && !quieto); } catch { /* */ } };
    window.addEventListener("ma-efeitos", muda);
    return () => window.removeEventListener("ma-efeitos", muda);
  }, []);

  const particulas = useMemo(() => Array.from({ length: tipo === "logo" ? 6 : 22 }, (_, i) => ({
    left: (i * 47 + 13) % 100, delay: (i * 0.7) % 9, dur: 7 + (i * 1.3) % 7, tam: 10 + (i * 5) % 16,
    cor: CORES[i % CORES.length], sim: (SIMBOLOS[tipo] || ["•"])[i % (SIMBOLOS[tipo] || ["•"]).length],
  })), [tipo]);

  if (!ligado || !tipo || tipo === "nenhum") return null;
  if (tipo === "logo_passeio") return <LogoPasseio logo={logo} />;
  if (tipo === "logo_toque") return <LogoToque logo={logo} />;
  if (tipo === "logo_orbita") return <LogoOrbita logo={logo} />;
  if (tipo === "logo_chuva") {
    return (
      <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden>
        {particulas.slice(0, 12).map((p, i) => (
          <span key={i} className="efeito-cair absolute top-0" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur + 3}s`, opacity: 0.22 }}>
            <Marca logo={logo} tam={22 + p.tam} />
          </span>
        ))}
      </div>
    );
  }
  const sobe = tipo === "criancas";
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden>
      {(tipo === "confete" || tipo === "carnaval" || tipo === "ano_novo") && particulas.map((p, i) => (
        <span key={`c${i}`} className="efeito-cair absolute top-0 rounded-sm opacity-80"
          style={{ left: `${p.left}%`, width: p.tam * 0.5, height: p.tam * 0.8, background: p.cor, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
      {tipo === "logo" && logo && particulas.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`l${i}`} src={logo} alt="" className="efeito-flutuar absolute opacity-[0.12]"
          style={{ left: `${p.left}%`, top: `${(i * 31) % 90}%`, width: 40 + p.tam * 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur + 6}s` }} />
      ))}
      {tipo !== "confete" && tipo !== "logo" && particulas.map((p, i) => (
        <span key={`s${i}`} className={`${sobe ? "efeito-subir" : tipo === "estrelas" ? "efeito-brilhar" : "efeito-cair"} absolute select-none`}
          style={{ left: `${p.left}%`, top: tipo === "estrelas" ? `${(i * 37) % 95}%` : sobe ? "auto" : 0, bottom: sobe ? 0 : "auto",
            fontSize: p.tam, color: tipo === "neve" || tipo === "natal" ? "#ffffffcc" : p.cor, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>{p.sim}</span>
      ))}
      {tipo === "junina" && (
        <div className="absolute inset-x-0 top-0 flex justify-around">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: `18px solid ${CORES[i % CORES.length]}` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Abertura: logo girando por um instante ao abrir o app (uma vez por sessão)
export function AberturaLogo({ logo, nome, cor }: { logo?: string | null; nome: string; cor: string }) {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ma_abertura") || localStorage.getItem("ma_efeitos") === "off") return;
      sessionStorage.setItem("ma_abertura", "1");
    } catch { /* */ }
    setVer(true);
    const t = setTimeout(() => setVer(false), 1600);
    return () => clearTimeout(t);
  }, []);
  if (!ver) return null;
  return (
    <div className="abertura fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4" style={{ background: `radial-gradient(circle, ${cor}55, #0b0f1d 70%)` }} onClick={() => setVer(false)}>
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt="" className="abertura-logo h-32 w-32 rounded-3xl object-contain" />
        : <span className="abertura-logo text-7xl">🥋</span>}
      <p className="titulo text-3xl font-extrabold text-white">{nome}</p>
    </div>
  );
}

// Logo da academia (ou 🥋 se não tiver logo)
function Marca({ logo, tam }: { logo?: string | null; tam: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return logo ? <img src={logo} alt="" draggable={false} style={{ width: tam, height: tam, objectFit: "contain" }} /> : <span style={{ fontSize: tam * 0.8, lineHeight: 1 }}>🥋</span>;
}

// Logo passeando pela tela inteira, batendo nas bordas (estilo protetor de tela)
function LogoPasseio({ logo }: { logo?: string | null }) {
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const T = 64;
    const est = [0, 1, 2].map((i) => ({ x: 40 + i * 90, y: 80 + i * 140, vx: (i % 2 ? -1 : 1) * (0.7 + i * 0.25), vy: (i === 1 ? -1 : 1) * (0.55 + i * 0.2), r: i * 40, vr: i % 2 ? -0.4 : 0.4 }));
    let raf = 0;
    const passo = () => {
      const w = window.innerWidth - T, h = window.innerHeight - T;
      est.forEach((b, i) => {
        b.x += b.vx; b.y += b.vy; b.r += b.vr;
        if (b.x <= 0 || b.x >= w) { b.vx *= -1; b.x = Math.max(0, Math.min(w, b.x)); b.vr *= -1; }
        if (b.y <= 0 || b.y >= h) { b.vy *= -1; b.y = Math.max(0, Math.min(h, b.y)); }
        const el = els.current[i];
        if (el) el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.r}deg)`;
      });
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} ref={(el) => { els.current[i] = el; }} className="absolute left-0 top-0 will-change-transform" style={{ opacity: i === 0 ? 0.28 : 0.16 }}>
          <Marca logo={logo} tam={i === 0 ? 64 : 44} />
        </span>
      ))}
    </div>
  );
}

// Logos girando em volta do centro da tela
function LogoOrbita({ logo }: { logo?: string | null }) {
  const n = 6;
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] flex items-center justify-center overflow-hidden" aria-hidden>
      {[0, 1].map((anel) => (
        <div key={anel} className="efeito-girar absolute" style={{ width: anel ? "min(90vw, 90vh)" : "min(55vw, 55vh)", aspectRatio: "1", animationDuration: anel ? "60s" : "38s", animationDirection: anel ? "reverse" : "normal" }}>
          {Array.from({ length: n }).map((_, i) => (
            <span key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -50%) rotate(${(360 / n) * i}deg) translateY(-${anel ? 44 : 27}vmin)`, opacity: anel ? 0.14 : 0.2 }}>
              <Marca logo={logo} tam={anel ? 34 : 46} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// Toque em qualquer lugar: a logo "explode" em pedacinhos a partir do dedo
function LogoToque({ logo }: { logo?: string | null }) {
  const [estouros, setEstouros] = useState<{ id: number; x: number; y: number }[]>([]);
  useEffect(() => {
    const toque = (ev: PointerEvent) => {
      const id = Date.now() + Math.random();
      setEstouros((l) => [...l.slice(-5), { id, x: ev.clientX, y: ev.clientY }]);
      setTimeout(() => setEstouros((l) => l.filter((z) => z.id !== id)), 900);
    };
    window.addEventListener("pointerdown", toque, { passive: true });
    return () => window.removeEventListener("pointerdown", toque);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {estouros.map((z) => Array.from({ length: 7 }).map((_, i) => {
        const ang = (Math.PI * 2 * i) / 7, d = 70 + (i % 3) * 18;
        return (
          <span key={`${z.id}-${i}`} className="efeito-estouro absolute"
            style={{ left: z.x - 14, top: z.y - 14, ["--dx" as any]: `${Math.cos(ang) * d}px`, ["--dy" as any]: `${Math.sin(ang) * d}px` }}>
            <Marca logo={logo} tam={28} />
          </span>
        );
      }))}
    </div>
  );
}
