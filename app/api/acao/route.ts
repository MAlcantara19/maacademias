import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { executarAcao } from "@/lib/acoes";

export const runtime = "nodejs";

// Botões da notificação no celular ("não vou hoje", "todos que confirmaram vieram").
// Usa a sessão de quem está logado no aparelho (cookie).
export async function POST(req: Request) {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, texto: "Entre no app para fazer isso." }, { status: 401 });
  const r = await executarAcao(sb, new URL(req.url).searchParams);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
