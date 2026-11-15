// Ações que dá para fazer direto da notificação (servidor e app usam a mesma regra)
export async function executarAcao(sb: any, p: URLSearchParams): Promise<{ ok: boolean; texto: string }> {
  const tipo = p.get("tipo");
  if (tipo === "nao-vou") {
    const { data, error } = await sb.rpc("nao_vou_hoje", { p_membro: p.get("membro"), p_horario: p.get("horario") || null });
    if (error || !data?.ok) return { ok: false, texto: data?.erro || error?.message || "Não deu para avisar." };
    return { ok: true, texto: `🙋 Pronto! O professor já sabe que ${data.nome} não vai hoje${data.turma ? ` (${data.turma})` : ""}.` };
  }
  if (tipo === "vieram") {
    const { data, error } = await sb.rpc("confirmar_quem_confirmou", { p_horario: p.get("horario"), p_data: p.get("data") || null });
    if (error || !data?.ok) return { ok: false, texto: data?.erro || error?.message || "Não deu para marcar." };
    return { ok: true, texto: `✅ ${data.marcados} presença(s) marcada(s) em ${data.turma}. Confira quem faltou na chamada.` };
  }
  return { ok: false, texto: "Ação desconhecida." };
}

export const DESCRICAO_ACAO: Record<string, string> = {
  "nao-vou": "Avisar o professor que não vai à aula de hoje (sai do ✋ e conta como falta avisada).",
  vieram: "Marcar presente todo mundo que tocou em ✋ “Vou nessa aula” (menos quem avisou falta).",
};
