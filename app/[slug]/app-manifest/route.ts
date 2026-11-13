import { NextResponse } from "next/server";
import { buscarAcademia, corDa } from "@/lib/academia";

// Manifesto do app de cada academia: instalando de dentro dela, o ícone é a logo
// da academia e o app abre direto nela.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a: any = await buscarAcademia(slug);
  if (!a) return NextResponse.json({ erro: "academia não encontrada" }, { status: 404 });
  const cor = corDa(a);
  const icones: any[] = [];
  if (a.logo_url) {
    icones.push({ src: a.logo_url, sizes: "512x512", type: "image/png", purpose: "any" });
    icones.push({ src: a.logo_url, sizes: "192x192", type: "image/png", purpose: "any" });
  }
  icones.push({ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" });
  const manifesto = {
    id: `/${slug}/app`,
    name: a.nome,
    short_name: a.nome.length > 14 ? a.nome.split(" ").slice(0, 2).join(" ") : a.nome,
    description: `App da ${a.nome}`,
    start_url: `/${slug}/app`,
    scope: "/",
    display: "standalone",
    background_color: "#121a36",
    theme_color: cor,
    lang: "pt-BR",
    icons: icones,
    // atalhos: segure o ícone do app
    shortcuts: [
      { name: "Minha carteirinha", short_name: "Carteirinha", url: `/${slug}/app/carteirinha`, icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Minhas turmas", short_name: "Turmas", url: `/${slug}/app/turmas`, icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Chamada", short_name: "Chamada", url: `/${slug}/app/chamada`, icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
  return new NextResponse(JSON.stringify(manifesto), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
