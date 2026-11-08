"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { abrirAnexo, dataBR, hojeISO } from "@/lib/util";
import { Faixa } from "@/components/Faixa";
import { QR } from "@/components/QR";

function Carteirinha() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const cartao = useRef<HTMLDivElement>(null);
  const [opcoes, setOpcoes] = useState<any[]>(ctx.meusAlunos);
  const [alunoId, setAlunoId] = useState(params.get("aluno") || ctx.meusAlunos[0]?.id || "");
  const [p, setP] = useState<any>(null);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [fed, setFed] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const ano = Number(hojeISO().slice(0, 4));
  const cor = ctx.academia.cores?.primaria || "#7c3aed";

  useEffect(() => {
    if (ctx.equipe) sb.from("painel_alunos").select("membro_id, nome").eq("academia_id", ctx.academia.id).eq("ativo", true).order("nome")
      .then(({ data }) => { setOpcoes((data || []).map((d: any) => ({ id: d.membro_id, nome: d.nome }))); if (!alunoId && data?.[0]) setAlunoId(data[0].membro_id); });
  }, []); // eslint-disable-line

  async function carregar() {
    if (!alunoId) return;
    const { data } = await sb.from("painel_alunos").select("*").eq("membro_id", alunoId).maybeSingle();
    const { data: perfil } = data ? await sb.from("perfis").select("foto_carteirinha_url").eq("id", data.perfil_id).maybeSingle() : { data: null };
    setP(data ? { ...data, foto: perfil?.foto_carteirinha_url || data.foto_url } : null);
    const { data: c } = await sb.from("carteirinhas").select("*").eq("membro_id", alunoId).order("ano", { ascending: false });
    setCartoes(c || []);
  }
  useEffect(() => { carregar(); }, [alunoId]); // eslint-disable-line

  const ativa = cartoes.find((c) => c.tipo === "academia" && c.ativa);

  async function gerarImagem() {
    if (!cartao.current) return null;
    return toPng(cartao.current, { pixelRatio: 3, cacheBust: true });
  }
  async function baixar() {
    const url = await gerarImagem();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = `carteirinha-${(p?.nome || "aluno").replace(/\s+/g, "-").toLowerCase()}-${ano}.png`; a.click();
  }
  async function salvarHistorico() {
    const url = await gerarImagem();
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    const caminho = `${ctx.academia.id}/carteirinhas/${alunoId}-${ano}-${Date.now()}.png`;
    const up = await sb.storage.from("privado").upload(caminho, blob, { contentType: "image/png" });
    if (up.error) return setMsg("Não foi possível salvar a imagem: " + up.error.message);
    const { error } = await sb.from("carteirinhas").insert({
      academia_id: ctx.academia.id, membro_id: alunoId, tipo: "academia", ano, foto_url: p?.foto || null,
      imagem_url: "privado:" + caminho, valida_ate: `${ano}-12-31`,
    });
    setMsg(error ? error.message : `Carteirinha ${ano} salva no histórico.`);
    carregar();
  }
  async function trocarFoto(arquivo?: File) {
    if (!arquivo || !p) return;
    const caminho = `${ctx.academia.id}/fotos/carteirinha-${p.perfil_id}-${Date.now()}.${arquivo.name.split(".").pop()}`;
    const up = await sb.storage.from("publico").upload(caminho, arquivo);
    if (up.error) return setMsg(up.error.message);
    await sb.from("perfis").update({ foto_carteirinha_url: sb.storage.from("publico").getPublicUrl(caminho).data.publicUrl }).eq("id", p.perfil_id);
    carregar();
  }
  async function enviarFederacao() {
    if (!fed?.entidade) return setMsg("Informe a federação.");
    let imagem: string | null = null;
    if (fed.arquivo) {
      const caminho = `${ctx.academia.id}/carteirinhas/federacao-${alunoId}-${Date.now()}.${fed.arquivo.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, fed.arquivo);
      if (up.error) return setMsg(up.error.message);
      imagem = "privado:" + caminho;
    }
    const { error } = await sb.from("carteirinhas").insert({
      academia_id: ctx.academia.id, membro_id: alunoId, tipo: "federacao", entidade: fed.entidade, numero: fed.numero || null,
      ano, valida_ate: fed.valida_ate || null, imagem_url: imagem,
    });
    setMsg(error ? error.message : "Carteirinha da federação enviada.");
    setFed(null); carregar();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Carteirinha</h1>
      {opcoes.length > 1 && (
        <select className="campo max-w-sm" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} aria-label="Aluno">
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      )}

      {p && (
        <>
          {/* O cartão */}
          <div className="overflow-x-auto">
            <div ref={cartao} className="relative w-[340px] overflow-hidden rounded-2xl text-white sm:w-[428px]"
              style={{ aspectRatio: "85.6 / 54", background: `linear-gradient(135deg, #121a36 0%, #121a36 55%, ${cor} 140%)`, fontFamily: "Barlow, sans-serif" }}>
              <div className="flex h-full flex-col p-4">
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif" }} className="text-lg font-extrabold leading-none">{ctx.academia.nome}</span>
                  <span className="numero text-sm font-bold opacity-80">{ano}</span>
                </div>
                <div className="mt-3 flex flex-1 gap-3">
                  <div className="h-[86px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-white/10" style={{ boxShadow: `0 0 0 3px ${p.cor_faixa || "#ffffff55"}` }}>
                    {p.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.foto} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-3xl opacity-60">🥋</div>}
                  </div>
                  <div className="min-w-0 flex-1 text-[11px] leading-tight">
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif" }} className="truncate text-xl font-bold leading-none">{p.nome}</p>
                    <p className="mt-1 opacity-80">{p.faixa ? `Faixa ${p.faixa.toLowerCase()}${p.grau ? ` · ${p.grau}º grau` : ""}` : "—"}</p>
                    <p className="opacity-80">{p.faixa_modalidade || (p.modalidades || []).join(", ")}</p>
                    <p className="opacity-80">Nasc. {dataBR(p.nascimento)}</p>
                    <p className="opacity-80">Aluno desde {dataBR(p.aluno_desde)}</p>
                  </div>
                  <div className="shrink-0 self-end"><QR texto={ativa?.codigo || p.membro_id} tamanho={64} /></div>
                </div>
                <Faixa cor={p.cor_faixa || cor} graus={p.grau || 0} altura={9} className="mt-2" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={baixar}>Baixar imagem</button>
            {ctx.equipe && <button className="btn-sec" onClick={salvarHistorico}>Salvar {ano} no histórico</button>}
            <label className="btn-sec cursor-pointer">Trocar foto da carteirinha
              <input type="file" accept="image/*" className="hidden" onChange={(e) => trocarFoto(e.target.files?.[0])} />
            </label>
          </div>
          {msg && <p className="text-sm text-suave">{msg}</p>}

          {/* Federação */}
          <section className="rounded-2xl bg-painel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Federação</h2>
              <button className="btn-sec text-sm" onClick={() => setFed(fed ? null : { entidade: "" })}>Enviar carteirinha</button>
            </div>
            {fed && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <input className="campo" placeholder="Federação (ex.: Federação de Judô do RJ)" onChange={(e) => setFed({ ...fed, entidade: e.target.value })} />
                <input className="campo" placeholder="Número de registro" onChange={(e) => setFed({ ...fed, numero: e.target.value })} />
                <div><label className="rotulo">Válida até</label><input type="date" className="campo" onChange={(e) => setFed({ ...fed, valida_ate: e.target.value })} /></div>
                <div><label className="rotulo">Foto da carteirinha</label><input type="file" accept="image/*,application/pdf" className="campo" onChange={(e) => setFed({ ...fed, arquivo: e.target.files?.[0] })} /></div>
                <button className="btn sm:col-span-2" onClick={enviarFederacao}>Enviar</button>
              </div>
            )}
            <ul className="space-y-2">
              {cartoes.filter((c) => c.tipo === "federacao").map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{c.entidade}{c.numero ? ` nº ${c.numero}` : ""} <span className="text-sm text-suave">{c.valida_ate ? `até ${dataBR(c.valida_ate)}` : ""}</span></span>
                  <span className="flex gap-2">
                    <span className={`chip ${c.ativa ? "border-ok" : ""}`}>{c.ativa ? "ativa" : "histórico"}</span>
                    {c.imagem_url && <button className="text-sm underline" onClick={() => abrirAnexo(sb, c.imagem_url)}>Ver</button>}
                  </span>
                </li>
              ))}
              {!cartoes.some((c) => c.tipo === "federacao") && <p className="text-suave">Nenhuma carteirinha de federação enviada.</p>}
            </ul>
          </section>

          {/* Histórico */}
          <section className="rounded-2xl bg-painel p-4">
            <h2 className="mb-3 text-2xl font-bold">Histórico da academia</h2>
            <ul className="space-y-1">
              {cartoes.filter((c) => c.tipo === "academia").map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>Carteirinha {c.ano}</span>
                  <span className="flex gap-2 text-sm">
                    <span className={c.ativa ? "text-ok" : "text-suave"}>{c.ativa ? "ativa" : "antiga"}</span>
                    {c.imagem_url && <button className="underline" onClick={() => abrirAnexo(sb, c.imagem_url)}>Ver</button>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default function Pagina() {
  return <Suspense><Carteirinha /></Suspense>;
}
