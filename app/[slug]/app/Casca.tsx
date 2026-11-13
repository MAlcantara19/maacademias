"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProvedorCtx, type Ctx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Faixa } from "@/components/Faixa";
import { BoasVindas } from "@/components/BoasVindas";
import { Contrato } from "@/components/Contrato";
import { liberado } from "@/lib/planos";
import { BotaoWhats } from "@/components/BotaoWhats";
import { AceiteTermos } from "@/components/AceiteTermos";
import { InstalarApp } from "@/components/InstalarApp";
import { EstiloFaixaCtx } from "@/lib/estiloFaixa";
import { supabaseNavegador as sbFaixa } from "@/lib/supabase/client";

type Item = { href: string; rotulo: string; icone: string; m?: string };

export function Casca({ ctx, cor, naoLidas, vendoComo, outras = [], children }: { ctx: Ctx; cor: string; naoLidas: number; vendoComo?: any; outras?: any[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mais, setMais] = useState(false);
  // cores das faixas da academia (para os graus coloridos do judô)
  const [coresFaixas, setCoresFaixas] = useState<string[][]>([]);
  useEffect(() => {
    sbFaixa().from("modalidades").select("cores_graduacoes").eq("academia_id", ctx.academia.id)
      .then(({ data }) => setCoresFaixas((data || []).map((m: any) => m.cores_graduacoes || [])));
  }, [ctx.academia.id]);

  // lembra a última academia aberta (o app instalado abre direto nela)
  useEffect(() => { try { localStorage.setItem("ma_ultima_academia", ctx.academia.slug); } catch { /* */ } }, [ctx.academia.slug]);
  // Modo claro/escuro escolhido pela pessoa (vale só neste aparelho); "" = o da academia
  const [meuTema, setMeuTema] = useState("");
  useEffect(() => { try { setMeuTema(localStorage.getItem("ma_tema") || ""); } catch { /* */ } }, []);
  const modo = meuTema || ctx.academia.tema?.modo || "escuro";
  function trocarTema() {
    const prox = modo === "escuro" ? "claro" : "escuro";
    setMeuTema(prox);
    try { localStorage.setItem("ma_tema", prox); } catch { /* */ }
  }
  const BotaoTema = ({ className = "" }: { className?: string }) => (
    <button onClick={trocarTema} className={className} aria-label="Trocar modo claro/escuro">{modo === "escuro" ? "☀️ Modo claro" : "🌙 Modo escuro"}</button>
  );
  const base = `/${ctx.academia.slug}/app`;

  const plano = ctx.academia.plano;
  const mod = (n: string) => ctx.academia.modulos?.[n] !== false && liberado(plano, n);
  const itens: Item[] = (ctx.equipe
    ? [
        { href: base, rotulo: "Início", icone: "🏠" },
        { href: `${base}/chamada`, rotulo: "Chamada", icone: "✅" },
        { href: `${base}/qrcodes`, rotulo: "QR Codes", icone: "📱" },
        { href: `${base}/alunos`, rotulo: "Alunos", icone: "👥" },
        { href: `${base}/ranking`, rotulo: "Ranking", icone: "🏆", m: "ranking" },
        { href: `${base}/calendario`, rotulo: "Calendário", icone: "📅" },
        { href: `${base}/campeonatos`, rotulo: "Campeonatos", icone: "🥇", m: "campeonatos" },
        { href: `${base}/feed`, rotulo: "Feed", icone: "📸", m: "feed" },
        { href: `${base}/mensalidades`, rotulo: "Mensalidades", icone: "💳", m: "mensalidades" },
        { href: `${base}/pendencias`, rotulo: "Pendências", icone: "📌" },
        { href: `${base}/avisos`, rotulo: "Avisos", icone: "📣" },
        { href: `${base}/relatorio`, rotulo: "Relatório do mês", icone: "📊" },
        { href: `${base}/lista-presenca`, rotulo: "Lista de presença", icone: "🧾" },
        { href: `${base}/planos`, rotulo: "Planos de aula", icone: "📝" },
        { href: `${base}/tecnicas`, rotulo: "Técnicas e exames", icone: "🥋" },
        { href: `${base}/estudar`, rotulo: "Estudar", icone: "🧠" },
        { href: `${base}/cronometro`, rotulo: "Cronômetro", icone: "⏱️" },
        { href: `${base}/totem`, rotulo: "Modo totem", icone: "📟", m: "totem" },
        { href: `${base}/experimentais`, rotulo: "Aulas experimentais", icone: "🙋", m: "aula_experimental" },
        { href: `${base}/gestao`, rotulo: "Turmas e equipe", icone: "🗂️" },
        { href: `${base}/notificacoes`, rotulo: "Notificações", icone: "🔔" },
        { href: `${base}/config`, rotulo: "Personalizar academia", icone: "🎨" },
      ]
    : [
        { href: base, rotulo: "Início", icone: "🏠" },
        { href: `${base}/turmas`, rotulo: "Turmas", icone: "👥" },
        { href: `${base}/carteirinha`, rotulo: "Carteirinha", icone: "💳", m: "carteirinha" },
        { href: `${base}/meu`, rotulo: ctx.meusAlunos.length > 1 || !ctx.meusAlunos[0]?.eu ? "Meus atletas" : "Meu perfil", icone: "🥋" },
        { href: `${base}/feed`, rotulo: "Feed", icone: "📸", m: "feed" },
        { href: `${base}/ranking`, rotulo: "Ranking", icone: "🏆", m: "ranking" },
        { href: `${base}/calendario`, rotulo: "Calendário", icone: "📅" },
        { href: `${base}/tecnicas`, rotulo: "Matéria da faixa", icone: "📚" },
        { href: `${base}/estudar`, rotulo: "Estudar", icone: "🧠" },
        { href: `${base}/mensalidades`, rotulo: "Mensalidades", icone: "💳", m: "mensalidades" },
        { href: `${base}/pendencias`, rotulo: "Pendências", icone: "📌" },
        { href: `${base}/notificacoes`, rotulo: "Notificações", icone: "🔔" },
      ]
  ).filter((i: any) => !i.m || mod(i.m) || (i.m === "feed" && ctx.academia.modulos?.galeria === true))
   .filter((i: any) => !(i.href.endsWith("/tecnicas") || i.href.endsWith("/estudar")) || ctx.academia.modulos?.tecnicas === true)
   .filter((i: any) => !i.href.endsWith("/feed") || liberado(plano, "feed") || liberado(plano, "galeria"))
   .filter((i: any) => !i.href.endsWith("/relatorio") || (ctx.admin && liberado(plano, "relatorio")))
   .filter((i: any) => !i.href.endsWith("/config") || ctx.admin)
   .filter((i: any) => !(ctx.equipe && !ctx.admin && i.href.endsWith("/mensalidades") && !ctx.academia.professor_ve_mensalidades))
   .map((i: any) => (ctx.equipe && !ctx.admin && i.href.endsWith("/gestao") ? { ...i, rotulo: "Minhas turmas" } : i))
   .map((i: any) => (i.href.endsWith("/feed") && ctx.academia.modulos?.feed === false ? { ...i, rotulo: "Galeria", icone: "📁" } : i));

  function verComo(valor: string) {
    document.cookie = `ver_como=${valor}; path=/; max-age=${valor ? 7200 : 0}`;
    router.replace(base);
    router.refresh();
  }

  const ativo = (h: string) => (h === base ? path === base : path.startsWith(h));
  const principais = itens.slice(0, 4);

  async function sair() {
    await supabaseNavegador().auth.signOut();
    router.replace("/login");
  }

  return (
    <ProvedorCtx value={ctx}>
    <EstiloFaixaCtx.Provider value={{ estilo: ctx.academia.estilo_grau || "barra", cores: coresFaixas }}>
      <div style={{ ["--cor" as any]: cor }} className="min-h-dvh bg-fundo text-texto md:flex"
        data-modo={modo} data-fonte={ctx.academia.tema?.fonte || "esportiva"}>
        {!vendoComo && <BoasVindas perfil={ctx.perfil} academia={ctx.academia} equipe={ctx.equipe} />}
        <AceiteTermos />
        <Contrato ctx={ctx} />
        {!ctx.equipe && <BotaoWhats numero={ctx.academia.whatsapp} acima texto={`Oi! Sou aluno(a) da ${ctx.academia.nome}.`} rotulo={`Falar com a ${ctx.academia.nome}`} />}
        {/* Lateral (computador) */}
        <aside className="nao-imprimir sticky top-0 hidden h-dvh w-60 shrink-0 lg:w-64 flex-col border-r border-linha bg-painel p-4 md:flex">
          <Link href={`/${ctx.academia.slug}`} className="titulo text-2xl font-extrabold">{ctx.academia.nome}</Link>
          <Faixa cor={cor} graus={2} altura={8} className="mb-2 mt-2" />
          {outras.length > 0 && (
            <select className="campo mb-3 py-1.5 text-sm" value="" onChange={(e) => e.target.value && router.push(`/${e.target.value}/app`)} aria-label="Trocar de academia">
              <option value="">↔ Trocar de academia</option>
              {outras.map((a: any) => <option key={a.slug} value={a.slug}>{a.nome}</option>)}
            </select>
          )}
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
            {ctx.equipe && <button onClick={() => verComo("primeiro")} className="mt-2 block text-suave underline">👁️ Ver como aluno</button>}
            {ctx.master && <Link href="/master" className="mt-1 block text-suave underline">Painel master</Link>}
            <InstalarApp className="mt-1 block text-suave underline" />
            <BotaoTema className="mt-1 block text-suave underline" />
            <button onClick={sair} className="mt-1 block text-suave underline">Sair</button>
          </div>
        </aside>

        {/* Topo (celular) */}
        <div className="flex-1">
          <header className="nao-imprimir sticky top-0 z-20 flex items-center justify-between border-b border-linha bg-fundo/95 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
            <Link href={base} className="titulo truncate text-xl font-extrabold">{ctx.academia.nome}</Link>
            <Link href={`${base}/notificacoes`} className="relative p-1 text-xl" aria-label="Notificações">
              🔔{naoLidas > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-erro px-1.5 text-[10px] text-white">{naoLidas}</span>}
            </Link>
          </header>

          {vendoComo && (
            <div className="nao-imprimir flex items-center justify-between gap-2 bg-alerta px-4 py-2 text-sm font-semibold text-black">
              <span>👁️ Vendo o app como aluno: {vendoComo.nome}</span>
              <button className="underline" onClick={() => verComo("")}>Voltar para a minha visão</button>
            </div>
          )}
          <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 md:px-6 md:pb-12 md:pt-6 lg:px-8 lg:pt-8">{children}</main>
        </div>

        {/* Menu de baixo (celular) */}
        <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-linha bg-painel pb-[env(safe-area-inset-bottom)] md:hidden">
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
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMais(false)}>
            <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-painel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-3 flex items-center justify-between bg-painel px-5 pb-2 pt-4">
                <span className="mx-auto h-1.5 w-12 rounded-full bg-linha" aria-hidden />
                <button className="absolute right-4 top-3 rounded-full bg-painel2 px-3 py-1 text-sm" onClick={() => setMais(false)} aria-label="Fechar menu">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {itens.slice(4).map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setMais(false)} className="flex flex-col items-center gap-1 rounded-2xl bg-painel2 p-4 text-center text-sm">
                    <span className="text-2xl" aria-hidden>{i.icone}</span>{i.rotulo}
                  </Link>
                ))}
              </div>
              {outras.length > 0 && (
                <div className="mt-4 space-y-2">
                  {outras.map((a: any) => <Link key={a.slug} href={`/${a.slug}/app`} onClick={() => setMais(false)} className="btn-sec w-full">↔ {a.nome}</Link>)}
                </div>
              )}
              {ctx.equipe && <button onClick={() => { setMais(false); verComo("primeiro"); }} className="btn-sec mt-4 w-full">👁️ Ver como aluno</button>}
              <InstalarApp className="btn mt-2 w-full" />
              <BotaoTema className="btn-sec mt-2 w-full" />
              <button onClick={sair} className="btn-sec mt-2 w-full">Sair</button>
            </div>
          </div>
        )}
      </div>
    </EstiloFaixaCtx.Provider>
    </ProvedorCtx>
  );
}
