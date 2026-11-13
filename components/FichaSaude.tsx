"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

const CONDICOES = ["Asma / bronquite", "Diabetes", "Epilepsia / convulsão", "Problema no coração", "Pressão alta", "Labirintite / desmaios", "Hérnia / problema de coluna", "TDAH / TEA"];

// Ficha de saúde (anamnese): abre e fecha; preenche quem quiser. Só a pessoa,
// o responsável e a equipe dela veem.
export function FichaSaude({ perfilId, saude, podeEditar, onSalvo }: { perfilId: string; saude: any; podeEditar: boolean; onSalvo?: () => void }) {
  const sb = supabaseNavegador();
  const [s, setS] = useState<any>(saude || {});
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState("");
  const muda = (k: string, v: any) => setS((x: any) => ({ ...x, [k]: v }));
  const temAlgo = Object.values(saude || {}).some((v: any) => (Array.isArray(v) ? v.length : !!v));
  const alerta = (saude?.condicoes || []).length > 0 || !!saude?.alergias;

  async function salvar() {
    const { error } = await sb.from("perfis").update({ saude: { ...s, atualizado_em: new Date().toISOString().slice(0, 10) } }).eq("id", perfilId);
    setMsg(error ? error.message : "Salvo."); if (!error) { setEditando(false); onSalvo?.(); }
  }

  if (!editando) {
    return (
      <div className="space-y-2 text-sm">
        {!temAlgo && <p className="text-suave">Ficha de saúde não preenchida.</p>}
        {alerta && <p className="font-semibold text-alerta">⚕️ Atenção: há informação de saúde importante.</p>}
        {saude?.tipo_sanguineo && <p>🩸 Tipo sanguíneo: <b>{saude.tipo_sanguineo}</b></p>}
        {(saude?.condicoes || []).length > 0 && <p>Condições: {saude.condicoes.join(", ")}{saude.condicao_outra ? `, ${saude.condicao_outra}` : ""}</p>}
        {saude?.alergias && <p>Alergias: {saude.alergias}</p>}
        {saude?.medicamentos && <p>Remédios de uso contínuo: {saude.medicamentos}</p>}
        {saude?.lesoes && <p>Lesões / cirurgias: {saude.lesoes}</p>}
        {saude?.liberacao && <p>Liberação médica para treinar: {saude.liberacao}</p>}
        {saude?.plano && <p>Plano de saúde: {saude.plano}</p>}
        {saude?.observacoes && <p>Obs.: {saude.observacoes}</p>}
        {saude?.atualizado_em && <p className="text-xs text-suave">Atualizada em {saude.atualizado_em.split("-").reverse().join("/")}</p>}
        {podeEditar && <button className="btn-sec text-sm" onClick={() => setEditando(true)}>{temAlgo ? "Editar ficha de saúde" : "Preencher ficha de saúde"}</button>}
      </div>
    );
  }
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <label className="rotulo">Tipo sanguíneo</label>
        <select className="campo" value={s.tipo_sanguineo || ""} onChange={(e) => muda("tipo_sanguineo", e.target.value)}>
          <option value="">Não sei</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo">Liberação médica para treinar</label>
        <select className="campo" value={s.liberacao || ""} onChange={(e) => muda("liberacao", e.target.value)}>
          <option value="">Não informado</option><option>Sim, tenho atestado</option><option>Não tenho atestado</option><option>Com restrições</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <span className="rotulo">Tem alguma destas condições?</span>
        <div className="flex flex-wrap gap-2">
          {CONDICOES.map((c) => {
            const on = (s.condicoes || []).includes(c);
            return <button key={c} type="button" className="chip text-xs" onClick={() => muda("condicoes", on ? s.condicoes.filter((x: string) => x !== c) : [...(s.condicoes || []), c])}
              style={on ? { background: "var(--color-alerta)", borderColor: "var(--color-alerta)", color: "#111" } : {}}>{on ? "✓ " : ""}{c}</button>;
          })}
        </div>
        <input className="campo mt-2" placeholder="Outra condição" value={s.condicao_outra || ""} onChange={(e) => muda("condicao_outra", e.target.value)} />
      </div>
      <input className="campo" placeholder="Alergias (remédio, alimento, picada…)" value={s.alergias || ""} onChange={(e) => muda("alergias", e.target.value)} />
      <input className="campo" placeholder="Remédios de uso contínuo" value={s.medicamentos || ""} onChange={(e) => muda("medicamentos", e.target.value)} />
      <input className="campo" placeholder="Lesões ou cirurgias (ex.: joelho em 2024)" value={s.lesoes || ""} onChange={(e) => muda("lesoes", e.target.value)} />
      <input className="campo" placeholder="Plano de saúde (opcional)" value={s.plano || ""} onChange={(e) => muda("plano", e.target.value)} />
      <textarea className="campo min-h-16 sm:col-span-2" placeholder="Algo mais que o professor precisa saber?" value={s.observacoes || ""} onChange={(e) => muda("observacoes", e.target.value)} />
      {msg && <p className="text-alerta sm:col-span-2">{msg}</p>}
      <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setEditando(false)}>Cancelar</button></div>
    </div>
  );
}
