// resume as pendências do cadastro em ícones curtos
export function resumoPendencias(itens: string[]) {
  const g = { saude: 0, termos: 0, docs: 0, resp: 0, dados: 0 };
  for (const x of itens) {
    const t = x.toLowerCase();
    if (t.startsWith("termo")) g.termos++;
    else if (t.includes("saúde") || t.includes("emergência")) g.saude++;
    else if (t.includes("document") || t.includes("certid") || t.includes("guarda")) g.docs++;
    else if (t.includes("respons")) g.resp++;
    else g.dados++;
  }
  return [g.saude && "⚕️ saúde", g.termos && `✍️ ${g.termos} termo(s)`, g.docs && `📎 ${g.docs} doc.`, g.resp && "👨‍👧 responsável", g.dados && `📝 ${g.dados} dado(s)`].filter(Boolean) as string[];
}
