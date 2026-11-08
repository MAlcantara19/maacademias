"use client";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";
import { createBrowserClient } from "@supabase/ssr";

let cliente: ReturnType<typeof createBrowserClient> | null = null;

// Cliente do Supabase para componentes que rodam no navegador
export function supabaseNavegador() {
  if (!cliente) {
    cliente = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_CHAVE
    );
  }
  return cliente;
}
