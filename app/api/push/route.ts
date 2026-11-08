import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/chaves";

export const runtime = "nodejs";

// Chamado pelo Supabase (Database Webhook) a cada notificação nova.
// Envia o push para os celulares cadastrados da pessoa.
export async function POST(req: Request) {
  if (!process.env.PUSH_WEBHOOK_SECRET || req.headers.get("x-segredo") !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privada = process.env.VAPID_PRIVATE_KEY;
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!publica || !privada || !secreta) return NextResponse.json({ erro: "variáveis de push não configuradas" }, { status: 500 });

  const corpo = await req.json().catch(() => null);
  const n = corpo?.record;
  if (!n?.perfil_id) return NextResponse.json({ ok: true, enviados: 0 });

  webpush.setVapidDetails(process.env.VAPID_EMAIL || "mailto:contato@example.com", publica, privada);
  const sb = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });

  const [{ data: subs }, { data: pref }, { data: acad }] = await Promise.all([
    sb.from("push_inscricoes").select("*").eq("perfil_id", n.perfil_id),
    sb.from("preferencias_notificacao").select("tipos_desligados").eq("perfil_id", n.perfil_id).maybeSingle(),
    n.academia_id ? sb.from("academias").select("slug").eq("id", n.academia_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if ((pref?.tipos_desligados || []).includes(n.tipo)) return NextResponse.json({ ok: true, enviados: 0 });

  const url = acad?.slug ? `/${acad.slug}/app/notificacoes` : "/login";
  const payload = JSON.stringify({ titulo: n.titulo, texto: n.texto, url, tag: n.tipo });
  let enviados = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.chaves }, payload);
      enviados++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_inscricoes").delete().eq("id", s.id);
    }
  }
  return NextResponse.json({ ok: true, enviados });
}
