"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR } from "@/lib/util";

// Ficha de saúde (anamnese). Fica numa tabela só dela: veem apenas a pessoa,
// o responsável e os professores/admin da pessoa. Renovação anual.
const SIM_NAO: [string, string][] = [
  ["cardiaco", "Problema cardíaco"], ["respiratorio", "Problema respiratório (asma, bronquite…)"],
  ["convulsao", "Histórico de convulsão / epilepsia"], ["ortopedico", "Problema ortopédico (coluna, joelho…)"],
];

export function FichaSaude({ perfilId, podeEditar, onSalvo }: { perfilId: string; podeEditar: boolean; onSalvo?: () => void }) {
  const sb = supabaseNavegador();
  const [ficha, setFicha] = useState<any>(undefined);
  const [emerg, setEmerg] = useState<any>({});
  const [s, setS] = useState<any>({});
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const [{ data: f }, { data: p }] = await Promise.all([
      sb.from("fichas_saude").select("*").eq("perfil_id", perfilId).maybeSingle(),
      sb.from("perfis").select("contato_emergencia_nome, contato_emergencia_tel").eq("id", perfilId).maybeSingle(),
    ]);
    setFicha(f || null); setS(f?.dados || {}); setEmerg(p || {});
  }
  useEffect(() => { carregar(); }, [perfilId]); // eslint-disable-line
  const muda = (k: string, v: any) => setS((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    if (!emerg.contato_emergencia_tel) return setMsg("Informe o telefone de emergência.");
    const validade = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const r1 = await sb.from("fichas_saude").upsert({ perfil_id: perfilId, dados: s, atualizado_em: new Date().toISOString(), validade }, { onConflict: "perfil_id" });
    const r2 = await sb.from("perfis").update({ contato_emergencia_nome: emerg.contato_emergencia_nome || null, contato_emergencia_tel: emerg.contato_emergencia_tel || null }).eq("id", perfilId);
    const erro = r1.error || r2.error;
    setMsg(erro ? erro.message : "Ficha de saúde salva. Vale por 1 ano.");
    if (!erro) { setEditando(false); carregar(); onSalvo?.(); }
  }

  if (ficha === undefined) return <p className="text-sm text-suave">Carregando…</p>;
  const d = ficha?.dados || {};
  const alertas = SIM_NAO.filter(([k]) => d[k] === "sim").map(([, r]) => r);
  const vencida = ficha?.validade && ficha.validade < new Date().toISOString().slice(0, 10);

  if (!editando) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-xs text-suave">🔒 Visível só para o aluno, o responsável e os professores dele.</p>
        {!ficha && <p className="text-suave">Ficha de saúde não preenchida.</p>}
        {vencida && <p className="font-semibold text-alerta">⏰ Ficha vencida em {dataBR(ficha.validade)}: precisa renovar.</p>}
        {(alertas.length > 0 || d.alergias || d.restricoes) && <p className="font-semibold text-alerta">⚕️ Atenção: há informação de saúde importante.</p>}
        {d.tipo_sanguineo && <p>🩸 Tipo sanguíneo: <b>{d.tipo_sanguineo}</b></p>}
        {alertas.length > 0 && <p>{alertas.join(" · ")}{d.detalhe_condicoes ? ` — ${d.detalhe_condicoes}` : ""}</p>}
        {d.condicoes && <p>Doenças/condições: {d.condicoes}</p>}
        {d.alergias && <p>Alergias: {d.alergias}</p>}
        {d.medicamentos && <p>Remédios de uso contínuo: {d.medicamentos}</p>}
        {d.lesoes && <p>Lesões anteriores: {d.lesoes}</p>}
        {d.cirurgias && <p>Cirurgias: {d.cirurgias}</p>}
        {d.restricoes && <p>Restrições médicas: {d.restricoes}</p>}
        {d.observacoes && <p>Observações: {d.observacoes}</p>}
        {(emerg.contato_emergencia_nome || emerg.contato_emergencia_tel) && <p>🚑 Emergência: {emerg.contato_emergencia_nome} {emerg.contato_emergencia_tel}</p>}
        {ficha?.atualizado_em && <p className="text-xs text-suave">Atualizada em {dataBR(ficha.atualizado_em)} · válida até {dataBR(ficha.validade)}</p>}
        {podeEditar && <button className="btn-sec text-sm" onClick={() => setEditando(true)}>{ficha ? (vencida ? "Renovar ficha de saúde" : "Editar ficha de saúde") : "Preencher ficha de saúde"}</button>}
        {msg && <p className="text-suave">{msg}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <label className="rotulo">Tipo sanguíneo</label>
        <select className="campo" value={s.tipo_sanguineo || ""} onChange={(e) => muda("tipo_sanguineo", e.target.value)}>
          <option value="">Não sei</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div><label className="rotulo">Plano de saúde (opcional)</label><input className="campo" value={s.plano || ""} onChange={(e) => muda("plano", e.target.value)} /></div>
      {SIM_NAO.map(([k, r]) => (
        <div key={k} className="flex items-center justify-between gap-2 rounded-xl bg-painel2 p-2 sm:col-span-1">
          <span>{r}</span>
          <span className="flex shrink-0 gap-1">
            {["nao", "sim"].map((v) => (
              <button key={v} type="button" className="chip px-3 text-xs" onClick={() => muda(k, v)}
                style={s[k] === v ? { background: v === "sim" ? "var(--color-alerta)" : "var(--color-ok)", borderColor: "transparent", color: "#111" } : {}}>{v === "sim" ? "Sim" : "Não"}</button>
            ))}
          </span>
        </div>
      ))}
      {SIM_NAO.some(([k]) => s[k] === "sim") && <input className="campo sm:col-span-2" placeholder="Explique os itens marcados “Sim”" value={s.detalhe_condicoes || ""} onChange={(e) => muda("detalhe_condicoes", e.target.value)} />}
      <input className="campo" placeholder="Outras doenças ou condições preexistentes" value={s.condicoes || ""} onChange={(e) => muda("condicoes", e.target.value)} />
      <input className="campo" placeholder="Alergias (remédio, alimento, picada…)" value={s.alergias || ""} onChange={(e) => muda("alergias", e.target.value)} />
      <input className="campo" placeholder="Remédios de uso contínuo" value={s.medicamentos || ""} onChange={(e) => muda("medicamentos", e.target.value)} />
      <input className="campo" placeholder="Lesões anteriores" value={s.lesoes || ""} onChange={(e) => muda("lesoes", e.target.value)} />
      <input className="campo" placeholder="Cirurgias anteriores" value={s.cirurgias || ""} onChange={(e) => muda("cirurgias", e.target.value)} />
      <input className="campo" placeholder="Restrições médicas (o que não pode fazer)" value={s.restricoes || ""} onChange={(e) => muda("restricoes", e.target.value)} />
      <textarea className="campo min-h-16 sm:col-span-2" placeholder="Observações importantes" value={s.observacoes || ""} onChange={(e) => muda("observacoes", e.target.value)} />
      <div><label className="rotulo">Contato de emergência</label><input className="campo" placeholder="Nome" value={emerg.contato_emergencia_nome || ""} onChange={(e) => setEmerg({ ...emerg, contato_emergencia_nome: e.target.value })} /></div>
      <div><label className="rotulo">Telefone de emergência *</label><input className="campo" type="tel" placeholder="(24) 99999-9999" value={emerg.contato_emergencia_tel || ""} onChange={(e) => setEmerg({ ...emerg, contato_emergencia_tel: e.target.value })} /></div>
      {msg && <p className="text-alerta sm:col-span-2">{msg}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Salvar ficha de saúde</button><button className="btn-sec" onClick={() => setEditando(false)}>Cancelar</button></div>
    </div>
  );
}
