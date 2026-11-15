"use client";
// Contas lembradas neste aparelho (ex.: o tablet da família): cada pessoa
// toca no próprio nome e entra sem digitar a senha de novo.
// Fica só neste navegador. "Sair" tira a conta da lista.

export type ContaSalva = { email: string; nome?: string; foto?: string | null; slug?: string; access_token: string; refresh_token: string; salvo_em: number };
const CHAVE = "ma_contas";
const NAO_LEMBRAR = "ma_nao_lembrar";
const VIVA = "ma_sessao_viva";

export function listarContas(): ContaSalva[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
}
function gravar(l: ContaSalva[]) { try { localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, 8))); } catch { /* */ } }

export function removerConta(email?: string | null) {
  if (!email) return;
  gravar(listarContas().filter((c) => c.email !== email));
}

// guarda (ou atualiza) a conta que está aberta agora
export async function salvarContaAtual(sb: any, extra: { nome?: string; foto?: string | null; slug?: string } = {}, forcar = false) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user?.email) return;
  const l = listarContas();
  const i = l.findIndex((c) => c.email === session.user.email);
  if (i < 0 && !forcar) return; // só atualiza quem a pessoa pediu para lembrar
  const antiga = i >= 0 ? l[i] : null;
  const nova: ContaSalva = {
    email: session.user.email, access_token: session.access_token, refresh_token: session.refresh_token, salvo_em: Date.now(),
    nome: extra.nome || antiga?.nome, foto: extra.foto !== undefined ? extra.foto : antiga?.foto, slug: extra.slug || antiga?.slug,
  };
  gravar([nova, ...l.filter((c) => c.email !== nova.email)]);
}

// troca para outra conta lembrada (sem senha)
export async function trocarParaConta(sb: any, conta: ContaSalva): Promise<boolean> {
  await salvarContaAtual(sb);
  const { data, error } = await sb.auth.setSession({ access_token: conta.access_token, refresh_token: conta.refresh_token });
  if (error || !data?.session) { removerConta(conta.email); return false; }
  marcarSessao(true, conta.email);
  await salvarContaAtual(sb);
  return true;
}

// "Lembrar de mim" desligado: a sessão acaba quando o navegador fecha
export function marcarSessao(lembrar: boolean, email: string) {
  try {
    sessionStorage.setItem(VIVA, "1");
    if (lembrar) { if (localStorage.getItem(NAO_LEMBRAR) === email) localStorage.removeItem(NAO_LEMBRAR); }
    else localStorage.setItem(NAO_LEMBRAR, email);
  } catch { /* */ }
}
export function sessaoVenceu(email?: string | null) {
  try { return !!email && localStorage.getItem(NAO_LEMBRAR) === email && !sessionStorage.getItem(VIVA); } catch { return false; }
}
