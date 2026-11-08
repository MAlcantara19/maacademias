import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/server";
import { Diretorio } from "@/components/Diretorio";

export const revalidate = 300;

export default async function Inicio() {
  const supabase = await supabaseServidor();
  const { data: academias } = await supabase.from("diretorio_academias").select("*").order("nome");

  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-3">
        <span className="titulo text-xl font-bold">MA Academias</span>
        <div className="flex gap-2">
          <Link href="/conheca" className="btn-sec text-sm">Para academias</Link>
          <Link href="/login" className="btn-sec text-sm">Entrar</Link>
        </div>
      </header>

      <section className="pb-8 pt-10 sm:pt-16">
        <h1 className="max-w-2xl text-5xl font-extrabold sm:text-7xl">Escolha seu tatame.</h1>
        <p className="mt-4 max-w-xl text-lg text-suave">
          Horários, professores e aula experimental das academias de luta da região. Toque numa academia para ver tudo.
        </p>
      </section>

      <Diretorio academias={academias || []} />
    </main>
  );
}
