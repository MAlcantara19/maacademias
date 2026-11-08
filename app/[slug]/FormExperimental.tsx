"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, hora } from "@/lib/util";

export function FormExperimental({ academiaId, modalidades, professores, turmas }: {
  academiaId: string; modalidades: any[]; professores: any[]; turmas: any[];
}) {
  const [f, setF] = useState<any>({ modalidade_id: modalidades[0]?.id || "", professor_id: "", horario_id: "" });
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const muda = (k: string, v: string) => setF((x: any) => ({ ...x, [k]: v }));

  const profs = professores.filter((p) => p.modalidade_id === f.modalidade_id);
  const horarios = turmas
    .filter((t) => t.modalidade_id === f.modalidade_id)
    .flatMap((t) => (t.horarios || []).map((h: any) => ({ ...h, turma: t.nome })))
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro("");
    const { error } = await supabaseNavegador().from("aulas_experimentais").insert({
      academia_id: academiaId,
      modalidade_id: f.modalidade_id || null,
      professor_id: f.professor_id || null,
      horario_id: f.horario_id || null,
      nome: f.nome, telefone: f.telefone, nascimento: f.nascimento || null, mensagem: f.mensagem || null,
    });
    setEnviando(false);
    if (error) return setErro("Não foi possível enviar agora. Confira os campos e tente de novo.");
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mt-6 rounded-2xl bg-fundo p-6">
        <p className="text-2xl font-bold">Pedido enviado!</p>
        <p className="mt-1 text-suave">A academia vai te chamar no WhatsApp para confirmar o dia.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-6 grid gap-4 sm:grid-cols-2">
      <div>
        <label className="rotulo">Modalidade</label>
        <select className="campo" value={f.modalidade_id} onChange={(e) => setF({ ...f, modalidade_id: e.target.value, professor_id: "", horario_id: "" })}>
          {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo">Professor (opcional)</label>
        <select className="campo" value={f.professor_id} onChange={(e) => muda("professor_id", e.target.value)}>
          <option value="">Tanto faz</option>
          {profs.map((p) => <option key={p.membro_id} value={p.membro_id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo">Horário que prefere</label>
        <select className="campo" value={f.horario_id} onChange={(e) => muda("horario_id", e.target.value)}>
          <option value="">Qualquer um</option>
          {horarios.map((h) => (
            <option key={h.id} value={h.id}>{DIAS[h.dia_semana]} {hora(h.hora_inicio)} — {h.turma}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="rotulo">Nome</label>
        <input required className="campo" value={f.nome || ""} onChange={(e) => muda("nome", e.target.value)} />
      </div>
      <div>
        <label className="rotulo">WhatsApp</label>
        <input required type="tel" inputMode="tel" className="campo" placeholder="(24) 99999-9999" value={f.telefone || ""} onChange={(e) => muda("telefone", e.target.value)} />
      </div>
      <div>
        <label className="rotulo">Data de nascimento</label>
        <input type="date" className="campo" value={f.nascimento || ""} onChange={(e) => muda("nascimento", e.target.value)} />
      </div>
      <div>
        <label className="rotulo">Mensagem (opcional)</label>
        <input className="campo" placeholder="Ex.: é para meu filho de 10 anos" value={f.mensagem || ""} onChange={(e) => muda("mensagem", e.target.value)} />
      </div>
      {erro && <p className="text-sm text-alerta sm:col-span-2">{erro}</p>}
      <button className="btn sm:col-span-2" disabled={enviando}>{enviando ? "Enviando..." : "Pedir aula experimental"}</button>
    </form>
  );
}
