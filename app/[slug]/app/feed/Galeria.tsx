"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";

// Pega o id da pasta a partir do link do Drive
function idDaPasta(link: string) {
  const m = link.match(/folders\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : /^[\w-]{10,}$/.test(link.trim()) ? link.trim() : "";
}

// Galeria: cada álbum é uma pasta do Google Drive. Subiu no Drive, aparece aqui.
export function Galeria() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [albuns, setAlbuns] = useState<any[]>([]);
  const [aberto, setAberto] = useState<any>(null);
  const [fotos, setFotos] = useState<any[]>([]);
  const [zoom, setZoom] = useState<any>(null);
  const [novo, setNovo] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    const { data } = await sb.from("galerias").select("*").eq("academia_id", ctx.academia.id).order("ordem").order("criada_em", { ascending: false });
    setAlbuns(data || []);
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  async function abrir(a: any) {
    setAberto(a); setFotos([]); setMsg(""); setCarregando(true);
    const r = await fetch(`/api/drive?pasta=${a.pasta_id}`);
    const j = await r.json();
    setCarregando(false);
    if (!r.ok) return setMsg(j.erro || "Não foi possível abrir a pasta.");
    setFotos(j.arquivos);
  }

  async function salvar() {
    const id = idDaPasta(novo?.link || "");
    if (!novo?.titulo || !id) return setMsg("Dê um nome e cole o link da pasta do Drive.");
    const { error } = await sb.from("galerias").insert({ academia_id: ctx.academia.id, titulo: novo.titulo, pasta_url: novo.link, pasta_id: id });
    setMsg(error ? error.message : "Álbum adicionado."); setNovo(null); carregar();
  }
  async function remover(a: any) {
    if (!confirm(`Tirar o álbum “${a.titulo}” do app? (a pasta no Drive continua)`)) return;
    await sb.from("galerias").delete().eq("id", a.id); setAberto(null); carregar();
  }

  const novaFoto = (f: any) => Date.now() - new Date(f.criado).getTime() < 7 * 86400000;

  if (aberto) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className="text-sm text-suave" onClick={() => setAberto(null)}>← Álbuns</button>
          <div className="flex gap-2">
            <a href={aberto.pasta_url} target="_blank" className="btn-sec text-sm">Abrir no Drive</a>
            {ctx.equipe && <button className="text-sm text-suave underline" onClick={() => remover(aberto)}>remover</button>}
          </div>
        </div>
        <h2 className="text-3xl font-bold">{aberto.titulo}</h2>
        {carregando && <p className="text-suave">Carregando fotos…</p>}
        {msg && <p className="text-sm text-alerta">{msg}</p>}
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {fotos.map((f) => (
            <button key={f.id} className="relative aspect-square overflow-hidden rounded-md bg-painel2" onClick={() => setZoom(f)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.miniatura} alt={f.nome} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              {f.tipo === "video" && <span className="absolute inset-0 flex items-center justify-center text-3xl">▶️</span>}
              {novaFoto(f) && <span className="absolute left-1 top-1 rounded bg-ok px-1.5 text-[10px] font-bold text-white">NOVA</span>}
            </button>
          ))}
        </div>
        {zoom && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4" onClick={() => setZoom(null)}>
            {zoom.tipo === "video"
              ? <iframe src={`https://drive.google.com/file/d/${zoom.id}/preview`} className="aspect-video w-full max-w-3xl" allow="autoplay" title={zoom.nome} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={zoom.grande} alt={zoom.nome} referrerPolicy="no-referrer" className="max-h-[75vh] max-w-full rounded-lg object-contain" />}
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <a href={zoom.baixar} className="btn">⬇ Baixar</a>
              <a href={zoom.abrir} target="_blank" className="btn-sec">Abrir no Drive</a>
              <button className="btn-sec" onClick={() => setZoom(null)}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ctx.equipe && <button className="btn" onClick={() => setNovo({})}>Adicionar pasta do Drive</button>}
      {msg && <p className="text-sm text-suave">{msg}</p>}
      {novo && (
        <div className="space-y-2 rounded-2xl border border-linha bg-painel p-4">
          <input className="campo" placeholder="Nome do álbum (ex.: Treino de sábado)" onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          <input className="campo" placeholder="Link da pasta do Google Drive" onChange={(e) => setNovo({ ...novo, link: e.target.value })} />
          <p className="text-xs text-suave">No Drive: botão direito na pasta → Compartilhar → “Qualquer pessoa com o link” (leitor) → Copiar link. Tudo que você subir nessa pasta aparece aqui sozinho.</p>
          <div className="flex gap-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setNovo(null)}>Cancelar</button></div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {albuns.map((a) => (
          <button key={a.id} onClick={() => abrir(a)} className="flex items-center gap-3 rounded-2xl bg-painel p-4 text-left">
            <span className="text-4xl" aria-hidden>📁</span>
            <span><span className="block text-xl font-bold">{a.titulo}</span><span className="text-sm text-suave">Toque para ver as fotos</span></span>
          </button>
        ))}
      </div>
      {!albuns.length && !novo && <p className="text-suave">Nenhum álbum ainda.</p>}
    </div>
  );
}
