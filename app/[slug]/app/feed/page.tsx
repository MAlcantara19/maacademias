"use client";
import { liberado } from "@/lib/planos";
import { comprimir } from "@/lib/imagem";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Galeria } from "./Galeria";

const LIMITE_MB = 25;      // vídeo
const MAX_ARQUIVOS = 4;    // por post
const MAX_SEGUNDOS = 30;   // duração do vídeo

// Duração de um vídeo escolhido (em segundos)
function duracao(arq: File): Promise<number> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); ok(v.duration || 0); };
    v.onerror = () => ok(0);
    v.src = URL.createObjectURL(arq);
  });
}

// Feed da academia: fotos e vídeos dos treinos, curtidas, marcações e download
export default function Feed() {
  const ctx = useCtx();
  const podeVideo = liberado(ctx.academia.plano, "feed_video");
  const sb = supabaseNavegador();
  const [posts, setPosts] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState<any>(null);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");
  const temFeed = ctx.academia.modulos?.feed !== false;
  const temGaleria = ctx.academia.modulos?.galeria === true;
  const [aba, setAba] = useState(temFeed ? "feed" : "galeria");
  const meus = new Set(ctx.equipe ? [ctx.membroId] : ctx.meusAlunos.map((a) => a.id));
  const eu = ctx.membroId;

  async function carregar() {
    const { data } = await sb.from("feed_posts").select("*")
      .eq("academia_id", ctx.academia.id).order("criado_em", { ascending: false }).limit(40);
    const lista = data || [];
    setPosts(lista);
    // fotos privadas: gera links temporários de uma vez
    // a lista mostra a miniatura (leve); a foto grande só carrega ao tocar/baixar
    const privadas = lista.flatMap((p: any) => p.midias).map((m: any) => (m.tipo === "foto" && m.miniatura) || m.url)
      .filter((u: string) => u?.startsWith("privado:")).map((u: string) => u.slice(8));
    if (privadas.length) {
      const { data: assinadas } = await sb.storage.from("privado").createSignedUrls(privadas, 3600);
      setUrls(Object.fromEntries((assinadas || []).map((a: any) => ["privado:" + a.path, a.signedUrl])));
    }
  }
  useEffect(() => {
    carregar();
    sb.from("colegas").select("membro_id, nome, apelido").eq("academia_id", ctx.academia.id).order("nome")
      .then(({ data }) => setAlunos(data || []));
  }, []); // eslint-disable-line

  const src = (u: string) => (u.startsWith("privado:") ? urls[u] : u);

  async function publicar() {
    if (!novo?.arquivos?.length) return setMsg("Escolha pelo menos uma foto.");
    const lista = Array.from(novo.arquivos as FileList);
    if (lista.length > MAX_ARQUIVOS) return setMsg(`Escolha no máximo ${MAX_ARQUIVOS} fotos por post.`);
    const videos = lista.filter((f) => f.type.startsWith("video/"));
    if (videos.length && !podeVideo) return setMsg("Neste plano o feed é só de fotos. Vídeos, mande no grupo da turma. 😉");
    for (const v of videos) {
      if (v.size > LIMITE_MB * 1024 * 1024) return setMsg(`O vídeo ${v.name} passa de ${LIMITE_MB} MB.`);
      if ((await duracao(v)) > MAX_SEGUNDOS + 1) return setMsg(`Vídeos de até ${MAX_SEGUNDOS} segundos. Corte o vídeo e tente de novo.`);
    }
    setEnviando(true); setMsg("");
    const postId = crypto.randomUUID();
    const r = await sb.from("posts").insert({ id: postId, academia_id: ctx.academia.id, autor_id: eu, legenda: novo.legenda || null });
    if (r.error) { setEnviando(false); return setMsg("Não foi possível publicar: " + r.error.message); }
    let ordem = 0;
    for (const arq of Array.from(novo.arquivos as FileList)) {
      const caminho = `${ctx.academia.id}/feed/${postId}-${ordem}.${arq.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, await comprimir(arq));
      let miniatura: string | null = null;
      if (!up.error && arq.type.startsWith("image/")) {
        const cm = `${ctx.academia.id}/feed/${postId}-${ordem}-p.jpg`;
        const um = await sb.storage.from("privado").upload(cm, await comprimir(arq, 640, 0.7));
        if (!um.error) miniatura = "privado:" + cm;
      }
      if (!up.error) await sb.from("post_midias").insert({ post_id: postId, tipo: arq.type.startsWith("video") ? "video" : "foto", url: "privado:" + caminho, miniatura, ordem: ordem++ });
    }
    if (novo.marcados?.length) await sb.from("post_marcacoes").insert(novo.marcados.map((m: string) => ({ post_id: postId, membro_id: m })));
    setEnviando(false); setNovo(null); carregar();
  }

  async function curtir(p: any) {
    if (!eu) return;
    const curtiu = (p.curtidas || []).includes(eu);
    if (curtiu) await sb.from("curtidas").delete().eq("post_id", p.id).eq("membro_id", eu);
    else await sb.from("curtidas").insert({ post_id: p.id, membro_id: eu });
    carregar();
  }

  // foto grande (original): pede o link só quando precisa
  async function original(m: any) {
    if (!m.url.startsWith("privado:")) return m.url;
    const { data } = await sb.storage.from("privado").createSignedUrl(m.url.slice(8), 3600);
    return data?.signedUrl || "";
  }
  async function verGrande(m: any) { const u = await original(m); if (u) window.open(u, "_blank"); }

  async function baixar(m: any) {
    const url = await original(m);
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `treino-${m.id.slice(0, 6)}.${m.tipo === "video" ? "mp4" : "jpg"}`;
    a.click();
  }

  async function ocultar(p: any) {
    await sb.from("posts").update({ oculto: !p.oculto }).eq("id", p.id); carregar();
  }
  async function apagar(p: any) {
    if (!confirm("Apagar esta publicação?")) return;
    await sb.from("posts").delete().eq("id", p.id); carregar();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">{aba === "feed" ? "Feed" : "Galeria"}</h1>
        {aba === "feed" && <button className="btn" onClick={() => setNovo({ marcados: [] })}>Postar treino</button>}
      </div>
      {temFeed && temGaleria && (
        <div className="flex gap-1 rounded-2xl bg-painel p-1">
          {[["feed", "📸 Feed"], ["galeria", "📁 Galeria"]].map(([k, v]) => (
            <button key={k} onClick={() => setAba(k)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${aba === k ? "bg-painel2" : "text-suave"}`}>{v}</button>
          ))}
        </div>
      )}
      {aba === "galeria" ? <Galeria /> : <>
      {msg && <p className="text-sm text-alerta">{msg}</p>}

      {novo && (
        <section className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
          <label className="btn-sec w-full cursor-pointer">📷 {novo.arquivos?.length ? `${novo.arquivos.length} arquivo(s) escolhido(s)` : podeVideo ? `Escolher fotos ou vídeo (até ${MAX_SEGUNDOS} s)` : `Escolher fotos (até ${MAX_ARQUIVOS})`}
            <input type="file" accept={podeVideo ? "image/*,video/*" : "image/*"} multiple className="hidden" onChange={(e) => setNovo({ ...novo, arquivos: e.target.files })} />
          </label>
          <textarea className="campo min-h-20" placeholder="Legenda (ex.: Treino pesado de hoje! 💪)" onChange={(e) => setNovo({ ...novo, legenda: e.target.value })} />
          <p className="rotulo">Marcar quem aparece</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {alunos.map((a) => {
              const on = novo.marcados.includes(a.membro_id);
              return <button key={a.membro_id} type="button" className="chip text-xs" style={on ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                onClick={() => setNovo({ ...novo, marcados: on ? novo.marcados.filter((x: string) => x !== a.membro_id) : [...novo.marcados, a.membro_id] })}>{a.apelido || a.nome}</button>;
            })}
          </div>
          <p className="text-xs text-suave">Só poste fotos de quem autorizou o uso de imagem. As fotos ficam visíveis apenas para quem é da academia.</p>
          <div className="flex gap-2"><button className="btn" disabled={enviando} onClick={publicar}>{enviando ? "Enviando…" : "Publicar"}</button><button className="btn-sec" onClick={() => setNovo(null)}>Cancelar</button></div>
        </section>
      )}

      {posts.map((p) => {
        const autor = { nome: p.autor_nome, apelido: p.autor_apelido, foto_url: p.autor_foto };
        const curtiu = (p.curtidas || []).includes(eu);
        const meu = meus.has(p.autor_id);
        return (
          <article key={p.id} className={`overflow-hidden rounded-2xl bg-painel ${p.oculto ? "opacity-50" : ""}`}>
            <header className="flex items-center gap-3 p-3">
              <Avatar foto={autor?.foto_url} nome={autor?.nome} tamanho={36} mostrarFaixa={false} />
              <div className="flex-1">
                <p className="font-semibold">{autor?.apelido || autor?.nome}</p>
                <p className="text-xs text-suave">{dataHoraBR(p.criado_em)}{p.oculto ? " · oculto" : ""}</p>
              </div>
              {(ctx.equipe || meu) && (
                <div className="flex gap-2 text-xs">
                  {ctx.equipe && <button className="underline" onClick={() => ocultar(p)}>{p.oculto ? "mostrar" : "ocultar"}</button>}
                  <button className="text-suave underline" onClick={() => apagar(p)}>apagar</button>
                </div>
              )}
            </header>
            <div className="flex snap-x snap-mandatory overflow-x-auto">
              {(p.midias || []).map((m: any) => (
                <div key={m.id} className="relative w-full shrink-0 snap-center">
                  {m.tipo === "video"
                    ? <video src={src(m.url)} controls playsInline className="aspect-square w-full bg-black object-contain" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={src(m.miniatura || m.url)} alt={p.legenda || "Foto do treino"} loading="lazy" decoding="async"
                        onClick={() => verGrande(m)} className="aspect-square w-full cursor-zoom-in object-cover" />}
                  <button onClick={() => baixar(m)} className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">⬇ Baixar</button>
                </div>
              ))}
            </div>
            <div className="space-y-1 p-3">
              <button onClick={() => curtir(p)} className="text-lg" aria-pressed={curtiu}>{curtiu ? "❤️" : "🤍"} <span className="text-sm">{(p.curtidas || []).length}</span></button>
              {p.legenda && <p>{p.legenda}</p>}
              {(p.marcados || []).length > 0 && <p className="text-sm text-suave">Com: {p.marcados.join(", ")}</p>}
            </div>
          </article>
        );
      })}
      {!posts.length && <p className="text-suave">Nenhuma publicação ainda. Poste a foto do treino de hoje!</p>}
      </>}
    </div>
  );
}
