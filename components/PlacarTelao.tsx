"use client";
// Placar estilo TV (IJF): branco em cima, azul embaixo, relógio grande à direita.
// Usado no próprio celular (modo olímpico) e na tela que recebe a transmissão (tablet/TV).

export type Lado = "azul" | "branco";
export type Atleta = { nome: string; yuko: number; waza: number; shido: number };
export type Estado = {
  duracao: number; resta: number; golden: boolean; gs: number; correndo: boolean;
  azul: Atleta; branco: Atleta;
  osae: { lado: Lado; seg: number } | null;
  fim: { lado: Lado | null; motivo: string } | null;
};
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const NOME: Record<Lado, string> = { azul: "AZUL", branco: "BRANCO" };

export function PlacarTelao({ e, grande = false }: { e: Estado; grande?: boolean }) {
  const linha = (l: Lado) => {
    const a = e[l], azul = l === "azul";
    return (
      <div className="flex items-stretch" style={{ background: azul ? "#1d4ed8" : "#f8fafc", color: azul ? "#fff" : "#0f172a" }}>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          {e.osae?.lado === l && <span className="rounded-md px-2 py-1 text-sm font-extrabold" style={{ background: "#facc15", color: "#111" }}>{e.osae.seg}s</span>}
          <span className="truncate font-extrabold uppercase" style={{ fontSize: grande ? "min(5vw, 3.4rem)" : "1.6rem" }}>{a.nome || NOME[l]}</span>
        </div>
        <div className="flex items-center gap-1 px-2">
          {[0, 1, 2].map((i) => i < a.shido && (
            <span key={i} className="rounded" style={{ background: a.shido >= 3 ? "#dc2626" : "#facc15", height: grande ? "min(6vw, 4.5rem)" : "2.5rem", width: grande ? "min(4vw, 3rem)" : "1.75rem" }} />
          ))}
        </div>
        {([["WAZA-ARI", a.waza], ["YUKO", a.yuko]] as const).map(([r, v]) => (
          <div key={r} className="flex w-[18%] flex-col items-center justify-center border-l" style={{ borderColor: azul ? "#ffffff33" : "#0f172a22" }}>
            <span className="numero font-extrabold leading-none" style={{ fontSize: grande ? "min(10vw, 7rem)" : "3rem" }}>{v}</span>
            <span className="text-[10px] font-bold opacity-70">{r}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="flex overflow-hidden rounded-2xl shadow-2xl" style={{ background: "#0b0f1d" }}>
      <div className="flex-1 divide-y divide-black">{linha("branco")}{linha("azul")}</div>
      <div className="flex w-[30%] flex-col items-center justify-center px-2 text-white">
        {e.golden && <span className="text-xs font-bold tracking-widest" style={{ color: "#facc15" }}>GOLDEN SCORE</span>}
        <span className="numero font-extrabold leading-none" style={{ fontSize: grande ? "min(12vw, 9rem)" : "3.5rem", color: e.golden ? "#facc15" : e.correndo ? "#fff" : "#ef4444" }}>
          {e.golden ? `+${mmss(e.gs)}` : mmss(e.resta)}
        </span>
        {e.osae && <span className="mt-1 rounded px-2 text-sm font-bold" style={{ background: "#facc15", color: "#111" }}>OSAEKOMI {e.osae.seg}s</span>}
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
      <p className="numero text-lg opacity-80">Azul {e.azul.waza}W {e.azul.yuko}Y {e.azul.shido}S · Branco {e.branco.waza}W {e.branco.yuko}Y {e.branco.shido}S</p>
      {children}
    </div>
  );
}
