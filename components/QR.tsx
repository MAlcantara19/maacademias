"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QR({ texto, tamanho = 220 }: { texto: string; tamanho?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 1 }).then(setSrc).catch(() => setSrc(""));
  }, [texto, tamanho]);
  if (!src) return <div style={{ width: tamanho, height: tamanho }} className="rounded-lg bg-white/10" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR Code" width={tamanho} height={tamanho} className="rounded-lg bg-white" />;
}
