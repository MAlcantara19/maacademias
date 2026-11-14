import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa } from "@/lib/academia";

// Página pública de resultados: as medalhas da academia nos campeonatos
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await buscarAcademia(slug);
  return { title: a ? `Resultados — ${a.nome}` : "Resultados", description: a ? `Medalhas e conquistas da ${a.nome} nos campeonatos.` : undefined };
}

export default async function Resultados({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academia = await buscarAcademia(slug);
  if (!academia) notFound();
  const sb = await supabaseServidor();
  const { data } = await sb.rpc("resultados_publicos", { p_slug: slug });
  const linhas: any[] = data || [];
  const conta = (r: string) => linhas.filter((l) => l.resultado === r).length;
  const eventos = Array.from(new Map(linhas.map((l) => [l.evento_id, l])).values());
  const medalha: Record<string, string> = { ouro: "🥇", prata: "🥈", bronze: "🥉" };
  const cor = corDa(academia);

  return (
    <div className="min-h-dvh bg-fundo text-texto" data-modo={academia.tema?.modo || "escuro"} data-fonte={academia.tema?.fonte || "esportiva"} style={{ ["--cor" as any]: cor }}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-5">
        <nav className="flex items-center justify-between py-2 text-sm"><Link href={`/${slug}`} className="text-suave">← {academia.nome}</Link></nav>
        <header className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {academia.logo_url && <img src={academia.logo_url} alt="" className="h-16 w-16 rounded-xl object-contain" />}
          <div><h1 className="text-4xl font-extrabold sm:text-5xl">Resultados</h1><p className="text-suave">{academia.nome}</p></div>
        </header>
        <section className="grid grid-cols-3 gap-3 text-center">
          {(["ouro", "prata", "bronze"] as const).map((r) => (
            <div key={r} className="rounded-2xl bg-painel p-4"><p className="text-4xl">{medalha[r]}</p><p className="numero text-4xl font-extrabold">{conta(r)}</p><p className="text-xs uppercase tracking-wide text-suave">{r}</p></div>
          ))}
        </section>
        {eventos.map((e) => (
          <section key={e.evento_id} className="rounded-2xl bg-painel p-4">
            <h2 className="text-xl font-bold">{e.evento}</h2>
            <p className="text-sm text-suave">{new Date(e.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}{e.local ? ` · ${e.local}` : ""}</p>
            <ul className="mt-2 divide-y divide-linha">
              {linhas.filter((l) => l.evento_id === e.evento_id).map((l, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="text-2xl">{medalha[l.resultado]}</span>
                  <span className="min-w-0 flex-1"><b>{l.atleta}</b><span className="block truncate text-xs text-suave">{[l.categoria, l.faixa && `faixa ${String(l.faixa).toLowerCase()}`].filter(Boolean).join(" · ")}</span></span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!linhas.length && <p className="text-suave">Os resultados aparecem aqui assim que a academia registrar as medalhas dos campeonatos.</p>}
        <p className="text-center text-xs text-suave">Por privacidade, mostramos só o primeiro nome e a inicial do sobrenome.</p>
      </main>
    </div>
  );
}
