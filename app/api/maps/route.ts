import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Recebe um link do Google Maps (inclusive o curto maps.app.goo.gl), segue o
// redirecionamento e devolve latitude/longitude e o endereço que vem no link.
const PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.|maps\.)?google\.[a-z.]+)$/i;

function coords(u: string) {
  const d = decodeURIComponent(u);
  const m = d.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || d.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || d.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}
function enderecoDoLink(u: string) {
  const d = decodeURIComponent(u.replace(/\+/g, " "));
  const m = d.match(/\/place\/([^/@]+)/) || d.match(/[?&]q=([^&]+)/);
  const t = m?.[1]?.trim();
  return t && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(t) ? t : null;
}

export async function POST(req: Request) {
  const { url } = await req.json().catch(() => ({}));
  let atual: URL;
  try { atual = new URL(String(url || "").trim()); } catch { return NextResponse.json({ erro: "Link inválido." }, { status: 400 }); }
  let final = atual.toString();
  for (let i = 0; i < 6; i++) {
    if (!PERMITIDOS.test(atual.hostname)) return NextResponse.json({ erro: "Use um link do Google Maps." }, { status: 400 });
    if (coords(final)) break;
    const r = await fetch(final, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (MA Academias)" } }).catch(() => null);
    const loc = r?.headers.get("location");
    if (!loc) {
      // às vezes a página final traz as coordenadas no HTML
      const html = r && r.status === 200 ? await r.text().catch(() => "") : "";
      const m = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) || html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
      if (m) final += `@${m[1]},${m[2]}`;
      break;
    }
    atual = new URL(loc, final); final = atual.toString();
  }
  const c = coords(final);
  let endereco = enderecoDoLink(final), cidade: string | null = null;
  if (c) {
    // endereço por extenso (OpenStreetMap), se o link não trouxer
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lng}&accept-language=pt-BR`,
        { headers: { "User-Agent": "MA Academias (contato pelo site)" } });
      const j = await r.json();
      const a = j?.address || {};
      cidade = [a.city || a.town || a.village || a.municipality, a.state_code || a.state].filter(Boolean).join(" - ") || null;
      if (!endereco) endereco = [a.road && `${a.road}${a.house_number ? `, ${a.house_number}` : ""}`, a.suburb || a.neighbourhood].filter(Boolean).join(" - ") || j?.display_name || null;
    } catch { /* sem endereço por extenso */ }
  }
  if (!c) return NextResponse.json({ erro: "Não achei as coordenadas nesse link. No Google Maps, toque em Compartilhar → Copiar link e cole aqui.", final }, { status: 422 });
  return NextResponse.json({ latitude: c.lat, longitude: c.lng, endereco, cidade, final });
}
