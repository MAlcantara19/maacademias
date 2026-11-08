"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ProvedorCtx, type Ctx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Faixa } from "@/components/Faixa";

type Item = { href: string; rotulo: string; icone: string };

export function Casca({ ctx, cor, naoLidas, children }: { ctx: Ctx; cor: string; naoLidas: number; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mais, setMais] = useState(false);
  const base = `/${ctx.academia.slug}/app`;

  const itens: Item[] = ctx.equipe
    ? [
        { href: base, rotulo: "Início", icone: "🏠" },
        { href: `${base}/chamada`, rotulo: "Chamada", icone: "✅" },
        { href: `${base}/alunos`, rotulo: "Alunos", icone: "👥" },
        { href: `${base}/ranking`, rotulo: "Ranking", icone: "🏆" },
        { href: `${base}/calendario`, rotulo: "Calendário", icone: "📅" },
        { href: `${base}/campeonatos`, rotulo: "Campeonatos", icone: "🥇" },
        { href: `${base}/pendencias`, rotulo: "Pendências", icone: "📌" },
        { href: `${base}/experimentais`, rotulo: "Aulas experimentais", icone: "🙋" },
        { href: `${base}/notificacoes`, rotulo: "Notificações", icone: "🔔" },
        { href: `${base}/config`, rotulo: "QR e ajustes", icone: "⚙️" },
      ]
    : [
        { href: base, rotulo: "Início", icone: "🏠" },
        { href: `${base}/meu`, rotulo: ctx.meusAlunos.length > 1 || !ctx.meusAlunos[0]?.eu ? "Meus atletas" : "Meu perfil", icone: "🥋" },
        { href: `${base}/ranking`, rotulo: "Ranking", icone: "🏆" },
        { href: `${base}/calendario`, rotulo: "Calendário", icone: "📅" },
        { href: `${base}/carteirinha`, rotulo: "Carteirinha", icone: "🪪" },
        { href: `${base}/pendencias`, rotulo: "Pendências", icone: "📌" },
        { href: `${base}/notificacoes`, rotulo: "Notificações", icone: "🔔" },
      ];

  const ativo = (h: string) => (h === base ? path === base : path.startsWith(h));
  const principais = itens.slice(0, 4);

  async function sair() {
    await supabaseNavegador().auth.signOut();
    router.replace("/login");
  }

  return (
    <ProvedorCtx value={ctx}>
      <div style={{ ["--cor" as any]: cor }} className="min-h-dvh lg:flex">
        {/* Lateral (computador) */}
        <aside className="nao-imprimir sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-linha bg-painel p-4 lg:flex">
          <Link href={`/${ctx.academia.slug}`} className="titulo text-2xl font-extrabold">{ctx.academia.nome}</Link>
          <Faixa cor={cor} graus={2} altura={8} className="mb-4 mt-2" />
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {itens.map((i) => (
              <Link key={i.href} href={i.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${ativo(i.href) ? "bg-painel2 font-semibold" : "text-suave hover:bg-painel2/60"}`}>
                <span aria-hidden>{i.icone}</span>{i.rotulo}
                {i.rotulo === "Notificações" && naoLidas > 0 && <span className="ml-auto rounded-full bg-erro px-2 text-xs text-white">{naoLidas}</span>}
              </Link>
            ))}
          </nav>
          <div className="border-t border-linha pt-3 text-sm">
            <p className="truncate font-semibold">{ctx.perfil?.nome}</p>
            <p className="text-suave">{ctx.papeis.map((p) => ({ admin: "Admin", professor: "Professor", aluno: "Aluno", responsavel: "Responsável" } as any)[p]).join(" · ")}</p>
            <button onClick={sair} className="mt-2 text-suave underline">Sair</button>
          </div>
        </aside>

        {/* Topo (celular) */}
        <div className="flex-1">
          <header className="nao-imprimir sticky top-0 z-20 flex items-center justify-between border-b border-linha bg-fundo/95 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
            <Link href={base} className="titulo truncate text-xl font-extrabold">{ctx.academia.nome}</Link>
            <Link href={`${base}/notificacoes`} className="relative p-1 text-xl" aria-label="Notificações">
              🔔{naoLidas > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-erro px-1.5 text-[10px] text-white">{naoLidas}</span>}
            </Link>
          </header>

          <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
        </div>

        {/* Menu de baixo (celular) */}
        <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-linha bg-painel pb-[env(safe-area-inset-bottom)] lg:hidden">
          {principais.map((i) => (
            <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${ativo(i.href) ? "text-texto" : "text-suave"}`}>
              <span className="text-xl" aria-hidden>{i.icone}</span>{i.rotulo.split(" ")[0]}
              {ativo(i.href) && <span className="h-1 w-6 rounded-full" style={{ background: cor }} />}
            </Link>
          ))}
          <button onClick={() => setMais(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-suave">
            <span className="text-xl" aria-hidden>☰</span>Mais
          </button>
        </nav>

        {mais && (
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMais(false)}>
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-painel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-3 gap-3">
                {itens.slice(4).map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setMais(false)} className="flex flex-col items-center gap-1 rounded-2xl bg-painel2 p-4 text-center text-sm">
                    <span className="text-2xl" aria-hidden>{i.icone}</span>{i.rotulo}
                  </Link>
                ))}
              </div>
              <button onClick={sair} className="btn-sec mt-4 w-full">Sair</button>
            </div>
          </div>
        )}
      </div>
    </ProvedorCtx>
  );
}
