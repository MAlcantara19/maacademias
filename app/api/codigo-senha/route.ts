import { NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/chaves";
import { acharPerfis } from "@/lib/perfisPorContato";
import { mandarEmail, mandarWhats, temEmailApi, temWhatsApi } from "@/lib/mensageiro";

export const runtime = "nodejs";

// "Esqueci a senha" sem depender do professor: chega um código de 6 dígitos
// no WhatsApp (Z-API) ou no e-mail (Resend) e a própria pessoa cria a senha.
// Sem essas integrações configuradas, responde { sem_envio: true } e a tela
// usa o caminho antigo (a academia é avisada e manda uma senha provisória).
const hash = (perfil: string, codigo: string) => createHash("sha256").update(perfil + ":" + codigo).digest("hex");

export async function POST(req: Request) {
  const secreta = process.env.SUPABASE_SECRET_KEY;
  const { acao, contato, codigo, senha, perfil_id } = await req.json().catch(() => ({}));
  const porEmail = String(contato || "").includes("@");
  if (!secreta || (porEmail ? !temEmailApi() : !temWhatsApi())) return NextResponse.json({ sem_envio: true });
  if (!contato || String(contato).trim().length < 6) return NextResponse.json({ erro: "Digite o e-mail ou o WhatsApp do cadastro." }, { status: 400 });
  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const perfis = await acharPerfis(admin, String(contato));

  if (acao === "enviar") {
    // sempre a mesma resposta, exista ou não o cadastro
    if (perfis.length) {
      const { data: antigo } = await admin.from("codigos_senha").select("criado_em").eq("perfil_id", perfis[0].id).maybeSingle();
      if (antigo && Date.now() - new Date(antigo.criado_em).getTime() < 60_000) return NextResponse.json({ ok: true, canal: porEmail ? "email" : "whats" });
      const cod = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expira = new Date(Date.now() + 15 * 60_000).toISOString();
      for (const p of perfis) {
        await admin.from("codigos_senha").upsert({ perfil_id: p.id, codigo_hash: hash(p.id, cod), expira_em: expira, tentativas: 0, criado_em: new Date().toISOString() });
      }
      const texto = `Seu código para criar uma senha nova no app da academia é: ${cod}\n\nEle vale por 15 minutos. Se não foi você que pediu, ignore esta mensagem.`;
      if (porEmail) await mandarEmail(perfis[0].email, `Código ${cod} — nova senha`, texto);
      else await mandarWhats(perfis[0].telefone, `🔑 ${texto}`);
    }
    return NextResponse.json({ ok: true, canal: porEmail ? "email" : "whats" });
  }

  if (acao === "confirmar") {
    const cod = String(codigo || "").replace(/\D/g, "");
    if (cod.length !== 6) return NextResponse.json({ erro: "O código tem 6 números." }, { status: 400 });
    const ids = perfis.map((p: any) => p.id);
    const { data: cods } = ids.length ? await admin.from("codigos_senha").select("*").in("perfil_id", ids) : { data: [] as any[] };
    const validos = (cods || []).filter((c: any) => new Date(c.expira_em) > new Date() && c.tentativas < 5);
    const certos = validos.filter((c: any) => c.codigo_hash === hash(c.perfil_id, cod));
    if (!certos.length) {
      for (const c of validos) await admin.from("codigos_senha").update({ tentativas: c.tentativas + 1 }).eq("perfil_id", c.perfil_id);
      return NextResponse.json({ erro: "Código errado ou vencido. Confira ou peça outro." }, { status: 400 });
    }
    const donos = perfis.filter((p: any) => certos.some((c: any) => c.perfil_id === p.id));
    // o mesmo WhatsApp em mais de uma conta (ex.: pai e filho): a pessoa escolhe qual
    const alvo = donos.length === 1 ? donos[0] : donos.find((p: any) => p.id === perfil_id);
    if (!alvo) return NextResponse.json({ escolher: donos.map((p: any) => ({ id: p.id, nome: p.apelido || p.nome })) });
    if (!senha || String(senha).length < 6) return NextResponse.json({ erro: "A senha nova precisa ter pelo menos 6 caracteres." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(alvo.user_id, { password: String(senha) });
    if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
    await admin.from("perfis").update({ trocar_senha: false, senha_provisoria_ate: null }).eq("id", alvo.id);
    await admin.from("codigos_senha").delete().in("perfil_id", ids);
    await admin.from("pedidos_senha").update({ atendido_em: new Date().toISOString() }).eq("perfil_id", alvo.id).is("atendido_em", null);
    await admin.from("senhas_geradas").insert({ perfil_id: alvo.id, quem: "a própria pessoa (código)", via: porEmail ? "codigo_email" : "codigo_whats" });
    const { data: u } = await admin.auth.admin.getUserById(alvo.user_id);
    return NextResponse.json({ ok: true, email: u?.user?.email || alvo.email });
  }
  return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
}
