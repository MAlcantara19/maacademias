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
