import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Domínios que mostram a página geral (o resto é domínio próprio de academia)
const PRINCIPAIS = (process.env.NEXT_PUBLIC_DOMINIOS_PRINCIPAIS || "localhost")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function eDominioPrincipal(host: string) {
  return (
    PRINCIPAIS.includes(host) ||
    host.endsWith(".vercel.app") ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.")
  );
}

// Descobre a academia pelo domínio próprio (ex.: clubedeluta.com.br)
async function slugDoDominio(host: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/academias?select=slug&ativa=eq.true&dominio=in.(${encodeURIComponent(host)},${encodeURIComponent("www." + host.replace(/^www\./, ""))},${encodeURIComponent(host.replace(/^www\./, ""))})&limit=1`;
  try {
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_CHAVE,
        Authorization: `Bearer ${SUPABASE_CHAVE}`,
      },
      next: { revalidate: 300 },
    });
    const dados = await r.json();
    return Array.isArray(dados) && dados[0]?.slug ? dados[0].slug : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // Sem as chaves do Supabase, não trava o site: deixa abrir a página /status
  if (!SUPABASE_URL || !SUPABASE_CHAVE) return NextResponse.next({ request });

  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  // 1) Domínio próprio → reescreve /qualquer-coisa para /<slug>/qualquer-coisa
  let resposta: NextResponse;
  if (!eDominioPrincipal(host) && !pathname.startsWith("/login") && !pathname.startsWith("/auth") && !pathname.startsWith("/status") && !pathname.startsWith("/minha-conta") && !pathname.startsWith("/master") && !pathname.startsWith("/conheca") && !pathname.startsWith("/demo")) {
    const slug = await slugDoDominio(host);
    if (slug && !pathname.startsWith(`/${slug}`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
      resposta = NextResponse.rewrite(url);
    } else {
      resposta = NextResponse.next({ request });
    }
  } else {
    resposta = NextResponse.next({ request });
  }

  // 2) Mantém a sessão do Supabase renovada
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_CHAVE,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(lista) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    }
  );
  try {
    await supabase.auth.getUser();
  } catch {
    // se o Supabase estiver fora do ar, o site continua abrindo
  }

  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|sw.js|favicon.ico|icon-.*|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
