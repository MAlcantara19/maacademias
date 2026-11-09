"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";

// Traz alunos de outra academia em que você também dá aula (ex.: da academia
// do Zezinho para o Dojô). O aluno usa o MESMO login nas duas.
export function TrazerAlunos({ jaAqui, onFechar }: { jaAqui: string[]; onFechar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [academias, setAcademias] = useState<Record<string, string>>({});
  const [origem, setOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turma, setTurma] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("painel_alunos").select("membro_id, perfil_id, nome, academia_id, turmas, faixa").neq("academia_id", ctx.academia.id).eq("ativo", true).order("nome");
      setLista((data || []).filter((a: any) => !jaAqui.includes(a.perfil_id)));
      const ids = Array.from(new Set((data || []).map((a: any) => a.academia_id)));
      if (ids.length) {
        const { data: ac } = await sb.from("academias").select("id, nome").in("id", ids);
        setAcademias(Object.fromEntries((ac || []).map((a: any) => [a.id, a.nome])));
      }
      const { data: t } = await sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome");
      setTurmas(t || []);
    })();
  }, []); // eslint-disable-line

  const filtrada = useMemo(() => lista.filter((a) => (!origem || a.academia_id === origem) && (!busca || a.nome.toLowerCase().includes(busca.toLowerCase()))), [lista, origem, busca]);

  async function trazer() {
    if (!marcados.length) return setMsg("Marque pelo menos um aluno.");
    const perfis = Array.from(new Set(lista.filter((a) => marcados.includes(a.membro_id)).map((a) => a.perfil_id)));
    let ok = 0;
    for (const p of perfis) {
      const id = crypto.randomUUID();
      const { error } = await sb.from("membros").insert({ id, academia_id: ctx.academia.id, perfil_id: p, papel: "aluno" });
      if (error) continue;
      ok++;
      if (turma) await sb.from("matriculas").insert({ turma_id: turma, membro_id: id });
    }
    setMsg(`${ok} aluno(s) trazido(s). Eles entram com o mesmo login e trocam de academia pelo menu.`);
    setTimeout(onFechar, 1500);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
      <h2 className="text-2xl font-bold">Trazer alunos de outra academia</h2>
      <p className="text-sm text-suave">Aparecem os alunos das academias em que você é professor ou admin. Os dados de lá (mensalidade, carteirinha) continuam lá; aqui eles ganham o conteúdo desta academia.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="campo" value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Academia de origem">
          <option value="">Todas as academias</option>
          {Object.entries(academias).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <input className="campo" placeholder="Buscar nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="campo" value={turma} onChange={(e) => setTurma(e.target.value)} aria-label="Turma aqui">
          <option value="">Turma aqui: nenhuma</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {filtrada.map((a) => (
          <li key={a.membro_id}>
            <label className="flex items-center gap-3 rounded-xl bg-painel2 p-2">
              <input type="checkbox" checked={marcados.includes(a.membro_id)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, a.membro_id] : marcados.filter((x) => x !== a.membro_id))} />
              <span className="flex-1">{a.nome} <span className="text-xs text-suave">· {academias[a.academia_id]}{a.faixa ? ` · ${a.faixa}` : ""}</span></span>
            </label>
          </li>
        ))}
        {!filtrada.length && <p className="text-sm text-suave">Nenhum aluno disponível.</p>}
      </ul>
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <div className="flex gap-2"><button className="btn" onClick={trazer}>Trazer {marcados.length || ""}</button><button className="btn-sec" onClick={onFechar}>Fechar</button></div>
    </section>
  );
}
