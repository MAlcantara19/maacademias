"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Faixa } from "@/components/Faixa";

// Painel do master: todas as academias, criar academia nova e definir o admin
export default function Master() {
  const sb = supabaseNavegador();
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [lista, setLista] = useState<any[]>([]);
  const [resumos, setResumos] = useState<Record<string, any>>({});
  const [nova, setNova] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data: m } = await sb.rpc("sou_master");
    setOk(!!m);
    if (!m) return;
    const { data } = await sb.from("academias").select("id, slug, nome, cidade, cores, ativa, no_diretorio, dominio").order("nome");
    setLista(data || []);
    const { data: r } = await sb.from("resumo_academia").select("*");
    setResumos(Object.fromEntries((r || []).map((x: any) => [x.academia_id, x])));
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const slugDe = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  async function criar() {
    if (!nova?.nome) return setMsg("Dê um nome para a academia.");
    setMsg("");
    const id = crypto.randomUUID();
    const { error } = await sb.from("academias").insert({
      id, nome: nova.nome, slug: nova.slug || slugDe(nova.nome), cidade: nova.cidade || null,
      whatsapp: nova.whatsapp || null, cores: { primaria: nova.cor || "#7c3aed" }, no_diretorio: true,
    });
    if (error) return setMsg(error.message.includes("duplicate") ? "Já existe uma academia com esse endereço (slug)." : error.message);
    if (nova.admin_email) {
      const email = nova.admin_email.trim().toLowerCase();
      const { data: existente } = await sb.from("perfis").select("id").ilike("email", email).limit(1);
      let perfilId = existente?.[0]?.id;
      if (!perfilId) {
        perfilId = crypto.randomUUID();
        await sb.from("perfis").insert({ id: perfilId, nome: nova.admin_nome || email, email });
      }
      await sb.from("membros").insert({ academia_id: id, perfil_id: perfilId, papel: "admin" });
    }
    setNova(null); setMsg("Academia criada! O admin entra com o e-mail informado (em “Primeiro acesso” se ainda não tiver senha).");
    carregar();
  }

  async function alternar(a: any, campo: string) {
    await sb.from("academias").update({ [campo]: !a[campo] }).eq("id", a.id);
    carregar();
  }

  if (ok === null) return <main className="p-6 text-suave">Carregando…</main>;
  if (!ok) return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-4xl font-extrabold">Área do master</h1>
      <p className="text-suave">Sua conta não é master. Veja como resolver em Minha conta.</p>
      <Link href="/minha-conta" className="btn">Minha conta</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-extrabold">Painel master</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setNova({ cor: "#7c3aed" })}>Nova academia</button>
          <button className="btn-sec" onClick={async () => { await sb.auth.signOut(); router.replace("/login"); }}>Sair</button>
        </div>
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}

      {nova && (
        <section className="grid gap-3 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <h2 className="text-2xl font-bold sm:col-span-2">Nova academia</h2>
          <div><label className="rotulo">Nome</label><input className="campo" onChange={(e) => setNova({ ...nova, nome: e.target.value, slug: slugDe(e.target.value) })} /></div>
          <div><label className="rotulo">Endereço no site</label><input className="campo" value={nova.slug || ""} onChange={(e) => setNova({ ...nova, slug: slugDe(e.target.value) })} /><p className="mt-1 text-xs text-suave">/{nova.slug || "nome-da-academia"}</p></div>
          <div><label className="rotulo">Cidade</label><input className="campo" onChange={(e) => setNova({ ...nova, cidade: e.target.value })} /></div>
          <div><label className="rotulo">WhatsApp</label><input className="campo" placeholder="5524999999999" onChange={(e) => setNova({ ...nova, whatsapp: e.target.value })} /></div>
          <div><label className="rotulo">Cor</label><input type="color" className="h-12 w-full rounded-xl" value={nova.cor} onChange={(e) => setNova({ ...nova, cor: e.target.value })} /></div>
          <div />
          <div><label className="rotulo">Nome do admin (dono)</label><input className="campo" onChange={(e) => setNova({ ...nova, admin_nome: e.target.value })} /></div>
          <div><label className="rotulo">E-mail do admin</label><input type="email" className="campo" onChange={(e) => setNova({ ...nova, admin_email: e.target.value })} /></div>
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={criar}>Criar academia</button><button className="btn-sec" onClick={() => setNova(null)}>Cancelar</button></div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {lista.map((a) => {
          const r = resumos[a.id] || {};
          const cor = a.cores?.primaria || "#7c3aed";
          return (
            <article key={a.id} className={`overflow-hidden rounded-2xl bg-painel ${a.ativa ? "" : "opacity-60"}`}>
              <Faixa cor={cor} altura={8} className="rounded-none" />
              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-2xl font-bold">{a.nome}</h2>
                  <p className="text-sm text-suave">/{a.slug}{a.dominio ? ` · ${a.dominio}` : ""}{a.cidade ? ` · ${a.cidade}` : ""}</p>
                </div>
                <p className="numero text-lg">{r.alunos_ativos ?? 0} alunos ativos · {r.novos_no_mes ?? 0} novos no mês</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/${a.slug}/app`} className="btn text-sm">Abrir app</Link>
                  <Link href={`/${a.slug}`} className="btn-sec text-sm">Página pública</Link>
                  <button className="btn-sec text-sm" onClick={() => alternar(a, "no_diretorio")}>{a.no_diretorio ? "No diretório ✓" : "Fora do diretório"}</button>
                  <button className="btn-sec text-sm" onClick={() => alternar(a, "ativa")}>{a.ativa ? "Desativar" : "Ativar"}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
