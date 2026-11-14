"use client";
// Placar estilo TV (IJF): branco em cima, azul embaixo, relógio grande à direita.
// Usado no próprio celular (modo olímpico) e na tela que recebe a transmissão (tablet/TV).

export type Lado = "azul" | "branco";
export type Atleta = { nome: string; yuko: number; waza: number; shido: number; ippon?: number; hansoku?: boolean };
export type Evento = { id: number; lado: Lado; tipo: "ippon" | "waza" | "yuko" | "shido" | "hansoku"; quando: string; obs?: string };
export type Estado = {
  duracao: number; resta: number; golden: boolean; gs: number; correndo: boolean;
  azul: Atleta; branco: Atleta;
  osae: { lado: Lado; seg: number } | null;
  fim: { lado: Lado | null; motivo: string } | null;
  eventos?: Evento[];
  info?: { categoria?: string; fase?: string };
};
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const NOME: Record<Lado, string> = { azul: "AZUL", branco: "BRANCO" };
// placar em 3 dígitos, como na TV: Ippon · Waza-ari · Yuko (ex.: 101 = ippon + yuko)
export const iwy = (a: Atleta) => [a.ippon ? 1 : 0, Math.min(a.waza, 9), Math.min(a.yuko, 9)];
// cor do relógio: verde correndo, vermelho parado, amarelo no Golden Score
export const corRelogio = (e: Estado) => (e.fim ? "#ef4444" : e.osae ? "#22c55e" : !e.correndo ? "#ef4444" : e.golden ? "#facc15" : "#22c55e");

export function PlacarTelao({ e, grande = false }: { e: Estado; grande?: boolean }) {
  const linha = (l: Lado) => {
    const a = e[l], azul = l === "azul";
    const vermelho = a.hansoku || a.shido >= 3;
    const cartao = { height: grande ? "min(7vw, 5rem)" : "2.6rem", width: grande ? "min(4.6vw, 3.3rem)" : "1.7rem" };
    const digitos = iwy(a);
    return (
      <div className="flex items-stretch" style={{ background: azul ? "#1d4ed8" : "#f8fafc", color: azul ? "#fff" : "#0f172a" }}>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          {e.osae?.lado === l && <span className="numero rounded-md px-2 py-1 text-sm font-extrabold" style={{ background: "#facc15", color: "#111" }}>{e.osae.seg}s</span>}
          <span className="truncate font-extrabold uppercase" style={{ fontSize: grande ? "min(5vw, 3.4rem)" : "clamp(1rem, 4.5vw, 1.6rem)" }}>{a.nome || NOME[l]}</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 sm:px-2" aria-label={`${a.shido} shido${vermelho ? ", hansoku-make" : ""}`}>
          {vermelho
            ? <span className="rounded shadow" style={{ ...cartao, background: "#dc2626" }} />
            : [0, 1].map((i) => i < a.shido && <span key={i} className="rounded shadow" style={{ ...cartao, background: "#facc15" }} />)}
        </div>
        <div className="flex items-center px-1.5 sm:px-3" style={{ background: azul ? "#1e40af" : "#e2e8f0" }}>
          {digitos.map((d, i) => (
            <div key={i} className="flex flex-col items-center" style={{ width: grande ? "min(8vw, 6rem)" : "clamp(1.8rem, 9vw, 2.8rem)" }}>
              <span className="text-[10px] font-bold opacity-60">{"IWY"[i]}</span>
              <span className="numero font-extrabold leading-none" style={{ fontSize: grande ? "min(10vw, 7.5rem)" : "clamp(2rem, 10vw, 3.2rem)" }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  const info = [e.info?.categoria, e.info?.fase].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ background: "#0b0f1d" }}>
      {info && <p className="px-4 py-1 text-center font-bold uppercase tracking-widest text-white/80" style={{ fontSize: grande ? "min(2.6vw, 1.6rem)" : ".8rem" }}>{info}</p>}
      <div className="flex">
        <div className="flex-1 divide-y divide-black">{linha("branco")}{linha("azul")}</div>
        <div className="flex w-[28%] min-w-[5.5rem] flex-col items-center justify-center px-1 text-white">
          {e.golden && <span className="text-center text-[10px] font-bold tracking-widest sm:text-xs" style={{ color: "#facc15" }}>GOLDEN SCORE</span>}
          <span className="numero font-extrabold leading-none" style={{ fontSize: grande ? "min(12vw, 9rem)" : "clamp(2rem, 11vw, 3.5rem)", color: corRelogio(e) }}>
            {e.golden ? `+${mmss(e.gs)}` : mmss(e.resta)}
          </span>
          {e.osae && <span className="numero mt-1 rounded px-2 text-sm font-bold" style={{ background: "#facc15", color: "#111" }}>OSAEKOMI {e.osae.seg}s</span>}
        </div>
      </div>
    </div>
  );
}

// Tela de vitória (cor do vencedor, confete)
export function TelaVitoria({ e, onFechar, children }: { e: Estado; onFechar?: () => void; children?: React.ReactNode }) {
  if (!e.fim) return null;
  const v = e.fim.lado;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center"
      style={{ background: v === "azul" ? "#1d4ed8" : v === "branco" ? "#f8fafc" : "#334155", color: v === "branco" ? "#0f172a" : "#fff" }}
      onClick={onFechar}>
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="confete" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s`, background: ["#facc15", "#dc2626", "#16a34a", "#ffffff", "#0f172a"][i % 5] }} />
      ))}
      <p className="text-2xl font-bold tracking-widest opacity-80">SORE-MADE</p>
      <p className="vitoria titulo font-extrabold leading-none" style={{ fontSize: "min(16vw, 8rem)" }}>{v ? `VITÓRIA DO ${NOME[v]}` : "EMPATE"}</p>
      {v && e[v].nome && <p className="text-3xl font-bold">{e[v].nome}</p>}
      <p className="text-xl">{e.fim.motivo}</p>
      <p className="numero text-lg opacity-80">Azul {iwy(e.azul).join("")} ({e.azul.shido} shido) · Branco {iwy(e.branco).join("")} ({e.branco.shido} shido)</p>
      {children}
    </div>
  );
}
