import { redirect, notFound } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa } from "@/lib/academia";
import { Casca } from "./Casca";
import { NENHUM } from "@/lib/util";

export default async function LayoutApp({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academia = await buscarAcademia(slug);
  if (!academia) notFound();

  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${slug}/app`);

  const { data: perfil } = await supabase.from("perfis").select("*").eq("user_id", user.id).maybeSingle();
  const { data: master } = await supabase.rpc("sou_master");

  // Meus vínculos nesta academia
  const { data: meus } = await supabase.from("membros")
    .select("id, papel, perfil_id").eq("academia_id", academia.id).eq("perfil_id", perfil?.id || NENHUM).eq("ativo", true);

  // Dependentes (filhos) nesta academia
  const { data: deps } = await supabase.from("responsaveis").select("dependente_id").eq("responsavel_id", perfil?.id || NENHUM);
  const depIds = (deps || []).map((d: any) => d.dependente_id);
  const { data: depMembros } = depIds.length
    ? await supabase.from("membros").select("id, papel, perfil_id, perfis(nome, apelido, foto_url)").eq("academia_id", academia.id).in("perfil_id", depIds).eq("ativo", true)
    : { data: [] as any[] };

  const papeis = new Set<string>((meus || []).map((m: any) => m.papel));
  if (master) papeis.add("admin");
  if ((depMembros || []).length) papeis.add("responsavel");
  if (!papeis.size) redirect("/login");

  const equipe = papeis.has("admin") || papeis.has("professor");
  const membroEquipe = (meus || []).find((m: any) => m.papel !== "aluno");
  const membroAluno = (meus || []).find((m: any) => m.papel === "aluno");
  const meusAlunos = [
    ...(membroAluno ? [{ id: membroAluno.id, nome: perfil?.nome, apelido: perfil?.apelido, foto_url: perfil?.foto_url, eu: true }] : []),
    ...(depMembros || []).map((d: any) => ({ id: d.id, nome: d.perfis?.nome, apelido: d.perfis?.apelido, foto_url: d.perfis?.foto_url, eu: false })),
  ];

  // Último acesso (para o painel de alunos)
  if (perfil) await supabase.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", perfil.id);

  const { count: naoLidas } = await supabase.from("notificacoes")
    .select("id", { count: "exact", head: true }).eq("lida", false);

  return (
    <Casca
      ctx={{
        academia, perfil, papeis: Array.from(papeis), equipe, admin: papeis.has("admin"),
        membroId: membroEquipe?.id || membroAluno?.id || null, meusAlunos,
      }}
      cor={corDa(academia)}
      naoLidas={naoLidas || 0}
    >
      {children}
    </Casca>
  );
}
