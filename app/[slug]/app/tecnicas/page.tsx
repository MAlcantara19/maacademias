"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CLASSIFICACOES, GRUPOS, corConjunto, nomeGrupo, ordemGrupo } from "@/lib/tecnicas";
import { Faixa } from "@/components/Faixa";
import { BotaoFalar } from "@/components/Falar";

// Banco de técnicas por faixa: a "matéria" de cada exame
export default function Tecnicas() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [mods, setMods] = useState<any[]>([]);
  const [modId, setModId] = useState("");
  const [lista, setLista] = useState<any[]>([]);
  const [minhas, setMinhas] = useState<Record<string, string>>({}); // modalidade → faixa atual (aluno)
  const [form, setForm] = useState<any>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string>("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    sb.from("modalidades").select("id, nome, graduacoes, cores_graduacoes").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem")
      .then(({ data }) => { setMods(data || []); if (data?.[0]) setModId(data[0].id); });
    if (!ctx.equipe && ctx.meusAlunos[0]) {
      sb.from("graduacoes").select("modalidade_id, faixa, data").eq("membro_id", ctx.meusAlunos[0].id).order("data")
        .then(({ data }) => setMinhas(Object.fromEntries((data || []).map((g: any) => [g.modalidade_id, g.faixa]))));
    }
  }, []); // eslint-disable-line

  async function carregar() {
    if (!modId) return;
    const { data } = await sb.from("tecnicas").select("*").eq("modalidade_id", modId).order("ordem");
    setLista(data || []);
  }
  useEffect(() => { carregar(); }, [modId]); // eslint-disable-line

  const mod = mods.find((m) => m.id === modId);
  const faixas: string[] = mod?.graduacoes || [];
  const cor = (f: string) => mod?.cores_graduacoes?.[faixas.indexOf(f)];
  const minhaFaixa = minhas[modId];
  const minhaAlvo = minhaFaixa ? faixas[faixas.indexOf(minhaFaixa) + 1] : faixas[1];

  const porFaixa = useMemo(() => {
    const grupos: [string, any[]][] = [["", lista.filter((t) => !t.faixa)]];
    faixas.forEach((f) => grupos.push([f, lista.filter((t) => t.faixa === f)]));
    return grupos.filter(([, l]) => l.length);
  }, [lista, faixas]);

  async function salvar() {
    if (!form?.nome || !form?.grupo) return setMsg("Preencha o nome e o grupo.");
    const dados = { academia_id: ctx.academia.id, modalidade_id: modId, faixa: form.faixa || null, grupo: form.grupo, nome: form.nome,
      nome_original: form.nome_original || null, descricao: form.descricao || null, video_url: form.video_url || null, ordem: Number(form.ordem || 0),
      imagem_url: form.imagem_url || null, classificacao: form.classificacao || null, conjunto: form.conjunto || null, kana: form.kana || null };
    const { error } = form.id ? await sb.from("tecnicas").update(dados).eq("id", form.id) : await sb.from("tecnicas").insert(dados);
    setMsg(error ? error.message : "Técnica salva."); setForm(null); carregar();
  }
  async function apagar(t: any) {
    if (!confirm(`Apagar ${t.nome_original || t.nome}?`)) return;
    await sb.from("tecnicas").delete().eq("id", t.id); carregar();
  }

  // Importa uma lista colada (planilha/CSV): faixa;grupo;nome;nome original;descrição;vídeo
  async function importar() {
    if (!csv) return;
    const linhas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = linhas[0]?.includes(";") ? ";" : linhas[0]?.includes("\t") ? "\t" : ",";
    const dados = linhas
      .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")))
      .filter((c) => c[2] && !/^nome$/i.test(c[2]))
      .map((c, i) => ({
        academia_id: ctx.academia.id, modalidade_id: modId, faixa: c[0] || null, grupo: (c[1] || "outro").toLowerCase(),
        nome: c[2], nome_original: c[3] || null, descricao: c[4] || null, video_url: c[5] || null, ordem: i + 1,
      }));
    if (!dados.length) return setMsg("Nenhuma linha válida encontrada.");
    const { error } = await sb.from("tecnicas").insert(dados);
    setMsg(error ? error.message : `${dados.length} técnicas importadas.`); setCsv(null); carregar();
  }

  // Copiar o programa para outra academia em que você também é admin (ex.: projeto social)
  const [copia, setCopia] = useState<any>(null);
  async function abrirCopia() {
    const { data } = await sb.from("modalidades").select("id, nome, academias(nome)").neq("academia_id", ctx.academia.id);
    setCopia({ destinos: data || [], destino: "" });
  }
  async function copiar() {
    if (!copia?.destino) return;
    const { data, error } = await sb.rpc("copiar_tecnicas", { p_origem: modId, p_destino: copia.destino, p_substituir: !!copia.substituir });
    setMsg(error ? error.message : `${data} técnicas copiadas.`); setCopia(null);
  }

  const Item = ({ t }: { t: any }) => (
    <li className="rounded-xl bg-painel2" style={{ borderLeft: `5px solid ${corConjunto(t.conjunto)}` }}>
      <button className="flex w-full items-center justify-between gap-2 p-3 text-left" onClick={() => setAberta(aberta === t.id ? "" : t.id)}>
        <span className="flex items-center gap-2"><b>{t.nome_original || t.nome}</b>{t.nome_original && <BotaoFalar texto={t.nome_original} kana={t.kana} />}{t.nome_original && <span className="text-sm text-suave">{t.nome}</span>}</span>
        {t.video_url && <span aria-hidden>▶️</span>}
      </button>
      {aberta === t.id && (
        <div className="space-y-2 px-3 pb-3 text-sm">
          {t.imagem_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.imagem_url} alt={t.nome} className="max-h-72 rounded-lg" />
          )}
          {(t.conjunto || t.classificacao) && <p className="text-xs text-suave">{[t.conjunto, CLASSIFICACOES[t.classificacao]].filter(Boolean).join(" · ")}</p>}
          {t.descricao && <p className="text-suave">{t.descricao}</p>}
          {t.video_url && <a href={t.video_url} target="_blank" className="btn-sec text-sm">Ver vídeo</a>}
          {ctx.equipe && (
            <div className="flex gap-3">
              <button className="underline" onClick={() => setForm({ ...t })}>editar</button>
              <button className="text-suave underline" onClick={() => apagar(t)}>apagar</button>
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">{ctx.equipe ? "Técnicas e exames" : "Matéria da faixa"}</h1>
        {ctx.equipe && (
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setForm({ grupo: "nage-waza", faixa: faixas[1] || "" })}>Nova técnica</button>
            <button className="btn-sec" onClick={() => setCsv("")}>Importar lista</button>
            <Link className="btn-sec" href={`${base}/tecnicas/exame`}>Exame de faixa</Link>
            <Link className="btn-sec" href={`${base}/tecnicas/roleta`}>🎯 Roleta</Link>
            {ctx.admin && <button className="btn-sec" onClick={abrirCopia}>Copiar para outra academia</button>}
          </div>
        )}
        {!ctx.equipe && <Link className="btn" href={`${base}/tecnicas/roleta`}>🎯 Roleta</Link>}
      </div>

      <div className="flex flex-wrap gap-2">
        {mods.map((m) => (
          <button key={m.id} className="chip py-2" onClick={() => setModId(m.id)} style={m.id === modId ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}>{m.nome}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {copia && (
        <section className="space-y-2 rounded-2xl border border-linha bg-painel p-4">
          <p className="font-semibold">Copiar as técnicas de {mod?.nome} para:</p>
          <select className="campo" value={copia.destino} onChange={(e) => setCopia({ ...copia, destino: e.target.value })}>
            <option value="">Escolha a academia e a modalidade…</option>
            {copia.destinos.map((d: any) => <option key={d.id} value={d.id}>{d.academias?.nome} — {d.nome}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" onChange={(e) => setCopia({ ...copia, substituir: e.target.checked })} /> Apagar as técnicas que já existem lá antes</label>
          <p className="text-xs text-suave">O conteúdo só vai para academias em que você também é admin. Ninguém de fora vê suas técnicas.</p>
          <div className="flex gap-2"><button className="btn" onClick={copiar}>Copiar</button><button className="btn-sec" onClick={() => setCopia(null)}>Cancelar</button></div>
        </section>
      )}

      {csv !== null && (
        <section className="space-y-2 rounded-2xl border border-linha bg-painel p-4">
          <p className="font-semibold">Importar técnicas para {mod?.nome}</p>
          <p className="text-sm text-suave">Cole da planilha (uma técnica por linha), na ordem: <b>faixa ; grupo ; nome ; nome original ; descrição ; link do vídeo</b>. Faixa vazia = vale para todas.</p>
          <textarea className="campo min-h-40 font-mono text-xs" placeholder={"Azul;nage-waza;Varrida no pé;De-ashi-harai;;https://youtu.be/...\n;ukemi;Queda para trás;Ushiro-ukemi;;"} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="flex gap-2"><button className="btn" onClick={importar}>Importar</button><button className="btn-sec" onClick={() => setCsv(null)}>Cancelar</button></div>
        </section>
      )}

      {form && (
        <section className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <select className="campo" value={form.faixa || ""} onChange={(e) => setForm({ ...form, faixa: e.target.value })}>
            <option value="">Todas as faixas (taiso, ukemi…)</option>
            {faixas.map((f) => <option key={f} value={f}>Exame para faixa {f}</option>)}
          </select>
          <select className="campo" value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })}>
            {Object.entries(GRUPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="campo" placeholder="Nome original (ex.: O-soto-gari)" value={form.nome_original || ""} onChange={(e) => setForm({ ...form, nome_original: e.target.value })} />
          <input className="campo" placeholder="Nome em português" value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Descrição / pontos de atenção" value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <input className="campo" placeholder="Link do vídeo (YouTube, Drive…)" value={form.video_url || ""} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
          <input className="campo" type="number" placeholder="Ordem" value={form.ordem ?? ""} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
          <select className="campo" value={form.classificacao || ""} onChange={(e) => setForm({ ...form, classificacao: e.target.value })}>
            <option value="">Classificação (para a roleta)…</option>
            {Object.entries(CLASSIFICACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="campo" list="conjuntos" placeholder="Grupo/cor (ex.: 1º grupo, 6º grupo, Shinmeisho)" value={form.conjunto || ""} onChange={(e) => setForm({ ...form, conjunto: e.target.value })} />
          <datalist id="conjuntos">{["1º grupo", "2º grupo", "3º grupo", "4º grupo", "5º grupo", "6º grupo", "Shinmeisho", "Extras", "Katame-waza", "Kata"].map((c) => <option key={c} value={c} />)}</datalist>
          <input className="campo" placeholder="Escrita em japonês para o áudio (opcional)" value={form.kana || ""} onChange={(e) => setForm({ ...form, kana: e.target.value })} />
          <input className="campo" placeholder="Link da imagem/ficha da técnica (opcional)" value={form.imagem_url || ""} onChange={(e) => setForm({ ...form, imagem_url: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
        </section>
      )}

      {!ctx.equipe && minhaAlvo && (
        <p className="rounded-2xl p-4" style={{ background: "var(--cor)" }}>
          Sua faixa em {mod?.nome}: <b>{minhaFaixa || "—"}</b>. Sua matéria é a da faixa <b>{minhaAlvo}</b> 👇
        </p>
      )}

      {porFaixa.map(([f, l]) => {
        const destaque = !ctx.equipe && f === minhaAlvo;
        return (
          <section key={f || "geral"} className={`rounded-2xl bg-painel p-4 ${destaque ? "ring-2 ring-[var(--cor)]" : ""}`}>
            <h2 className="text-2xl font-bold">{f ? `Exame para faixa ${f}` : "Todas as faixas"}</h2>
            {f && <Faixa cor={cor(f)} altura={8} className="mb-3 mt-1 max-w-xs" />}
            {Array.from(new Set(l.map((t: any) => t.grupo))).sort((a: any, b: any) => ordemGrupo(a) - ordemGrupo(b)).map((g: any) => (
              <div key={g} className="mt-3">
                <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-suave">{nomeGrupo(g)}</h3>
                <ul className="space-y-1.5">{l.filter((t: any) => t.grupo === g).map((t: any) => <Item key={t.id} t={t} />)}</ul>
              </div>
            ))}
          </section>
        );
      })}
      {!lista.length && <p className="text-suave">Nenhuma técnica cadastrada para {mod?.nome || "esta modalidade"}.{ctx.equipe ? " Use “Importar lista” para trazer do Dojô." : ""}</p>}
    </div>
  );
}
