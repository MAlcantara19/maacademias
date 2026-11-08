import { notFound } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa } from "@/lib/academia";
import { Faixa } from "@/components/Faixa";
import { FormCadastro } from "./FormCadastro";

export default async function Cadastro({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academia = await buscarAcademia(slug);
  if (!academia) notFound();
  const sb = await supabaseServidor();
  const [{ data: modalidades }, { data: turmas }] = await Promise.all([
    sb.from("modalidades").select("id, nome").eq("academia_id", academia.id).eq("ativa", true).order("ordem"),
    sb.from("turmas").select("id, nome, modalidade_id").eq("academia_id", academia.id).eq("ativa", true).order("nome"),
  ]);
  return (
    <main style={{ ["--cor" as any]: corDa(academia) }} className="mx-auto max-w-lg px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-5xl font-extrabold">Cadastro de aluno</h1>
      <p className="mt-1 text-lg text-suave">{academia.nome}</p>
      <Faixa graus={2} altura={10} className="my-5" />
      <FormCadastro academiaId={academia.id} slug={slug} modalidades={modalidades || []} turmas={turmas || []} />
    </main>
  );
}
