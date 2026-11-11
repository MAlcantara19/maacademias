import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Roda 1x por dia (vercel.json → crons): apaga fotos do feed mais velhas que o
// prazo de cada academia (padrão 30 dias), arquivos e posts.
// Precisa das variáveis SUPABASE_SECRET_KEY e CRON_SECRET na Vercel.
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) return NextResponse.json({ erro: "faltam chaves do Supabase" }, { status: 500 });

  const sb = createClient(url, chave, { auth: { persistSession: false } });
  const { data: vencidos, error } = await sb.rpc("posts_vencidos");
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  let arquivos = 0;
  const caminhos: Record<string, string[]> = { privado: [], publico: [] };
  for (const p of vencidos || []) {
    for (const u of p.urls || []) {
      if (!u) continue;
      const [balde, ...resto] = String(u).split(":");
      if (caminhos[balde] && resto.length) caminhos[balde].push(resto.join(":"));
    }
  }
  for (const balde of Object.keys(caminhos)) {
    for (let i = 0; i < caminhos[balde].length; i += 100) {
      const lote = caminhos[balde].slice(i, i + 100);
      const r = await sb.storage.from(balde).remove(lote);
      if (!r.error) arquivos += lote.length;
    }
  }
  const ids = (vencidos || []).map((p: any) => p.post_id);
  if (ids.length) await sb.from("posts").delete().in("id", ids);
  return NextResponse.json({ posts_apagados: ids.length, arquivos_apagados: arquivos });
}
