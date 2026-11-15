import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/server";
import { Diretorio } from "@/components/Diretorio";
import { AberturaLogo, EfeitosTela } from "@/components/EfeitosTela";
import { efeitoDaTemporada } from "@/lib/efeitos";

export const revalidate = 60;

// Página principal da plataforma: o master personaliza em Painel master → Página principal
export default async function Inicio() {
  const supabase = await supabaseServidor();
  const [{ data: academias }, { data: p }] = await Promise.all([
    supabase.from("diretorio_academias").select("*").order("nome"),
    supabase.from("plataforma").select("*").eq("id", 1).maybeSingle(),
  ]);
  const cfg: any = p || {};
  const nome = cfg.nome || "MA Academias";
  const logo = cfg.logo_url || "/marca/ma-academias.svg";
  const cor = cfg.cor || "#7c3aed";
  const efeito = (cfg.efeito_temporada && efeitoDaTemporada()) || cfg.efeito || "nenhum";

  return (
    <div data-modo={cfg.modo || "escuro"} style={{ ["--cor" as any]: cor }} className="min-h-dvh bg-fundo text-texto">
      <EfeitosTela tipo={efeito} logo={logo} />
      {cfg.abertura && <AberturaLogo logo={logo} nome={nome} cor={cor} />}
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3 py-3">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
            <span className="titulo text-xl font-bold">{nome}</span>
          </span>
          <div className="flex gap-2">
            <Link href="/planos" className="btn-sec text-sm">Para academias</Link>
            <Link href="/login" className="btn-sec text-sm">Entrar</Link>
          </div>
        </header>

        <section className="pb-8 pt-10 sm:pt-16">
          <h1 className="max-w-2xl text-5xl font-extrabold sm:text-7xl">{cfg.titulo || "Escolha seu tatame."}</h1>
          <p className="mt-4 max-w-xl text-lg text-suave">
            {cfg.subtitulo || "Horários, professores e aula experimental das academias de luta da região. Toque numa academia para ver tudo."}
          </p>
        </section>

        <Diretorio academias={academias || []} mostrarPilotos={cfg.mostrar_pilotos !== false} />

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-6 text-sm text-suave">
          <span>{cfg.rodape || `${nome} · plataforma das academias de luta`}</span>
          <span className="flex gap-3">
            {cfg.whatsapp && <a className="underline" href={`https://wa.me/${String(cfg.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {cfg.instagram && <a className="underline" href={`https://instagram.com/${String(cfg.instagram).replace("@", "")}`} target="_blank" rel="noreferrer">Instagram</a>}
            <Link className="underline" href="/demo">Demonstração</Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
