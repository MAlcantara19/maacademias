"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CORES_CATEGORIA, corCategoria } from "@/lib/tecnicas";
import { BotaoFalar, EscolhaVoz } from "@/components/Falar";

// Palavras em japonês: a "folha" do dojô, editável e importável
export default function Vocabulario() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [copia, setCopia] = useState<any>(null);
  const [filtro, setFiltro] = useState("basica");
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data } = await sb.from("vocabulario").select("*").eq("academia_id", ctx.academia.id).order("lista").order("ordem");
    setLista(data || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  async function salvar() {
    if (!form?.termo || !form?.significado) return setMsg("Preencha a palavra e o significado.");
    const dados = { academia_id: ctx.academia.id, termo: form.termo, grafia_antiga: form.grafia_antiga || null, significado: form.significado, kana: form.kana || null,
      categoria: form.categoria || null, lista: form.lista || "basica", ordem: Number(form.ordem || 0) };
    const { error } = form.id ? await sb.from("vocabulario").update(dados).eq("id", form.id) : await sb.from("vocabulario").insert(dados);
    setMsg(error ? error.message : "Salvo."); setForm(null); carregar();
  }
  async function apagar(p: any) {
    if (!confirm(`Apagar “${p.termo}”?`)) return;
    await sb.from("vocabulario").delete().eq("id", p.id); carregar();
  }
  // Colar da planilha: palavra ; grafia antiga ; significado ; categoria ; lista (basica/ampliada)
  async function importar() {
    const linhas = (csv || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = linhas[0]?.includes(";") ? ";" : linhas[0]?.includes("\t") ? "\t" : ",";
    const dados = linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")))
      .filter((c) => c[0] && c[2] && !/^palavra$/i.test(c[0]))
      .map((c, i) => ({ academia_id: ctx.academia.id, termo: c[0], grafia_antiga: c[1] || null, significado: c[2], categoria: c[3] || null,
        lista: (c[4] || "").toLowerCase().startsWith("amp") ? "ampliada" : "basica", ordem: i + 1 }));
    if (!dados.length) return setMsg("Nenhuma linha válida.");
    if (confirm("Apagar as palavras atuais antes de importar? (OK = substituir, Cancelar = acrescentar)")) {
      await sb.from("vocabulario").delete().eq("academia_id", ctx.academia.id);
    }
    const { error } = await sb.from("vocabulario").insert(dados);
    setMsg(error ? error.message : `${dados.length} palavras importadas.`); setCsv(null); carregar();
  }
  async function listaBase() {
    const { error } = await sb.rpc("semear_vocabulario", { p_acad: ctx.academia.id });
    setMsg(error ? error.message : "Lista base carregada (só entra se estiver vazia)."); carregar();
  }
  async function abrirCopia() {
    const { data } = await sb.from("academias").select("id, nome").neq("id", ctx.academia.id);
    setCopia({ destinos: data || [], destino: "" });
  }
  async function copiar() {
    const { data, error } = await sb.rpc("copiar_vocabulario", { p_origem: ctx.academia.id, p_destino: copia.destino });
    setMsg(error ? error.message : `${data} palavras copiadas.`); setCopia(null);
  }

  if (!ctx.equipe) return <p className="text-suave">Só a equipe edita as palavras. <Link className="underline" href={`/${ctx.academia.slug}/app/estudar`}>Ir para Estudar</Link></p>;
  const mostradas = lista.filter((p) => filtro === "todas" || p.lista === filtro);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-extrabold">Palavras do judô</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setForm({ lista: "basica" })}>Nova palavra</button>
          <button className="btn-sec" onClick={() => setCsv("")}>Importar da folha</button>
          {!lista.length && ctx.master && <button className="btn-sec" onClick={listaBase}>Carregar lista base</button>}
          {ctx.admin && lista.length > 0 && <button className="btn-sec" onClick={abrirCopia}>Copiar para outra academia</button>}
        </div>
      </div>
      <EscolhaVoz />
      <p className="text-xs text-suave">Se o áudio de alguma palavra sair estranho, edite e preencha a escrita em japonês (kana).</p>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {csv !== null && (
        <section className="space-y-2 rounded-2xl border border-linha bg-painel p-4">
          <p className="text-sm text-suave">Cole da planilha, uma palavra por linha: <b>palavra correta ; grafia antiga ; significado ; categoria ; lista</b> (lista = basica ou ampliada).</p>
          <textarea className="campo min-h-40 font-mono text-xs" placeholder={"Sono-mama;Sonomama;Não se mexam;Arbitragem;basica"} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="flex gap-2"><button className="btn" onClick={importar}>Importar</button><button className="btn-sec" onClick={() => setCsv(null)}>Cancelar</button></div>
        </section>
      )}
      {copia && (
        <section className="space-y-2 rounded-2xl border border-linha bg-painel p-4">
          <select className="campo" value={copia.destino} onChange={(e) => setCopia({ ...copia, destino: e.target.value })}>
            <option value="">Copiar para…</option>
            {copia.destinos.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <div className="flex gap-2"><button className="btn" onClick={copiar} disabled={!copia.destino}>Copiar</button><button className="btn-sec" onClick={() => setCopia(null)}>Cancelar</button></div>
        </section>
      )}
      {form && (
        <section className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <input className="campo" placeholder="Palavra (grafia correta)" value={form.termo || ""} onChange={(e) => setForm({ ...form, termo: e.target.value })} />
          <input className="campo" placeholder="Grafia antiga (como estava na folha)" value={form.grafia_antiga || ""} onChange={(e) => setForm({ ...form, grafia_antiga: e.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Significado" value={form.significado || ""} onChange={(e) => setForm({ ...form, significado: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2">
            <input className="campo" placeholder="Escrita em japonês para o áudio (opcional, ex.: りょうて)" value={form.kana || ""} onChange={(e) => setForm({ ...form, kana: e.target.value })} />
            {form.termo && <BotaoFalar texto={form.termo} kana={form.kana} />}
          </div>
          <input className="campo" list="cats" placeholder="Categoria" value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="cats">{Object.keys(CORES_CATEGORIA).map((c) => <option key={c} value={c} />)}</datalist>
          <select className="campo" value={form.lista} onChange={(e) => setForm({ ...form, lista: e.target.value })}><option value="basica">Lista básica (60)</option><option value="ampliada">Lista ampliada</option></select>
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
        </section>
      )}

      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        {[["basica", `Básica (${lista.filter((p) => p.lista === "basica").length})`], ["ampliada", `Ampliada (${lista.filter((p) => p.lista === "ampliada").length})`], ["todas", "Todas"]].map(([k, v]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${filtro === k ? "bg-painel2" : "text-suave"}`}>{v}</button>
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {mostradas.map((p) => (
          <li key={p.id} className="rounded-xl bg-painel p-3" style={{ borderLeft: `5px solid ${corCategoria(p.categoria)}` }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-lg font-bold">{p.termo} <BotaoFalar texto={p.termo} kana={p.kana} /> {p.grafia_antiga && <span className="text-xs font-normal text-suave">(antes: {p.grafia_antiga})</span>}</p>
                <p className="text-sm">{p.significado}</p>
                <p className="text-xs text-suave">{p.categoria}</p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button className="underline" onClick={() => setForm({ ...p })}>editar</button>
                <button className="text-suave underline" onClick={() => apagar(p)}>apagar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
