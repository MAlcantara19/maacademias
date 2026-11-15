import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";
import { acharPerfis } from "@/lib/perfisPorContato";

export const runtime = "nodejs";

// Entrar com o WhatsApp no lugar do e-mail: o servidor acha a conta pelo
// telefone do cadastro e tenta a senha. O e-mail nunca aparece para quem tenta.
export async function POST(req: Request) {
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return NextResponse.json({ erro: "Entrar pelo WhatsApp ainda não está ligado (falta SUPABASE_SECRET_KEY). Use o e-mail." }, { status: 500 });
  const { telefone, senha } = await req.json().catch(() => ({}));
  if (!telefone || !senha) return NextResponse.json({ erro: "Digite o WhatsApp e a senha." }, { status: 400 });
  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const perfis = await acharPerfis(admin, String(telefone));
  const anon = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  for (const p of perfis) {
    const { data: u } = await admin.auth.admin.getUserById(p.user_id);
    const email = u?.user?.email;
    if (!email) continue;
    const { data, error } = await anon.auth.signInWithPassword({ email, password: String(senha) });
    if (!error && data.session) {
      return NextResponse.json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token, email });
    }
  }
  return NextResponse.json({ erro: "WhatsApp ou senha incorretos." }, { status: 400 });
}
