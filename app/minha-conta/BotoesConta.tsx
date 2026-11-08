"use client";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

export function BotoesConta() {
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <button className="btn-sec" onClick={() => router.refresh()}>Verificar de novo</button>
      <button className="btn-sec" onClick={async () => { await supabaseNavegador().auth.signOut(); router.replace("/login"); }}>Sair</button>
    </div>
  );
}
