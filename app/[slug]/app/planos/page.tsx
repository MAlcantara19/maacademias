"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, hojeISO } from "@/lib/util";
import { minhasTurmas } from "@/lib/turmas";

const TIPOS = ["Aquecimento", "Taiso", "Técnica", "Uchikomi", "Nage-komi", "Drill", "Rola", "Randori", "Físico", "Volta à calma"];

// Planos de aula: monte uma vez, reaproveite sempre
export default function Planos() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [filtro, setFiltro] = useState("proximos");

  async function carregar() {
    const { data } = await sb.from("planos_aula").select("*, turmas(nome)").eq("academia_id", ctx.academia.id).order("data", { ascending: true, nullsFirst: false });
    setLista(data || []);
  }
  useEffect(() => {
    carregar();
    sb.from("turmas").select("id, nome, modalidade_id, professor_id").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(minhasTurmas(ctx, data || [])));
    sb.from("tecnicas").select("id, nome, nome_original, modalidade_id, faixa").eq("academia_id", ctx.academia.id).order("ordem").then(({ data }) => setTecnicas(data || []));
  }, []); // eslint-disable-line

  const novoBloco = () => ({ tipo: "Técnica", minutos: 15, texto: "" });
  const total = (b: any[]) => (b || []).reduce((s, x) => s + Number(x.minutos || 0), 0);

  async function salvar() {
    if (!form.titulo) return;
    const dados = {
      academia_id: ctx.academia.id, turma_id: form.turma_id || null, data: form.data || null, titulo: form.titulo,
      blocos: form.blocos, tecnicas: form.tecnicas || [], visivel_alunos: form.visivel_alunos !== false, autor_id: ctx.membroId,
    };
    if (form.id) await sb.from("planos_aula").update(dados).eq("id", form.id);
    else await sb.from("planos_aula").insert(dados);
    setForm(null); carregar();
  }
  async function apagar(p: any) {
    if (!confirm("Apagar este plano?")) return;
    await sb.from("planos_aula").delete().eq("id", p.id); carregar();
  }

  const hoje = hojeISO();
  const filtrada = lista.filter((p) => filtro === "modelos" ? !p.data : filtro === "proximos" ? p.data && p.data >= hoje : p.data && p.data < hoje);
  const turmaForm = turmas.find((t) => t.id === form?.turma_id);
  const tecDisp = tecnicas.filter((t) => !turmaForm || t.modalidade_id === turmaForm.modalidade_id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Planos de aula</h1>
        <button className="btn" onClick={() => setForm({ data: hoje, blocos: [{ tipo: "Aquecimento", minutos: 10, texto: "" }, novoBloco()], tecnicas: [] })}>Novo plano</button>
      </div>

      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        {[["proximos", "Próximos"], ["modelos", "Modelos"], ["passados", "Já dados"]].map(([k, v]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${filtro === k ? "bg-painel2" : "text-suave"}`}>{v}</button>
        ))}
      </div>

      {form && (
        <section className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="campo sm:col-span-3" placeholder="Título (ex.: Pesado: passagem e rola)" value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            <select className="campo" value={form.turma_id || ""} onChange={(e) => setForm({ ...form, turma_id: e.target.value })}>
              <option value="">Sem turma (modelo)</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <input type="date" className="campo" value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visivel_alunos !== false} onChange={(e) => setForm({ ...form, visivel_alunos: e.target.checked })} /> Alunos podem ver</label>
          </div>
          {form.blocos.map((b: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_auto] gap-2 rounded-xl bg-painel2 p-2 sm:grid-cols-[10rem_5rem_1fr_auto]">
              <select className="campo" value={b.tipo} onChange={(e) => { const l = [...form.blocos]; l[i] = { ...b, tipo: e.target.value }; setForm({ ...form, blocos: l }); }}>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input className="campo" type="number" value={b.minutos} aria-label="Minutos" onChange={(e) => { const l = [...form.blocos]; l[i] = { ...b, minutos: e.target.value }; setForm({ ...form, blocos: l }); }} />
              <input className="campo col-span-3 sm:col-span-1" placeholder="O que fazer" value={b.texto} onChange={(e) => { const l = [...form.blocos]; l[i] = { ...b, texto: e.target.value }; setForm({ ...form, blocos: l }); }} />
              <button className="text-suave" aria-label="Remover bloco" onClick={() => setForm({ ...form, blocos: form.blocos.filter((_: any, k: number) => k !== i) })}>✕</button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button className="btn-sec text-sm" onClick={() => setForm({ ...form, blocos: [...form.blocos, novoBloco()] })}>+ Bloco</button>
            <span className="numero text-lg">{total(form.blocos)} min</span>
          </div>
          {tecDisp.length > 0 && (
            <div>
              <p className="rotulo">Técnicas da aula</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {tecDisp.map((t) => {
                  const on = (form.tecnicas || []).includes(t.id);
                  return <button key={t.id} className="chip text-xs" style={on ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                    onClick={() => setForm({ ...form, tecnicas: on ? form.tecnicas.filter((x: string) => x !== t.id) : [...(form.tecnicas || []), t.id] })}>{t.nome_original || t.nome}</button>;
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2"><button className="btn" onClick={salvar}>Salvar plano</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
        </section>
      )}

      <ul className="space-y-3">
        {filtrada.map((p) => (
          <li key={p.id} className="rounded-2xl bg-painel p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xl font-bold">{p.titulo}</p>
                <p className="text-sm text-suave">{p.data ? dataBR(p.data) : "Modelo"}{p.turmas?.nome ? ` · ${p.turmas.nome}` : ""} · {total(p.blocos)} min{p.visivel_alunos ? "" : " · 🔒"}</p>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="underline" onClick={() => setForm({ ...p, id: undefined, data: hoje, titulo: p.titulo })}>Usar de novo</button>
                <button className="underline" onClick={() => setForm({ ...p })}>Editar</button>
                <button className="text-suave underline" onClick={() => apagar(p)}>Apagar</button>
              </div>
            </div>
            <ol className="mt-2 space-y-1 text-sm">
              {(p.blocos || []).map((b: any, i: number) => <li key={i}><b className="numero">{b.minutos}′</b> {b.tipo}{b.texto ? <span className="text-suave"> — {b.texto}</span> : null}</li>)}
            </ol>
            {(p.tecnicas || []).length > 0 && (
              <p className="mt-2 text-sm text-suave">🥋 {(p.tecnicas || []).map((id: string) => { const t = tecnicas.find((x) => x.id === id); return t?.nome_original || t?.nome; }).filter(Boolean).join(", ")}</p>
            )}
          </li>
        ))}
        {!filtrada.length && <p className="text-suave">Nenhum plano aqui.</p>}
      </ul>
    </div>
  );
}
