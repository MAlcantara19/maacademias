"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// "Vou nessa aula": o aluno avisa que vai e vê quantos já confirmaram
export function PreCheckin({ academiaId, horarioId, data, membroId, claro = false }: { academiaId: string; horarioId: string; data: string; membroId: string; claro?: boolean }) {
  const sb = supabaseNavegador();
  const [vou, setVou] = useState(false);
  const [total, setTotal] = useState(0);

  async function carregar() {
    const { data: meu } = await sb.from("pre_checkins").select("membro_id").eq("horario_id", horarioId).eq("data", data).eq("membro_id", membroId);
    setVou(!!meu?.length);
    const { data: c } = await sb.rpc("contagem_pre_checkin", { p_acad: academiaId, p_de: data, p_ate: data });
    setTotal((c || []).find((x: any) => x.horario_id === horarioId)?.vao || 0);
  }
  useEffect(() => { carregar(); }, [horarioId, data, membroId]); // eslint-disable-line

  async function alternar() {
    if (vou) await sb.from("pre_checkins").delete().eq("horario_id", horarioId).eq("data", data).eq("membro_id", membroId);
    else await sb.from("pre_checkins").insert({ horario_id: horarioId, data, membro_id: membroId });
    carregar();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button onClick={alternar} className={`rounded-xl px-4 py-2 font-semibold ${claro ? (vou ? "bg-white text-black" : "border border-white/70") : vou ? "btn" : "btn-sec"}`}>
        {vou ? "✋ Vou! (toque para desmarcar)" : "✋ Vou nessa aula"}
      </button>
      <span className="text-sm opacity-90">{total ? `${total} ${total === 1 ? "pessoa confirmou" : "pessoas confirmaram"}` : "Ninguém confirmou ainda"}</span>
    </div>
  );
}
