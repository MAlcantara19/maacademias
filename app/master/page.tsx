"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Faixa } from "@/components/Faixa";
import { dataHoraBR, dinheiro } from "@/lib/util";
import { PRECO_PLANO, ROTULO_PLANO } from "@/lib/planos";

// Painel do dono da plataforma: todas as academias, números, calendário geral
// e o que cada academia paga para você.
export default function Master() {
  const sb = supabaseNavegador();
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [lista, setLista] = useState<any[]>([]);
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [agenda, setAgenda] = useState<any[]>([]);
  const [nova, setNova] = useState<any>(null);
  const [editar, setEditar] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [uso, setUso] = useState<Record<string, any>>({});

  async function carregar() {
    const { data: m } = await sb.rpc("sou_master");
    setOk(!!m);
    if (!m) return;
    const [{ data: r }, { data: ac }, { data: cal }, { data: uso }] = await Promise.all([
      sb.rpc("resumo_master"),
      sb.from("academias").select("id, cores, dominio, cidade, no_diretorio, plano, feed_retencao_dias"),
      sb.rpc("calendario_master", { p_dias: 45 }),
      sb.rpc("uso_armazenamento"),
    ]);
    setUso(Object.fromEntries((uso || []).map((u: any) => [u.academia_id, u])));
    setLista(r || []);
    setExtra(Object.fromEntries((ac || []).map((a: any) => [a.id, a])));
    setAgenda(cal || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const slugDe = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  async function criar() {
    if (!nova?.nome) return setMsg("Dê um nome para a academia.");
    const id = crypto.randomUUID();
    const { error } = await sb.from("academias").insert({
      id, nome: nova.nome, slug: nova.slug || slugDe(nova.nome), cidade: nova.cidade || null, tipo: nova.tipo || "academia",
      plano: nova.tipo === "projeto_social" ? "social" : nova.plano || "base",
      whatsapp: nova.whatsapp || null, cores: { primaria: nova.cor || "#7c3aed" }, no_diretorio: true,
    });
    if (error) return setMsg(error.message.includes("duplicate") ? "Já existe uma academia com esse endereço." : error.message);
    if (nova.admin_email) {
      const email = nova.admin_email.trim().toLowerCase();
      const { data: existente } = await sb.from("perfis").select("id").ilike("email", email).limit(1);
      let perfilId = existente?.[0]?.id;
      if (!perfilId) { perfilId = crypto.randomUUID(); await sb.from("perfis").insert({ id: perfilId, nome: nova.admin_nome || email, email }); }
      await sb.from("membros").insert({ academia_id: id, perfil_id: perfilId, papel: "admin" });
    }
    if (nova.valor) await sb.from("plataforma_contratos").insert({ academia_id: id, valor_mensal: Number(nova.valor), dia_vencimento: Number(nova.dia || 10) });
    setNova(null); setMsg("Academia criada!"); carregar();
  }
  async function salvarContrato() {
    await sb.from("plataforma_contratos").upsert({ academia_id: editar.id, valor_mensal: Number(editar.valor || 0), dia_vencimento: Number(editar.dia || 10), ativo: true });
    setEditar(null); carregar();
  }
  async function registrarPagamento(a: any) {
    const comp = new Date(); comp.setDate(1);
    const { error } = await sb.from("plataforma_pagamentos").upsert({ academia_id: a.academia_id, competencia: comp.toISOString().slice(0, 10), valor: a.plataforma_valor || 0, pago_em: new Date().toISOString().slice(0, 10) }, { onConflict: "academia_id,competencia" });
    setMsg(error ? error.message : `Pagamento de ${a.nome} registrado.`); carregar();
  }
  async function mudarPlano(a: any, plano: string) {
    await sb.from("academias").update({ plano }).eq("id", a.academia_id);
    const preco = PRECO_PLANO[plano] ?? 0;
    if (preco > 0) await sb.from("plataforma_contratos").upsert({ academia_id: a.academia_id, valor_mensal: preco, dia_vencimento: a.plataforma_dia || 10, ativo: true });
    setMsg(`${a.nome} agora está no plano ${ROTULO_PLANO[plano]}.`); carregar();
  }
  async function alternar(id: string, campo: string, valor: boolean) { await sb.from("academias").update({ [campo]: !valor }).eq("id", id); carregar(); }

  if (ok === null) return <main className="p-6 text-suave">Carregando…</main>;
  if (!ok) return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-4xl font-extrabold">Área do master</h1>
      <p className="text-suave">Sua conta não é master.</p>
      <Link href="/minha-conta" className="btn">Minha conta</Link>
    </main>
  );

  const pagantes = lista.filter((a) => Number(a.plataforma_valor) > 0);
  const previsto = pagantes.reduce((s, a) => s + Number(a.plataforma_valor), 0);
  const recebido = pagantes.filter((a) => a.plataforma_pago_mes).reduce((s, a) => s + Number(a.plataforma_valor), 0);
  const totalAlunos = lista.reduce((s, a) => s + (a.alunos_ativos || 0), 0);
  const totalMb = Object.values(uso).reduce((s: number, u: any) => s + Number(u.mb || 0), 0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-extrabold">Painel master</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/master/calendario" className="btn-sec">📅 Calendário</Link>
          <Link href="/master/atividade" className="btn-sec">🧾 Atividade e erros</Link>
          <button className="btn" onClick={() => setNova({ cor: "#7c3aed", tipo: "academia" })}>Nova academia</button>
          <button className="btn-sec" onClick={async () => { await sb.auth.signOut(); router.replace("/login"); }}>Sair</button>
        </div>
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[lista.length, "academias"], [totalAlunos, "alunos ativos"], [dinheiro(recebido), "você recebeu este mês"], [`${Math.round(totalMb)} MB`, "de 1.024 MB grátis em arquivos"]].map(([v, r]) => (
          <div key={r as string} className="rounded-2xl bg-painel p-4"><p className="numero text-3xl font-bold">{v}</p><p className="text-sm text-suave">{r}</p></div>
        ))}
      </section>

      {nova && (
        <section className="grid gap-3 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <h2 className="text-2xl font-bold sm:col-span-2">Nova academia</h2>
          <input className="campo" placeholder="Nome" onChange={(e) => setNova({ ...nova, nome: e.target.value, slug: slugDe(e.target.value) })} />
          <input className="campo" placeholder="endereço no site" value={nova.slug || ""} onChange={(e) => setNova({ ...nova, slug: slugDe(e.target.value) })} />
          <input className="campo" placeholder="Cidade" onChange={(e) => setNova({ ...nova, cidade: e.target.value })} />
          <select className="campo" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}><option value="academia">Academia</option><option value="projeto_social">Projeto social</option></select>
          <select className="campo" value={nova.plano || "base"} onChange={(e) => setNova({ ...nova, plano: e.target.value, valor: PRECO_PLANO[e.target.value] || "" })}>
            {Object.entries(ROTULO_PLANO).map(([k, v]) => <option key={k} value={k}>Plano {v}{PRECO_PLANO[k] ? ` — R$ ${PRECO_PLANO[k]}/mês` : ""}</option>)}
          </select>
          <span />
          <input className="campo" placeholder="Nome do admin (dono)" onChange={(e) => setNova({ ...nova, admin_nome: e.target.value })} />
          <input className="campo" type="email" placeholder="E-mail do admin" onChange={(e) => setNova({ ...nova, admin_email: e.target.value })} />
          <input className="campo" inputMode="decimal" placeholder="Quanto paga por mês para você (opcional)" onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
          <input className="campo" type="number" placeholder="Dia do vencimento" onChange={(e) => setNova({ ...nova, dia: e.target.value })} />
          <input type="color" className="h-12 w-full rounded-xl" value={nova.cor} onChange={(e) => setNova({ ...nova, cor: e.target.value })} />
          <div className="flex gap-2"><button className="btn" onClick={criar}>Criar</button><button className="btn-sec" onClick={() => setNova(null)}>Cancelar</button></div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {lista.map((a) => {
            const x = extra[a.academia_id] || {};
            const cor = x.cores?.primaria || "#7c3aed";
            return (
              <article key={a.academia_id} className={`overflow-hidden rounded-2xl bg-painel ${a.ativa ? "" : "opacity-60"}`}>
                <Faixa cor={cor} altura={8} className="rounded-none" />
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="text-2xl font-bold">{a.nome} {a.tipo === "projeto_social" && <span className="chip text-xs">projeto social</span>}</h2>
                    <p className="text-sm text-suave">/{a.slug}{x.dominio ? ` · ${x.dominio}` : ""}{x.cidade ? ` · ${x.cidade}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-suave">Plano:</span>
                    <select className="campo w-auto py-1.5 text-sm" value={x.plano || "base"} onChange={(e) => mudarPlano(a, e.target.value)}>
                      {Object.entries(ROTULO_PLANO).map(([k, v]) => <option key={k} value={k}>{v}{PRECO_PLANO[k] ? ` — R$ ${PRECO_PLANO[k]}` : ""}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-painel2 p-2"><p className="numero text-xl font-bold">{a.alunos_ativos}</p><p className="text-[11px] text-suave">alunos{a.novos_mes ? ` (+${a.novos_mes})` : ""}</p></div>
                    <div className="rounded-xl bg-painel2 p-2"><p className="numero text-xl font-bold">{a.presenca_30d ?? "—"}%</p><p className="text-[11px] text-suave">presença 30d</p></div>
                    <div className="rounded-xl bg-painel2 p-2"><p className="numero text-xl font-bold">{dinheiro(a.recebido_mes).replace(",00", "")}</p><p className="text-[11px] text-suave">recebeu no mês</p></div>
                  </div>
                  {Number(a.atrasado) > 0 && <p className="text-sm text-erro">Alunos devendo: {dinheiro(a.atrasado)}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
                    <span>💾 {uso[a.academia_id]?.mb ?? 0} MB ({uso[a.academia_id]?.mb_feed ?? 0} MB de feed)</span>
                    <span>· fotos do feed ficam</span>
                    <select className="campo w-auto px-2 py-1 text-xs" value={x.feed_retencao_dias || 30}
                      onChange={async (e) => { await sb.from("academias").update({ feed_retencao_dias: Number(e.target.value) }).eq("id", a.academia_id); carregar(); }}>
                      {[15, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} dias</option>)}
                    </select>
                  </div>
                  {a.proximo_evento && <p className="text-sm">📅 {a.proximo_evento} · {dataHoraBR(a.proximo_evento_data)}</p>}
                  <div className="rounded-xl border border-linha p-2 text-sm">
                    {editar?.id === a.academia_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="campo w-28" inputMode="decimal" placeholder="R$/mês" defaultValue={a.plataforma_valor || ""} onChange={(e) => setEditar({ ...editar, valor: e.target.value })} />
                        <input className="campo w-20" type="number" placeholder="dia" defaultValue={a.plataforma_dia || 10} onChange={(e) => setEditar({ ...editar, dia: e.target.value })} />
                        <button className="btn-sec text-xs" onClick={salvarContrato}>Salvar</button>
                      </div>
                    ) : Number(a.plataforma_valor) > 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>💼 Paga {dinheiro(a.plataforma_valor)} todo dia {a.plataforma_dia} · {a.plataforma_pago_mes ? <b className="text-ok">pago este mês</b> : <b className="text-alerta">em aberto</b>}</span>
                        <span className="flex gap-2">
                          {!a.plataforma_pago_mes && <button className="btn-sec px-2 py-1 text-xs" onClick={() => registrarPagamento(a)}>Recebi</button>}
                          <button className="text-xs underline" onClick={() => setEditar({ id: a.academia_id, valor: a.plataforma_valor, dia: a.plataforma_dia })}>editar</button>
                        </span>
                      </div>
                    ) : (
                      <button className="text-xs underline" onClick={() => setEditar({ id: a.academia_id })}>💼 Definir quanto esta academia paga para você</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/${a.slug}/app`} className="btn text-sm">Abrir app</Link>
                    <Link href={`/${a.slug}`} className="btn-sec text-sm">Página</Link>
                    <button className="btn-sec text-sm" onClick={() => alternar(a.academia_id, "no_diretorio", x.no_diretorio)}>{x.no_diretorio ? "No diretório ✓" : "Fora do diretório"}</button>
                    <button className="btn-sec text-sm" onClick={() => alternar(a.academia_id, "ativa", a.ativa)}>{a.ativa ? "Desativar" : "Ativar"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="h-fit rounded-2xl bg-painel p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-bold">📅 Próximos 45 dias</h2><Link href="/master/calendario" className="text-sm underline">ver tudo</Link></div>
          <ul className="space-y-2">
            {agenda.map((e, i) => (
              <li key={i} className="border-l-4 pl-3" style={{ borderColor: extra[lista.find((a) => a.slug === e.slug)?.academia_id]?.cores?.primaria || "var(--cor)" }}>
                <p className="text-sm font-semibold">{e.tipo === "campeonato" ? "🥇" : e.tipo === "prova" ? "🎓" : "📅"} {e.titulo}</p>
                <p className="text-xs text-suave">{e.academia} · {dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
              </li>
            ))}
            {!agenda.length && <p className="text-sm text-suave">Nenhum evento marcado.</p>}
          </ul>
        </aside>
      </div>
    </main>
  );
}
