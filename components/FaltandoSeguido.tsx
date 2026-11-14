"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, primeiroNome, whatsapp } from "@/lib/util";

// Quem faltou as últimas aulas seguidas, com a mensagem pronta para o WhatsApp
export function FaltandoSeguido({ limite = 8 }: { limite?: number }) {
  const ctx = useCtx();
  const [l, setL] = useState<any[] | null>(null);
  const [todos, setTodos] = useState(false);
  const min = Math.max(2, ctx.academia.alerta_faltas_seguidas || 3);
  useEffect(() => {
    supabaseNavegador().rpc("faltas_seguidas", { p_acad: ctx.academia.id, p_min: min }).then(({ data }) => setL(data || []));
  }, [ctx.academia.id, min]);
  if (!l?.length) return null;
  const msg = (x: any) => {
    const nome = primeiroNome(x.apelido || x.nome);
    return x.menor
      ? `Olá! Aqui é da ${ctx.academia.nome}. Sentimos falta de ${nome} nos treinos: ${x.seguidas} aulas seguidas da turma ${x.turma}. Aconteceu alguma coisa? Está tudo bem? Se precisar de algo, é só falar. Esperamos ${nome} no tatame! 🥋`
      : `Oi, ${nome}! Aqui é da ${ctx.academia.nome}. Sentimos sua falta: você faltou as últimas ${x.seguidas} aulas da turma ${x.turma}. Aconteceu alguma coisa? Está tudo bem? Te esperamos no tatame! 🥋`;
  };
  const vis = todos ? l : l.slice(0, limite);
  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4">
      <h2 className="text-xl font-bold">📉 Faltando seguido ({l.length})</h2>
      <p className="text-xs text-suave">{min} ou mais aulas seguidas sem vir. A mensagem já vai pronta; é só tocar em Enviar.</p>
      <ul className="space-y-1.5">
        {vis.map((x) => {
          const w = whatsapp(x.whatsapp, msg(x));
          return (
            <li key={x.membro_id + x.turma_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2 text-sm">
              <span className="min-w-0 flex-1">
                <b>{x.apelido || x.nome}</b>{x.menor ? " 🧒" : ""} · <span className={x.seguidas >= 4 ? "font-semibold text-erro" : "text-alerta"}>faltou {x.seguidas} aulas</span>
                <span className="block text-xs text-suave">{x.turma}{x.ultima_presenca ? ` · última presença ${dataBR(x.ultima_presenca)}` : " · ainda não veio"}</span>
              </span>
              {w ? <a className="btn px-3 py-1.5 text-xs" target="_blank" href={w}>💬 Enviar no WhatsApp</a> : <span className="text-xs text-suave">sem WhatsApp</span>}
            </li>
          );
        })}
      </ul>
      {l.length > limite && <button className="text-sm underline" onClick={() => setTodos(!todos)}>{todos ? "Mostrar menos" : `Ver todos (${l.length})`}</button>}
    </section>
  );
}
