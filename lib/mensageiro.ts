// Envio automático (só no servidor). Tudo é opcional: sem as variáveis,
// o app continua funcionando e o professor manda pelo próprio WhatsApp.
//
// WhatsApp pela Z-API (z-api.io): ZAPI_INSTANCIA, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN
// E-mail pela Resend (resend.com): RESEND_API_KEY e (opcional) EMAIL_REMETENTE

export const temWhatsApi = () => !!(process.env.ZAPI_INSTANCIA && process.env.ZAPI_TOKEN);
export const temEmailApi = () => !!process.env.RESEND_API_KEY;

// deixa o número no formato 55 + DDD + número
export function numeroWhats(tel?: string | null) {
  let d = (tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d.replace(/^0+/, "");
  return d.length >= 12 ? d : "";
}

export async function mandarWhats(tel: string | null | undefined, texto: string): Promise<boolean> {
  const fone = numeroWhats(tel);
  if (!temWhatsApi() || !fone) return false;
  try {
    const r = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ZAPI_CLIENT_TOKEN ? { "Client-Token": process.env.ZAPI_CLIENT_TOKEN } : {}) },
      body: JSON.stringify({ phone: fone, message: texto }),
    });
    return r.ok;
  } catch { return false; }
}

export async function mandarEmail(para: string | null | undefined, assunto: string, texto: string): Promise<boolean> {
  if (!temEmailApi() || !para || !para.includes("@") || para.endsWith("@example.com")) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_REMETENTE || process.env.BACKUP_REMETENTE || "MA Academias <onboarding@resend.dev>",
        to: [para], subject: assunto, text: texto,
      }),
    });
    return r.ok;
  } catch { return false; }
}
