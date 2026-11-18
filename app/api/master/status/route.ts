import { NextResponse } from "next/server";
import { conferirMaster } from "@/lib/soMaster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quais integrações estão configuradas na Vercel (só diz sim/não, nunca mostra as chaves)
export async function GET(req: Request) {
  if (!(await conferirMaster(req))) return NextResponse.json({ erro: "Só o master." }, { status: 403 });
  const tem = (k: string) => !!process.env[k];
  return NextResponse.json({
    itens: [
      { grupo: "Base", nome: "Chave secreta do Supabase", ok: tem("SUPABASE_SECRET_KEY"), vars: ["SUPABASE_SECRET_KEY"], para: "criar logins, nova senha, push, backup" },
      { grupo: "Notificações no celular", nome: "Chaves VAPID", ok: tem("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && tem("VAPID_PRIVATE_KEY"), vars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"], para: "o celular tocar" },
      { grupo: "Notificações no celular", nome: "Senha do Webhook", ok: tem("PUSH_WEBHOOK_SECRET"), vars: ["PUSH_WEBHOOK_SECRET"], para: "o Supabase avisar o site a cada notificação" },
      { grupo: "E-mail", nome: "Resend", ok: tem("RESEND_API_KEY"), vars: ["RESEND_API_KEY", "EMAIL_REMETENTE"], para: "backup mensal e código de senha por e-mail", opcional: true },
      { grupo: "WhatsApp", nome: "Z-API", ok: tem("ZAPI_INSTANCIA") && tem("ZAPI_TOKEN"), vars: ["ZAPI_INSTANCIA", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"], para: "mandar senha e código no WhatsApp sozinho", opcional: true },
      { grupo: "Tarefas automáticas", nome: "Senha do cron", ok: tem("CRON_SECRET"), vars: ["CRON_SECRET"], para: "backup mensal (Vercel Cron)", opcional: true },
      { grupo: "Demonstração", nome: "Senha dos pilotos", ok: tem("NEXT_PUBLIC_DEMO_SENHA"), vars: ["NEXT_PUBLIC_DEMO_SENHA"], para: "entrar nos pilotos e o roteiro trocar de perfil", opcional: true },
      { grupo: "Galeria", nome: "Google Drive", ok: tem("GOOGLE_API_KEY"), vars: ["GOOGLE_API_KEY"], para: "galeria pelo Google Drive", opcional: true },
    ],
    versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    commit: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 120) || null,
  });
}
