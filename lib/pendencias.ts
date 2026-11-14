// Áreas do cadastro, com os emojis usados no app
export const AREAS = [
  { id: "dados", icone: "👤", nome: "Dados" },
  { id: "resp", icone: "👨‍👧", nome: "Responsável" },
  { id: "saude", icone: "⚕️", nome: "Saúde" },
  { id: "termos", icone: "✍️", nome: "Termos" },
  { id: "docs", icone: "📎", nome: "Documentos" },
] as const;
export type Area = (typeof AREAS)[number]["id"];

export function areaDe(item: string): Area {
  const t = item.toLowerCase();
  if (t.startsWith("termo")) return "termos";
  if (t.includes("saúde") || t.includes("emergência")) return "saude";
  if (t.includes("document") || t.includes("certid") || t.includes("guarda")) return "docs";
  if (t.includes("respons")) return "resp";
  return "dados";
}

export function porArea(itens: string[]) {
  const r: Record<Area, string[]> = { dados: [], resp: [], saude: [], termos: [], docs: [] };
  for (const x of itens) r[areaDe(x)].push(x);
  return r;
}

// resume as pendências do cadastro em ícones curtos
export function resumoPendencias(itens: string[]) {
  const g = porArea(itens);
  return [g.saude.length && "⚕️ saúde", g.termos.length && `✍️ ${g.termos.length} termo(s)`, g.docs.length && `📎 ${g.docs.length} doc.`,
    g.resp.length && "👨‍👧 responsável", g.dados.length && `📝 ${g.dados.length} dado(s)`].filter(Boolean) as string[];
}
