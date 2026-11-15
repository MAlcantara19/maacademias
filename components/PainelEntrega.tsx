"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Master: as notificações estão chegando? Aparelhos ativos e entregas por academia
export function PainelEntrega() {
  const [l, setL] = useState<any[] | null>(null);
  useEffect(() => {
    supabaseNavegador().rpc("entrega_notificacoes").then(({ data, error }: any) => setL(error ? null : data || []), () => setL(null));
  }, []);
  if (!l) return null;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const tot = l.reduce((s, x) => ({ p: s.p + x.pessoas, c: s.c + x.com_push, e: s.e + x.enviadas_7d, ch: s.ch + x.chegaram_7d }), { p: 0, c: 0, e: 0, ch: 0 });
  return (
    <details className="rounded-2xl bg-painel p-4">
      <summary className="cursor-pointer text-xl font-bold">🔔 Entrega das notificações</summary>
      <p className="mt-1 text-sm text-suave">
        {tot.c} de {tot.p} pessoas ({pct(tot.c, tot.p)}%) recebem no celular · últimos 7 dias: {tot.e} notificações, {tot.ch} tocaram em algum aparelho.
        {tot.e > 0 && tot.ch === 0 ? " ⚠️ Nenhuma chegou no celular: confira o Webhook do Supabase e as chaves VAPID na Vercel." : ""}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-suave">
            <tr><th className="py-1">Academia</th><th>Com push</th><th>Aparelhos</th><th>Enviadas 7d</th><th>Chegaram</th><th>Lidas</th></tr>
          </thead>
          <tbody>
            {l.map((x) => (
              <tr key={x.academia_id} className="border-t border-linha">
                <td className="py-1.5 font-semibold">{x.academia}</td>
                <td>{x.com_push}/{x.pessoas} <span className="text-xs text-suave">({pct(x.com_push, x.pessoas)}%)</span></td>
                <td>{x.aparelhos}</td>
                <td>{x.enviadas_7d}</td>
                <td>{x.chegaram_7d} <span className="text-xs text-suave">({pct(x.chegaram_7d, x.enviadas_7d)}%)</span></td>
                <td>{x.lidas_7d} <span className="text-xs text-suave">({pct(x.lidas_7d, x.enviadas_7d)}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-suave">“Chegaram” = tocou em pelo menos um celular. Quem não ativou no aparelho só vê dentro do app (Notificações).</p>
    </details>
  );
}
