"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { abrirAnexo, dataBR, dinheiro, hojeISO } from "@/lib/util";

const CATEGORIAS = ["Aluguel", "Luz", "Água", "Internet", "Material", "Manutenção", "Limpeza", "Professores", "Impostos", "Eventos", "Outros"];

// Despesas do mês (só o admin vê) e o lucro: recebido − despesas
export function Despesas({ mes, recebido }: { mes: string; recebido: number }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [nova, setNova] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const [a, m] = mes.split("-").map(Number);
    const fim = new Date(a, m, 0).toISOString().slice(0, 10);
    const { data } = await sb.from("despesas").select("*").eq("academia_id", ctx.academia.id).gte("data", mes + "-01").lte("data", fim).order("data");
    setLista(data || []);
  }
  useEffect(() => { carregar(); }, [mes]); // eslint-disable-line

  async function salvar() {
    if (!nova?.descricao || !nova?.valor) return setMsg("Preencha a descrição e o valor.");
    let comprovante = null;
    if (nova.arquivo) {
      const caminho = `${ctx.academia.id}/despesas/${Date.now()}.${nova.arquivo.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, nova.arquivo);
      if (!up.error) comprovante = "privado:" + caminho;
    }
    const { error } = await sb.from("despesas").insert({
      academia_id: ctx.academia.id, data: nova.data || hojeISO(), descricao: nova.descricao, categoria: nova.categoria || "Outros",
      valor: Number(String(nova.valor).replace(",", ".")), comprovante_url: comprovante, criado_por: ctx.membroId,
    });
    setMsg(error ? error.message : ""); setNova(null); carregar();
  }
  async function apagar(d: any) { if (confirm(`Apagar “${d.descricao}”?`)) { await sb.from("despesas").delete().eq("id", d.id); carregar(); } }
  // repete as despesas do mês passado (aluguel, luz...) no mês atual
  async function repetirMesPassado() {
    const [a, m] = mes.split("-").map(Number);
    const ini = new Date(a, m - 2, 1).toISOString().slice(0, 10), fim = new Date(a, m - 1, 0).toISOString().slice(0, 10);
    const { data } = await sb.from("despesas").select("*").eq("academia_id", ctx.academia.id).gte("data", ini).lte("data", fim);
    if (!data?.length) return setMsg("Não há despesas no mês passado.");
    await sb.from("despesas").insert(data.map((d: any) => ({
      academia_id: d.academia_id, data: `${mes}-${d.data.slice(8)}`.slice(0, 10), descricao: d.descricao, categoria: d.categoria, valor: d.valor, criado_por: ctx.membroId,
    })));
    setMsg(`${data.length} despesa(s) copiadas. Ajuste os valores que mudaram.`); carregar();
  }

  const total = lista.reduce((s, d) => s + Number(d.valor), 0);
  const lucro = recebido - total;
  const porCategoria = CATEGORIAS.map((c) => ({ c, v: lista.filter((d) => (d.categoria || "Outros") === c).reduce((s, d) => s + Number(d.valor), 0) })).filter((x) => x.v);

  return (
    <section className="rounded-2xl bg-painel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Despesas e lucro</h2>
        <div className="flex gap-2">
          <button className="btn-sec text-sm" onClick={repetirMesPassado}>Repetir mês passado</button>
          <button className="btn text-sm" onClick={() => setNova({ data: hojeISO(), categoria: "Outros" })}>+ Despesa</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-painel2 p-2"><p className="numero text-xl font-bold text-ok">{dinheiro(recebido)}</p><p className="text-xs text-suave">recebido</p></div>
        <div className="rounded-xl bg-painel2 p-2"><p className="numero text-xl font-bold text-erro">{dinheiro(total)}</p><p className="text-xs text-suave">despesas</p></div>
        <div className="rounded-xl bg-painel2 p-2"><p className={`numero text-xl font-bold ${lucro >= 0 ? "text-ok" : "text-erro"}`}>{dinheiro(lucro)}</p><p className="text-xs text-suave">lucro</p></div>
      </div>
      {msg && <p className="mt-2 text-sm text-suave">{msg}</p>}
      {nova && (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input className="campo sm:col-span-2" placeholder="Descrição (ex.: conserto do ar-condicionado)" onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
          <input className="campo" inputMode="decimal" placeholder="Valor" onChange={(e) => setNova({ ...nova, valor: e.target.value })} />
          <input className="campo" type="date" defaultValue={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} />
          <select className="campo" value={nova.categoria} onChange={(e) => setNova({ ...nova, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="btn-sec cursor-pointer text-sm sm:col-span-2">📎 {nova.arquivo ? "Comprovante ok" : "Comprovante (opcional)"}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setNova({ ...nova, arquivo: e.target.files?.[0] })} /></label>
          <div className="flex gap-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setNova(null)}>✕</button></div>
        </div>
      )}
      {porCategoria.length > 0 && <p className="mt-3 text-sm text-suave">{porCategoria.map((x) => `${x.c}: ${dinheiro(x.v)}`).join(" · ")}</p>}
      <ul className="mt-2 divide-y divide-linha">
        {lista.map((d) => (
          <li key={d.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="numero w-12 text-suave">{dataBR(d.data).slice(0, 5)}</span>
            <span className="flex-1">{d.descricao} <span className="text-xs text-suave">· {d.categoria}</span></span>
            {d.comprovante_url && <button className="text-xs underline" onClick={() => abrirAnexo(sb, d.comprovante_url)}>📎</button>}
            <span className="numero font-semibold">{dinheiro(d.valor)}</span>
            <button className="text-xs text-suave underline" onClick={() => apagar(d)}>apagar</button>
          </li>
        ))}
        {!lista.length && <p className="py-2 text-sm text-suave">Nenhuma despesa lançada neste mês.</p>}
      </ul>
    </section>
  );
}
