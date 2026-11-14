"use client";
// Cria o login com senha provisória (a pessoa troca no primeiro acesso)
export async function criarLogin(sb: any, perfil_id: string, senha?: string): Promise<{ email?: string; senha?: string; erro?: string }> {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch("/api/criar-login", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ perfil_id, senha }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : { erro: j.erro || "Não foi possível criar o login." };
}

export const textoAcesso = (academia: string, email: string, senha: string, link: string) =>
  `Olá! Seu acesso ao app da ${academia}:\n\n🌐 ${link}\n📧 E-mail: ${email}\n🔑 Senha provisória: ${senha}\n\nNo primeiro acesso o app pede para você criar a sua senha.`;
