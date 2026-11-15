"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { EFEITOS } from "@/components/EfeitosTela";
import { NENHUM } from "@/lib/util";

// Master: personaliza a página principal (/) — logo, textos, cor, efeitos — e
// marca quais academias são de demonstração (aparecem na aba “Pilotos”).
export function EditorPlataforma() {
  const sb = supabaseNavegador();
  const [c, setC] = useState<any>(null);
  const [acads, setAcads] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [{ data, error }, { data: a }] = await Promise.all([
      sb.from("plataforma").select("*").eq("id", 1).maybeSingle(),
      sb.from("academias").select("id, nome, slug, demonstracao, no_diretorio").order("nome"),
    ]);
    if (error) { setMsg("Rode o arquivo ATUALIZAR-25.sql no Supabase para personalizar a página principal."); return; }
    setC(data || {}); setAcads(a || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const muda = (k: string, v: any) => setC((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    setSalvando(true); setMsg("");
    let logo_url = c.logo_url || null;
    if (arquivo) {
      const ext = (arquivo.name.split(".").pop() || "png").toLowerCase();
      const caminho = `${NENHUM}/plataforma/logo-${Date.now()}.${ext}`;
      const up = await sb.storage.from("publico").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
      if (up.error) { setSalvando(false); return setMsg("Não deu para enviar a logo: " + up.error.message); }
      logo_url = sb.storage.from("publico").getPublicUrl(caminho).data.publicUrl;
    }
    const { error } = await sb.from("plataforma").update({
      nome: c.nome || "MA Academias", titulo: c.titulo || null, subtitulo: c.subtitulo || null, logo_url,
      cor: c.cor || "#7c3aed", modo: c.modo || "escuro", efeito: c.efeito || "nenhum", efeito_temporada: !!c.efeito_temporada,
      abertura: !!c.abertura, mostrar_pilotos: c.mostrar_pilotos !== false, whatsapp: c.whatsapp || null, instagram: c.instagram || null,
      rodape: c.rodape || null, atualizado_em: new Date().toISOString(),
    }).eq("id", 1);
    setSalvando(false); setArquivo(null);
    setMsg(error ? "Não deu para salvar: " + error.message : "✅ Salvo! A página principal muda em até 1 minuto.");
    carregar();
  }
  async function alternarDemo(a: any) {
    await sb.from("academias").update({ demonstracao: !a.demonstracao }).eq("id", a.id);
    carregar();
  }

  if (!c) return msg ? <p className="rounded-2xl bg-painel p-4 text-sm text-alerta">{msg}</p> : null;
  const logo = arquivo ? URL.createObjectURL(arquivo) : c.logo_url || "/marca/ma-academias.svg";
  return (
    <details className="rounded-2xl bg-painel p-4">
      <summary className="cursor-pointer text-xl font-bold">🏠 Página principal (o que todo mundo vê em /)</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-20 w-20 rounded-2xl bg-painel2 object-contain" />
          <div className="space-y-1 text-sm">
            <label className="btn-sec cursor-pointer text-sm">🖼️ Trocar logo<input type="file" accept="image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /></label>
            {c.logo_url && <button className="block text-xs text-suave underline" onClick={() => muda("logo_url", null)}>voltar para a logo provisória</button>}
            <p className="text-xs text-suave">PNG ou SVG quadrado, de preferência com fundo transparente.</p>
          </div>
        </div>
        <label className="text-sm">Nome<input className="campo" value={c.nome || ""} onChange={(e) => muda("nome", e.target.value)} /></label>
        <label className="text-sm">Cor principal<input type="color" className="h-12 w-full rounded-xl" value={c.cor || "#7c3aed"} onChange={(e) => muda("cor", e.target.value)} /></label>
        <label className="text-sm sm:col-span-2">Título grande<input className="campo" value={c.titulo || ""} onChange={(e) => muda("titulo", e.target.value)} placeholder="Escolha seu tatame." /></label>
        <label className="text-sm sm:col-span-2">Texto abaixo do título<textarea className="campo" rows={2} value={c.subtitulo || ""} onChange={(e) => muda("subtitulo", e.target.value)} /></label>
        <label className="text-sm">WhatsApp (rodapé)<input className="campo" value={c.whatsapp || ""} onChange={(e) => muda("whatsapp", e.target.value)} placeholder="5524999999999" /></label>
        <label className="text-sm">Instagram (rodapé)<input className="campo" value={c.instagram || ""} onChange={(e) => muda("instagram", e.target.value)} placeholder="@maacademias" /></label>
        <label className="text-sm sm:col-span-2">Texto do rodapé<input className="campo" value={c.rodape || ""} onChange={(e) => muda("rodape", e.target.value)} placeholder="MA Academias · plataforma das academias de luta" /></label>
        <div className="text-sm sm:col-span-2">
          <p className="mb-1">Modo</p>
          <div className="flex gap-2">
            {["escuro", "claro"].map((m) => <button key={m} className="chip" onClick={() => muda("modo", m)} style={(c.modo || "escuro") === m ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{m === "escuro" ? "🌙 Escuro" : "☀️ Claro"}</button>)}
          </div>
        </div>
        <div className="text-sm sm:col-span-2">
          <p className="mb-1">Efeito na tela</p>
          <div className="flex flex-wrap gap-2">
            {EFEITOS.map((x) => (
              <button key={x.id} className="chip" onClick={() => muda("efeito", x.id)}
                style={(c.efeito || "nenhum") === x.id ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{x.nome}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!c.efeito_temporada} onChange={(e) => muda("efeito_temporada", e.target.checked)} /> Trocar sozinho nas datas especiais (Natal, Ano-novo, Carnaval…)</label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!c.abertura} onChange={(e) => muda("abertura", e.target.checked)} /> Abertura com a logo ao entrar no site</label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={c.mostrar_pilotos !== false} onChange={(e) => muda("mostrar_pilotos", e.target.checked)} /> Mostrar a aba “🧪 Pilotos” (academias de demonstração)</label>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar página principal"}</button>
        <a className="btn-sec" href="/" target="_blank">Ver a página</a>
      </div>
      <div className="mt-5">
        <p className="font-semibold">Quais academias são de demonstração?</p>
        <p className="text-xs text-suave">As marcadas aparecem na aba “🧪 Pilotos”; as outras, na aba das academias reais.</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {acads.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded-xl bg-painel2 p-2 text-sm">
              <input type="checkbox" checked={!!a.demonstracao} onChange={() => alternarDemo(a)} /> {a.nome}
              {a.no_diretorio === false && <span className="text-xs text-suave">(fora do diretório)</span>}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
