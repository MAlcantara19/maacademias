import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
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
  if (!papeis.size) redirect("/minha-conta");

  let equipe = papeis.has("admin") || papeis.has("professor");
  const membroEquipe = (meus || []).find((m: any) => m.papel !== "aluno");
  const membroAluno = (meus || []).find((m: any) => m.papel === "aluno");
  let meusAlunos: any[] = [
    ...(membroAluno ? [{ id: membroAluno.id, nome: perfil?.nome, apelido: perfil?.apelido, foto_url: perfil?.foto_url, eu: true }] : []),
    ...(depMembros || []).map((d: any) => ({ id: d.id, nome: d.perfis?.nome, apelido: d.perfis?.apelido, foto_url: d.perfis?.foto_url, eu: false })),
  ];

  // "Ver como aluno": a equipe vê o app do jeito que um aluno vê (ótimo para demonstrar)
  let vendoComo: any = null;
  const verComo = (await cookies()).get("ver_como")?.value;
  if (equipe && verComo) {
    const { data: exemplo } = await supabase.from("membros")
      .select("id, perfis(nome, apelido, foto_url)").eq("academia_id", academia.id).eq("papel", "aluno").eq("ativo", true)
      .eq(verComo === "primeiro" ? "papel" : "id", verComo === "primeiro" ? "aluno" : verComo).limit(1);
    const ex = exemplo?.[0] as any;
    if (ex) {
      vendoComo = { id: ex.id, nome: ex.perfis?.apelido || ex.perfis?.nome };
      equipe = false;
      meusAlunos = [{ id: ex.id, nome: ex.perfis?.nome, apelido: ex.perfis?.apelido, foto_url: ex.perfis?.foto_url, eu: true }];
    }
  }

  // Último acesso (para o painel de alunos)
  if (perfil) await supabase.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", perfil.id);

  // Outras academias em que estou (para trocar de academia no menu)
  const idsPerfis = [perfil?.id, ...depIds].filter(Boolean);
  const { data: vinc } = idsPerfis.length
    ? await supabase.from("membros").select("academias(slug, nome)").in("perfil_id", idsPerfis).eq("ativo", true)
    : { data: [] as any[] };
  const outras = Array.from(new Map((vinc || []).map((v: any) => [v.academias?.slug, v.academias])).values())
    .filter((a: any) => a?.slug && a.slug !== academia.slug);

  const { count: naoLidas } = await supabase.from("notificacoes")
    .select("id", { count: "exact", head: true }).eq("lida", false);

  return (
    <Casca
      ctx={{
        academia, perfil, papeis: vendoComo ? ["aluno"] : Array.from(papeis), equipe, admin: !vendoComo && papeis.has("admin"), master: !!master, vendoComo: !!vendoComo,
        membroId: vendoComo ? vendoComo.id : membroEquipe?.id || membroAluno?.id || null, meusAlunos,
      }}
      vendoComo={vendoComo}
      outras={outras}
      cor={corDa(academia)}
      naoLidas={naoLidas || 0}
    >
      {children}
    </Casca>
  );
}
