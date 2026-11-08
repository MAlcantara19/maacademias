"use client";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

// Tela de erro: mostra o motivo em vez de uma página branca
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const semChaves = !SUPABASE_URL || !SUPABASE_CHAVE;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-5xl font-extrabold">Algo deu errado</h1>
      {semChaves ? (
        <p className="text-suave">
          O site não encontrou as chaves do Supabase. Confira as variáveis NEXT_PUBLIC_SUPABASE_URL e
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e publique de novo.
        </p>
      ) : (
        <p className="text-suave">Não foi possível carregar esta página. Tente de novo em alguns segundos.</p>
      )}
      <p className="text-xs text-suave">Código do erro: {error.digest || error.message}</p>
      <button className="btn w-fit" onClick={reset}>Tentar de novo</button>
    </main>
  );
}
