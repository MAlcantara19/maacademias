"use client";
import { useEffect, useState } from "react";
import { LeituraAviso, ResultadoEnquete } from "@/components/CienteAviso";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, dataHoraBR, hojeISO } from "@/lib/util";

// Mensagens prontas: um toque preenche o aviso (dá para editar antes de publicar)
const MODELOS: { rotulo: string; titulo: string; texto: string; opcoes?: string[] }[] = [
  { rotulo: "🚫 Treino cancelado", titulo: "Treino de hoje cancelado", texto: "Hoje não vai ter treino. Desculpem o aviso em cima da hora! Nos vemos na próxima aula. 🥋" },
  { rotulo: "🏖️ Feriado", titulo: "Feriado: não tem aula", texto: "No feriado a academia fica fechada. As aulas voltam no dia seguinte, no horário normal." },
  { rotulo: "🎒 Material", titulo: "Trazer material na próxima aula", texto: "Lembrem de trazer: kimono/uniforme limpo, faixa, garrafinha de água e chinelo." },
  { rotulo: "⏰ Mudou o horário", titulo: "Mudança de horário", texto: "Atenção: a aula de ___ vai ser às ___. Depois volta ao horário normal." },
  { rotulo: "🥇 Campeonato", titulo: "Inscrições abertas para o campeonato", texto: "Quem quiser competir, avise o professor até ___. Peso, documento e carteirinha em dia!" },
  { rotulo: "💳 Mensalidade", titulo: "Lembrete da mensalidade", texto: "A mensalidade vence dia ___. Dá para pagar pelo Pix direto no app, em Mensalidades." },
  { rotulo: "🗳️ Treino extra", titulo: "Treino extra no sábado?", texto: "Estamos pensando num treino extra no sábado de manhã. Quem vem?", opcoes: ["👍 Vou", "👎 Não vou"] },
  { rotulo: "🗳️ Melhor horário", titulo: "Qual o melhor horário para você?", texto: "Vamos abrir uma turma nova. Vote no horário que fica melhor:", opcoes: ["🌅 Manhã", "🌞 Tarde", "🌙 Noite"] },
];

