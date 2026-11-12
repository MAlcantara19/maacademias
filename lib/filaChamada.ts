"use client";
// Chamada sem internet: guarda as marcações no aparelho e envia quando a internet voltar.
import { supabaseNavegador } from "@/lib/supabase/client";

export type Op = {
  tipo: "marcar" | "desmarcar";
  aula: { turma_id: string; horario_id: string; data: string; hora_inicio: string; hora_fim: string; tipo_treino?: string | null };
  membro_id: string;
  confirmado_por?: string | null;
  metodo?: string;
};

const CHAVE = "ma_fila_chamada";

export function lerFila(): Op[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch { return []; }
}
function salvar(f: Op[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(f)); } catch { /* sem espaço: ignora */ }
}
export function enfileirar(op: Op) {
  // a última ação sobre o mesmo aluno na mesma aula é a que vale
  const f = lerFila().filter((x) => !(x.membro_id === op.membro_id && x.aula.turma_id === op.aula.turma_id && x.aula.data === op.aula.data && x.aula.hora_inicio === op.aula.hora_inicio));
  f.push(op);
  salvar(f);
  return f.length;
}

// Envia o que ficou guardado. Devolve quantas ainda faltam.
export async function enviarFila(): Promise<number> {
  const f = lerFila();
  if (!f.length || !navigator.onLine) return f.length;
  const sb = supabaseNavegador();
  const restante: Op[] = [];
  const aulas = new Map<string, string>();
  for (const op of f) {
    try {
      const k = `${op.aula.turma_id}|${op.aula.data}|${op.aula.hora_inicio}`;
      let aulaId = aulas.get(k);
      if (!aulaId) {
        const { data, error } = await sb.from("aulas").upsert(op.aula, { onConflict: "turma_id,data,hora_inicio" }).select("id").single();
        if (error || !data) throw error;
        aulaId = data.id as string;
        aulas.set(k, aulaId);
      }
      const r = op.tipo === "marcar"
        ? await sb.from("presencas").upsert({ aula_id: aulaId, membro_id: op.membro_id, metodo: op.metodo || "manual", confirmado_por: op.confirmado_por || null }, { onConflict: "aula_id,membro_id", ignoreDuplicates: true })
        : await sb.from("presencas").delete().eq("aula_id", aulaId).eq("membro_id", op.membro_id);
      if (r.error) throw r.error;
    } catch {
      restante.push(op);
    }
  }
  salvar(restante);
  return restante.length;
}
