"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";

// Cadastro rápido: o aluno cria o login depois com o mesmo e-mail
// (o sistema liga a conta ao cadastro sozinho).
export function NovoAluno({ onFechar }: { onFechar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [f, setF] = useState<any>({ sexo: "M", turmas: [] as string[] });
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
  }, []); // eslint-disable-line

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setMsg("");
    const perfilId = crypto.randomUUID();
    const membroId = crypto.randomUUID();
    const r1 = await sb.from("perfis").insert({
      id: perfilId, nome: f.nome, apelido: f.apelido || null, email: f.email || null, telefone: f.telefone || null,
      nascimento: f.nascimento || null, sexo: f.sexo,
    });
    if (r1.error) { setSalvando(false); return setMsg("Erro ao salvar: " + r1.error.message); }
    const r2 = await sb.from("membros").insert({ id: membroId, academia_id: ctx.academia.id, perfil_id: perfilId, papel: "aluno" });
    if (r2.error) { setSalvando(false); return setMsg("Erro ao vincular: " + r2.error.message); }
    if (f.turmas.length) await sb.from("matriculas").insert(f.turmas.map((t: string) => ({ turma_id: t, membro_id: membroId })));
    setSalvando(false);
    onFechar();
  }

  const muda = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  return (
    <form onSubmit={salvar} className="grid gap-3 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
      <h2 className="text-2xl font-bold sm:col-span-2">Novo aluno</h2>
      <div><label className="rotulo">Nome completo</label><input required className="campo" value={f.nome || ""} onChange={(e) => muda("nome", e.target.value)} /></div>
      <div><label className="rotulo">Apelido</label><input className="campo" value={f.apelido || ""} onChange={(e) => muda("apelido", e.target.value)} /></div>
      <div><label className="rotulo">E-mail (para o login)</label><input type="email" className="campo" value={f.email || ""} onChange={(e) => muda("email", e.target.value)} /></div>
      <div><label className="rotulo">WhatsApp</label><input type="tel" className="campo" placeholder="5524999999999" value={f.telefone || ""} onChange={(e) => muda("telefone", e.target.value)} /></div>
      <div><label className="rotulo">Nascimento</label><input type="date" className="campo" value={f.nascimento || ""} onChange={(e) => muda("nascimento", e.target.value)} /></div>
      <div>
        <label className="rotulo">Sexo (para as categorias)</label>
        <select className="campo" value={f.sexo} onChange={(e) => muda("sexo", e.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></select>
      </div>
      <div className="sm:col-span-2">
        <span className="rotulo">Turmas</span>
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => {
            const on = f.turmas.includes(t.id);
            return (
              <button type="button" key={t.id} className="chip" style={on ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}
                onClick={() => muda("turmas", on ? f.turmas.filter((x: string) => x !== t.id) : [...f.turmas, t.id])}>
                {on ? "✓ " : ""}{t.nome}
              </button>
            );
          })}
        </div>
      </div>
      {msg && <p className="text-sm text-alerta sm:col-span-2">{msg}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn" disabled={salvando}>{salvando ? "Salvando..." : "Cadastrar"}</button>
        <button type="button" className="btn-sec" onClick={onFechar}>Cancelar</button>
      </div>
    </form>
  );
}
