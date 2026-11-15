"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Formulário de evento do calendário (novo ou editar) com botão de apagar.
// Serve para campeonato, prova de faixa, evento, feriado e outros.
function partes(iso?: string | null) {
  if (!iso) return { data: "", hora: "08:00" };
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
  };
}

export function EditarEvento({ academiaId, evento, dataPadrao, mods = [], onFechar, onSalvo }: {
  academiaId: string; evento?: any; dataPadrao?: string; mods?: any[];
  onFechar: () => void; onSalvo: (apagado?: boolean, novoId?: string) => void;
}) {
  const sb = supabaseNavegador();
  const ini = partes(evento?.inicio), pes = partes(evento?.pesagem_em);
  const [f, setF] = useState<any>({
    tipo: evento?.tipo || "evento", titulo: evento?.titulo || "", descricao: evento?.descricao || "",
    data: evento ? ini.data : dataPadrao || "", hora: evento ? ini.hora : "08:00",
    local: evento?.local || "", maps_url: evento?.maps_url || "", link: evento?.link || "",
    modalidade_id: evento?.modalidade_id || "", publico: evento ? evento.publico !== false : true,
    cancela_aulas: !!evento?.cancela_aulas, repetir_anual: !!evento?.repetir_anual, pesagem_data: evento?.pesagem_em ? pes.data : "", pesagem_hora: evento?.pesagem_em ? pes.hora : "",
  });
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [listaMods, setListaMods] = useState<any[]>(mods);
  useEffect(() => {
    if (mods.length) { setListaMods(mods); return; }
    sb.from("modalidades").select("id, nome").eq("academia_id", academiaId).eq("ativa", true).order("ordem").then(({ data }) => setListaMods(data || []));
  }, [academiaId, mods.length]); // eslint-disable-line
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    if (!f.titulo.trim() || !f.data) { setMsg("Preencha o título e a data."); return; }
    setSalvando(true);
    const dados = {
      academia_id: academiaId, tipo: f.tipo, titulo: f.titulo.trim(), descricao: f.descricao.trim() || null,
      inicio: new Date(`${f.data}T${f.hora || "08:00"}:00-03:00`).toISOString(),
      local: f.local.trim() || null, maps_url: f.maps_url.trim() || null, link: f.link.trim() || null,
      modalidade_id: f.modalidade_id || null, publico: !!f.publico, cancela_aulas: !!f.cancela_aulas,
      ...(f.repetir_anual || evento?.repetir_anual !== undefined ? { repetir_anual: !!f.repetir_anual } : {}),
      pesagem_em: f.tipo === "campeonato" && f.pesagem_data ? new Date(`${f.pesagem_data}T${f.pesagem_hora || "08:00"}:00-03:00`).toISOString() : null,
    };
    const { error } = evento?.id ? await sb.from("eventos").update(dados).eq("id", evento.id) : await sb.from("eventos").insert(dados);
    setSalvando(false);
    if (error) { setMsg("Não deu para salvar: " + (error.message.includes("repetir_anual") ? "rode o arquivo ATUALIZAR-23.sql no Supabase para usar “repete todo ano”." : error.message)); return; }
    if (f.repetir_anual) await sb.rpc("gerar_eventos_anuais").then(() => {}, () => {}); // já cria o do ano que vem
    onSalvo();
  }

  // Duplicar (ex.: o campeonato do ano passado): copia tudo, com o cronograma, para a nova data
  const [dup, setDup] = useState<string | null>(null);
  async function duplicar() {
    if (!dup) return;
    const { data, error } = await sb.rpc("copiar_evento", { p_evento: evento.id, p_inicio: new Date(`${dup}T${f.hora || "08:00"}:00-03:00`).toISOString() });
    if (error) { setMsg("Não deu para duplicar: " + error.message); return; }
    setDup(null);
    onSalvo(false, data as string);
  }

  async function apagar() {
    const extra = evento.tipo === "campeonato" ? "\n\nAs inscrições, o cronograma e os recados desse campeonato também somem." : "";
    if (!confirm(`Apagar "${evento.titulo}" do calendário?${extra}\n\nNão dá para desfazer.`)) return;
    const { error } = await sb.from("eventos").delete().eq("id", evento.id);
    if (error) { setMsg("Não deu para apagar: " + error.message); return; }
    onSalvo(true);
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
      <p className="font-bold sm:col-span-2">{evento ? "✏️ Editar evento" : "➕ Novo evento"}</p>
      <label className="text-sm">Tipo
        <select className="campo" value={f.tipo} onChange={(e) => { set("tipo", e.target.value); if (!evento) set("cancela_aulas", e.target.value === "feriado"); }}>
          <option value="evento">Evento</option><option value="campeonato">Campeonato</option><option value="prova">Prova de faixa</option><option value="feriado">Feriado / sem aula</option><option value="outro">Outro</option>
        </select>
      </label>
      <label className="text-sm">Título<input className="campo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Copa Regional" /></label>
      <label className="text-sm">Data<input className="campo" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
      <label className="text-sm">Hora<input className="campo" type="time" value={f.hora} onChange={(e) => set("hora", e.target.value)} /></label>
      <label className="text-sm">Local<input className="campo" value={f.local} onChange={(e) => set("local", e.target.value)} placeholder="Ex.: Ginásio Municipal" /></label>
      <label className="text-sm">Modalidade
        <select className="campo" value={f.modalidade_id} onChange={(e) => set("modalidade_id", e.target.value)}>
          <option value="">Todas as modalidades</option>
          {listaMods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>
      {f.tipo === "campeonato" && <>
        <label className="text-sm">Dia da pesagem (opcional)<input className="campo" type="date" value={f.pesagem_data} onChange={(e) => set("pesagem_data", e.target.value)} /></label>
        <label className="text-sm">Hora da pesagem<input className="campo" type="time" value={f.pesagem_hora} onChange={(e) => set("pesagem_hora", e.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Link do edital / inscrição<input className="campo" value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" /></label>
      </>}
      <label className="text-sm sm:col-span-2">Link do Google Maps (opcional)<input className="campo" value={f.maps_url} onChange={(e) => set("maps_url", e.target.value)} placeholder="https://maps.app.goo.gl/…" /></label>
      <label className="text-sm sm:col-span-2">Descrição<textarea className="campo" rows={2} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.publico} onChange={(e) => set("publico", e.target.checked)} /> Aparece na página pública</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.cancela_aulas} onChange={(e) => set("cancela_aulas", e.target.checked)} /> Não tem aula nesse dia</label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.repetir_anual} onChange={(e) => set("repetir_anual", e.target.checked)} /> 🔁 Repete todo ano (o do ano seguinte aparece sozinho; dá para ajustar a data dele depois)</label>
      {msg && <p className="text-sm text-alerta sm:col-span-2">{msg}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        <button className="btn-sec" onClick={onFechar}>Cancelar</button>
        {evento?.id && dup === null && <button className="btn-sec" onClick={() => setDup("")}>📄 Duplicar</button>}
        {evento?.id && <button className="btn-sec ml-auto text-alerta" onClick={apagar}>🗑️ Apagar evento</button>}
      </div>
      {evento?.id && dup !== null && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-painel2 p-3 sm:col-span-2">
          <label className="text-sm">Nova data da cópia<input className="campo" type="date" value={dup} onChange={(e) => setDup(e.target.value)} /></label>
          <button className="btn" disabled={!dup} onClick={duplicar}>Criar cópia</button>
          <button className="btn-sec" onClick={() => setDup(null)}>Cancelar</button>
          <p className="w-full text-xs text-suave">Copia título (troca o ano), local, links, pesagem e o cronograma, mudando as datas juntas. Inscrições não são copiadas.</p>
        </div>
      )}
    </div>
  );
}
