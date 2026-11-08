"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

const CHAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function base64ParaUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Botão para receber as notificações no celular, mesmo com o app fechado
export function AtivarPush({ perfilId }: { perfilId?: string }) {
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "ios" | "ativo" | "inativo" | "negado" | "sem-chave">("carregando");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!CHAVE) return setEstado("sem-chave");
      const ios = /iphone|ipad/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado(ios && !instalado ? "ios" : "sem-suporte");
      if (Notification.permission === "denied") return setEstado("negado");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? "ativo" : "inativo");
    })();
  }, []);

  async function ativar() {
    setMsg("");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setEstado("negado");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(CHAVE) });
    const j = sub.toJSON();
    const { error } = await supabaseNavegador().from("push_inscricoes").upsert(
      { perfil_id: perfilId, endpoint: j.endpoint, chaves: j.keys, aparelho: navigator.userAgent.slice(0, 120) },
      { onConflict: "endpoint" }
    );
    if (error) return setMsg("Não foi possível salvar: " + error.message);
    setEstado("ativo");
  }

  async function desativar() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabaseNavegador().from("push_inscricoes").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setEstado("inativo");
  }

  if (estado === "carregando" || estado === "sem-chave") return null;
  return (
    <section className="rounded-2xl bg-painel p-4">
      <p className="font-semibold">📲 Notificações no celular</p>
      {estado === "ativo" && <><p className="text-sm text-suave">Ativadas neste aparelho.</p><button className="mt-2 text-sm underline" onClick={desativar}>Desativar</button></>}
      {estado === "inativo" && <><p className="text-sm text-suave">Receba avisos de pesagem, aniversários e mensalidades mesmo com o app fechado.</p><button className="btn mt-2" onClick={ativar}>Ativar notificações</button></>}
      {estado === "negado" && <p className="text-sm text-suave">As notificações estão bloqueadas. Libere nas configurações do navegador para este site.</p>}
      {estado === "ios" && <p className="text-sm text-suave">No iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o app pela tela inicial e volte aqui.</p>}
      {estado === "sem-suporte" && <p className="text-sm text-suave">Este navegador não aceita notificações. Use o Chrome no Android.</p>}
      {msg && <p className="mt-2 text-sm text-alerta">{msg}</p>}
    </section>
  );
}
