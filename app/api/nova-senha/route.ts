import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

export const runtime = "nodejs";

// Professor, admin ou master gera uma senha provisória nova para quem esqueceu.
// No próximo acesso a pessoa é obrigada a trocar.
export async function POST(req: Request) {
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return NextResponse.json({ erro: "Falta a variável SUPABASE_SECRET_KEY no servidor." }, { status: 500 });
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { perfil_id, senha: escolhida } = await req.json().catch(() => ({}));
  if (!token || !perfil_id) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });

  // quem pediu precisa ser da equipe dessa pessoa (ou do aluno de quem ela é responsável)
  const comoUsuario = createClient(SUPABASE_URL, SUPABASE_CHAVE, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: pode } = await comoUsuario.rpc("sou_equipe_do_perfil", { pf: perfil_id });
  if (!pode) return NextResponse.json({ erro: "Sem permissão para trocar a senha desta pessoa." }, { status: 403 });
  const { data: { user: eu } } = await comoUsuario.auth.getUser();

  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const { data: perfil } = await admin.from("perfis").select("id, user_id, email, nome").eq("id", perfil_id).maybeSingle();
  if (!perfil?.user_id) return NextResponse.json({ erro: "Esta pessoa ainda não tem login. Use “Criar login”." }, { status: 400 });
  if (perfil.user_id === eu?.id) return NextResponse.json({ erro: "Para trocar a sua própria senha, use Minha conta." }, { status: 400 });

  const senha = typeof escolhida === "string" && escolhida.trim().length >= 6 ? escolhida.trim() : "Treino" + Math.floor(1000 + Math.random() * 9000);
  const { error } = await admin.auth.admin.updateUserById(perfil.user_id, { password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  await admin.from("perfis").update({ trocar_senha: true }).eq("id", perfil_id);
  await admin.from("pedidos_senha").update({ atendido_em: new Date().toISOString(), atendido_por: eu?.id || null }).eq("perfil_id", perfil_id).is("atendido_em", null);
  const { data: u } = await admin.auth.admin.getUserById(perfil.user_id);
  return NextResponse.json({ ok: true, email: u?.user?.email || perfil.email, senha });
}
