"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, NENHUM, hora } from "@/lib/util";
import { minhasTurmas } from "@/lib/turmas";

// Minhas turmas: o aluno (ou responsável) vê as turmas, os horários e entra em cada uma
export default function MinhasTurmas() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[] | null>(null);
  const [filho, setFilho] = useState("");

  useEffect(() => {
    (async () => {
      if (ctx.equipe) {
        const { data } = await sb.from("turmas").select("id, nome, professor_id, modalidades(nome, cor), horarios(dia_semana, hora_inicio, hora_fim)")
          .eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome");
        setLista(minhasTurmas(ctx, data || []).map((t: any) => ({ turma: t, quem: [] })));
        return;
      }
      const ids = ctx.meusAlunos.map((m) => m.id);
      const { data } = await sb.from("matriculas").select("membro_id, turmas(id, nome, modalidades(nome, cor), horarios(dia_semana, hora_inicio, hora_fim))")
        .in("membro_id", ids.length ? ids : [NENHUM]).eq("status", "ativa");
      const porTurma = new Map<string, any>();
      (data || []).forEach((m: any) => {
        if (!m.turmas) return;
        const x = porTurma.get(m.turmas.id) || { turma: m.turmas, quem: [] };
        x.quem.push(ctx.meusAlunos.find((a) => a.id === m.membro_id)?.nome);
        (x.ids ||= []).push(m.membro_id);
        porTurma.set(m.turmas.id, x);
      });
      setLista(Array.from(porTurma.values()));
    })();
  }, []); // eslint-disable-line

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">{ctx.equipe ? "Turmas" : "Minhas turmas"}</h1>
      {lista === null && <p className="text-suave">Carregando…</p>}
      {lista?.length === 0 && <p className="text-suave">Nenhuma turma ainda. Fale com a academia para fazer a matrícula.</p>}
      {/* Responsável com mais de um filho: separa por criança (com filtro) */}
      {!ctx.equipe && ctx.meusAlunos.length > 1 && lista && lista.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button className="chip" onClick={() => setFilho("")} style={!filho ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>Todos</button>
          {ctx.meusAlunos.map((m) => (
            <button key={m.id} className="chip" onClick={() => setFilho(m.id)} style={filho === m.id ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{m.eu ? "Eu" : (m.apelido || m.nome || "").split(" ")[0]}</button>
          ))}
        </div>
      )}
      {!ctx.equipe && ctx.meusAlunos.length > 1 && lista ? (
        ctx.meusAlunos.filter((m) => !filho || m.id === filho).map((m) => {
          const deste = lista.filter((x: any) => (x.ids || []).includes(m.id));
          return (
            <section key={m.id} className="space-y-3">
              <h2 className="flex items-center gap-2 text-2xl font-bold">🧒 {m.eu ? "Eu" : m.apelido || m.nome} <span className="text-sm font-normal text-suave">· {deste.length} turma(s)</span></h2>
              {deste.length === 0 && <p className="text-sm text-suave">Ainda sem turma.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                {deste.map(({ turma: t }: any) => (
          <Link key={t.id} href={`/${ctx.academia.slug}/app/turmas/${t.id}`} className="rounded-2xl bg-painel p-4 transition hover:bg-painel2"
            style={{ borderLeft: `6px solid ${t.modalidades?.cor || "var(--cor)"}` }}>
            <p className="text-xs uppercase tracking-wide text-suave">{t.modalidades?.nome}</p>
            <p className="text-2xl font-bold">{t.nome}</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {[...(t.horarios || [])].sort((a: any, b: any) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)).map((h: any, i: number) => (
                <li key={i}>🕒 {DIAS[h.dia_semana]} · {hora(h.hora_inicio)}–{hora(h.hora_fim)}</li>
              ))}
            </ul>
            
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--cor)" }}>Ver turma →</p>
          </Link>
                ))}
              </div>
            </section>
          );
        })
      ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {lista?.map(({ turma: t, quem }) => (
          <Link key={t.id} href={`/${ctx.academia.slug}/app/turmas/${t.id}`} className="rounded-2xl bg-painel p-4 transition hover:bg-painel2"
            style={{ borderLeft: `6px solid ${t.modalidades?.cor || "var(--cor)"}` }}>
            <p className="text-xs uppercase tracking-wide text-suave">{t.modalidades?.nome}</p>
            <p className="text-2xl font-bold">{t.nome}</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {[...(t.horarios || [])].sort((a: any, b: any) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)).map((h: any, i: number) => (
                <li key={i}>🕒 {DIAS[h.dia_semana]} · {hora(h.hora_inicio)}–{hora(h.hora_fim)}</li>
              ))}
            </ul>
            {quem.length > 0 && ctx.meusAlunos.length > 1 && <p className="mt-2 text-xs text-suave">{quem.filter(Boolean).join(", ")}</p>}
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--cor)" }}>Ver turma →</p>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
