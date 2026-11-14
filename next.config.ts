import type { NextConfig } from "next";

// Regras de segurança enviadas em todas as páginas (as que o teste de segurança pediu)
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' é necessário para o reconhecimento facial (TensorFlow) rodar no navegador;
  // cdn.jsdelivr.net e storage.googleapis.com: "tirar o fundo da foto" (MediaPipe)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://brasilapi.com.br https://cdn.jsdelivr.net https://storage.googleapis.com",
  "frame-src https://www.openstreetmap.org https://drive.google.com https://www.google.com https://www.youtube.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const CABECALHOS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // câmera (foto/rosto), microfone (chamada por voz) e localização (check-in) só no próprio site
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Guarda as páginas já visitadas por alguns segundos: voltar e trocar de aba fica instantâneo
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  compress: true,
  poweredByHeader: false,
  async headers() {
    // no computador (npm run dev) as regras ficam desligadas para não atrapalhar o desenvolvimento
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: CABECALHOS }];
  },
};

export default nextConfig;
