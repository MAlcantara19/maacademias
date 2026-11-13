"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { dataBR, hojeISO, primeiroNome } from "@/lib/util";

const UNIDADES: Record<string, string> = { tempo: "tempo", quantidade: "quantidade", distancia: "metros", pontos: "pontos" };
const fmt = (v: number, u: string) => u === "tempo" ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}` : u === "distancia" ? `${v} m` : String(v);
const MODELOS = [
  { nome: "Parada de mão na parede", unidade: "tempo", melhor: "maior" },
  { nome: "Pular corda (1 minuto)", unidade: "quantidade", melhor: "maior", cada_n: 15 },
  { nome: "Zigue-zague", unidade: "tempo", melhor: "menor" },
  { nome: "Flexões seguidas", unidade: "quantidade", melhor: "maior" },
  { nome: "Uchikomi em 30 segundos", unidade: "quantidade", melhor: "maior" },
  { nome: "Prancha", unidade: "tempo", melhor: "maior" },
];

// Mural de recordes: a academia cria os exercícios e registra as marcas dos alunos
export default function Recordes() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [ex, setEx] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [novoEx, setNovoEx] = useState<any>(null);
  const [registrar, setRegistrar] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function carregar() {
    const [e, m] = await Promise.all([
      sb.from("recordes_exercicios").select("*").eq("academia_id", ctx.academia.id).eq("ativo", true).order("criado_em"),
      sb.rpc("mural_recordes", { p_acad: ctx.academia.id }),
    ]);
    setEx(e.data || []); setMarcas(m.data || []);
  }
  useEffect(() => {
    carregar();
    if (ctx.equipe) sb.from("painel_alunos").select("membro_id, nome, apelido").eq("academia_id", ctx.academia.id).eq("ativo", true).order("nome").then(({ data }) => setAlunos(data || []));
  }, []); // eslint-disable-line

  // melhor marca de cada aluno em cada exercício
  const ranking = useMemo(() => {
    const r: Record<string, any[]> = {};
    for (const e of ex) {
      const melhor = new Map<string, any>();
      for (const m of marcas.filter((x) => x.exercicio_id === e.id)) {
        const atual = melhor.get(m.membro_id);
        if (!atual || (e.melhor === "maior" ? m.valor > atual.valor : m.valor < atual.valor)) melhor.set(m.membro_id, m);
      }
      r[e.id] = Array.from(melhor.values()).sort((a, b) => (e.melhor === "maior" ? b.valor - a.valor : a.valor - b.valor));
    }
    return r;
  }, [ex, marcas]);
  const pontos = (e: any, v: number) => (e.cada_n ? Math.floor(v / e.cada_n) : null);

  async function salvarEx() {
    if (!novoEx?.nome) return setMsg("Dê um nome ao exercício.");
    const { error } = await sb.from("recordes_exercicios").insert({ academia_id: ctx.academia.id, nome: novoEx.nome, descricao: novoEx.descricao || null, unidade: novoEx.unidade || "quantidade", melhor: novoEx.melhor || "maior", cada_n: novoEx.cada_n ? Number(novoEx.cada_n) : null });
    setMsg(error ? error.message : ""); setNovoEx(null); carregar();
  }
  async function salvarMarca() {
    const e = ex.find((x) => x.id === registrar.exercicio_id);
    if (!registrar.membro_id) return setMsg("Escolha o aluno.");
    const valor = e.unidade === "tempo" ? Number(registrar.min || 0) * 60 + Number(registrar.seg || 0) : Number(String(registrar.valor || "").replace(",", "."));
    if (!valor) return setMsg("Informe a marca.");
    const { error } = await sb.from("recordes_marcas").insert({ exercicio_id: e.id, academia_id: ctx.academia.id, membro_id: registrar.membro_id, valor, data: registrar.data || hojeISO(), registrado_por: ctx.membroId });
    setMsg(error ? error.message : "Marca registrada!"); setRegistrar(null); carregar();
  }
  async function arquivar(e: any) { if (confirm(`Tirar “${e.nome}” do mural? As marcas ficam guardadas.`)) { await sb.from("recordes_exercicios").update({ ativo: false }).eq("id", e.id); carregar(); } }

  const medalha = (i: number) => ["🥇", "🥈", "🥉"][i] || `${i + 1}º`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-extrabold">🏆 Mural de recordes</h1>
        {ctx.equipe && <button className="btn" onClick={() => setNovoEx({ unidade: "quantidade", melhor: "maior" })}>+ Exercício</button>}
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}

      {novoEx && (
        <section className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
          <p className="text-sm text-suave">Comece de um modelo ou crie do zero:</p>
          <div className="flex flex-wrap gap-2">{MODELOS.map((m) => <button key={m.nome} className="chip text-xs" onClick={() => setNovoEx({ ...m })}>{m.nome}</button>)}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="campo sm:col-span-2" placeholder="Nome do exercício" value={novoEx.nome || ""} onChange={(e) => setNovoEx({ ...novoEx, nome: e.target.value })} />
            <select className="campo" value={novoEx.unidade} onChange={(e) => setNovoEx({ ...novoEx, unidade: e.target.value })}>
              <option value="quantidade">Conta quantidade (repetições, pulos…)</option><option value="tempo">Conta tempo</option><option value="distancia">Conta distância (metros)</option><option value="pontos">Pontos</option>
            </select>
            <select className="campo" value={novoEx.melhor} onChange={(e) => setNovoEx({ ...novoEx, melhor: e.target.value })}>
              <option value="maior">Quanto MAIOR, melhor</option><option value="menor">Quanto MENOR, melhor (ex.: tempo de prova)</option>
            </select>
            <input className="campo" type="number" placeholder="Pontos: a cada quantos = 1 ponto? (opcional)" value={novoEx.cada_n || ""} onChange={(e) => setNovoEx({ ...novoEx, cada_n: e.target.value })} />
            <input className="campo" placeholder="Regra / como fazer (opcional)" value={novoEx.descricao || ""} onChange={(e) => setNovoEx({ ...novoEx, descricao: e.target.value })} />
          </div>
          <div className="flex gap-2"><button className="btn" onClick={salvarEx}>Criar</button><button className="btn-sec" onClick={() => setNovoEx(null)}>Cancelar</button></div>
        </section>
      )}

      {!ex.length && !novoEx && <p className="text-suave">Nenhum exercício no mural ainda.{ctx.equipe ? " Crie o primeiro (ex.: parada de mão, pular corda, zigue-zague)." : ""}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {ex.map((e) => (
          <section key={e.id} className="space-y-3 rounded-2xl bg-painel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold">{e.nome}</h2>
                <p className="text-xs text-suave">{UNIDADES[e.unidade]} · {e.melhor === "maior" ? "maior é melhor" : "menor é melhor"}{e.cada_n ? ` · a cada ${e.cada_n} = 1 ponto` : ""}</p>
                {e.descricao && <p className="text-sm">{e.descricao}</p>}
              </div>
              {ctx.equipe && <button className="text-xs text-suave underline" onClick={() => arquivar(e)}>tirar</button>}
            </div>
            <ol className="space-y-1.5">
              {(ranking[e.id] || []).slice(0, 10).map((m, i) => (
                <li key={m.marca_id} className={`flex items-center gap-3 rounded-xl p-2 ${i < 3 ? "bg-painel2" : ""}`}>
                  <span className="w-8 text-center text-xl">{medalha(i)}</span>
                  <Avatar foto={m.foto_url} nome={m.nome} tamanho={32} mostrarFaixa={false} />
                  <span className="min-w-0 flex-1 truncate">{m.apelido || primeiroNome(m.nome)}<span className="block text-xs text-suave">{dataBR(m.data)}</span></span>
                  <span className="numero text-xl font-bold">{fmt(Number(m.valor), e.unidade)}</span>
                  {pontos(e, Number(m.valor)) !== null && <span className="chip text-xs">{pontos(e, Number(m.valor))} pts</span>}
                </li>
              ))}
              {!(ranking[e.id] || []).length && <p className="text-sm text-suave">Ninguém registrou ainda.</p>}
            </ol>
            {ctx.equipe && (registrar?.exercicio_id === e.id ? (
              <div className="grid gap-2 rounded-xl border border-linha p-3 sm:grid-cols-2">
                <select className="campo sm:col-span-2" value={registrar.membro_id || ""} onChange={(x) => setRegistrar({ ...registrar, membro_id: x.target.value })}>
                  <option value="">Aluno…</option>{alunos.map((a) => <option key={a.membro_id} value={a.membro_id}>{a.nome}</option>)}
                </select>
                {e.unidade === "tempo" ? (
                  <div className="flex items-center gap-1">
                    <input className="campo" type="number" min={0} placeholder="min" value={registrar.min || ""} onChange={(x) => setRegistrar({ ...registrar, min: x.target.value })} />:
                    <input className="campo" type="number" min={0} max={59} placeholder="seg" value={registrar.seg || ""} onChange={(x) => setRegistrar({ ...registrar, seg: x.target.value })} />
                  </div>
                ) : <input className="campo" inputMode="decimal" placeholder={UNIDADES[e.unidade]} value={registrar.valor || ""} onChange={(x) => setRegistrar({ ...registrar, valor: x.target.value })} />}
                <input className="campo" type="date" value={registrar.data || hojeISO()} onChange={(x) => setRegistrar({ ...registrar, data: x.target.value })} />
                <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvarMarca}>Registrar</button><button className="btn-sec" onClick={() => setRegistrar(null)}>Cancelar</button></div>
              </div>
            ) : <button className="btn-sec text-sm" onClick={() => setRegistrar({ exercicio_id: e.id })}>+ Registrar marca</button>)}
          </section>
        ))}
      </div>
    </div>
  );
}
