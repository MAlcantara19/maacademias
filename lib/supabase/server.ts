import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente do Supabase para páginas que rodam no servidor
export async function supabaseServidor() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_CHAVE,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component: o proxy renova a sessão
          }
        },
      },
    }
  );
}
