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

  async function esqueci() {
    if (!email) return setMsg("Digite seu e-mail acima e toque de novo em “Esqueci a senha”.");
    await supabaseNavegador().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login/nova-senha` });
    setMsg("Enviamos um link para criar uma nova senha no seu e-mail.");
  }

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
      {!primeiro && <button type="button" className="w-full text-sm text-suave underline" onClick={esqueci}>Esqueci a senha</button>}
      <button type="button" className="w-full text-sm underline" onClick={() => { setPrimeiro(!primeiro); setMsg(""); }}>
        {primeiro ? "Já tenho conta — entrar" : "Primeiro acesso? Criar minha senha"}
      </button>
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
