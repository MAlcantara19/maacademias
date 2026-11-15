"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, primeiroNome } from "@/lib/util";

const TIPOS = [
  { id: "treinos", rotulo: "💪 Número de treinos", ex: "Treinar 20 vezes até o fim do mês" },
  { id: "peso", rotulo: "⚖️ Chegar a um peso", ex: "Bater 81 kg para o campeonato" },
  { id: "graduar", rotulo: "🥋 Graduar", ex: "Pegar a faixa azul até dezembro" },
  { id: "livre", rotulo: "🎯 Outra meta", ex: "Aprender o armlock da guarda" },
];

// 🎯 Meta pessoal na tela inicial (o aluno ou o responsável cria; o progresso anda sozinho)
export function MetaPessoal({ aluno, base }: { aluno: { id: string; nome?: string; apelido?: string; eu?: boolean }; base: string }) {
  const sb = supabaseNavegador();
  const [meta, setMeta] = useState<any>(undefined);
  const [prog, setProg] = useState<{ atual?: number; pct: number; texto: string }>({ pct: 0, texto: "" });
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const quem = aluno.eu ? "" : `${primeiroNome(aluno.apelido || aluno.nome)} · `;

  async function pesoAtual(): Promise<number | null> {
    const { data: m } = await sb.from("membros").select("perfil_id").eq("id", aluno.id).maybeSingle();
    if (!m) return null;
    const { data } = await sb.from("medidas").select("peso_kg").eq("perfil_id", m.perfil_id).not("peso_kg", "is", null).order("data", { ascending: false }).limit(1);
    return data?.[0]?.peso_kg != null ? Number(data[0].peso_kg) : null;
  }

  async function carregar() {
    const { data, error } = await sb.from("metas_pessoais").select("*").eq("membro_id", aluno.id).is("concluida_em", null).order("criado_em", { ascending: false }).limit(1);
    if (error) return setMeta(null);
    const m = data?.[0] || null; setMeta(m);
    if (!m) return;
    if (m.tipo === "treinos") {
      const { count } = await sb.from("presencas").select("aula_id", { count: "exact", head: true }).eq("membro_id", aluno.id).gte("chegou_em", m.criado_em);
      const n = count || 0;
      setProg({ atual: n, pct: Math.min(100, Math.round((n / Number(m.alvo || 1)) * 100)), texto: `${n} de ${Number(m.alvo)} treinos` });
    } else if (m.tipo === "peso") {
      const p = await pesoAtual();
      const ini = Number(m.inicial ?? p ?? 0), alvo = Number(m.alvo);
      const pct = p == null || ini === alvo ? 0 : Math.max(0, Math.min(100, Math.round(((ini - p) / (ini - alvo)) * 100)));
      setProg({ atual: p ?? undefined, pct, texto: p == null ? "Registre seu peso para acompanhar" : `${p} kg agora · meta ${alvo} kg (faltam ${Math.abs(p - alvo).toFixed(1)} kg)` });
    } else if (m.prazo) {
      const total = new Date(m.prazo).getTime() - new Date(m.criado_em).getTime();
      const foi = Date.now() - new Date(m.criado_em).getTime();
      const dias = Math.ceil((new Date(m.prazo + "T23:59:00").getTime() - Date.now()) / 86400000);
      setProg({ pct: total > 0 ? Math.max(0, Math.min(100, Math.round((foi / total) * 100))) : 0, texto: dias >= 0 ? `Faltam ${dias} dias (até ${dataBR(m.prazo)})` : `Prazo era ${dataBR(m.prazo)}` });
    } else setProg({ pct: 0, texto: "Marque como concluída quando conseguir!" });
  }
  useEffect(() => { carregar().catch(() => setMeta(null)); }, [aluno.id]); // eslint-disable-line

  async function salvar() {
    if (!form?.titulo?.trim()) return setMsg("Escreva a sua meta.");
    if ((form.tipo === "treinos" || form.tipo === "peso") && !Number(form.alvo)) return setMsg(form.tipo === "peso" ? "Qual o peso que você quer?" : "Quantos treinos?");
    const inicial = form.tipo === "peso" ? await pesoAtual() : null;
    const { error } = await sb.from("metas_pessoais").insert({ membro_id: aluno.id, tipo: form.tipo, titulo: form.titulo.trim(), alvo: form.alvo ? Number(String(form.alvo).replace(",", ".")) : null, inicial, prazo: form.prazo || null });
    if (error) return setMsg(error.message.includes("metas_pessoais") ? "Peça para a academia atualizar o app (ATUALIZAR-25)." : error.message);
    setForm(null); setMsg(""); carregar();
  }
  async function concluir(ok: boolean) {
    if (!ok && !confirm("Apagar esta meta?")) return;
    if (ok) await sb.from("metas_pessoais").update({ concluida_em: new Date().toISOString() }).eq("id", meta.id);
    else await sb.from("metas_pessoais").delete().eq("id", meta.id);
    if (ok) setMsg("🎉 Meta concluída! Bora para a próxima?");
    carregar();
  }

  if (meta === undefined) return null;
  if (form) {
    const t = TIPOS.find((x) => x.id === form.tipo)!;
    return (
      <section className="space-y-2 rounded-2xl bg-painel p-4">
        <p className="font-bold">🎯 {quem}Nova meta</p>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((x) => <button key={x.id} className="chip text-xs" style={form.tipo === x.id ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}} onClick={() => setForm({ ...form, tipo: x.id })}>{x.rotulo}</button>)}
        </div>
        <input className="campo" placeholder={t.ex} value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          {(form.tipo === "treinos" || form.tipo === "peso") && <input className="campo" inputMode="decimal" placeholder={form.tipo === "peso" ? "Peso desejado (kg)" : "Quantos treinos"} value={form.alvo || ""} onChange={(e) => setForm({ ...form, alvo: e.target.value })} />}
          <label className="text-sm">Até quando (opcional)<input className="campo" type="date" value={form.prazo || ""} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></label>
        </div>
        {msg && <p className="text-sm text-alerta">{msg}</p>}
        <div className="flex gap-2"><button className="btn" onClick={salvar}>Salvar meta</button><button className="btn-sec" onClick={() => { setForm(null); setMsg(""); }}>Cancelar</button></div>
      </section>
    );
  }
  if (!meta) {
    return (
      <button className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-linha p-4 text-left" onClick={() => setForm({ tipo: "treinos" })}>
        <span className="text-3xl" aria-hidden>🎯</span>
        <span><b>{quem}Criar uma meta pessoal</b><span className="block text-sm text-suave">{msg || "Treinos no mês, peso para o campeonato, graduação… o app acompanha para você."}</span></span>
      </button>
    );
  }
  return (
    <section className="rounded-2xl bg-painel p-4">
      <p className="text-sm text-suave">🎯 {quem}Minha meta</p>
      <p className="text-xl font-bold">{meta.titulo}</p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-painel2"><div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: prog.pct >= 100 ? "var(--color-ok)" : "var(--cor)" }} /></div>
      <p className="mt-1 text-sm text-suave">{prog.texto}{prog.pct >= 100 && meta.tipo !== "graduar" && meta.tipo !== "livre" ? " · 🎉 chegou lá!" : ""}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <button className="underline" onClick={() => concluir(true)}>✅ Concluí</button>
        {meta.tipo === "peso" && <Link className="underline" href={`${base}/meu`}>registrar peso</Link>}
        <button className="text-suave underline" onClick={() => concluir(false)}>apagar</button>
      </div>
    </section>
  );
}
