"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, dataHoraBR, hojeISO } from "@/lib/util";

export default function Avisos() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mods, setMods] = useState<any[]>([]);
  const [novo, setNovo] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data } = await sb.from("avisos").select("*, turmas(nome), modalidades(nome)").eq("academia_id", ctx.academia.id)
      .order("fixado", { ascending: false }).order("criado_em", { ascending: false });
    setLista(data || []);
  }
  useEffect(() => {
    carregar();
    sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
    sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).then(({ data }) => setMods(data || []));
  }, []); // eslint-disable-line

  async function salvar() {
    if (!novo?.titulo) return setMsg("Escreva o título do aviso.");
    const { error } = await sb.from("avisos").insert({
      academia_id: ctx.academia.id, escopo: novo.escopo, titulo: novo.titulo, texto: novo.texto || null,
      turma_id: novo.escopo === "turma" ? novo.turma_id : null, modalidade_id: novo.escopo === "modalidade" ? novo.modalidade_id : null,
      data: novo.escopo === "dia" ? novo.data || hojeISO() : null, fixado: !!novo.fixado, publico: !!novo.publico,
      expira_em: novo.expira ? new Date(novo.expira + "T23:59:00-03:00").toISOString() : null, autor_id: ctx.membroId,
    });
    setMsg(error ? error.message : "Aviso publicado.");
    setNovo(null); carregar();
  }
  async function apagar(id: string) {
    if (!confirm("Apagar este aviso?")) return;
    await sb.from("avisos").delete().eq("id", id); carregar();
  }
  async function fixar(a: any) {
    await sb.from("avisos").update({ fixado: !a.fixado }).eq("id", a.id); carregar();
  }

  const expirado = (a: any) => a.expira_em && new Date(a.expira_em) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Avisos</h1>
        <button className="btn" onClick={() => setNovo({ escopo: "geral" })}>Novo aviso</button>
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {novo && (
        <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <select className="campo" value={novo.escopo} onChange={(e) => setNovo({ ...novo, escopo: e.target.value })}>
            <option value="geral">Para todos</option><option value="modalidade">Uma modalidade</option><option value="turma">Uma turma</option><option value="dia">Só de um dia</option>
          </select>
          {novo.escopo === "turma" && <select className="campo" defaultValue="" onChange={(e) => setNovo({ ...novo, turma_id: e.target.value })}><option value="" disabled>Turma…</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>}
          {novo.escopo === "modalidade" && <select className="campo" defaultValue="" onChange={(e) => setNovo({ ...novo, modalidade_id: e.target.value })}><option value="" disabled>Modalidade…</option>{mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>}
          {novo.escopo === "dia" && <input type="date" className="campo" defaultValue={hojeISO()} onChange={(e) => setNovo({ ...novo, data: e.target.value })} />}
          {novo.escopo === "geral" && <span />}
          <input className="campo sm:col-span-2" placeholder="Título (ex.: Treino de sábado cancelado)" onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          <textarea className="campo min-h-20 sm:col-span-2" placeholder="Texto (opcional)" onChange={(e) => setNovo({ ...novo, texto: e.target.value })} />
          <div><label className="rotulo">Some sozinho em (opcional)</label><input type="date" className="campo" onChange={(e) => setNovo({ ...novo, expira: e.target.value })} /></div>
          <div className="flex flex-col justify-end gap-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => setNovo({ ...novo, fixado: e.target.checked })} /> 📌 Fixar no topo</label>
            <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => setNovo({ ...novo, publico: e.target.checked })} /> 🌐 Mostrar na página pública</label>
          </div>
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Publicar</button><button className="btn-sec" onClick={() => setNovo(null)}>Cancelar</button></div>
        </div>
      )}

      <ul className="space-y-2">
        {lista.map((a) => (
          <li key={a.id} className={`rounded-2xl bg-painel p-4 ${expirado(a) ? "opacity-50" : ""}`} style={{ borderLeft: "4px solid var(--cor)" }}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{a.fixado ? "📌 " : ""}{a.titulo}</p>
              <span className="text-xs text-suave">
                {a.escopo === "turma" ? a.turmas?.nome : a.escopo === "modalidade" ? a.modalidades?.nome : a.escopo === "dia" ? `Dia ${dataBR(a.data)}` : "Todos"}
                {a.publico ? " · público" : ""}{a.expira_em ? ` · ${expirado(a) ? "expirou" : "até"} ${dataHoraBR(a.expira_em)}` : ""}
              </span>
            </div>
            {a.texto && <p className="mt-1 whitespace-pre-line text-sm text-suave">{a.texto}</p>}
            <div className="mt-2 flex gap-3 text-sm">
              <button className="underline" onClick={() => fixar(a)}>{a.fixado ? "Desafixar" : "Fixar"}</button>
              <button className="text-suave underline" onClick={() => apagar(a.id)}>Apagar</button>
            </div>
          </li>
        ))}
        {!lista.length && <p className="text-suave">Nenhum aviso publicado.</p>}
      </ul>
    </div>
  );
}
