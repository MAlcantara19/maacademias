"use client";
import { useEffect } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Guarda os erros que acontecem no navegador para o suporte (painel master)
export async function registrarErro(mensagem: string, detalhe?: string) {
  try {
    await supabaseNavegador().from("erros_app").insert({
      pagina: location.pathname, mensagem: String(mensagem).slice(0, 500), detalhe: (detalhe || "").slice(0, 2000),
      navegador: navigator.userAgent.slice(0, 200),
    });
  } catch { /* sem conexão: ignora */ }
}

export function RegistroErros() {
  useEffect(() => {
    const vistos = new Set<string>();
    const anotar = (m: string, d?: string) => { if (vistos.has(m)) return; vistos.add(m); registrarErro(m, d); };
    const erro = (e: ErrorEvent) => anotar(e.message, e.error?.stack);
    const promessa = (e: PromiseRejectionEvent) => anotar(String(e.reason?.message || e.reason), e.reason?.stack);
    window.addEventListener("error", erro);
    window.addEventListener("unhandledrejection", promessa);
    return () => { window.removeEventListener("error", erro); window.removeEventListener("unhandledrejection", promessa); };
  }, []);
  return null;
}
