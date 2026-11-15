"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES } from "@/lib/util";

// Relatório de engajamento (dono): quem abre o app, lê avisos e confirma presença, mês a mês
export function Engajamento({ academiaId }: { academiaId: string }) {
  const [l, setL] = useState<any[] | null>(null);
  useEffect(() => {
    supabaseNavegador().rpc("engajamento_mensal", { p_acad: academiaId, p_meses: 6 }).then(({ data, error }: any) => setL(error ? null : data || []), () => setL(null));
  }, [academiaId]);
  if (!l || !l.length) return null;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const ult = l[l.length - 1];
  const Barra = ({ v, cor }: { v: number; cor: string }) => (
    <div className="h-2 overflow-hidden rounded-full bg-painel2"><div className="h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: cor }} /></div>
  );
  return (
    <section className="space-y-3 rounded-2xl bg-painel p-4">
      <h2 className="text-2xl font-bold">📱 Engajamento no app</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Abriram o app", ult.abriram_app, "alunos ou responsáveis no mês"],
          ["Confirmaram presença (✋)", ult.confirmaram_presenca, `${ult.confirmacoes} confirmações`],
          ["Deram ciente nos avisos", ult.deram_ciente, `${ult.avisos} aviso(s) no mês`],
        ].map(([t, v, s]) => (
          <div key={t as string} className="rounded-xl bg-painel2 p-3">
            <p className="text-sm text-suave">{t}</p>
            <p className="numero text-3xl font-bold">{v as number}<span className="text-base text-suave"> / {ult.alunos}</span></p>
            <p className="text-xs text-suave">{pct(v as number, ult.alunos)}% · {s}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-suave"><tr><th className="py-1">Mês</th><th>Alunos</th><th>Abriram o app</th><th>Confirmaram ✋</th><th>Ciente</th><th>Treinaram</th></tr></thead>
          <tbody>
            {l.map((m) => (
              <tr key={m.mes} className="border-t border-linha align-middle">
                <td className="py-2 font-semibold">{MESES[Number(m.mes.slice(5, 7)) - 1].slice(0, 3)}/{m.mes.slice(2, 4)}</td>
                <td>{m.alunos}</td>
                <td className="pr-3"><span>{m.abriram_app} ({pct(m.abriram_app, m.alunos)}%)</span><Barra v={pct(m.abriram_app, m.alunos)} cor="var(--cor)" /></td>
                <td className="pr-3"><span>{m.confirmaram_presenca} ({pct(m.confirmaram_presenca, m.alunos)}%)</span><Barra v={pct(m.confirmaram_presenca, m.alunos)} cor="var(--color-ok)" /></td>
                <td className="pr-3"><span>{m.deram_ciente}</span><Barra v={pct(m.deram_ciente, m.alunos)} cor="var(--color-alerta)" /></td>
                <td>{m.treinaram} ({pct(m.treinaram, m.alunos)}%)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-suave">“Abriram o app” começa a contar a partir desta atualização. Dica: avisos com enquete e o “✋ Vou nessa aula” são o que mais trazem a turma para o app.</p>
    </section>
  );
}
