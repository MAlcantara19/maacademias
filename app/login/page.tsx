"use client";
import { Suspense, useEffect, useState } from "react";
import { InstalarApp } from "@/components/InstalarApp";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/client";
import { destinoDepoisDoLogin } from "@/lib/destino";
import { listarContas, marcarSessao, removerConta, salvarContaAtual, trocarParaConta, type ContaSalva } from "@/lib/contasSalvas";

// Traduz os erros do Supabase para algo que dá para resolver
function traduzir(m: string) {
  if (m.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("not confirmed")) return "Este e-mail ainda não foi confirmado. Abra o link que chegou no seu e-mail. (Se foi criado no painel do Supabase, marque “Auto Confirm User”.)";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("already registered")) return "Esse e-mail já tem conta. Use “Entrar”.";
  return m;
}

function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = supabaseNavegador();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState("");
  const [academias, setAcademias] = useState<any[]>([]);
  const [primeiro, setPrimeiro] = useState(false);
  const [contas, setContas] = useState<ContaSalva[]>([]);

  useEffect(() => {
    setContas(listarContas());
    // senha provisória vencida (48 h): sai e explica
    if (params.get("expirou") === "1") {
      sb.auth.signOut({ scope: "local" }).finally(() => setMsg("Sua senha provisória venceu (vale 48 horas). Toque em “Esqueci a senha” para pedir outra."));
    }
  }, []); // eslint-disable-line

  async function seguir(slug?: string) {
    const proximo = params.get("next");
    if (proximo) return router.replace(proximo);
    if (slug) { router.replace(`/${slug}/app`); router.refresh(); return; }
    const d = await destinoDepoisDoLogin(sb);
    if (d.lista) { setAcademias(d.lista); setCarregando(false); return; }
    router.replace(d.url!);
    router.refresh();
  }

  async function depoisDeEntrar(emailConta: string) {
    marcarSessao(lembrar, emailConta);
    if (lembrar) await salvarContaAtual(sb, {}, true); else removerConta(emailConta);
    await seguir();
  }

  // aceita e-mail ou WhatsApp
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg("");
    const id = email.trim();
    if (!id.includes("@")) {
      const r = await fetch("/api/entrar-telefone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: id, senha }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setCarregando(false); return setMsg(j.erro || "WhatsApp ou senha incorretos."); }
      const { error } = await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      if (error) { setCarregando(false); return setMsg(traduzir(error.message)); }
      return depoisDeEntrar(j.email);
    }
    const { error } = await sb.auth.signInWithPassword({ email: id, password: senha });
    if (error) { setCarregando(false); return setMsg(traduzir(error.message)); }
    await depoisDeEntrar(id);
  }

  async function entrarComo(c: ContaSalva) {
    setCarregando(true); setMsg("");
    const ok = await trocarParaConta(sb, c);
    if (!ok) { setCarregando(false); setContas(listarContas()); setEmail(c.email); return setMsg(`Precisa digitar a senha de ${c.nome || c.email} de novo.`); }
    await seguir(c.slug);
  }

  // Primeiro acesso: o aluno cria a senha com o e-mail que a academia cadastrou
  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    setCarregando(true); setMsg("");
    const { data, error } = await sb.auth.signUp({
      email: email.trim(), password: senha, options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) { setCarregando(false); return setMsg(traduzir(error.message)); }
    if (data.session) return seguir();
    setCarregando(false);
    setMsg("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre.");
    setPrimeiro(false);
  }

  // Esqueci a senha: se a academia tiver o envio automático, chega um código de
  // 6 dígitos (WhatsApp ou e-mail) e a pessoa mesma cria a senha. Senão, com
  // e-mail chega o link do Supabase e a academia é avisada para mandar uma provisória.
  const [esq, setEsq] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<{ canal: string; cod: string; nova: string; escolher?: any[]; perfil?: string } | null>(null);
  async function avisarAcademia(c: string) {
    if (c.includes("@")) await sb.auth.resetPasswordForEmail(c, { redirectTo: `${window.location.origin}/login/nova-senha` }).catch(() => {});
    await sb.rpc("pedir_nova_senha", { p_contato: c }).then(() => {}, () => {});
    setEsq(null); setCodigo(null);
    setMsg(c.includes("@")
      ? "Pronto! Se o e-mail estiver cadastrado, chega um link para criar a nova senha (veja também o spam). Sua academia também foi avisada e pode te mandar uma senha provisória."
      : "Pronto! Sua academia foi avisada e vai te mandar uma senha provisória pelo WhatsApp.");
  }
  async function pedirSenha() {
    const c = (esq || "").trim();
    if (c.length < 6) return setMsg("Digite o e-mail ou o WhatsApp que está no seu cadastro.");
    setCarregando(true); setMsg("");
    const r = await fetch("/api/codigo-senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "enviar", contato: c }) });
    const j = await r.json().catch(() => ({ sem_envio: true }));
    setCarregando(false);
    if (j.sem_envio || !r.ok) return avisarAcademia(c);
    setCodigo({ canal: j.canal, cod: "", nova: "" });
  }
  async function confirmarCodigo() {
    if (!codigo) return;
    setCarregando(true); setMsg("");
    const r = await fetch("/api/codigo-senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "confirmar", contato: esq, codigo: codigo.cod, senha: codigo.nova, perfil_id: codigo.perfil }) });
    const j = await r.json().catch(() => ({}));
    if (j.escolher) { setCarregando(false); return setCodigo({ ...codigo, escolher: j.escolher }); }
    if (!r.ok || !j.ok) { setCarregando(false); return setMsg(j.erro || "Não deu certo. Tente de novo."); }
    const { error } = await sb.auth.signInWithPassword({ email: j.email, password: codigo.nova });
    if (error) { setCarregando(false); setEsq(null); setCodigo(null); return setMsg("Senha criada! Agora entre com ela."); }
    await depoisDeEntrar(j.email);
  }
  function esqueci() { setEsq(email || ""); setCodigo(null); setMsg(""); }

  if (academias.length) {
    return (
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold">Qual academia?</h1>
        {academias.map((a) => (
          <button key={a.slug} className="btn-sec w-full justify-start text-left" onClick={() => router.replace(`/${a.slug}/app`)}>{a.nome}</button>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={primeiro ? criarConta : entrar} className="space-y-4">
      {!primeiro && contas.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-painel p-3">
          <p className="text-sm font-semibold">👥 Contas neste aparelho</p>
          <div className="grid gap-2">
            {contas.map((c) => (
              <div key={c.email} className="flex items-center gap-2">
                <button type="button" disabled={carregando} onClick={() => entrarComo(c)} className="flex flex-1 items-center gap-3 rounded-xl bg-painel2 p-2 text-left">
                  {c.foto ? <img src={c.foto} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-painel text-lg">🥋</span>}
                  <span className="min-w-0"><b className="block truncate">{c.nome || c.email}</b><span className="block truncate text-xs text-suave">{c.nome ? c.email : "toque para entrar"}</span></span>
                </button>
                <button type="button" className="px-2 text-suave" aria-label={`Esquecer ${c.nome || c.email} neste aparelho`} onClick={() => { removerConta(c.email); setContas(listarContas()); }}>✕</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-suave">Toque no seu nome para entrar sem digitar a senha. Ou entre com outra conta abaixo.</p>
        </section>
      )}
      <h1 className="text-5xl font-extrabold">{primeiro ? "Primeiro acesso" : "Entrar"}</h1>
      <p className="text-suave">{primeiro ? "Use o mesmo e-mail que você passou para a academia e crie sua senha." : "Use o e-mail ou o WhatsApp do seu cadastro na academia."}</p>
      <div>
        <label className="rotulo" htmlFor="email">{primeiro ? "E-mail" : "E-mail ou WhatsApp"}</label>
        <input id="email" type={primeiro ? "email" : "text"} inputMode="email" autoComplete="username" autoCapitalize="none" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={primeiro ? "" : "voce@email.com ou (24) 99999-9999"} />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete={primeiro ? "new-password" : "current-password"} required className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      {!primeiro && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          Lembrar de mim neste aparelho
        </label>
      )}
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <button className="btn w-full" disabled={carregando}>{carregando ? "Aguarde..." : primeiro ? "Criar minha senha" : "Entrar"}</button>
      {!primeiro && esq === null && <button type="button" className="w-full text-sm text-suave underline" onClick={esqueci}>Esqueci a senha</button>}
      {!primeiro && esq !== null && !codigo && (
        <div className="space-y-2 rounded-2xl bg-painel p-3">
          <p className="text-sm font-semibold">🔑 Esqueci a senha</p>
          <input className="campo" placeholder="Seu e-mail ou WhatsApp do cadastro" value={esq} onChange={(e) => setEsq(e.target.value)} autoComplete="email" />
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" disabled={carregando} onClick={pedirSenha}>Pedir nova senha</button>
            <button type="button" className="btn-sec" onClick={() => setEsq(null)}>Cancelar</button>
          </div>
          <p className="text-xs text-suave">Chega um código ou um link para você criar a senha. Se não chegar, o professor recebe o pedido e pode te mandar uma senha provisória.</p>
        </div>
      )}
      {!primeiro && esq !== null && codigo && (
        <div className="space-y-2 rounded-2xl bg-painel p-3">
          <p className="text-sm font-semibold">🔢 Digite o código</p>
          <p className="text-xs text-suave">Se o {codigo.canal === "email" ? "e-mail" : "WhatsApp"} estiver no cadastro, chegou um código de 6 números {codigo.canal === "email" ? "no seu e-mail (veja o spam)" : "no seu WhatsApp"}. Ele vale 15 minutos.</p>
          <input className="campo numero text-center text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo.cod} onChange={(e) => setCodigo({ ...codigo, cod: e.target.value.replace(/\D/g, "") })} autoComplete="one-time-code" />
          <input className="campo" type="password" autoComplete="new-password" placeholder="Sua senha nova (mín. 6)" value={codigo.nova} onChange={(e) => setCodigo({ ...codigo, nova: e.target.value })} />
          {codigo.escolher && (
            <div className="space-y-1">
              <p className="text-sm">Esse contato está em mais de uma conta. Qual é a sua?</p>
              {codigo.escolher.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 text-sm"><input type="radio" name="conta" checked={codigo.perfil === p.id} onChange={() => setCodigo({ ...codigo, perfil: p.id })} /> {p.nome}</label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" disabled={carregando || codigo.cod.length !== 6 || codigo.nova.length < 6 || (!!codigo.escolher && !codigo.perfil)} onClick={confirmarCodigo}>Criar senha e entrar</button>
            <button type="button" className="btn-sec" onClick={() => { setEsq(null); setCodigo(null); }}>Cancelar</button>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <button type="button" className="underline" disabled={carregando} onClick={pedirSenha}>Mandar outro código</button>
            <button type="button" className="underline" onClick={() => avisarAcademia((esq || "").trim())}>Não chegou? Pedir para a academia</button>
          </div>
        </div>
      )}
      {/* A academia entrega o e-mail e uma senha provisória; no 1º acesso o app pede para trocar.
          (O "criar minha senha" antigo só aparece com ?primeiro=1 no endereço.) */}
      {params.get("primeiro") === "1" ? (
        <button type="button" className="w-full text-sm underline" onClick={() => { setPrimeiro(!primeiro); setMsg(""); }}>
          {primeiro ? "Já tenho conta — entrar" : "Primeiro acesso? Criar minha senha"}
        </button>
      ) : (
        <p className="text-center text-xs text-suave">Ainda não tem senha? Peça à sua academia: ela envia seu e-mail e uma senha provisória, que você troca no primeiro acesso.</p>
      )}
    </form>
  );
}

export default function Login() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-10 text-sm text-suave">← Todas as academias</Link>
      <Suspense><FormLogin /></Suspense>
      <div className="mt-6 flex justify-center"><InstalarApp /></div>
      <p className="mt-8 text-center text-xs text-suave">Ao entrar, você concorda com os <a className="underline" href="/termos">Termos de Uso</a> e a <a className="underline" href="/privacidade">Política de Privacidade</a>.</p>
    </main>
  );
}
