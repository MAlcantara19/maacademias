"use client";
// Pede ao servidor uma senha provisória nova (a pessoa troca no próximo acesso)
export async function gerarNovaSenha(sb: any, perfil_id: string): Promise<{ email?: string; senha?: string; erro?: string }> {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch("/api/nova-senha", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ perfil_id }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : { erro: j.erro || "Não foi possível gerar a nova senha." };
}

export const textoNovaSenha = (academia: string, nome: string, email: string, senha: string, link: string) =>
  `Oi, ${nome}! Aqui é da ${academia}. Sua senha do app foi trocada 🔑\n\n🌐 ${link}\n📧 E-mail: ${email}\n🔑 Senha provisória: ${senha}\n\nAo entrar, o app pede para você criar a sua senha nova.`;
