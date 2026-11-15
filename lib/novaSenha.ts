"use client";
// Pede ao servidor uma senha provisória nova (a pessoa troca no próximo acesso).
// extra.enviar: se a academia tiver o WhatsApp automático (Z-API), já manda.
export async function gerarNovaSenha(sb: any, perfil_id: string, extra: { enviar?: boolean; telefone?: string | null; academia?: string } = {}): Promise<{ email?: string; senha?: string; erro?: string; enviado?: boolean; whatsAuto?: boolean }> {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch("/api/nova-senha", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ perfil_id, enviar: extra.enviar !== false, telefone: extra.telefone || null, academia: extra.academia, link: `${window.location.origin}/login` }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : { erro: j.erro || "Não foi possível gerar a nova senha." };
}

export const textoNovaSenha = (academia: string, nome: string, email: string, senha: string, link: string) =>
  `Oi, ${nome}! Aqui é da ${academia}. Sua senha do app foi trocada 🔑\n\n🌐 ${link}\n📧 E-mail: ${email}\n🔑 Senha provisória: ${senha}\n\nEla vale por 48 horas. Ao entrar, o app pede para você criar a sua senha nova.`;
