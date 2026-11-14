"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR, primeiroNome } from "@/lib/util";

// Próximos campeonatos: o aluno (ou o responsável) pede a inscrição e o professor aprova
export function QueroLutar() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [evs, setEvs] = useState<any[]>([]);
  const [insc, setInsc] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const ids = ctx.meusAlunos.map((a) => a.id);

  async function carregar() {
    const { data: e } = await sb.from("eventos").select("id, titulo, inicio, local, pesagem_em").eq("academia_id", ctx.academia.id).eq("tipo", "campeonato")
      .gte("inicio", new Date().toISOString()).order("inicio").limit(4);
    setEvs(e || []);
    if (e?.length && ids.length) {
      const { data: i } = await sb.from("inscricoes_evento").select("id, evento_id, membro_id, status, categoria_peso").in("evento_id", e.map((x: any) => x.id)).in("membro_id", ids);
      setInsc(i || []);
    }
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  if (!evs.length || !ids.length) return null;

  async function pedir(ev: any, membro: string) {
    const cat = prompt("Categoria de peso (se souber, ex.: -66 kg). Pode deixar em branco que o professor ajusta:", "");
    if (cat === null) return;
    const obs = prompt("Algum recado para o professor? (opcional)", "") || "";
    const { error } = await sb.rpc("pedir_inscricao", { p_evento: ev.id, p_membro: membro, p_categoria: cat, p_obs: obs });
    setMsg(error ? error.message : "✅ Pedido enviado! O professor vai aprovar.");
    carregar();
  }
  async function cancelar(i: any) {
    if (!confirm("Cancelar o pedido de inscrição?")) return;
    const { error } = await sb.rpc("cancelar_pedido_inscricao", { p_inscricao: i.id });
    setMsg(error ? error.message : "Pedido cancelado."); carregar();
  }

  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4">
      <h2 className="text-xl font-bold">🥇 Próximos campeonatos</h2>
      {evs.map((ev) => (
        <div key={ev.id} className="space-y-1.5 rounded-xl bg-painel2 p-3 text-sm">
          <p><b>{ev.titulo}</b> · {dataHoraBR(ev.inicio)}{ev.local ? ` · ${ev.local}` : ""}</p>
          {ctx.meusAlunos.map((a) => {
            const i = insc.find((x) => x.evento_id === ev.id && x.membro_id === a.id);
            const quem = ctx.meusAlunos.length > 1 || !a.eu ? primeiroNome(a.apelido || a.nome) : "Você";
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{quem}: {!i ? "não inscrito" : i.status === "pendente" ? "⏳ pedido enviado" : i.status === "recusada" ? "❌ não foi desta vez" : `✅ inscrito${i.categoria_peso ? ` (${i.categoria_peso})` : ""}`}</span>
                {!i || i.status === "recusada" ? <button className="btn px-3 py-1 text-xs" onClick={() => pedir(ev, a.id)}>🙋 Quero lutar</button>
                  : i.status === "pendente" ? <button className="text-xs text-suave underline" onClick={() => cancelar(i)}>cancelar pedido</button> : null}
              </div>
            );
          })}
        </div>
      ))}
      {msg && <p className="text-sm text-suave">{msg}</p>}
    </section>
  );
}
