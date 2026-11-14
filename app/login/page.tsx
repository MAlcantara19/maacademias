"use client";
import { Suspense, useState } from "react";
import { InstalarApp } from "@/components/InstalarApp";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/client";
import { destinoDepoisDoLogin } from "@/lib/destino";

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
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState("");
  const [academias, setAcademias] = useState<any[]>([]);
  const [primeiro, setPrimeiro] = useState(false);

  async function seguir() {
    const proximo = params.get("next");
    if (proximo) return router.replace(proximo);
    const d = await destinoDepoisDoLogin(supabaseNavegador());
    if (d.lista) { setAcademias(d.lista); setCarregando(false); return; }
    router.replace(d.url!);
    router.refresh();
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg("");
    const { error } = await supabaseNavegador().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) { setCarregando(false); return setMsg(traduzir(error.message)); }
    await seguir();
  }

  // Primeiro acesso: o aluno cria a senha com o e-mail que a academia cadastrou
  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    setCarregando(true); setMsg("");
    const { data, error } = await supabaseNavegador().auth.signUp({
      email: email.trim(), password: senha, options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) { setCarregando(false); return setMsg(traduzir(error.message)); }
    if (data.session) return seguir();
    setCarregando(false);
    setMsg("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre.");
    setPrimeiro(false);
  }

  // Esqueci a senha: com e-mail chega o link; e a academia (professor/admin) é avisada
  // e pode mandar uma senha provisória pelo WhatsApp. Também aceita só o WhatsApp.
  const [esq, setEsq] = useState<string | null>(null);
  async function pedirSenha() {
    const c = (esq || "").trim();
    if (c.length < 6) return setMsg("Digite o e-mail ou o WhatsApp que está no seu cadastro.");
    setCarregando(true);
    const sb = supabaseNavegador();
    if (c.includes("@")) await sb.auth.resetPasswordForEmail(c, { redirectTo: `${window.location.origin}/login/nova-senha` }).catch(() => {});
    await sb.rpc("pedir_nova_senha", { p_contato: c }).then(() => {}, () => {});
    setCarregando(false); setEsq(null);
    setMsg(c.includes("@")
      ? "Pronto! Se o e-mail estiver cadastrado, chega um link para criar a nova senha (veja também o spam). Sua academia também foi avisada e pode te mandar uma senha provisória."
      : "Pronto! Sua academia foi avisada e vai te mandar uma senha provisória pelo WhatsApp.");
  }
  function esqueci() { setEsq(email || ""); setMsg(""); }

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
      <h1 className="text-5xl font-extrabold">{primeiro ? "Primeiro acesso" : "Entrar"}</h1>
      <p className="text-suave">{primeiro ? "Use o mesmo e-mail que você passou para a academia e crie sua senha." : "Use o e-mail cadastrado pela sua academia."}</p>
      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete={primeiro ? "new-password" : "current-password"} required className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <button className="btn w-full" disabled={carregando}>{carregando ? "Aguarde..." : primeiro ? "Criar minha senha" : "Entrar"}</button>
      {!primeiro && esq === null && <button type="button" className="w-full text-sm text-suave underline" onClick={esqueci}>Esqueci a senha</button>}
      {!primeiro && esq !== null && (
        <div className="space-y-2 rounded-2xl bg-painel p-3">
          <p className="text-sm font-semibold">🔑 Esqueci a senha</p>
          <input className="campo" placeholder="Seu e-mail ou WhatsApp do cadastro" value={esq} onChange={(e) => setEsq(e.target.value)} autoComplete="email" />
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" disabled={carregando} onClick={pedirSenha}>Pedir nova senha</button>
            <button type="button" className="btn-sec" onClick={() => setEsq(null)}>Cancelar</button>
          </div>
          <p className="text-xs text-suave">Com e-mail, chega um link para criar a senha. Em todo caso, o professor recebe o pedido e pode te mandar uma senha provisória.</p>
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
      <Link href="/" className="mb-10 text-sm text-suave">← Academias</Link>
      <Suspense><FormLogin /></Suspense>
      <div className="mt-6 flex justify-center"><InstalarApp /></div>
      <p className="mt-8 text-center text-xs text-suave">Ao entrar, você concorda com os <a className="underline" href="/termos">Termos de Uso</a> e a <a className="underline" href="/privacidade">Política de Privacidade</a>.</p>
    </main>
  );
}
