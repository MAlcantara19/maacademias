export const GRUPOS: Record<string, string> = {
  taiso: "Taiso (ginástica)",
  ukemi: "Ukemi (quedas e rolamentos)",
  "nage-waza": "Nage-waza (projeções)",
  "osaekomi-waza": "Osaekomi-waza (imobilizações)",
  "shime-waza": "Shime-waza (estrangulamentos)",
  "kansetsu-waza": "Kansetsu-waza (chaves de braço)",
  "katame-waza": "Katame-waza (solo)",
  kata: "Kata",
  "defesa-pessoal": "Defesa pessoal",
  outro: "Outros",
};
export const ORDEM_GRUPOS = Object.keys(GRUPOS);
export const nomeGrupo = (g: string) => GRUPOS[g] || g;
export const ordemGrupo = (g: string) => { const i = ORDEM_GRUPOS.indexOf(g); return i < 0 ? 99 : i; };

// Cores por conjunto (grupos do Gokyo) — usadas na roleta e nos cards
export const CORES_CONJUNTO: Record<string, string> = {
  "1º grupo": "#2563eb", "2º grupo": "#facc15", "3º grupo": "#f97316", "4º grupo": "#16a34a",
  "5º grupo": "#7c3aed", "6º grupo": "#111111", "Shinmeisho": "#dc2626", "Extras": "#dc2626",
  "Katame-waza": "#0d9488", "Kata": "#78350f",
};
export const corConjunto = (c?: string | null) => (c && CORES_CONJUNTO[c]) || "#64748b";

export const CLASSIFICACOES: Record<string, string> = {
  "te-waza": "Te-waza (braço)", "koshi-waza": "Koshi-waza (quadril)", "ashi-waza": "Ashi-waza (perna)",
  "ma-sutemi": "Ma-sutemi (sacrifício de costas)", "yoko-sutemi": "Yoko-sutemi (sacrifício lateral)",
  "osaekomi-waza": "Osaekomi (imobilização)", "shime-waza": "Shime (estrangulamento)", "kansetsu-waza": "Kansetsu (chave)",
};
