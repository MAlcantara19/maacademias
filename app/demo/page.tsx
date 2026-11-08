"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

// Entra direto na Academia Piloto com o login de demonstração
export default function Demo() {
  const router = useRouter();
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL || "";
  const senha = process.env.NEXT_PUBLIC_DEMO_SENHA || "";
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!email || !senha) return;
    supabaseNavegador().auth.signInWithPassword({ email, password: senha }).then(({ error }) => {
      if (error) return setErro("A demonstração está indisponível agora.");
      router.replace("/academia-piloto/app");
      router.refresh();
    });
  }, []); // eslint-disable-line

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
      {email && senha && !erro ? (
        <p className="text-2xl">Abrindo a Academia Piloto…</p>
      ) : (
        <>
          <h1 className="text-4xl font-extrabold">Demonstração</h1>
          <p className="text-suave">{erro || "Veja a página pública da Academia Piloto ou peça um acesso de teste."}</p>
          <Link href="/academia-piloto" className="btn">Ver a Academia Piloto</Link>
        </>
      )}
    </main>
  );
}
