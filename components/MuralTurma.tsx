"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR } from "@/lib/util";

// Mural da turma: só a equipe posta; alunos e responsáveis leem (e aparece no telão)
export function MuralTurma({ turmaId }: { turmaId: string }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [l, setL] = useState<any[]>([]);
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState("");
  async function carregar() {
    const { data } = await sb.from("avisos").select("*").eq("turma_id", turmaId).order("fixado", { ascending: false }).order("criado_em", { ascending: false }).limit(10);
    setL((data || []).filter((a: any) => !a.expira_em || new Date(a.expira_em) > new Date()));
  }
  useEffect(() => { carregar(); }, [turmaId]); // eslint-disable-line
  async function postar() {
    if (!f?.titulo?.trim()) return setMsg("Escreva o título do recado.");
    const { error } = await sb.from("avisos").insert({
      academia_id: ctx.academia.id, escopo: "turma", turma_id: turmaId, titulo: f.titulo.trim(), texto: f.texto || null,
      fixado: !!f.fixado, publico: false, autor_id: ctx.membroId, expira_em: f.expira ? new Date(f.expira + "T23:59:00-03:00").toISOString() : null,
    });
    if (error) return setMsg(error.message);
    setF(null); setMsg(""); carregar();
  }
  async function apagar(a: any) {
    if (!confirm("Apagar este recado do mural?")) return;
    await sb.from("avisos").delete().eq("id", a.id); carregar();
  }
  if (!l.length && !ctx.equipe) return null;
  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">📌 Mural da turma</h2>
        {ctx.equipe && <button className="btn-sec text-sm" onClick={() => setF(f ? null : {})}>{f ? "Fechar" : "+ Recado"}</button>}
      </div>
      {f && (
        <div className="space-y-2 rounded-xl bg-painel2 p-3">
          <input className="campo" placeholder="Título (ex.: Treino de sábado cancelado)" value={f.titulo || ""} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <textarea className="campo min-h-16" placeholder="Detalhes (opcional)" value={f.texto || ""} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.fixado} onChange={(e) => setF({ ...f, fixado: e.target.checked })} /> 📌 Fixar no topo</label>
            <label className="flex items-center gap-2">Sai do mural em <input type="date" className="campo w-auto py-1" value={f.expira || ""} onChange={(e) => setF({ ...f, expira: e.target.value })} /></label>
          </div>
          {msg && <p className="text-sm text-alerta">{msg}</p>}
          <button className="btn text-sm" onClick={postar}>Publicar no mural</button>
        </div>
      )}
      {l.map((a) => (
        <article key={a.id} className="rounded-xl border-l-4 bg-painel2 p-3" style={{ borderColor: "var(--cor)" }}>
          <p className="font-semibold">{a.fixado ? "📌 " : ""}{a.titulo}</p>
          {a.texto && <p className="whitespace-pre-line text-sm">{a.texto}</p>}
          <p className="mt-1 flex justify-between text-xs text-suave"><span>{dataBR(a.criado_em)}{a.expira_em ? ` · até ${dataBR(a.expira_em)}` : ""}</span>{ctx.equipe && <button className="underline" onClick={() => apagar(a)}>apagar</button>}</p>
        </article>
      ))}
      {!l.length && <p className="text-sm text-suave">Nenhum recado ainda. Os recados aparecem para os alunos desta turma e no telão.</p>}
    </section>
  );
}
