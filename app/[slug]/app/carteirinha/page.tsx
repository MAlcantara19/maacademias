"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toPng } from "html-to-image";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { abrirAnexo, dataBR, hojeISO } from "@/lib/util";
import { CartaoAluno, MODELOS_CARTAO, VersoCartao, type ConfigCartao } from "@/components/CartaoAluno";
import { liberado } from "@/lib/planos";
import { QR } from "@/components/QR";

function Carteirinha() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const cartao = useRef<HTMLDivElement>(null);
  const verso = useRef<HTMLDivElement>(null);
  const fundoTela = useRef<HTMLDivElement>(null);
  const [gerandoFundo, setGerandoFundo] = useState(false);
  const [cfg, setCfg] = useState<ConfigCartao>(ctx.academia.carteirinha || {});
  const [editando, setEditando] = useState(false);
  const plano = ctx.academia.plano;
  const podeModelos = liberado(plano, "carteirinha_modelos");
  const podeCompleta = liberado(plano, "carteirinha_completa");
  // o que o plano não tem não vale, mesmo que esteja salvo
  const cfgValida: ConfigCartao = {
    ...cfg,
    modelo: podeModelos ? cfg.modelo : "classico",
    cor: podeModelos ? cfg.cor : undefined,
    nascimento: podeModelos ? cfg.nascimento : true, desde: podeModelos ? cfg.desde : true, modalidade: podeModelos ? cfg.modalidade : true, qr: podeModelos ? cfg.qr : true,
    fundo_foto: podeCompleta && cfg.fundo_foto, verso: podeCompleta && cfg.verso,
  };
  async function salvarModelo() {
    const { error } = await sb.from("academias").update({ carteirinha: cfg }).eq("id", ctx.academia.id);
    setMsg(error ? error.message : "Modelo da carteirinha salvo para todos os alunos.");
    if (!error) setEditando(false);
  }
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

  async function gerarImagem(el = cartao.current) {
    if (!el) return null;
    return toPng(el, { pixelRatio: 3, cacheBust: true });
  }
  // Papel de parede da tela de bloqueio: carteirinha + QR grande, no tamanho do celular
  async function papelDeParede() {
    setGerandoFundo(true);
    await new Promise((r) => setTimeout(r, 300));
    const url = fundoTela.current ? await toPng(fundoTela.current, { pixelRatio: 3, cacheBust: true }) : null;
    setGerandoFundo(false);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = `tela-de-bloqueio-${(p?.apelido || p?.nome || "aluno").split(" ")[0].toLowerCase()}.png`; a.click();
    setMsg("Imagem baixada! No celular: Galeria → abra a imagem → ⋮ → Definir como papel de parede → Tela de bloqueio.");
  }

  async function baixar() {
    const nome = (p?.nome || "aluno").replace(/\s+/g, "-").toLowerCase();
    for (const [el, lado] of [[cartao.current, "frente"], [cfgValida.verso ? verso.current : null, "verso"]] as const) {
      const url = await gerarImagem(el);
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url; a.download = `carteirinha-${nome}-${ano}${cfgValida.verso ? `-${lado}` : ""}.png`; a.click();
    }
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
          {/* Papel de parede (fica fora da tela; só aparece na imagem gerada) */}
          {gerandoFundo && (
            <div style={{ position: "fixed", left: -10000, top: 0 }}>
              <div ref={fundoTela} className="flex flex-col items-center justify-between p-6 text-white"
                style={{ width: 360, height: 780, background: `linear-gradient(180deg, #0b0f1d 0%, ${ctx.academia.cores?.primaria || "#7c3aed"} 160%)`, fontFamily: "Barlow, sans-serif" }}>
                <div className="h-40" />
                <div className="flex flex-col items-center gap-4">
                  <div style={{ transform: "scale(.82)" }}><CartaoAluno academia={ctx.academia} p={p} cfg={{ ...cfgValida, qr: false }} ano={ano} codigo={ativa?.codigo || p.membro_id} /></div>
                  <div className="rounded-2xl bg-white p-3"><QR texto={ativa?.codigo || p.membro_id} tamanho={170} /></div>
                  <p className="text-sm opacity-80">Mostre este QR na recepção</p>
                </div>
                <p className="text-xs opacity-60">{ctx.academia.nome} · {ano}</p>
              </div>
            </div>
          )}

          {/* O cartão */}
          <div className="flex flex-wrap gap-4 overflow-x-auto">
            <CartaoAluno ref={cartao} academia={ctx.academia} p={p} cfg={cfgValida} ano={ano} codigo={ativa?.codigo || p.membro_id} />
            {cfgValida.verso && <VersoCartao ref={verso} academia={ctx.academia} cfg={cfgValida} ano={ano} />}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={baixar}>Baixar imagem</button>
            <button className="btn-sec" onClick={papelDeParede} disabled={gerandoFundo}>{gerandoFundo ? "Gerando…" : "📱 Papel de parede (tela de bloqueio)"}</button>
            {ctx.equipe && <button className="btn-sec" onClick={salvarHistorico}>Salvar {ano} no histórico</button>}
            {ctx.admin && <button className="btn-sec" onClick={() => setEditando(!editando)}>🎨 Personalizar modelo</button>}
            <label className="btn-sec cursor-pointer">Trocar foto da carteirinha
              <input type="file" accept="image/*" className="hidden" onChange={(e) => trocarFoto(e.target.files?.[0])} />
            </label>
          </div>
          {msg && <p className="text-sm text-suave">{msg}</p>}

          {editando && ctx.admin && (
            <section className="space-y-4 rounded-2xl border border-linha bg-painel p-4">
              <h2 className="text-2xl font-bold">Modelo da carteirinha</h2>
              <p className="text-sm text-suave">Vale para todos os alunos. A prévia acima muda na hora.</p>

              {podeModelos ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MODELOS_CARTAO.map((m) => (
                    <button key={m.id} onClick={() => setCfg({ ...cfg, modelo: m.id })} className="rounded-xl border-2 p-3 text-left"
                      style={{ borderColor: (cfg.modelo || "classico") === m.id ? "var(--cor)" : "var(--color-linha)" }}>
                      <span className="block font-semibold">{m.nome}</span><span className="text-xs text-suave">{m.texto}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-suave">Modelo: Clássico.</p>}

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.logo !== false} onChange={(e) => setCfg({ ...cfg, logo: e.target.checked })} /> Mostrar a logo</label>
                {podeModelos && ([["nascimento", "Nascimento"], ["desde", "Aluno desde"], ["modalidade", "Modalidade"], ["qr", "QR Code"]] as const).map(([k, r]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={(cfg as any)[k] !== false} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /> {r}</label>
                ))}
                {podeModelos && <label className="flex items-center gap-2">Cor <input type="color" value={cfg.cor || ctx.academia.cores?.primaria || "#7c3aed"} onChange={(e) => setCfg({ ...cfg, cor: e.target.value })} /></label>}
              </div>
              <input className="campo" maxLength={60} placeholder="Frase no rodapé (opcional), ex.: Disciplina dentro e fora do tatame" value={cfg.frase || ""} onChange={(e) => setCfg({ ...cfg, frase: e.target.value })} />

              {podeCompleta && (
                <div className="space-y-2 rounded-xl bg-painel2 p-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg.fundo_foto} onChange={(e) => setCfg({ ...cfg, fundo_foto: e.target.checked })} /> Usar a foto de capa da academia no fundo</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg.verso} onChange={(e) => setCfg({ ...cfg, verso: e.target.checked })} /> Gerar o verso (contatos e regras)</label>
                  {cfg.verso && <textarea className="campo min-h-20" maxLength={240} placeholder="Texto do verso (regras, recado…)" value={cfg.verso_texto || ""} onChange={(e) => setCfg({ ...cfg, verso_texto: e.target.value })} />}
                </div>
              )}

              <details className="rounded-xl bg-painel2 p-3 text-sm">
                <summary className="cursor-pointer font-semibold">📐 Tamanhos ideais das imagens</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-suave">
                  <li><b className="text-texto">Logo:</b> quadrada, PNG com fundo transparente, de 512 × 512 a 1000 × 1000 px. Na carteirinha ela ocupa um quadradinho; desenho simples aparece melhor que texto miúdo.</li>
                  <li><b className="text-texto">Foto do aluno:</b> em pé (3 × 4), rosto centralizado, pelo menos 600 × 800 px.</li>
                  <li><b className="text-texto">Foto de capa (fundo):</b> 1600 × 600 px, sem texto (fica escurecida atrás dos dados).</li>
                  <li><b className="text-texto">Carteirinha baixada:</b> sai em alta (cerca de 1280 × 810 px), boa para gráfica em PVC no tamanho de cartão de crédito (85,6 × 54 mm).</li>
                </ul>
              </details>

              <div className="flex gap-2"><button className="btn" onClick={salvarModelo}>Salvar modelo</button><button className="btn-sec" onClick={() => { setCfg(ctx.academia.carteirinha || {}); setEditando(false); }}>Cancelar</button></div>
            </section>
          )}

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