export default function Avisos() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mods, setMods] = useState<any[]>([]);
  const [novo, setNovo] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data } = await sb.from("avisos").select("*, turmas(nome), modalidades(nome)").eq("academia_id", ctx.academia.id)
      .order("fixado", { ascending: false }).order("criado_em", { ascending: false });
    setLista(data || []);
  }
  useEffect(() => {
    carregar();
    sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
    sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).then(({ data }) => setMods(data || []));
  }, []); // eslint-disable-line

  async function salvar() {
    if (!novo?.titulo) return setMsg("Escreva o título do aviso.");
    const agendado = novo.agendar && novo.quando_data ? new Date(`${novo.quando_data}T${novo.quando_hora || "08:00"}:00-03:00`).toISOString() : null;
    if (agendado && new Date(agendado) < new Date()) return setMsg("A data do agendamento já passou.");
    const opcoes = novo.enquete ? (novo.opcoes || []).map((o: string) => o.trim()).filter(Boolean) : [];
    if (novo.enquete && opcoes.length < 2) return setMsg("A enquete precisa de pelo menos 2 opções.");
    const { error } = await sb.from("avisos").insert({
      academia_id: ctx.academia.id, escopo: novo.escopo, titulo: novo.titulo, texto: novo.texto || null,
      turma_id: novo.escopo === "turma" ? novo.turma_id : null, modalidade_id: novo.escopo === "modalidade" ? novo.modalidade_id : null,
      data: novo.escopo === "dia" ? novo.data || hojeISO() : null, fixado: !!novo.fixado, publico: !!novo.publico,
      expira_em: novo.expira ? new Date(novo.expira + "T23:59:00-03:00").toISOString() : null, autor_id: ctx.membroId,
      ...(agendado ? { publicar_em: agendado } : {}),
      ...(opcoes.length >= 2 ? { opcoes } : {}),
    });
    setMsg(error ? (/publicar_em|opcoes/.test(error.message) ? "Rode o arquivo ATUALIZAR-25.sql no Supabase para agendar e fazer enquete." : error.message)
      : agendado ? `⏰ Aviso agendado para ${dataHoraBR(agendado)}. Ele chega sozinho no celular de todos nessa hora.` : opcoes.length >= 2 ? "🗳️ Enquete publicada." : "Aviso publicado.");
    setNovo(null); carregar();
  }
  async function apagar(id: string) {
    if (!confirm("Apagar este aviso?")) return;
    await sb.from("avisos").delete().eq("id", id); carregar();
  }
  async function lembrar(a: any) {
    const { data, error } = await sb.rpc("lembrar_aviso", { p_aviso: a.id });
    setMsg(error ? error.message.replace(/^.*?: /, "") : data ? `🔔 Lembrete mandado para ${data} pessoa(s) que ainda não leram.` : "Todo mundo já leu! 🎉");
    carregar();
  }
  async function fixar(a: any) {
    await sb.from("avisos").update({ fixado: !a.fixado }).eq("id", a.id); carregar();
  }

  const expirado = (a: any) => a.expira_em && new Date(a.expira_em) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Avisos</h1>
        <button className="btn" onClick={() => setNovo({ escopo: "geral" })}>Novo aviso</button>
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {novo && (
        <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <select className="campo" value={novo.escopo} onChange={(e) => setNovo({ ...novo, escopo: e.target.value })}>
            <option value="geral">Para todos</option><option value="modalidade">Uma modalidade</option><option value="turma">Uma turma</option><option value="dia">Só de um dia</option>
          </select>
          {novo.escopo === "turma" && <select className="campo" defaultValue="" onChange={(e) => setNovo({ ...novo, turma_id: e.target.value })}><option value="" disabled>Turma…</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>}
          {novo.escopo === "modalidade" && <select className="campo" defaultValue="" onChange={(e) => setNovo({ ...novo, modalidade_id: e.target.value })}><option value="" disabled>Modalidade…</option>{mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>}
          {novo.escopo === "dia" && <input type="date" className="campo" defaultValue={hojeISO()} onChange={(e) => setNovo({ ...novo, data: e.target.value })} />}
          {novo.escopo === "geral" && <span />}
          <div className="flex flex-wrap gap-1.5 sm:col-span-2">
            <span className="self-center text-xs text-suave">Prontos:</span>
            {MODELOS.map((m) => (
              <button key={m.rotulo} type="button" className="chip text-xs" onClick={() => setNovo({ ...novo, titulo: m.titulo, texto: m.texto, enquete: !!m.opcoes, opcoes: m.opcoes || novo.opcoes })}>{m.rotulo}</button>
            ))}
          </div>
          <input className="campo sm:col-span-2" placeholder="Título (ex.: Treino de sábado cancelado)" value={novo.titulo || ""} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          <textarea className="campo min-h-20 sm:col-span-2" placeholder="Texto (opcional)" value={novo.texto || ""} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} />
          <div className="space-y-2 rounded-xl bg-painel2 p-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!novo.enquete} onChange={(e) => setNovo({ ...novo, enquete: e.target.checked, opcoes: novo.opcoes || ["👍 Vou", "👎 Não vou"] })} /> 🗳️ Virar enquete (os alunos respondem com um toque)</label>
            {novo.enquete && (
              <div className="flex flex-wrap items-center gap-2">
                {(novo.opcoes || []).map((o: string, i: number) => (
                  <input key={i} className="campo w-36 py-1.5" value={o} onChange={(e) => { const l = [...novo.opcoes]; l[i] = e.target.value; setNovo({ ...novo, opcoes: l }); }} placeholder={`Opção ${i + 1}`} />
                ))}
                {(novo.opcoes || []).length < 5 && <button type="button" className="chip" onClick={() => setNovo({ ...novo, opcoes: [...(novo.opcoes || []), ""] })}>+ opção</button>}
                {(novo.opcoes || []).length > 2 && <button type="button" className="text-xs text-suave underline" onClick={() => setNovo({ ...novo, opcoes: novo.opcoes.slice(0, -1) })}>tirar a última</button>}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!novo.agendar} onChange={(e) => setNovo({ ...novo, agendar: e.target.checked })} /> ⏰ Agendar (escrever agora e mandar sozinho depois)</label>
            {novo.agendar && (
              <div className="flex flex-wrap gap-2">
                <input type="date" className="campo w-auto" min={hojeISO()} value={novo.quando_data || ""} onChange={(e) => setNovo({ ...novo, quando_data: e.target.value })} />
                <input type="time" className="campo w-auto" value={novo.quando_hora || "08:00"} onChange={(e) => setNovo({ ...novo, quando_hora: e.target.value })} />
                <span className="self-center text-xs text-suave">Os alunos só veem e recebem nessa hora (pode levar até 10 min).</span>
              </div>
            )}
          </div>
          <div><label className="rotulo">Some sozinho em (opcional)</label><input type="date" className="campo" onChange={(e) => setNovo({ ...novo, expira: e.target.value })} /></div>
          <div className="flex flex-col justify-end gap-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => setNovo({ ...novo, fixado: e.target.checked })} /> 📌 Fixar no topo</label>
            <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => setNovo({ ...novo, publico: e.target.checked })} /> 🌐 Mostrar na página pública</label>
          </div>
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>{novo.agendar ? "⏰ Agendar" : novo.enquete ? "🗳️ Publicar enquete" : "Publicar"}</button><button className="btn-sec" onClick={() => setNovo(null)}>Cancelar</button></div>
        </div>
      )}

      <ul className="space-y-2">
        {lista.map((a) => (
          <li key={a.id} className={`rounded-2xl bg-painel p-4 ${expirado(a) ? "opacity-50" : ""}`} style={{ borderLeft: "4px solid var(--cor)" }}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{a.fixado ? "📌 " : ""}{a.titulo}</p>
              <span className="text-xs text-suave">
                {a.escopo === "turma" ? a.turmas?.nome : a.escopo === "modalidade" ? a.modalidades?.nome : a.escopo === "dia" ? `Dia ${dataBR(a.data)}` : "Todos"}
                {a.publico ? " · público" : ""}{a.expira_em ? ` · ${expirado(a) ? "expirou" : "até"} ${dataHoraBR(a.expira_em)}` : ""}
              </span>
            </div>
            {a.texto && <p className="mt-1 whitespace-pre-line text-sm text-suave">{a.texto}</p>}
            {a.publicar_em && new Date(a.publicar_em) > new Date() && <p className="mt-1 text-sm font-semibold text-alerta">⏰ Agendado para {dataHoraBR(a.publicar_em)} — os alunos ainda não veem</p>}
            {a.opcoes?.length > 0 && <ResultadoEnquete avisoId={a.id} equipe />}
            {!(a.publicar_em && new Date(a.publicar_em) > new Date()) && <LeituraAviso avisoId={a.id} />}
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {!(a.publicar_em && new Date(a.publicar_em) > new Date()) && !expirado(a) && <button className="underline" onClick={() => lembrar(a)}>🔔 Lembrar quem ainda não leu</button>}
              <button className="underline" onClick={() => fixar(a)}>{a.fixado ? "Desafixar" : "Fixar"}</button>
              <button className="text-suave underline" onClick={() => apagar(a.id)}>Apagar</button>
            </div>
          </li>
        ))}
        {!lista.length && <p className="text-suave">Nenhum aviso publicado.</p>}
      </ul>
    </div>
  );
}
