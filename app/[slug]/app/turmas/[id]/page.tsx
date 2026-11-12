"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PreCheckin } from "@/components/PreCheckin";
import { DIAS, addDias, hojeISO, hora, primeiroNome } from "@/lib/util";

// Uma turma: horários, professor, próxima aula (com "vou nessa aula") e colegas
export default function Turma({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [t, setT] = useState<any>(null);
  const [prof, setProf] = useState<any>(null);
  const [colegas, setColegas] = useState<any[]>([]);
  const [meuNaTurma, setMeuNaTurma] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("turmas").select("id, nome, publico, modalidades(nome, cor), horarios(id, dia_semana, hora_inicio, hora_fim, tipo_treino)").eq("id", id).maybeSingle();
      setT(data);
      const { data: p } = await sb.rpc("professor_da_turma", { p_turma: id });
      setProf(p?.[0] || null);
      const { data: c } = await sb.rpc("colegas_da_turma", { p_turma: id });
      setColegas(c || []);
      const meu = (c || []).find((x: any) => ctx.meusAlunos.some((m) => m.id === x.membro_id));
      setMeuNaTurma(meu?.membro_id || null);
    })();
  }, [id]); // eslint-disable-line

  if (!t) return <p className="text-suave">Carregando…</p>;

  // próxima aula desta turma
  const hoje = hojeISO();
  const agora = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const proximas: any[] = [];
  (t.horarios || []).forEach((h: any) => {
    for (let k = 0; k < 7; k++) {
      const dia = addDias(hoje, k);
      if (new Date(dia + "T12:00:00").getDay() === h.dia_semana && (dia > hoje || h.hora_fim > agora)) proximas.push({ ...h, dia });
    }
  });
  proximas.sort((a, b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
  const proxima = proximas[0];

  return (
    <div className="space-y-5">
      <Link href={`/${ctx.academia.slug}/app/turmas`} className="text-sm text-suave">← Turmas</Link>
      <div>
        <p className="text-sm uppercase tracking-wide text-suave">{t.modalidades?.nome}</p>
        <h1 className="text-4xl font-extrabold">{t.nome}</h1>
        {prof && (
          <p className="mt-2 flex items-center gap-2 text-sm"><Avatar foto={prof.foto_url} nome={prof.nome} tamanho={28} mostrarFaixa={false} /> Professor(a): <b>{prof.nome}</b></p>
        )}
      </div>

      {proxima && (
        <section className="rounded-2xl p-5 text-white" style={{ background: t.modalidades?.cor || "var(--cor)" }}>
          <p className="text-sm opacity-90">Próxima aula</p>
          <p className="numero text-3xl font-bold">{proxima.dia === hoje ? "Hoje" : DIAS[proxima.dia_semana]} · {hora(proxima.hora_inicio)}</p>
          {proxima.tipo_treino && <p>Treino {proxima.tipo_treino}</p>}
          {meuNaTurma && ctx.academia.modulos?.pre_checkin !== false && (
            <PreCheckin academiaId={ctx.academia.id} horarioId={proxima.id} data={proxima.dia} membroId={meuNaTurma} claro />
          )}
        </section>
      )}

      <section className="rounded-2xl bg-painel p-4">
        <h2 className="mb-2 text-2xl font-bold">Horários</h2>
        <ul className="space-y-1">
          {[...(t.horarios || [])].sort((a: any, b: any) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)).map((h: any) => (
            <li key={h.id} className="flex justify-between"><span>{DIAS[h.dia_semana]}</span><span className="numero">{hora(h.hora_inicio)}–{hora(h.hora_fim)}{h.tipo_treino ? ` · ${h.tipo_treino}` : ""}</span></li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-painel p-4">
        <h2 className="mb-3 text-2xl font-bold">Turma ({colegas.length})</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {colegas.map((c) => (
            <div key={c.membro_id} className="flex flex-col items-center gap-1 text-center">
              <Avatar foto={c.foto_url} nome={c.nome} cor={c.cor_faixa} grau={c.grau} tamanho={56} />
              <span className="text-sm leading-tight">{c.apelido || primeiroNome(c.nome)}</span>
              {c.faixa && <span className="text-[11px] text-suave">{c.faixa}</span>}
            </div>
          ))}
          {!colegas.length && <p className="col-span-full text-sm text-suave">Só quem é da turma vê os colegas.</p>}
        </div>
      </section>
    </div>
  );
}
