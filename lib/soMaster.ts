import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

// Confere, pelo token de quem chamou, se é o master. Devolve o usuário ou null.
export async function conferirMaster(req: Request) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_CHAVE, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const [{ data: master }, { data: { user } }] = await Promise.all([sb.rpc("sou_master"), sb.auth.getUser(token)]);
  return master && user ? user : null;
}
