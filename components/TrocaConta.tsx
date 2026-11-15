"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { listarContas, marcarSessao, salvarContaAtual, sessaoVenceu, trocarParaConta, type ContaSalva } from "@/lib/contasSalvas";
import { PERFIS_DEMO, ROTEIRO_DEMO } from "@/lib/demo";
import { PLANOS } from "@/lib/planos";

// Mantém a conta lembrada em dia (nome, foto, academia e as chaves de acesso)
// e encerra a sessão de quem pediu para não ser lembrado quando o navegador fechou.
export function useGuardaConta(perfil: any, slug: string) {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseNavegador();
    let parar = () => {};
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (sessaoVenceu(session?.user?.email)) {
        await sb.auth.signOut({ scope: "local" });
        router.replace("/login"); return;
      }
      await salvarContaAtual(sb, { nome: perfil?.apelido || perfil?.nome, foto: perfil?.foto_url || null, slug });
      const { data } = sb.auth.onAuthStateChange((ev: string) => { if (ev === "TOKEN_REFRESHED") salvarContaAtual(sb); });
      parar = () => data.subscription.unsubscribe();
    })();
    return () => parar();
  }, [perfil?.id, slug]); // eslint-disable-line
}

// Lista de contas lembradas neste aparelho para trocar sem senha
export function ContasDoAparelho({ className = "", emailAtual }: { className?: string; emailAtual?: string | null }) {
  const router = useRouter();
  const [contas, setContas] = useState<ContaSalva[]>([]);
  const [eu, setEu] = useState<string | null>(emailAtual || null);
  const [trocando, setTrocando] = useState("");
  useEffect(() => {
    setContas(listarContas());
    supabaseNavegador().auth.getSession().then(({ data }: any) => setEu(data.session?.user?.email || null));
  }, []);
  const outras = contas.filter((c) => c.email !== eu);

  async function trocar(c: ContaSalva) {
    setTrocando(c.email);
    const ok = await trocarParaConta(supabaseNavegador(), c);
    if (!ok) { setTrocando(""); router.push("/login"); return; }
    window.location.href = c.slug ? `/${c.slug}/app` : "/login";
  }
  async function outraConta() {
    const sb = supabaseNavegador();
    await salvarContaAtual(sb);
    router.push("/login?outra=1");
  }

  return (
    <div className={className}>
      {outras.length > 0 && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-suave">Trocar de conta</p>}
      <div className="space-y-1">
        {outras.map((c) => (
          <button key={c.email} onClick={() => trocar(c)} disabled={!!trocando} className="flex w-full items-center gap-2 rounded-xl bg-painel2 p-2 text-left text-sm">
            {c.foto ? <img src={c.foto} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span aria-hidden>🥋</span>}
            <span className="truncate">{trocando === c.email ? "Entrando…" : c.nome || c.email}</span>
          </button>
        ))}
        <button onClick={outraConta} className="block text-sm text-suave underline">➕ Entrar com outra conta</button>
      </div>
    </div>
  );
}

// Responsável: escolhe de qual filho é a vez (o app mostra só aquela criança)
export function EscolhaFamilia({ familia }: { familia: { atual: string | null; opcoes: { id: string; nome: string; foto?: string | null; eu?: boolean }[] } | null }) {
  const router = useRouter();
  if (!familia) return null;
  function escolher(id: string) {
    document.cookie = `familia=${id}; path=/; max-age=${id ? 31536000 : 0}; samesite=lax`;
    router.refresh();
  }
  const chip = (ativo: boolean) => `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${ativo ? "font-bold text-white" : "border-linha bg-painel"}`;
  return (
    <div className="nao-imprimir mb-4 flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-sm text-suave">👨‍👧 Vez de:</span>
      <button className={chip(!familia.atual)} style={!familia.atual ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}} onClick={() => escolher("")}>Todos</button>
      {familia.opcoes.map((o) => (
        <button key={o.id} className={chip(familia.atual === o.id)} style={familia.atual === o.id ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}} onClick={() => escolher(o.id)}>
          {o.foto ? <img src={o.foto} alt="" className="h-5 w-5 rounded-full object-cover" /> : null}
          {o.eu ? "Eu" : (o.nome || "").split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

// Nas academias piloto: atalhos para trocar de piloto e de perfil sem voltar ao início
export function BarraPiloto({ slug }: { slug: string }) {
  const path = usePathname();
  const router = useRouter();
  const [entrando, setEntrando] = useState("");
  const [aberta, setAberta] = useState(true);
  const [passo, setPasso] = useState<number | null>(null);   // roteiro de demonstração ligado?
  const [lista, setLista] = useState(false);
  const [eu, setEu] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAberta(localStorage.getItem("ma_barra_piloto") !== "fechada");
      const p = localStorage.getItem("ma_roteiro"); setPasso(p === null ? null : Number(p));
    } catch { /* */ }
    supabaseNavegador().auth.getSession().then(({ data }: any) => setEu(data.session?.user?.email || null));
  }, []);
  if (!slug.startsWith("piloto-")) return null;
  const senha = process.env.NEXT_PUBLIC_DEMO_SENHA || "";
  const resto = path.slice(`/${slug}`.length);
  const perfis = PERFIS_DEMO.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.grupo })));

  function alternar() {
    const v = !aberta; setAberta(v);
    try { localStorage.setItem("ma_barra_piloto", v ? "aberta" : "fechada"); } catch { /* */ }
  }
  async function entrarComo(email: string) {
    if (!email) return;
    const p = perfis.find((x) => x.email === email);
    setEntrando(p ? `${p.grupo} ${p.rotulo}` : email);
    const sb = supabaseNavegador();
    await salvarContaAtual(sb);
    await sb.auth.signOut({ scope: "local" });
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) { setEntrando(""); alert(`Não consegui entrar como ${email}. Confira a senha da demonstração (supabase/senhas-demo.sql).`); router.replace("/login"); return; }
    marcarSessao(true, email);
    window.location.href = `/${slug}/app`;
  }

  function guardarPasso(n: number | null) {
    setPasso(n);
    try { if (n === null) localStorage.removeItem("ma_roteiro"); else localStorage.setItem("ma_roteiro", String(n)); } catch { /* */ }
  }
  async function irPara(n: number) {
    const p = ROTEIRO_DEMO[n]; if (!p) return;
    guardarPasso(n); setLista(false);
    const email = perfis.find((x) => x.chave === p.perfil)?.email;
    if (email && email !== eu && senha) {
      setEntrando(p.titulo);
      const sb = supabaseNavegador();
      await salvarContaAtual(sb);
      await sb.auth.signOut({ scope: "local" });
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) { setEntrando(""); alert(`Não consegui entrar como ${email}.`); return; }
      marcarSessao(true, email);
    }
    window.location.href = `/${slug}${p.caminho}`;
  }
  const atual = passo !== null ? ROTEIRO_DEMO[passo] : null;
  const painelRoteiro = (
    <>
      {atual && (
        <div className="nao-imprimir fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-xl rounded-2xl bg-black/90 p-3 text-sm text-white shadow-2xl md:bottom-4">
          <div className="flex items-center gap-2">
            <span className="min-w-0 font-bold">🎬 {passo! + 1}/{ROTEIRO_DEMO.length} · {atual.titulo}</span>
            <span className="ml-auto flex gap-1">
              <button className="rounded-lg bg-white/15 px-2 py-1 disabled:opacity-40" disabled={passo === 0 || !!entrando} onClick={() => irPara(passo! - 1)} aria-label="Passo anterior">◀</button>
              <button className="rounded-lg bg-white px-3 py-1 font-bold text-black disabled:opacity-40" disabled={passo === ROTEIRO_DEMO.length - 1 || !!entrando} onClick={() => irPara(passo! + 1)}>{entrando ? "…" : "▶"}</button>
              <button className="rounded-lg bg-white/15 px-2 py-1" onClick={() => setLista(!lista)} aria-label="Ver todos os passos">☰</button>
              <button className="rounded-lg bg-white/15 px-2 py-1" onClick={() => guardarPasso(null)} aria-label="Fechar roteiro">✕</button>
            </span>
          </div>
          <p className="mt-1 opacity-90">{atual.dica}</p>
          {(() => { const quem = perfis.find((x) => x.chave === atual.perfil); return quem ? <p className="mt-1 text-xs opacity-70">Perfil: {quem.grupo} {quem.rotulo}</p> : null; })()}
        </div>
      )}
      {lista && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setLista(false)}>
          <div className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-painel p-4 text-texto" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-xl font-bold">🎬 Roteiro de demonstração</p>
            <ol className="space-y-1">
              {ROTEIRO_DEMO.map((r, n) => (
                <li key={n}>
                  <button className={`w-full rounded-xl p-2 text-left ${passo === n ? "bg-painel2 font-bold" : "hover:bg-painel2"}`} onClick={() => irPara(n)}>
                    {n + 1}. {r.titulo} <span className="text-xs text-suave">· {perfis.find((x) => x.chave === r.perfil)?.grupo || "sem login"}</span>
                  </button>
                </li>
              ))}
            </ol>
            {!senha && <p className="mt-2 text-xs text-alerta">Sem NEXT_PUBLIC_DEMO_SENHA na Vercel, o roteiro não troca de perfil sozinho.</p>}
          </div>
        </div>
      )}
    </>
  );

  if (!aberta) {
    return <>{painelRoteiro}<button onClick={alternar} className="nao-imprimir fixed right-3 top-[max(4rem,calc(env(safe-area-inset-top)+3.5rem))] z-30 rounded-full bg-alerta px-3 py-1 text-xs font-bold text-black shadow md:top-3">🧪 Piloto</button></>;
  }
  return (
    <div className="nao-imprimir flex flex-wrap items-center gap-x-3 gap-y-2 bg-alerta/90 px-4 py-2 text-sm text-black">
      <span className="font-bold">🧪 Piloto:</span>
      {PLANOS.map((p) => (
        <Link key={p.id} href={`/${p.slugDemo}${resto}`} className={`rounded-full px-2.5 py-0.5 ${p.slugDemo === slug ? "bg-black font-bold text-white" : "bg-white/60"}`}>{p.nome}</Link>
      ))}
      {senha && (
        <select className="rounded-lg bg-white/80 px-2 py-1 text-sm" value="" disabled={!!entrando} onChange={(e) => entrarComo(e.target.value)} aria-label="Entrar como outro perfil">
          <option value="">{entrando ? `Entrando como ${entrando}…` : "👤 Entrar como…"}</option>
          {PERFIS_DEMO.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.itens.map((i) => <option key={i.email} value={i.email}>{i.icone} {i.rotulo}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {resto ? <Link href={`/${slug}`} className="underline">Página pública</Link> : <Link href={`/${slug}/app`} className="underline">Abrir o app</Link>}
      <button className="rounded-full bg-black px-2.5 py-0.5 font-bold text-white" onClick={() => (passo === null ? irPara(0) : setLista(true))}>🎬 {passo === null ? "Roteiro" : "Passos"}</button>
      <Link href="/demo" className="underline">Demonstração</Link>
      <Link href="/" className="underline">🏠 Todas as academias</Link>
      <button onClick={alternar} className="ml-auto underline" aria-label="Esconder a barra do piloto">esconder</button>
      {painelRoteiro}
    </div>
  );
}
