"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, dataBR, dataHoraBR, hora, primeiroNome, whatsapp } from "@/lib/util";

const ETAPAS: [string, string][] = [
  ["nova", "Novas"], ["encaminhada", "Encaminhadas"], ["agendada", "Agendadas"],
  ["compareceu", "Compareceram"], ["matriculou", "Matricularam"], ["desistiu", "Desistiram"],
];

export default function Experimentais() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [etapa, setEtapa] = useState("nova");
  const [profs, setProfs] = useState<any[]>([]);

  async function carregar() {
    const { data } = await sb.from("aulas_experimentais")
      .select("*, modalidades(nome), horarios(dia_semana, hora_inicio)")
      .eq("academia_id", ctx.academia.id).order("criado_em", { ascending: false });
    setLista(data || []);
  }
  useEffect(() => {
    carregar();
    sb.from("professores_publicos").select("membro_id, nome").eq("academia_id", ctx.academia.id).then(({ data }) =>
      setProfs(Array.from(new Map((data || []).map((p: any) => [p.membro_id, p])).values())));
  }, []); // eslint-disable-line

  async function mudar(e: any, campos: any) {
    await sb.from("aulas_experimentais").update({ ...campos, atualizada_em: new Date().toISOString() }).eq("id", e.id);
    carregar();
  }

  // Vira aluno aproveitando os dados do pedido
  async function matricular(e: any) {
    if (!confirm(`Cadastrar ${e.nome} como aluno?`)) return;
    const perfilId = crypto.randomUUID();
    const r = await sb.from("perfis").insert({ id: perfilId, nome: e.nome, telefone: e.telefone, nascimento: e.nascimento, email: e.email });
    if (r.error) return alert(r.error.message);
    await sb.from("membros").insert({ academia_id: ctx.academia.id, perfil_id: perfilId, papel: "aluno" });
    await mudar(e, { status: "matriculou", perfil_id: perfilId });
  }

  const total = (s: string) => lista.filter((e) => e.status === s).length;
  const convertidos = total("matriculou"), finalizados = convertidos + total("desistiu");

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Aulas experimentais</h1>
      <p className="text-suave">
        {lista.length} pedido(s) · {finalizados ? Math.round((100 * convertidos) / finalizados) : 0}% dos que finalizaram viraram alunos
      </p>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ETAPAS.map(([k, v]) => (
          <button key={k} onClick={() => setEtapa(k)} className="chip shrink-0 py-2"
            style={etapa === k ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>
            {v} <b className="numero">{total(k)}</b>
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {lista.filter((e) => e.status === etapa).map((e) => {
          const z = whatsapp(e.telefone, `Oi, ${primeiroNome(e.nome)}! Aqui é da ${ctx.academia.nome}. Vamos marcar sua aula experimental de ${e.modalidades?.nome || "luta"}?`);
          return (
            <li key={e.id} className="rounded-2xl bg-painel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{e.nome}</p>
                  <p className="text-sm text-suave">
                    {e.modalidades?.nome || "Qualquer modalidade"}
                    {e.horarios ? ` · prefere ${DIAS[e.horarios.dia_semana]} ${hora(e.horarios.hora_inicio)}` : ""}
                    {e.nascimento ? ` · nasc. ${dataBR(e.nascimento)}` : ""} · pedido em {dataHoraBR(e.criado_em)}
                  </p>
                  {e.mensagem && <p className="mt-1 text-sm">💬 {e.mensagem}</p>}
                  {e.agendada_para && <p className="mt-1 text-sm">📅 Agendada para {dataHoraBR(e.agendada_para)}</p>}
                </div>
                {z && <a href={z} target="_blank" className="btn-sec text-sm">WhatsApp</a>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.status === "nova" && (
                  <select className="campo w-auto text-sm" defaultValue="" onChange={(x) => x.target.value && mudar(e, { status: "encaminhada", encaminhada_para: x.target.value })}>
                    <option value="">Encaminhar para…</option>
                    {profs.map((p) => <option key={p.membro_id} value={p.membro_id}>{p.nome}</option>)}
                  </select>
                )}
                {["nova", "encaminhada"].includes(e.status) && (
                  <input type="datetime-local" className="campo w-auto text-sm" aria-label="Agendar"
                    onChange={(x) => x.target.value && mudar(e, { status: "agendada", agendada_para: new Date(x.target.value + ":00-03:00").toISOString() })} />
                )}
                {e.status === "agendada" && <button className="btn-sec text-sm" onClick={() => mudar(e, { status: "compareceu" })}>Compareceu</button>}
                {["agendada", "compareceu"].includes(e.status) && <button className="btn text-sm" onClick={() => matricular(e)}>Matricular</button>}
                {!["matriculou", "desistiu"].includes(e.status) && <button className="text-sm text-suave underline" onClick={() => mudar(e, { status: "desistiu" })}>Desistiu</button>}
              </div>
            </li>
          );
        })}
        {!lista.filter((e) => e.status === etapa).length && <p className="text-suave">Ninguém nesta etapa.</p>}
      </ul>
    </div>
  );
}
