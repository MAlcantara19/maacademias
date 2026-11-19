import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/chaves";
import { conferirMaster } from "@/lib/soMaster";
import { numeroWhats, temWhatsApi } from "@/lib/mensageiro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function meuTelefone(userId: string) {
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return "";
  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const { data } = await admin.from("perfis").select("telefone").eq("user_id", userId).limit(1).maybeSingle();
  return data?.telefone || "";
}

// GET: o número do master (para já vir preenchido)
export async function GET(req: Request) {
  const eu = await conferirMaster(req);
  if (!eu) return NextResponse.json({ erro: "Só o master." }, { status: 403 });
  return NextResponse.json({ telefone: await meuTelefone(eu.id), configurado: temWhatsApi() });
}

// POST: manda uma mensagem de teste pela Z-API e devolve o que ela respondeu
export async function POST(req: Request) {
  const eu = await conferirMaster(req);
  if (!eu) return NextResponse.json({ erro: "Só o master." }, { status: 403 });
  if (!temWhatsApi()) return NextResponse.json({ erro: "Falta configurar ZAPI_INSTANCIA e ZAPI_TOKEN na Vercel (e fazer Redeploy)." }, { status: 400 });
  const { telefone } = await req.json().catch(() => ({}));
  const fone = numeroWhats(telefone || (await meuTelefone(eu.id)));
  if (!fone) return NextResponse.json({ erro: "Número inválido. Use DDD + número, ex.: 11 98765-4321." }, { status: 400 });
  const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  try {
    const r = await fetch(`https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ZAPI_CLIENT_TOKEN ? { "Client-Token": process.env.ZAPI_CLIENT_TOKEN } : {}) },
      body: JSON.stringify({ phone: fone, message: `✅ Teste do MA Academias (${hora}). Se chegou, o WhatsApp automático está funcionando!` }),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && !j?.error) return NextResponse.json({ ok: true, para: fone.replace(/^55/, "").replace(/(\d{2})(\d+)(\d{4})$/, "($1) $2-$3") });
    const motivo = String(j?.error || j?.message || `a Z-API respondeu ${r.status}`);
    const dica = /client-token/i.test(motivo) ? " Confira a ZAPI_CLIENT_TOKEN (Z-API → Segurança)."
      : /not connected|disconnected|desconectad/i.test(motivo) ? " O celular da Z-API está desconectado: abra o painel da Z-API e leia o QR Code de novo."
      : r.status === 404 || /instance/i.test(motivo) ? " Confira a ZAPI_INSTANCIA e o ZAPI_TOKEN." : "";
    return NextResponse.json({ erro: `Não foi: ${motivo}.${dica}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.name === "TimeoutError" ? "A Z-API não respondeu em 15 segundos." : "Não deu para falar com a Z-API." }, { status: 502 });
  }
}
