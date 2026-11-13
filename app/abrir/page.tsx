"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ponto de entrada do app instalado: volta para a última academia usada neste aparelho
export default function Abrir() {
  const router = useRouter();
  useEffect(() => {
    let destino = "/login";
    try { const s = localStorage.getItem("ma_ultima_academia"); if (s) destino = `/${s}/app`; } catch { /* */ }
    router.replace(destino);
  }, [router]);
  return <main className="flex min-h-dvh items-center justify-center text-suave">Abrindo…</main>;
}
