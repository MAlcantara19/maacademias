"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { primeiroNome } from "@/lib/util";

// Aviso do dia: quem faz aniversário hoje (a equipe tem o botão de mandar parabéns)
export function AniversarioDoDia({ academia, equipe }: { academia: any; equipe: boolean }) {
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [zap, setZap] = useState<Record<string, string>>({});

  useEffect(() => {
    sb.rpc("aniversariantes_hoje", { p_acad: academia.id }).then(async ({ data }) => {
      setLista(data || []);
      if (equipe && data?.length) {
        const { data: p } = await sb.from("painel_alunos").select("membro_id, whatsapp").in("membro_id", data.map((x: any) => x.membro_id));
        setZap(Object.fromEntries((p || []).map((x: any) => [x.membro_id, x.whatsapp])));
      }
    });
  }, [academia.id]); // eslint-disable-line

  if (!lista.length) return null;
  return (
    <section className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #db2777, #f59e0b)" }}>
      <p className="text-lg font-bold">🎂 Hoje tem aniversário!</p>
      <ul className="mt-1 space-y-1">
        {lista.map((a) => {
          const texto = `Parabéns, ${a.apelido || primeiroNome(a.nome)}! 🎉🥋 Toda a ${academia.nome} deseja um feliz aniversário, muita saúde e muitos treinos!`;
          const numero = (zap[a.membro_id] || "").replace(/\D/g, "");
          return (
            <li key={a.membro_id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{a.apelido || a.nome}{a.idade ? ` · ${a.idade} anos` : ""}</span>
              {equipe && numero && <a className="rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold" target="_blank" href={`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`}>Mandar parabéns</a>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
