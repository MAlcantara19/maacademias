import { NENHUM } from "@/lib/util";
import type { supabaseNavegador } from "@/lib/supabase/client";

// Para onde mandar a pessoa depois do login
export async function destinoDepoisDoLogin(sb: ReturnType<typeof supabaseNavegador>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { url: "/login" };
  await sb.rpc("vincular_minha_conta"); // garante o vínculo pelo e-mail
  const { data: master } = await sb.rpc("sou_master");
  const { data: perfil } = await sb.from("perfis").select("id").eq("user_id", user.id).maybeSingle();
  const ids = [perfil?.id || NENHUM];
  const { data: deps } = await sb.from("responsaveis").select("dependente_id").eq("responsavel_id", perfil?.id || NENHUM);
  (deps || []).forEach((d: any) => ids.push(d.dependente_id));
  const { data: vinculos } = await sb.from("membros").select("academias(slug, nome)").in("perfil_id", ids).eq("ativo", true);
  const lista: any[] = Array.from(new Map((vinculos || []).map((v: any) => [v.academias.slug, v.academias])).values());
  if (master) return { url: "/master" };
  if (lista.length === 1) return { url: `/${lista[0].slug}/app` };
  if (lista.length > 1) return { lista };
  return { url: "/minha-conta" };
}

