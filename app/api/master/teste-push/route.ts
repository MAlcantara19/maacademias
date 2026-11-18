import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/chaves";
import { conferirMaster } from "@/lib/soMaster";

export const runtime = "nodejs";

// Cria uma notificação de teste para o master. Ela faz o caminho completo:
// banco → Webhook do Supabase → /api/push → celular. A tela confere se chegou.
export async function POST(req: Request) {
  const eu = await conferirMaster(req);
  if (!eu) return NextResponse.json({ erro: "Só o master." }, { status: 403 });
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return NextResponse.json({ erro: "Falta a SUPABASE_SECRET_KEY na Vercel." }, { status: 500 });
  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const { data: perfil } = await admin.from("perfis").select("id").eq("user_id", eu.id).limit(1).maybeSingle();
  if (!perfil) return NextResponse.json({ erro: "Sua conta de master não tem perfil. Entre uma vez numa academia." }, { status: 400 });
  const { count } = await admin.from("push_inscricoes").select("id", { count: "exact", head: true }).eq("perfil_id", perfil.id);
  const { data: n, error } = await admin.from("notificacoes").insert({
    perfil_id: perfil.id, tipo: "teste", titulo: "🔔 Teste de notificação",
    texto: `Se você está lendo isto no celular, está tudo certo! (${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })})`, link: "/master",
  }).select("id").single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: n.id, aparelhos: count || 0 });
}
