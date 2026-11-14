import { notFound } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa, modulo } from "@/lib/academia";
import { Faixa } from "@/components/Faixa";
import { FormCadastro } from "./FormCadastro";

export default async function Cadastro({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ indicado?: string; nome?: string; tel?: string; nasc?: string; resp?: string; email?: string }> }) {
  const { slug } = await params;
  const { indicado, nome, tel, nasc, resp, email } = await searchParams;
  const academia = await buscarAcademia(slug);
  if (!academia || !modulo(academia, "cadastro_online")) notFound();
  const sb = await supabaseServidor();
  const [{ data: modalidades }, { data: turmas }, { data: vagas }] = await Promise.all([
    sb.from("modalidades").select("id, nome").eq("academia_id", academia.id).eq("ativa", true).order("ordem"),
    sb.from("turmas").select("id, nome, modalidade_id").eq("academia_id", academia.id).eq("ativa", true).order("nome"),
    sb.from("turmas_vagas").select("turma_id, lotada").eq("academia_id", academia.id),
  ]);
  const lotadas = new Set((vagas || []).filter((v: any) => v.lotada).map((v: any) => v.turma_id));
  return (
    <div className="min-h-dvh bg-fundo text-texto" data-modo={academia.tema?.modo || "escuro"} data-fonte={academia.tema?.fonte || "esportiva"}>
    <main style={{ ["--cor" as any]: corDa(academia) }} className="mx-auto max-w-2xl px-4 sm:px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Pré-matrícula</h1>
      <p className="mt-1 text-lg text-suave">{academia.nome}</p>
      <Faixa graus={2} altura={10} className="my-5" />
      <FormCadastro inicial={{ nome, tel, nasc: nasc && /^\d{4}-\d{2}-\d{2}$/.test(nasc) ? nasc : undefined, resp, email }} academia={{ id: academia.id, nome: academia.nome, termos_cadastro: academia.termos_cadastro }} slug={slug} indicadoPor={indicado && /^[0-9a-f-]{36}$/.test(indicado) ? indicado : null} modalidades={modalidades || []} turmas={(turmas || []).map((t: any) => ({ ...t, lotada: lotadas.has(t.id) }))} />
    </main>
    </div>
  );
}
