import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa } from "@/lib/academia";

// Página da cerimônia de graduação: quem mudou de faixa (para mandar aos pais e mostrar no telão)
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await buscarAcademia(slug);
  return { title: a ? `Graduação — ${a.nome}` : "Graduação" };
}

export default async function Graduacao({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { slug } = await params;
  const q = await searchParams;
  const academia = await buscarAcademia(slug);
  if (!academia) notFound();
  const valida = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const hoje = new Date().toISOString().slice(0, 10);
  const ate = valida(q.ate) || valida(q.de) || hoje;
  const de = valida(q.de) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const sb = await supabaseServidor();
  const { data } = await sb.rpc("graduacoes_publicas", { p_slug: slug, p_de: de, p_ate: ate });
  const lista: any[] = data || [];
  const mods = Array.from(new Set(lista.map((l) => l.modalidade)));
  const cor = corDa(academia);
  const dataTxt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="relative min-h-dvh overflow-hidden text-white" style={{ background: `radial-gradient(circle at 50% 0%, ${cor}, #0b0f1d 70%)` }}>
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className="confete" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.35}s`, animationDuration: "4s", background: ["#facc15", "#ffffff", "#22c55e", "#3b82f6", "#ef4444"][i % 5] }} />
      ))}
      <main className="relative mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
        <nav className="text-left text-sm"><Link href={`/${slug}`} className="opacity-80">← {academia.nome}</Link></nav>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {academia.logo_url && <img src={academia.logo_url} alt="" className="mx-auto h-20 w-20 object-contain" />}
        <h1 className="titulo text-4xl font-extrabold sm:text-6xl">🎉 Parabéns, novos graduados!</h1>
        <p className="text-lg opacity-90">{academia.nome} · {de === ate ? dataTxt(de) : `${dataTxt(de)} a ${dataTxt(ate)}`}</p>
        {mods.map((m) => (
          <section key={m} className="space-y-3">
            {mods.length > 1 && <h2 className="text-2xl font-bold">{m}</h2>}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {lista.filter((l) => l.modalidade === m).map((l, i) => (
                <li key={i} className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <p className="text-xl font-bold leading-tight">{l.atleta}</p>
                  <div className="mx-auto mt-3 h-4 w-full max-w-[9rem] rounded-sm" style={{ background: l.cor || "#fff", boxShadow: "0 0 0 1px #0004" }} />
                  <p className="mt-2 text-sm">Faixa <b>{String(l.faixa).toLowerCase()}</b>{l.grau ? ` · ${l.grau}º grau` : ""}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!lista.length && <p className="opacity-80">Nenhuma graduação registrada nesse período.</p>}
        <p className="text-xs opacity-70">Por privacidade, só o primeiro nome e a inicial do sobrenome.</p>
      </main>
    </div>
  );
}
