// Só no servidor: acha as contas (com login) pelo e-mail ou pelo WhatsApp do cadastro
export async function acharPerfis(admin: any, contato: string) {
  const c = contato.trim().toLowerCase();
  if (c.includes("@")) {
    const { data } = await admin.from("perfis").select("id, nome, apelido, email, telefone, user_id").ilike("email", c).not("user_id", "is", null).limit(3);
    return data || [];
  }
  const dig = c.replace(/\D/g, "");
  if (dig.length < 8) return [];
  const { data } = await admin.from("perfis").select("id, nome, apelido, email, telefone, user_id").not("user_id", "is", null).ilike("telefone", `%${dig.slice(-4)}`).limit(300);
  return (data || []).filter((p: any) => (p.telefone || "").replace(/\D/g, "").slice(-9) === dig.slice(-9)).slice(0, 3);
}
