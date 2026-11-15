// Converte o link guardado na notificação para a tela do app (serve no app e no push)
export function destinoNotificacao(base: string, link?: string | null) {
  if (!link) return base;
  if (link.startsWith("/eventos/")) return `${base}/campeonatos/${link.split("/")[2]}`;
  if (link.startsWith("/alunos/")) return `${base}${link}`;
  const mapa: Record<string, string> = {
    "/avisos": base, "/mensalidades": `${base}/mensalidades`, "/materiais": base, "/aniversarios": `${base}/calendario`,
    "/alunos": `${base}/alunos`, "/gestao": `${base}/gestao`, "/meu": `${base}/meu`, "/carteirinha": `${base}/carteirinha`, "/calendario": `${base}/calendario`,
    "/experimentais": `${base}/experimentais`, "/pendencias": `${base}/pendencias`, "/ranking": `${base}/ranking`, "/checkins-gps": `${base}#gps`,
    "/particulares": `${base}/particulares`, "/estudar": `${base}/estudar`, "/feed": `${base}/feed`,
  };
  if (mapa[link]) return mapa[link];
  if (link.startsWith("/pendencias")) return `${base}/pendencias`;
  if (link.startsWith("/exportar")) return `${base}${link}`;
  return base;
}
