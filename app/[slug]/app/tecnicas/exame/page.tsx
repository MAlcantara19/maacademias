"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, hojeISO } from "@/lib/util";
import { nomeGrupo, ordemGrupo } from "@/lib/tecnicas";
import { Avatar } from "@/components/Avatar";
import { Faixa } from "@/components/Faixa";

// Ficha do exame de faixa: taiso, ukemi e as técnicas da faixa disputada.
// Dá para preencher no celular ou imprimir em branco.
function Exame() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const base = `/${ctx.academia.slug}/app`;
  const [alunos, setAlunos] = useState<any[]>([]);
  const [alunoId, setAlunoId] = useState(params.get("aluno") || "");
  const [mods, setMods] = useState<any[]>([]);
  const [modId, setModId] = useState("");
  const [aluno, setAluno] = useState<any>(null);
  const [faixaAtual, setFaixaAtual] = useState("");
  const [faixaAlvo, setFaixaAlvo] = useState("");
  const [itens, setItens] = useState<any[]>([]);
  const [exame, setExame] = useState<any>({ data: hojeISO(), resultado: "pendente", observacao: "" });
  const [msg, setMsg] = useState("");

  // Abrir um exame já salvo
  useEffect(() => {
    sb.from("modalidades").select("id, nome, graduacoes, cores_graduacoes").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem")
      .then(({ data }) => { setMods(data || []); if (!modId && data?.[0]) setModId(data[0].id); });
    sb.from("painel_alunos").select("membro_id, nome").eq("academia_id", ctx.academia.id).eq("ativo", true).order("nome").then(({ data }) => setAlunos(data || []));
    const id = params.get("exame");
    if (id) sb.from("exames_faixa").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setExame(data); setAlunoId(data.membro_id); setModId(data.modalidade_id);
      setFaixaAtual(data.faixa_atual || ""); setFaixaAlvo(data.faixa_alvo); setItens(data.itens || []);
    });
  }, []); // eslint-disable-line

  // Dados do aluno e faixa atual na modalidade
  useEffect(() => {
    if (!alunoId || !modId) return;
    (async () => {
      const { data: p } = await sb.from("painel_alunos").select("*").eq("membro_id", alunoId).maybeSingle();
      setAluno(p);
      if (exame.id) return;
      const { data: g } = await sb.from("graduacoes").select("faixa, grau, data").eq("membro_id", alunoId).eq("modalidade_id", modId).order("data", { ascending: false }).limit(1);
      const mod = mods.find((m) => m.id === modId);
      const atual = g?.[0]?.faixa || mod?.graduacoes?.[0] || "";
      setFaixaAtual(atual);
      setFaixaAlvo(mod?.graduacoes?.[(mod.graduacoes.indexOf(atual) ?? -1) + 1] || "");
    })();
  }, [alunoId, modId, mods]); // eslint-disable-line

  // Itens do exame = técnicas gerais (taiso/ukemi) + técnicas da faixa disputada
  useEffect(() => {
    if (!modId || !faixaAlvo || exame.id) return;
    sb.from("tecnicas").select("*").eq("modalidade_id", modId).or(`faixa.is.null,faixa.eq.${faixaAlvo}`).order("ordem").then(({ data }) => {
      const l = (data || []).sort((a: any, b: any) => ordemGrupo(a.grupo) - ordemGrupo(b.grupo) || a.ordem - b.ordem);
      setItens(l.map((t: any) => ({ tecnica_id: t.id, grupo: t.grupo, nome: t.nome_original || t.nome, traducao: t.nome_original ? t.nome : null, nota: null })));
    });
  }, [modId, faixaAlvo]); // eslint-disable-line

  const notas = itens.map((i) => i.nota).filter((n) => n !== null && n !== "" && !isNaN(Number(n))).map(Number);
  const media = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
  const mod = mods.find((m) => m.id === modId);
  const corAlvo = mod?.cores_graduacoes?.[mod.graduacoes.indexOf(faixaAlvo)];

  async function salvar() {
    if (!alunoId || !faixaAlvo) return setMsg("Escolha o aluno e a faixa disputada.");
    const dados = {
      academia_id: ctx.academia.id, membro_id: alunoId, modalidade_id: modId, faixa_atual: faixaAtual || null, faixa_alvo: faixaAlvo,
      data: exame.data, itens, nota_final: media, resultado: exame.resultado, observacao: exame.observacao || null, avaliador_id: ctx.membroId,
    };
    const { data, error } = exame.id
      ? await sb.from("exames_faixa").update(dados).eq("id", exame.id).select().single()
      : await sb.from("exames_faixa").insert(dados).select().single();
    if (error) return setMsg(error.message);
    setExame(data); setMsg("Exame salvo.");
  }

  async function graduar() {
    const { error } = await sb.from("graduacoes").insert({
      membro_id: alunoId, modalidade_id: modId, faixa: faixaAlvo, grau: 0, data: exame.data, registrado_por: ctx.membroId,
      observacao: `Aprovado no exame${media != null ? ` (nota ${media})` : ""}`,
    });
    setMsg(error ? error.message : `Graduação registrada: faixa ${faixaAlvo}! 🎉 A moldura da foto já mudou de cor.`);
  }

  const grupos = Array.from(new Set(itens.map((i) => i.grupo)));

  if (!ctx.equipe) return <p className="text-suave">Só a equipe aplica exames. Veja sua matéria em <Link className="underline" href={`${base}/tecnicas`}>Matéria da faixa</Link>.</p>;

  return (
    <div className="space-y-5">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Exame de faixa</h1>
        <div className="flex gap-2">
          <button className="btn-sec" onClick={() => window.print()}>Imprimir</button>
          <button className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
      {msg && <p className="nao-imprimir text-sm text-ok">{msg}</p>}

      <div className="nao-imprimir grid gap-2 sm:grid-cols-4">
        <select className="campo" value={alunoId} onChange={(e) => { setAlunoId(e.target.value); setExame({ data: hojeISO(), resultado: "pendente" }); }} disabled={!!exame.id} aria-label="Aluno">
          <option value="">Escolha o aluno…</option>
          {alunos.map((a) => <option key={a.membro_id} value={a.membro_id}>{a.nome}</option>)}
        </select>
        <select className="campo" value={modId} onChange={(e) => setModId(e.target.value)} disabled={!!exame.id} aria-label="Modalidade">
          {mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <select className="campo" value={faixaAlvo} onChange={(e) => setFaixaAlvo(e.target.value)} disabled={!!exame.id} aria-label="Faixa disputada">
          {(mod?.graduacoes || []).map((f: string) => <option key={f} value={f}>Disputando: {f}</option>)}
        </select>
        <input type="date" className="campo" value={exame.data} onChange={(e) => setExame({ ...exame, data: e.target.value })} aria-label="Data" />
      </div>

      {/* Cabeçalho da ficha */}
      <section className="imprimir-claro flex items-center gap-4 rounded-2xl bg-painel p-4">
        {aluno && <Avatar foto={aluno.foto_url} nome={aluno.nome} cor={aluno.cor_faixa} grau={aluno.grau} tamanho={64} />}
        <div className="flex-1">
          <p className="text-sm text-suave">{ctx.academia.nome} · {mod?.nome} · {dataBR(exame.data)}</p>
          <h2 className="text-3xl font-extrabold">{aluno?.nome || "Aluno: ____________________"}</h2>
          <p>Faixa atual: <b>{faixaAtual || "—"}</b> → disputando: <b>{faixaAlvo || "—"}</b></p>
          {faixaAlvo && <Faixa cor={corAlvo} altura={8} className="mt-1 max-w-xs" />}
        </div>
        <div className="text-center">
          <p className="numero text-5xl font-bold">{media ?? "—"}</p>
          <p className="text-xs text-suave">média</p>
        </div>
      </section>

      {grupos.map((g) => (
        <section key={g} className="imprimir-claro break-inside-avoid rounded-2xl bg-painel p-4">
          <h3 className="mb-2 text-xl font-bold">{nomeGrupo(g)}</h3>
          <ul className="divide-y divide-linha">
            {itens.map((it, i) => it.grupo !== g ? null : (
              <li key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <p className="font-semibold">{it.nome}</p>
                  {it.traducao && <p className="text-xs text-suave">{it.traducao}</p>}
                </div>
                <div className="nao-imprimir flex gap-1">
                  {[5, 7, 10].map((n) => (
                    <button key={n} className="h-9 w-9 rounded-lg border border-linha text-sm" style={Number(it.nota) === n ? { background: "var(--cor)" } : {}}
                      onClick={() => setItens(itens.map((x, k) => (k === i ? { ...x, nota: n } : x)))}>{n}</button>
                  ))}
                  <input className="campo w-16 text-center" type="number" min={0} max={10} step="0.5" value={it.nota ?? ""} aria-label={`Nota ${it.nome}`}
                    onChange={(e) => setItens(itens.map((x, k) => (k === i ? { ...x, nota: e.target.value === "" ? null : Number(e.target.value) } : x)))} />
                </div>
                <span className="hidden w-24 border-b border-gray-400 print:block">&nbsp;</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!itens.length && <p className="text-suave">Cadastre as técnicas desta faixa em <Link className="underline" href={`${base}/tecnicas`}>Técnicas</Link> para montar a ficha.</p>}

      <section className="imprimir-claro space-y-3 rounded-2xl bg-painel p-4">
        <div className="flex flex-wrap gap-2">
          {[["aprovado", "✅ Aprovado"], ["reprovado", "❌ Refazer"], ["pendente", "⏳ Pendente"]].map(([k, v]) => (
            <button key={k} className="chip py-2" onClick={() => setExame({ ...exame, resultado: k })} style={exame.resultado === k ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{v}</button>
          ))}
        </div>
        <textarea className="campo min-h-20" placeholder="Observações do avaliador" value={exame.observacao || ""} onChange={(e) => setExame({ ...exame, observacao: e.target.value })} />
        <div className="hidden pt-10 text-center text-sm print:block">_______________________________<br />Avaliador</div>
        {exame.id && exame.resultado === "aprovado" && <button className="nao-imprimir btn" onClick={graduar}>🎉 Registrar a faixa {faixaAlvo}</button>}
      </section>
    </div>
  );
}

export default function Pagina() {
  return <Suspense><Exame /></Suspense>;
}
