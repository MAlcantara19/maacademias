// Aceita os dois nomes de variável que o Supabase usa:
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (novo) ou NEXT_PUBLIC_SUPABASE_ANON_KEY (antigo)
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
