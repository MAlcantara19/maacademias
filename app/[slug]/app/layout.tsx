import { redirect, notFound } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa } from "@/lib/academia";
import { Casca } from "./Casca";

// Cada academia instala com o próprio nome e a própria logo
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a: any = await buscarAcademia(slug);
  return {
    manifest: `/${slug}/app-manifest`,
    ...(a?.logo_url ? { icons: { apple: a.logo_url } } : {}),
    appleWebApp: { capable: true, title: a?.nome || "MA Academias" },
  };
}

export default async function LayoutApp({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academia = await buscarAcademia(slug);
  if (!academia) notFound();

  const supabase = await supabaseServidor();
  // getClaims confere o login sem ir ao servidor de autenticação (mais rápido)
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/login?next=/${slug}/app`);

  // Uma única ida ao banco traz perfil, vínculos, dependentes, outras academias e notificações
  let { data: c, error: erroCtx } = await supabase.rpc("contexto_app", { p_academia: academia.id });
  if (erroCtx) c = await contextoSemAtualizacao(supabase, academia.id, claims.claims.sub as string); // banco sem a ATUALIZAÇÃO 08
  const perfil: any = c?.perfil || null;
  const master = !!c?.master;
  const meus: any[] = c?.meus || [];
  const depMembros: any[] = (c?.dependentes || []).map((d: any) => ({ ...d, perfis: { nome: d.nome, apelido: d.apelido, foto_url: d.foto_url } }));

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

  // "Visualizar como": a equipe vê o app do jeito que um aluno vê; o admin também
  // pode ver como um professor ou um responsável (ótimo para conferir e demonstrar)
  const podeVerComo = master || papeis.has("admin");
  const equipeReal = equipe;
  let vendoComo: any = null;
  let papeisVisao: string[] | null = null;
  let professorVisao: string | null = null;
  let perfilVisao: any = null;
  const verComo = (await cookies()).get("ver_como")?.value;
  if (equipe && verComo) {
    if (verComo.startsWith("prof:") && podeVerComo) {
      const { data: pr } = await supabase.from("membros").select("id, perfis(nome, apelido, foto_url)")
        .eq("academia_id", academia.id).eq("id", verComo.slice(5)).in("papel", ["professor", "admin"]).maybeSingle();
      const x = pr as any;
      if (x) {
        vendoComo = { id: x.id, nome: x.perfis?.apelido || x.perfis?.nome, tipo: "professor" };
        papeisVisao = ["professor"]; professorVisao = x.id; meusAlunos = []; perfilVisao = x.perfis;
      }
    } else if (verComo.startsWith("resp:") && podeVerComo) {
      const pid = verComo.slice(5);
      const [{ data: rp }, { data: deps }] = await Promise.all([
        supabase.from("perfis").select("nome, apelido, foto_url").eq("id", pid).maybeSingle(),
        supabase.from("responsaveis").select("dependente_id").eq("responsavel_id", pid),
      ]);
      const ids = (deps || []).map((d: any) => d.dependente_id);
      const { data: kids } = ids.length
        ? await supabase.from("membros").select("id, perfis(nome, apelido, foto_url)").eq("academia_id", academia.id).eq("papel", "aluno").eq("ativo", true).in("perfil_id", ids)
        : { data: [] as any[] };
      if (rp) {
        vendoComo = { id: null, nome: (rp as any).apelido || (rp as any).nome, tipo: "responsável" };
        papeisVisao = ["responsavel"]; equipe = false; perfilVisao = rp;
        meusAlunos = (kids || []).map((k: any) => ({ id: k.id, nome: k.perfis?.nome, apelido: k.perfis?.apelido, foto_url: k.perfis?.foto_url, eu: false }));
      }
    } else if (!verComo.includes(":")) {
      const { data: exemplo } = await supabase.from("membros")
        .select("id, perfis(nome, apelido, foto_url)").eq("academia_id", academia.id).eq("papel", "aluno").eq("ativo", true)
        .eq(verComo === "primeiro" ? "papel" : "id", verComo === "primeiro" ? "aluno" : verComo).limit(1);
      const ex = exemplo?.[0] as any;
      if (ex) {
        vendoComo = { id: ex.id, nome: ex.perfis?.apelido || ex.perfis?.nome, tipo: "aluno" };
        papeisVisao = ["aluno"]; equipe = false; perfilVisao = ex.perfis;
        meusAlunos = [{ id: ex.id, nome: ex.perfis?.nome, apelido: ex.perfis?.apelido, foto_url: ex.perfis?.foto_url, eu: true }];
      }
    }
  }

  // Último acesso: grava depois de a página já ter sido enviada (não atrasa a abertura)
  const dezMin = 10 * 60 * 1000;
  if (perfil && (!perfil.ultimo_acesso || Date.now() - new Date(perfil.ultimo_acesso).getTime() > dezMin)) {
    after(async () => { await supabase.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", perfil.id); });
  }
  const outras: any[] = c?.outras || [];
  const naoLidas: number = c?.nao_lidas || 0;

  return (
    <Casca
      ctx={{
        academia, perfil: perfilVisao ? { ...perfil, nome: perfilVisao.nome, apelido: perfilVisao.apelido, foto_url: perfilVisao.foto_url } : perfil,
        papeis: papeisVisao || Array.from(papeis), equipe, admin: !vendoComo && papeis.has("admin"), master: !vendoComo && !!master, vendoComo: !!vendoComo,
        professorId: vendoComo ? professorVisao : (meus || []).find((m: any) => m.papel === "professor")?.id || null,
        membroId: vendoComo ? vendoComo.id : membroEquipe?.id || membroAluno?.id || null, meusAlunos,
      }}
      vendoComo={vendoComo}
      verComoNivel={podeVerComo ? "admin" : equipeReal ? "equipe" : ""}
      outras={outras}
      cor={corDa(academia)}
      naoLidas={naoLidas || 0}
    >
      {children}
    </Casca>
  );
}

// Mesmo resultado do contexto_app, mas com várias consultas (usado se a ATUALIZAÇÃO 08 ainda não rodou)
async function contextoSemAtualizacao(supabase: any, academiaId: string, userId: string) {
  const [{ data: perfil }, { data: master }] = await Promise.all([
    supabase.from("perfis").select("*").eq("user_id", userId).maybeSingle(),
    supabase.rpc("sou_master"),
  ]);
  const pid = perfil?.id || "00000000-0000-0000-0000-000000000000";
  const [{ data: meus }, { data: deps }, { count }] = await Promise.all([
    supabase.from("membros").select("id, papel, perfil_id").eq("academia_id", academiaId).eq("perfil_id", pid).eq("ativo", true),
    supabase.from("responsaveis").select("dependente_id").eq("responsavel_id", pid),
    supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("lida", false),
  ]);
  const depIds = (deps || []).map((d: any) => d.dependente_id);
  const [{ data: dm }, { data: vinc }] = await Promise.all([
    depIds.length ? supabase.from("membros").select("id, papel, perfil_id, perfis(nome, apelido, foto_url)").eq("academia_id", academiaId).in("perfil_id", depIds).eq("ativo", true) : Promise.resolve({ data: [] }),
    supabase.from("membros").select("academias(id, slug, nome)").in("perfil_id", [pid, ...depIds]).eq("ativo", true),
  ]);
  return {
    perfil, master: !!master, meus: meus || [], nao_lidas: count || 0,
    dependentes: (dm || []).map((d: any) => ({ id: d.id, papel: d.papel, perfil_id: d.perfil_id, nome: d.perfis?.nome, apelido: d.perfis?.apelido, foto_url: d.perfis?.foto_url })),
    outras: Array.from(new Map((vinc || []).filter((v: any) => v.academias && v.academias.id !== academiaId).map((v: any) => [v.academias.slug, { slug: v.academias.slug, nome: v.academias.nome }])).values()),
  };
}
