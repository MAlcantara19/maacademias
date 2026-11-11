"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { PLANOS } from "@/lib/planos";

// Demonstração: /demo?plano=base | intermediario | completo
// Entra com o login de demonstração (NEXT_PUBLIC_DEMO_EMAIL/SENHA) na academia piloto do plano
function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const plano = PLANOS.find((p) => p.id === params.get("plano"));
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL || "";
  const senha = process.env.NEXT_PUBLIC_DEMO_SENHA || "";
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!plano || !email || !senha) return;
    supabaseNavegador().auth.signInWithPassword({ email, password: senha }).then(({ error }) => {
      if (error) return setErro("A demonstração está indisponível agora.");
      router.replace(`/${plano.slugDemo}/app`);
      router.refresh();
    });
  }, [plano?.id]); // eslint-disable-line

  if (plano && email && senha && !erro) return <p className="text-2xl">Abrindo o Piloto {plano.nome}…</p>;
  return (
    <>
      <h1 className="text-4xl font-extrabold">Demonstração</h1>
      <p className="text-suave">{erro || "Escolha o plano para ver o app por dentro, com alunos e aulas de exemplo."}</p>
      <div className="grid gap-2">
        {PLANOS.map((p) => (
          <div key={p.id} className="flex gap-2">
            {email && senha ? <Link href={`/demo?plano=${p.id}`} className="btn flex-1">Entrar no Piloto {p.nome}</Link> : null}
            <Link href={`/${p.slugDemo}`} className="btn-sec flex-1">Página do Piloto {p.nome}</Link>
          </div>
        ))}
      </div>
      <Link href="/planos" className="text-sm underline">Comparar os planos</Link>
    </>
  );
}

export default function Demo() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
      <Suspense><Conteudo /></Suspense>
    </main>
  );
}
