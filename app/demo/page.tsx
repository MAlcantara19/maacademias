"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { PLANOS } from "@/lib/planos";
import { PERFIS_DEMO } from "@/lib/demo";
import { QR } from "@/components/QR";

// Demonstração: escolha o plano e entre como admin, professor, aluno ou responsável
function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const [planoId, setPlanoId] = useState(params.get("plano") || "");
  const plano = PLANOS.find((p) => p.id === planoId);
  const senha = process.env.NEXT_PUBLIC_DEMO_SENHA || "";
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState("");
  const [qrPerfil, setQrPerfil] = useState("aluno-jj");
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);

  // Link do QR: abre direto como aquele perfil (ex.: o aluno no celular)
  useEffect(() => {
    const chave = params.get("entrar");
    if (!chave || !plano) return;
    const item = PERFIS_DEMO.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.grupo }))).find((i) => i.chave === chave);
    if (item) entrar(item.email, `${item.grupo} ${item.rotulo}`);
  }, []); // eslint-disable-line

  async function entrar(email: string, rotulo: string) {
    if (!plano) return;
    if (!senha) return setErro("A demonstração ainda não foi configurada (falta NEXT_PUBLIC_DEMO_SENHA).");
    setErro(""); setEntrando(rotulo);
    const sb = supabaseNavegador();
    const { data: ac } = await sb.from("academias").select("id").eq("slug", plano.slugDemo).maybeSingle();
    if (!ac) { setEntrando(""); return setErro(`A academia “${plano.slugDemo}” não existe no banco. Rode o arquivo supabase/piloto-academias.sql.`); }
    await sb.auth.signOut();
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) { setEntrando(""); return setErro(`Não consegui entrar como ${rotulo}. Confira se o login ${email} existe e se a senha é a mesma da demonstração (arquivo supabase/senhas-demo.sql).`); }
    router.replace(`/${plano.slugDemo}/app`);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-4xl font-extrabold">Demonstração</h1>
      <p className="text-suave">Veja o app por dentro, do jeito que cada pessoa vê. Os dados são de exemplo.</p>

      <div className="grid grid-cols-3 gap-2">
        {PLANOS.map((p) => (
          <button key={p.id} onClick={() => setPlanoId(p.id)} className="rounded-2xl border-2 p-3 text-left"
            style={{ borderColor: planoId === p.id ? "var(--cor)" : "var(--color-linha)", background: planoId === p.id ? "color-mix(in srgb, var(--cor) 15%, transparent)" : undefined }}>
            <span className="block font-bold">{p.nome}</span>
            <span className="text-xs text-suave">R$ {p.preco}/mês</span>
          </button>
        ))}
      </div>

      {erro && <p className="rounded-xl bg-painel p-3 text-sm text-alerta">{erro}</p>}

      {plano ? (
        <div className="space-y-4 text-left">
          <p className="text-center text-sm text-suave">Entrar no <b className="text-texto">Piloto {plano.nome}</b> como:</p>
          {PERFIS_DEMO.map((g) => (
            <section key={g.grupo}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-suave">{g.grupo}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.itens.map((i) => (
                  <button key={i.email} disabled={!!entrando} onClick={() => entrar(i.email, `${g.grupo} ${i.rotulo}`)}
                    className="rounded-xl bg-painel p-3 text-left transition hover:bg-painel2 disabled:opacity-50">
                    <span className="block font-semibold">{i.icone} {i.rotulo}</span>
                    {i.obs && <span className="text-xs text-suave">{i.obs}</span>}
                    {entrando === `${g.grupo} ${i.rotulo}` && <span className="block text-xs">Entrando…</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-2xl bg-painel p-4 text-center">
            <p className="font-semibold">📱 Mostrar em dois aparelhos</p>
            <p className="text-sm text-suave">Entre como professor ou admin aqui (tablet/notebook) e aponte a câmera do celular para o QR: ele abre já como este perfil.</p>
            <select className="campo mx-auto mt-3 w-auto" value={qrPerfil} onChange={(e) => setQrPerfil(e.target.value)} aria-label="Perfil do QR">
              {PERFIS_DEMO.flatMap((g) => g.itens.map((i) => <option key={i.chave} value={i.chave}>{g.grupo}: {i.rotulo}</option>))}
            </select>
            {origem && <div className="mt-3 flex justify-center"><QR texto={`${origem}/demo?plano=${plano.id}&entrar=${qrPerfil}`} tamanho={180} /></div>}
          </section>
          <Link href={`/${plano.slugDemo}`} className="btn-sec w-full">Ver a página pública do Piloto {plano.nome}</Link>
        </div>
      ) : <p className="text-sm text-suave">Escolha um plano acima.</p>}
      <Link href="/planos" className="text-sm underline">Comparar os planos</Link>
    </>
  );
}

export default function Demo() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6 text-center">
      <Suspense><Conteudo /></Suspense>
    </main>
  );
}
