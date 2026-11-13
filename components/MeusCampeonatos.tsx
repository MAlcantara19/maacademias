"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { comprimir } from "@/lib/imagem";
import { dataBR } from "@/lib/util";

const COLOCACOES = [["ouro", "🥇 Ouro"], ["prata", "🥈 Prata"], ["bronze", "🥉 Bronze"], ["quinto", "5º lugar"], ["participacao", "🎽 Participação"]] as const;
const MAX_FOTOS = 3;

// Histórico de campeonatos do aluno (o próprio aluno ou a equipe registram), com até 3 fotos
export function MeusCampeonatos({ academiaId, membroId, podeEditar }: { academiaId: string; membroId: string; podeEditar: boolean }) {
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await sb.from("campeonatos_aluno").select("*").eq("membro_id", membroId).order("data", { ascending: false });
    setLista(data || []);
    const caminhos = (data || []).flatMap((c: any) => c.fotos || []);
    if (caminhos.length) {
      const { data: assinadas } = await sb.storage.from("privado").createSignedUrls(caminhos, 3600);
      setUrls(Object.fromEntries((assinadas || []).map((x: any) => [x.path, x.signedUrl])));
    }
  }
  useEffect(() => { carregar(); }, [membroId]); // eslint-disable-line

  async function salvar() {
    if (!form.nome?.trim()) return setMsg("Dê o nome do campeonato.");
    setSalvando(true); setMsg("");
    const fotos: string[] = [...(form.fotos || [])];
    for (const arq of (form.novas || []) as File[]) {
      if (fotos.length >= MAX_FOTOS) break;
      const caminho = `${academiaId}/campeonatos/${membroId}-${Date.now()}-${fotos.length}.jpg`;
      const up = await sb.storage.from("privado").upload(caminho, await comprimir(arq, 1400, 0.75));
      if (!up.error) fotos.push(caminho);
    }
    const dados = {
      academia_id: academiaId, membro_id: membroId, nome: form.nome.trim(), data: form.data || null, local: form.local || null,
      categoria: form.categoria || null, colocacao: form.colocacao || null, adversarios: form.adversarios || null, observacao: form.observacao || null, fotos,
    };
    const { error } = form.id ? await sb.from("campeonatos_aluno").update(dados).eq("id", form.id) : await sb.from("campeonatos_aluno").insert(dados);
    setSalvando(false);
    if (error) return setMsg(error.message);
    setForm(null); carregar();
  }
  async function apagar(c: any) {
    if (!confirm(`Apagar “${c.nome}”?`)) return;
    if (c.fotos?.length) await sb.storage.from("privado").remove(c.fotos);
    await sb.from("campeonatos_aluno").delete().eq("id", c.id); carregar();
  }
  async function tirarFoto(c: any, caminho: string) {
    await sb.storage.from("privado").remove([caminho]);
    setForm({ ...form, fotos: (form.fotos || []).filter((x: string) => x !== caminho) });
  }

  const medalha = (k?: string) => COLOCACOES.find(([v]) => v === k)?.[1] || "";
  const resumo = { ouro: lista.filter((c) => c.colocacao === "ouro").length, prata: lista.filter((c) => c.colocacao === "prata").length, bronze: lista.filter((c) => c.colocacao === "bronze").length };

  return (
    <div className="space-y-3">
      {lista.length > 0 && <p className="text-sm">🥇 {resumo.ouro} · 🥈 {resumo.prata} · 🥉 {resumo.bronze} · {lista.length} campeonato(s)</p>}
      {lista.map((c) => (
        <div key={c.id} className="rounded-xl bg-painel2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{medalha(c.colocacao)} {c.nome}</p>
              <p className="text-xs text-suave">{[c.data && dataBR(c.data), c.local, c.categoria].filter(Boolean).join(" · ")}</p>
              {c.adversarios && <p className="mt-1 text-sm">🤼 {c.adversarios}</p>}
              {c.observacao && <p className="text-sm text-suave">{c.observacao}</p>}
            </div>
            {podeEditar && <div className="flex gap-2 text-xs"><button className="underline" onClick={() => setForm({ ...c, novas: [] })}>editar</button><button className="text-suave underline" onClick={() => apagar(c)}>apagar</button></div>}
          </div>
          {c.fotos?.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {c.fotos.map((f: string) => urls[f] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={urls[f]} alt="" loading="lazy" onClick={() => window.open(urls[f], "_blank")} className="aspect-square w-full cursor-zoom-in rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}
      {!lista.length && !form && <p className="text-sm text-suave">Nenhum campeonato registrado ainda.</p>}

      {form ? (
        <div className="grid gap-2 rounded-xl border border-linha p-3 sm:grid-cols-2">
          <input className="campo sm:col-span-2" placeholder="Campeonato * (ex.: Estadual Sub-18)" value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="campo" type="date" value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          <input className="campo" placeholder="Local / cidade" value={form.local || ""} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          <input className="campo" placeholder="Categoria (ex.: Sênior -100 kg)" value={form.categoria || ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <select className="campo" value={form.colocacao || ""} onChange={(e) => setForm({ ...form, colocacao: e.target.value })}>
            <option value="">Resultado…</option>
            {COLOCACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <textarea className="campo min-h-16 sm:col-span-2" placeholder="Adversários (ex.: venci Fulano por ippon, perdi para Ciclano…)" value={form.adversarios || ""} onChange={(e) => setForm({ ...form, adversarios: e.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Observação" value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          {(form.fotos || []).length > 0 && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {form.fotos.map((f: string) => <button key={f} type="button" className="chip text-xs" onClick={() => tirarFoto(form, f)}>🖼️ tirar foto</button>)}
            </div>
          )}
          {(form.fotos || []).length < MAX_FOTOS && (
            <label className="btn-sec cursor-pointer text-sm sm:col-span-2">📷 {form.novas?.length ? `${form.novas.length} foto(s) escolhida(s)` : `Fotos da chave ou do pódio (até ${MAX_FOTOS - (form.fotos || []).length})`}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setForm({ ...form, novas: Array.from(e.target.files || []).slice(0, MAX_FOTOS - (form.fotos || []).length) })} />
            </label>
          )}
          {msg && <p className="text-sm text-alerta sm:col-span-2">{msg}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
        </div>
      ) : podeEditar && <button className="btn-sec text-sm" onClick={() => setForm({ novas: [] })}>+ Campeonato</button>}
    </div>
  );
}
