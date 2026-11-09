import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

export const runtime = "nodejs";

// A equipe cria o login de um aluno/professor com senha provisória.
// No primeiro acesso a pessoa é obrigada a trocar a senha.
export async function POST(req: Request) {
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return NextResponse.json({ erro: "Falta a variável SUPABASE_SECRET_KEY no servidor." }, { status: 500 });

  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { perfil_id } = await req.json().catch(() => ({}));
  if (!token || !perfil_id) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });

  // Confere, com as regras de acesso de quem pediu, se é da equipe dessa pessoa
  const comoUsuario = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
  });
  const { data: pode } = await comoUsuario.rpc("sou_equipe_do_perfil", { pf: perfil_id });
  if (!pode) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const { data: perfil } = await admin.from("perfis").select("id, email, user_id, nome").eq("id", perfil_id).maybeSingle();
  if (!perfil?.email) return NextResponse.json({ erro: "Cadastre o e-mail da pessoa antes." }, { status: 400 });
  if (perfil.user_id) return NextResponse.json({ erro: "Essa pessoa já tem login." }, { status: 400 });

  const senha = "Treino" + Math.floor(1000 + Math.random() * 9000);
  const { data: criado, error } = await admin.auth.admin.createUser({ email: perfil.email, password: senha, email_confirm: true });
  if (error) {
    const msg = error.message.includes("already") ? "Já existe um login com esse e-mail. Peça para a pessoa usar “Esqueci a senha”." : error.message;
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
  await admin.from("perfis").update({ user_id: criado.user.id, trocar_senha: true, boas_vindas_em: null }).eq("id", perfil_id);
  return NextResponse.json({ ok: true, email: perfil.email, senha });
}
