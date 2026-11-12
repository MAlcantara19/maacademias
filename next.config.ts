import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Guarda as páginas já visitadas por alguns segundos: voltar e trocar de aba fica instantâneo
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  // Bibliotecas grandes: só carrega o pedaço usado
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
