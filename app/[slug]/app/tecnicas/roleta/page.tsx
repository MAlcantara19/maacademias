"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CLASSIFICACOES, corConjunto, nomeGrupo } from "@/lib/tecnicas";
import { RodaSorteio } from "@/components/RodaSorteio";
import { Tatame } from "@/components/Tatame";
import { BotaoFalar, EscolhaVoz } from "@/components/Falar";
import { falar } from "@/lib/fala";

// Roleta de técnicas: por grupo, tipo ou faixa. Tem modo tatame (tela cheia).
export default function Roleta() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [mods, setMods] = useState<any[]>([]);
  const [modId, setModId] = useState("");
  const [todas, setTodas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<{ tipo: string; valor: string }>({ tipo: "", valor: "" });
  const [sorteada, setSorteada] = useState<any>(null);
  const [tatame, setTatame] = useState(false);
  const [giros, setGiros] = useState(0);
  const membro = ctx.equipe ? null : ctx.meusAlunos[0]?.id;

  useEffect(() => {
    sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem")
      .then(({ data }) => { setMods(data || []); if (data?.[0]) setModId(data[0].id); });
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!modId) return;
    sb.from("tecnicas").select("*").eq("modalidade_id", modId).not("grupo", "in", "(taiso,ukemi,kata)").order("ordem")
      .then(({ data }) => setTodas(data || []));
  }, [modId]); // eslint-disable-line

  const conjuntos = Array.from(new Set(todas.map((t) => t.conjunto).filter(Boolean)));
  const classes = Array.from(new Set(todas.map((t) => t.classificacao).filter(Boolean)));
  const faixas = Array.from(new Set(todas.map((t) => t.faixa).filter(Boolean)));
  const lista = useMemo(() => todas.filter((t) =>
    !filtro.tipo || (filtro.tipo === "conjunto" ? t.conjunto === filtro.valor : filtro.tipo === "classe" ? t.classificacao === filtro.valor : t.faixa === filtro.valor)
  ), [todas, filtro]);

  async function sorteou(i: number) {
    const t = lista.slice(0, 40)[i];
    setSorteada(t);
    if (t.nome_original) falar(t.nome_original, t.kana);
    const n = giros + 1;
    setGiros(n);
    if (n % 5 === 0 && membro) await sb.from("quiz_resultados").insert({ academia_id: ctx.academia.id, membro_id: membro, modo: "roleta-tecnica", acertos: 0, total: 0 });
  }

  const Chip = ({ tipo, valor, rotulo, cor }: any) => {
    const on = filtro.tipo === tipo && filtro.valor === valor;
    return (
      <button className="chip text-xs" onClick={() => setFiltro(on ? { tipo: "", valor: "" } : { tipo, valor })}
        style={on ? { background: cor || "var(--cor)", borderColor: cor || "var(--cor)", color: cor === "#facc15" ? "#000" : undefined } : { borderColor: cor }}>
        {rotulo}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-extrabold">Roleta de técnicas</h1>
        <div className="flex gap-2">
          <button className="btn-sec text-sm" onClick={() => setTatame(true)}>⛶ Modo tatame</button>
          <Link href={`/${ctx.academia.slug}/app/estudar`} className="btn-sec text-sm">← Estudar</Link>
        </div>
      </div>
      {mods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {mods.map((m) => <button key={m.id} className="chip py-2" onClick={() => setModId(m.id)} style={m.id === modId ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{m.nome}</button>)}
        </div>
      )}
      <div className="space-y-2">
        {conjuntos.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Grupo:</span>{conjuntos.map((c) => <Chip key={c} tipo="conjunto" valor={c} rotulo={c} cor={corConjunto(c)} />)}</div>}
        {classes.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Tipo:</span>{classes.map((c) => <Chip key={c} tipo="classe" valor={c} rotulo={(CLASSIFICACOES[c] || c).split(" (")[0]} />)}</div>}
        {faixas.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-suave">Faixa:</span>{faixas.map((f) => <Chip key={f} tipo="faixa" valor={f} rotulo={f} />)}</div>}
      </div>
      <EscolhaVoz />

      <Tatame ativo={tatame} onSair={() => setTatame(false)}>
        <RodaSorteio grande={tatame} itens={lista.map((t) => ({ id: t.id, rotulo: t.nome_original || t.nome, cor: corConjunto(t.conjunto) }))} onSorteio={sorteou} />
        {sorteada && (
          <div className={`mx-auto w-full overflow-hidden rounded-3xl bg-painel text-center shadow-2xl ${tatame ? "max-w-2xl" : "max-w-sm"}`} style={{ borderTop: `8px solid ${corConjunto(sorteada.conjunto)}` }}>
            {sorteada.imagem_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sorteada.imagem_url} alt="" className="max-h-56 w-full object-cover" />
            )}
            <div className="space-y-1 p-5">
              <div className="flex items-center justify-center gap-3">
                <p className={`font-extrabold ${tatame ? "text-7xl" : "text-4xl"}`}>{sorteada.nome_original || sorteada.nome}</p>
                {sorteada.nome_original && <BotaoFalar texto={sorteada.nome_original} kana={sorteada.kana} grande={tatame} />}
              </div>
              {sorteada.nome_original && <p className={tatame ? "text-3xl text-suave" : "text-suave"}>{sorteada.nome}</p>}
              <p className="text-sm text-suave">
                {[sorteada.conjunto, CLASSIFICACOES[sorteada.classificacao] || nomeGrupo(sorteada.grupo), sorteada.faixa && `faixa ${sorteada.faixa.toLowerCase()}`].filter(Boolean).join(" · ")}
              </p>
              {sorteada.video_url && !tatame && <a href={sorteada.video_url} target="_blank" className="btn-sec mt-2 text-sm">▶️ Ver vídeo</a>}
            </div>
          </div>
        )}
      </Tatame>
    </div>
  );
}
