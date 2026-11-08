"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { FAIXAS_ETARIAS, dataBR, primeiroNome, whatsapp } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Barra } from "@/components/Grafico";
import { NovoAluno } from "./NovoAluno";

const ORDENS: Record<string, string> = {
  nome: "Nome (A–Z)", idade: "Idade", dias_sem_vir: "Dias sem vir", frequencia_30d: "Frequência", aluno_desde: "Aluno desde",
};

function Lista() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const base = `/${ctx.academia.slug}/app`;
  const [todos, setTodos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("ativos");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [turma, setTurma] = useState("");
  const [filtro, setFiltro] = useState("");
  const [ordem, setOrdem] = useState(params.get("ordem") || "nome");
  const [novo, setNovo] = useState(false);

  async function carregar() {
    const { data } = await sb.from("painel_alunos").select("*").eq("academia_id", ctx.academia.id);
    setTodos(data || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const turmas = useMemo(() => Array.from(new Set(todos.flatMap((a) => a.turmas || []))).sort(), [todos]);

  const lista = useMemo(() => {
    const t = busca.toLowerCase();
    const l = todos.filter((a) =>
      (situacao === "todos" || (situacao === "ativos" ? a.ativo : !a.ativo)) &&
      (!t || a.nome.toLowerCase().includes(t) || (a.apelido || "").toLowerCase().includes(t)) &&
      (!faixaEtaria || a.faixa_etaria === faixaEtaria) &&
      (!turma || (a.turmas || []).includes(turma)) &&
      (!filtro ||
        (filtro === "sumidos" && (a.dias_sem_vir ?? 0) >= (ctx.academia.alerta_dias_sem_vir || 7) && !a.afastado) ||
        (filtro === "atrasados" && a.mensalidades_atrasadas > 0) ||
        (filtro === "pendencias" && a.pendencias_abertas > 0) ||
        (filtro === "sem_login" && !a.tem_login) ||
        (filtro === "afastados" && a.afastado) ||
        (filtro === "sem_carteirinha" && !a.carteirinha_ok))
    );
    const dir = ordem === "dias_sem_vir" || ordem === "frequencia_30d" ? -1 : 1;
    return l.sort((x, y) => {
      const a = x[ordem], b = y[ordem];
      if (a == null) return 1; if (b == null) return -1;
      return (typeof a === "string" ? a.localeCompare(b) : a - b) * dir;
    });
  }, [todos, busca, situacao, faixaEtaria, turma, filtro, ordem, ctx.academia.alerta_dias_sem_vir]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold">Alunos</h1>
          <p className="text-suave">{lista.length} de {todos.length} cadastrados</p>
        </div>
        <button className="btn" onClick={() => setNovo(true)}>Cadastrar aluno</button>
      </div>

      {novo && <NovoAluno onFechar={() => { setNovo(false); carregar(); }} />}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input className="campo sm:col-span-3 lg:col-span-2" placeholder="Buscar por nome ou apelido" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="campo" value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
          <option value="ativos">Ativos</option><option value="inativos">Saíram</option><option value="todos">Todos</option>
        </select>
        <select className="campo" value={faixaEtaria} onChange={(e) => setFaixaEtaria(e.target.value)} aria-label="Faixa etária">
          <option value="">Todas as idades</option>
          {FAIXAS_ETARIAS.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select className="campo" value={turma} onChange={(e) => setTurma(e.target.value)} aria-label="Turma">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="campo" value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar">
          {Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>Ordenar: {v}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {[["", "Sem filtro"], ["sumidos", "👀 Sumidos"], ["afastados", "🩹 Afastados"], ["pendencias", "📌 Com pendência"], ["atrasados", "💳 Mensalidade atrasada"], ["sem_carteirinha", "🪪 Sem carteirinha"], ["sem_login", "🔑 Sem login"]].map(([k, v]) => (
          <button key={k} onClick={() => setFiltro(k)} className="chip" style={filtro === k ? { borderColor: "var(--cor)", background: "var(--cor)" } : {}}>{v}</button>
        ))}
      </div>

      <ul className="space-y-2">
        {lista.map((a) => {
          const z = whatsapp(a.whatsapp, `Oi, ${primeiroNome(a.apelido || a.nome)}! Aqui é da ${ctx.academia.nome}.`);
          return (
            <li key={a.membro_id} className={`flex items-center gap-3 rounded-2xl bg-painel p-3 ${!a.ativo ? "opacity-60" : ""}`}>
              <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={48} />
              <Link href={`${base}/alunos/${a.membro_id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {a.nome}{a.apelido && <span className="text-suave"> “{a.apelido}”</span>}
                </p>
                <p className="truncate text-sm text-suave">
                  {a.idade != null ? `${a.idade} anos · ` : ""}{(a.turmas || []).join(", ") || "sem turma"}
                </p>
                <p className="text-xs text-suave">
                  {a.ativo ? `Aluno desde ${dataBR(a.aluno_desde)}` : `Saiu em ${dataBR(a.saiu_em)}${a.motivo_saida ? ` (${a.motivo_saida})` : ""}`}
                  {a.ultima_aula ? ` · última aula ${dataBR(a.ultima_aula)}` : ""}
                  {a.dias_sem_vir != null && a.dias_sem_vir >= (ctx.academia.alerta_dias_sem_vir || 7) && a.ativo ? ` · ⚠️ ${a.dias_sem_vir} dias sem vir` : ""}
                  {a.afastado ? " · 🩹 afastado" : ""}
                  {a.pendencias_abertas > 0 ? ` · 📌 ${a.pendencias_abertas}` : ""}
                  {a.mensalidades_atrasadas > 0 ? ` · 💳 ${a.mensalidades_atrasadas}` : ""}
                </p>
                <div className="mt-1.5 max-w-48"><Barra pct={a.frequencia_30d} /></div>
              </Link>
              <div className="flex flex-col items-end gap-1">
                <span className="numero text-lg font-bold">{a.frequencia_30d ?? "—"}%</span>
                {z && <a href={z} target="_blank" className="btn-sec px-3 py-1.5 text-xs">WhatsApp</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Pagina() {
  return <Suspense><Lista /></Suspense>;
}
