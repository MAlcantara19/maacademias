import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { BotoesConta } from "./BotoesConta";

export const dynamic = "force-dynamic";

// Diagnóstico da conta: mostra se o login está ligado a um cadastro e a quais academias
export default async function MinhaConta() {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  await sb.rpc("vincular_minha_conta");
  const { data: master } = await sb.rpc("sou_master");
  const { data: perfil } = await sb.from("perfis").select("id, nome").eq("user_id", user.id).maybeSingle();
  const { data: vinculos } = perfil
    ? await sb.from("membros").select("papel, ativo, academias(slug, nome)").eq("perfil_id", perfil.id)
    : { data: [] as any[] };

  const ok = (b: boolean) => (b ? "✅" : "❌");

  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 py-10">
      <h1 className="text-5xl font-extrabold">Minha conta</h1>
      <ul className="space-y-3">
        <li className="rounded-2xl bg-painel p-4"><p className="font-semibold">✅ Login feito</p><p className="text-sm text-suave">{user.email}</p></li>
        <li className="rounded-2xl bg-painel p-4">
          <p className="font-semibold">{ok(!!perfil)} Cadastro ligado ao login</p>
          <p className="text-sm text-suave">
            {perfil ? perfil.nome : "Nenhum cadastro com este e-mail. A academia precisa cadastrar você com exatamente este e-mail (em Alunos → Cadastrar aluno)."}
          </p>
        </li>
        <li className="rounded-2xl bg-painel p-4">
          <p className="font-semibold">{ok(!!master || (vinculos || []).length > 0)} Academias</p>
          {master && <p className="text-sm">⭐ Você é master: vê e administra todas as academias.</p>}
          {(vinculos || []).map((v: any) => (
            <p key={v.academias.slug + v.papel} className="text-sm">
              <Link className="underline" href={`/${v.academias.slug}/app`}>{v.academias.nome}</Link> — {v.papel}{v.ativo ? "" : " (inativo)"}
            </p>
          ))}
          {!master && !(vinculos || []).length && <p className="text-sm text-suave">Sua conta ainda não está em nenhuma academia.</p>}
        </li>
      </ul>
      {master && <Link href="/master" className="btn">Abrir painel master</Link>}
      <BotoesConta />
    </main>
  );
}
