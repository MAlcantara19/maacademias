"use client";
import { useEffect } from "react";

// Registra o service worker (app instalável + notificações no celular)
export function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
