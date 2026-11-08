"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/client";

function FormLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState("");
  const [academias, setAcademias] = useState<any[]>([]);
  const [primeiro, setPrimeiro] = useState(false);

  // Primeiro acesso: o aluno cria a senha com o e-mail que a academia cadastrou
  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    setCarregando(true); setMsg("");
    const { data, error } = await supabaseNavegador().auth.signUp({
      email, password: senha, options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setCarregando(false);
    if (error) return setMsg(error.message.includes("registered") ? "Esse e-mail já tem conta. Use “Entrar”." : error.message);
    if (data.session) return entrar(e);
    setMsg("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre.");
    setPrimeiro(false);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg("");
    const sb = supabaseNavegador();
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      return setMsg("E-mail ou senha incorretos.");
    }
    const proximo = params.get("next");
    if (proximo) return router.replace(proximo);

    // Descobre em quais academias a pessoa está (ela ou os filhos)
    const { data: { user } } = await sb.auth.getUser();
    const { data: perfil } = await sb.from("perfis").select("id").eq("user_id", user!.id).maybeSingle();
    const ids = [perfil?.id].filter(Boolean);
    const { data: deps } = await sb.from("responsaveis").select("dependente_id").eq("responsavel_id", perfil?.id || "00000000-0000-0000-0000-000000000000");
    (deps || []).forEach((d: any) => ids.push(d.dependente_id));
    const { data: vinculos } = await sb
      .from("membros").select("academias(slug, nome)").in("perfil_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("ativo", true);
    const lista: any[] = Array.from(new Map((vinculos || []).map((v: any) => [v.academias.slug, v.academias])).values());

    setCarregando(false);
    if (lista.length === 1) return router.replace(`/${lista[0].slug}/app`);
    if (lista.length > 1) return setAcademias(lista);
    router.replace("/");
  }

  async function esqueci() {
    if (!email) return setMsg("Digite seu e-mail acima e toque de novo em “Esqueci a senha”.");
    await supabaseNavegador().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/nova-senha`,
    });
    setMsg("Enviamos um link para criar uma nova senha no seu e-mail.");
  }

  if (academias.length) {
    return (
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold">Qual academia?</h1>
        {academias.map((a) => (
          <button key={a.slug} className="btn-sec w-full justify-start text-left" onClick={() => router.replace(`/${a.slug}/app`)}>
            {a.nome}
          </button>
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
    </main>
  );
}
