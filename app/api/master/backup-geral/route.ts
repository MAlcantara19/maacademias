import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/chaves";
import { conferirMaster } from "@/lib/soMaster";
import { montarBackupGeral } from "@/lib/backupPlanilha";

export const runtime = "nodejs";
export const maxDuration = 60;

// Master: uma planilha com todas as academias reais (os pilotos ficam de fora, a não ser que peça)
export async function POST(req: Request) {
  const eu = await conferirMaster(req);
  if (!eu) return NextResponse.json({ erro: "Só o master." }, { status: 403 });
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) return NextResponse.json({ erro: "Falta a SUPABASE_SECRET_KEY na Vercel." }, { status: 500 });
  const { pilotos } = await req.json().catch(() => ({}));
  const admin = createClient(SUPABASE_URL, secreta, { auth: { persistSession: false } });
  const { data: acads, error } = await admin.from("academias").select("id, nome, demonstracao").order("nome");
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  const lista = (acads || []).filter((a: any) => pilotos || !a.demonstracao);
  if (!lista.length) return NextResponse.json({ erro: "Nenhuma academia real para o backup." }, { status: 400 });
  const buf = await montarBackupGeral(admin, lista);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-todas-academias-${hoje}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
