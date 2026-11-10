"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, hojeISO } from "@/lib/util";
import { minhasTurmas } from "@/lib/turmas";

// Lista de presença do mês (alunos × dias) para prestação de contas
// ou para imprimir em branco e fazer a chamada no papel.
export default function ListaPresenca() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [emBranco, setEmBranco] = useState(false);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [dias, setDias] = useState<string[]>([]);
  const [pres, setPres] = useState<Set<string>>(new Set());

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, horarios(dia_semana)").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome")
      .then(({ data }) => { const l = minhasTurmas(ctx, data || []); setTurmas(l); if (l[0]) setTurmaId(l[0].id); });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!turmaId) return;
    (async () => {
      const turma = turmas.find((t) => t.id === turmaId);
      const [a, m] = mes.split("-").map(Number);
      const total = new Date(a, m, 0).getDate();
      const dows = new Set((turma?.horarios || []).map((h: any) => h.dia_semana));
      const ds = Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)
        .filter((d) => !dows.size || dows.has(new Date(d + "T12:00:00").getDay()));
      setDias(ds);
      const { data: mats } = await sb.from("matriculas").select("membro_id").eq("turma_id", turmaId).neq("status", "encerrada");
      const ids = (mats || []).map((x: any) => x.membro_id);
      const { data: nomes } = ids.length ? await sb.from("painel_alunos").select("membro_id, nome, nascimento").in("membro_id", ids).order("nome") : { data: [] as any[] };
      setAlunos(nomes || []);
      const { data: aulas } = await sb.from("aulas").select("id, data").eq("turma_id", turmaId).gte("data", ds[0] || mes + "-01").lte("data", `${mes}-${total}`);
      const mapa = new Map((aulas || []).map((x: any) => [x.id, x.data]));
      const { data: p } = mapa.size ? await sb.from("presencas").select("aula_id, membro_id").in("aula_id", Array.from(mapa.keys())) : { data: [] as any[] };
      setPres(new Set((p || []).map((x: any) => x.membro_id + "|" + mapa.get(x.aula_id))));
    })();
  }, [turmaId, mes, turmas]); // eslint-disable-line

  const turma = turmas.find((t) => t.id === turmaId);
  const [a, m] = mes.split("-").map(Number);

  return (
    <div className="space-y-4">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Lista de presença</h1>
        <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      <div className="nao-imprimir flex flex-wrap gap-2">
        <select className="campo w-auto" value={turmaId} onChange={(e) => setTurmaId(e.target.value)} aria-label="Turma">
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <input type="month" className="campo w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emBranco} onChange={(e) => setEmBranco(e.target.checked)} /> Em branco (para chamada no papel)</label>
      </div>
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>

      <div className="imprimir-claro overflow-x-auto rounded-2xl bg-painel p-3">
        <p className="mb-2 font-bold">{ctx.academia.nome} · {turma?.nome} · {MESES[m - 1]} de {a}</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-linha p-1 text-left">Aluno</th>
              {dias.map((d) => <th key={d} className="numero w-8 border border-linha p-1 text-center">{Number(d.slice(8))}</th>)}
              {!emBranco && <th className="border border-linha p-1">Total</th>}
            </tr>
          </thead>
          <tbody>
            {alunos.map((al) => {
              const n = dias.filter((d) => pres.has(al.membro_id + "|" + d)).length;
              return (
                <tr key={al.membro_id}>
                  <td className="whitespace-nowrap border border-linha p-1">{al.nome}</td>
                  {dias.map((d) => (
                    <td key={d} className="border border-linha p-1 text-center">{!emBranco && pres.has(al.membro_id + "|" + d) ? "✓" : ""}</td>
                  ))}
                  {!emBranco && <td className="numero border border-linha p-1 text-center font-bold">{n}</td>}
                </tr>
              );
            })}
            {emBranco && Array.from({ length: 5 }).map((_, i) => (
              <tr key={"b" + i}><td className="border border-linha p-1">&nbsp;</td>{dias.map((d) => <td key={d} className="border border-linha" />)}</tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 hidden text-sm print:block">Professor(a): ____________________________</p>
      </div>
    </div>
  );
}
