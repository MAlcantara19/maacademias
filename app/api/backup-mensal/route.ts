import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";
import { montarBackup } from "@/lib/backupPlanilha";

export const runtime = "nodejs";
export const maxDuration = 60;

// Backup mensal por e-mail (Resend): a planilha da academia chega no e-mail dos admins.
// GET  → roda no dia 1º (vercel.json → crons), para todas as academias ativas.
// POST → botão "Mandar agora por e-mail" (só o admin daquela academia).
// Variáveis na Vercel: SUPABASE_SECRET_KEY, CRON_SECRET, RESEND_API_KEY e (opcional) BACKUP_REMETENTE.
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const nomeArq = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");

async function enviar(admin: any, academia: any) {
  const { data: adms } = await admin.from("membros").select("perfis(email, nome)").eq("academia_id", academia.id).eq("papel", "admin").eq("ativo", true);
  const para = Array.from(new Set((adms || []).map((m: any) => m.perfis?.email).filter(Boolean))) as string[];
  if (!para.length) return { academia: academia.nome, erro: "sem e-mail de admin" };
  const buf = await montarBackup(admin, academia.id);
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BACKUP_REMETENTE || "MA Academias <onboarding@resend.dev>",
      to: para,
      subject: `📦 Backup de ${mes} — ${academia.nome}`,
      html: `<p>Olá!</p><p>Segue em anexo o backup de <b>${academia.nome}</b>: alunos, responsáveis, turmas, matrículas, presenças dos últimos 12 meses, mensalidades e graduações.</p><p>Guarde no seu computador ou no Google Drive. 🥋</p><p style="color:#888;font-size:12px">Enviado automaticamente pelo app MA Academias.</p>`,
      attachments: [{ filename: `backup-${nomeArq(academia.nome)}-${hoje()}.xlsx`, content: Buffer.from(buf).toString("base64") }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { academia: academia.nome, para } : { academia: academia.nome, erro: j?.message || `Resend respondeu ${r.status}` };
}

function prontos() {
  const faltam = ["SUPABASE_SECRET_KEY", "RESEND_API_KEY"].filter((k) => !process.env[k]);
  return faltam.length ? `Falta configurar na Vercel: ${faltam.join(", ")}.` : null;
}

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const falta = prontos(); if (falta) return NextResponse.json({ erro: falta }, { status: 500 });
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data: acads } = await admin.from("academias").select("id, nome").eq("ativa", true);
  const res = [];
  for (const a of acads || []) res.push(await enviar(admin, a).catch((e) => ({ academia: a.nome, erro: String(e?.message || e) })));
  return NextResponse.json({ ok: true, res });
}

export async function POST(req: Request) {
  const falta = prontos(); if (falta) return NextResponse.json({ erro: falta }, { status: 500 });
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { academia_id } = await req.json().catch(() => ({}));
  if (!token || !academia_id) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });
  const comoUsuario = createClient(SUPABASE_URL, SUPABASE_CHAVE, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: pode } = await comoUsuario.rpc("sou_admin", { acad: academia_id });
  if (!pode) return NextResponse.json({ erro: "Só o admin da academia pode pedir o backup." }, { status: 403 });
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data: a } = await admin.from("academias").select("id, nome").eq("id", academia_id).maybeSingle();
  if (!a) return NextResponse.json({ erro: "Academia não encontrada." }, { status: 404 });
  const r = await enviar(admin, a);
  return (r as any).erro ? NextResponse.json({ erro: (r as any).erro }, { status: 400 }) : NextResponse.json(r);
}
