"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Aluno/responsável: "👍 Ciente" no aviso (a equipe vê quem leu)
export function BotaoCiente({ avisoId, perfilId }: { avisoId: string; perfilId?: string | null }) {
  const sb = supabaseNavegador();
  const [lido, setLido] = useState<boolean | null>(null);
  useEffect(() => {
    if (!perfilId) return;
    sb.from("avisos_lidos").select("aviso_id").eq("aviso_id", avisoId).eq("perfil_id", perfilId).maybeSingle()
      .then(({ data, error }: any) => setLido(error ? null : !!data), () => setLido(null));
  }, [avisoId, perfilId]); // eslint-disable-line
  if (!perfilId || lido === null) return null;
  async function alternar() {
    const novo = !lido; setLido(novo);
    if (novo) await sb.from("avisos_lidos").insert({ aviso_id: avisoId, perfil_id: perfilId });
    else await sb.from("avisos_lidos").delete().eq("aviso_id", avisoId).eq("perfil_id", perfilId);
  }
  return (
    <button onClick={alternar} className={`mt-1 rounded-full border px-3 py-0.5 text-xs ${lido ? "font-semibold text-white" : "border-linha text-suave"}`}
      style={lido ? { background: "var(--color-ok)", borderColor: "var(--color-ok)" } : {}}>
      {lido ? "✓ Ciente" : "👍 Ciente"}
    </button>
  );
}

// Equipe: quantos deram ciente e quem falta
export function LeituraAviso({ avisoId }: { avisoId: string }) {
  const [l, setL] = useState<any[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    supabaseNavegador().rpc("leitura_aviso", { p_aviso: avisoId }).then(({ data, error }: any) => setL(error ? null : data || []), () => setL(null));
  }, [avisoId]);
  if (!l || !l.length) return null;
  const leram = l.filter((x) => x.leu);
  const faltam = l.filter((x) => !x.leu);
  return (
    <div className="mt-1 text-xs">
      <button className="text-suave underline" onClick={() => setAberto(!aberto)}>👍 {leram.length} de {l.length} deram ciente</button>
      {aberto && (
        <div className="mt-1 space-y-1 rounded-xl bg-painel2 p-2">
          {leram.length > 0 && <p><b>Leram:</b> {leram.map((x) => x.nome).join(", ")}</p>}
          {faltam.length > 0 && <p className="text-suave"><b>Ainda não:</b> {faltam.map((x) => x.nome).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

// Enquete do aviso: o aluno vota com um toque; todo mundo vê a contagem; a equipe vê os nomes
export function ResultadoEnquete({ avisoId, opcoes, perfilId, equipe = false }: { avisoId: string; opcoes?: string[]; perfilId?: string | null; equipe?: boolean }) {
  const sb = supabaseNavegador();
  const [cont, setCont] = useState<{ opcao: string; votos: number }[]>([]);
  const [meu, setMeu] = useState<string | null>(null);
  const [nomes, setNomes] = useState<any[] | null>(null);
  async function carregar() {
    const { data } = await sb.rpc("contagem_enquete", { p_aviso: avisoId });
    setCont(data || (opcoes || []).map((o) => ({ opcao: o, votos: 0 })));
    if (perfilId && !equipe) {
      const { data: r } = await sb.from("avisos_respostas").select("opcao").eq("aviso_id", avisoId).eq("perfil_id", perfilId).maybeSingle();
      setMeu(r?.opcao || null);
    }
  }
  useEffect(() => { carregar().catch(() => {}); }, [avisoId, perfilId]); // eslint-disable-line
  async function votar(o: string) {
    if (!perfilId) return;
    setMeu(o);
    await sb.from("avisos_respostas").upsert({ aviso_id: avisoId, perfil_id: perfilId, opcao: o, em: new Date().toISOString() }, { onConflict: "aviso_id,perfil_id" });
    carregar();
  }
  async function verNomes() {
    if (nomes) return setNomes(null);
    const { data } = await sb.rpc("respostas_enquete", { p_aviso: avisoId });
    setNomes(data || []);
  }
  const total = cont.reduce((s, c) => s + c.votos, 0);
  return (
    <div className="mt-2 space-y-1.5">
      {cont.map((c) => {
        const pct = total ? Math.round((c.votos / total) * 100) : 0;
        const escolhido = meu === c.opcao;
        const Tag: any = equipe || !perfilId ? "div" : "button";
        return (
          <Tag key={c.opcao} onClick={equipe ? undefined : () => votar(c.opcao)}
            className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm ${escolhido ? "font-bold" : ""}`}
            style={{ borderColor: escolhido ? "var(--cor)" : "var(--color-linha)" }}>
            <span className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${(meu || equipe) ? pct : 0}%`, background: "var(--cor)" }} />
            <span className="relative flex justify-between gap-2"><span>{escolhido ? "✓ " : ""}{c.opcao}</span>{(meu || equipe) && <span>{c.votos} · {pct}%</span>}</span>
          </Tag>
        );
      })}
      <p className="text-xs text-suave">{total} {total === 1 ? "resposta" : "respostas"}{!equipe && !meu ? " · toque numa opção para responder" : !equipe ? " · dá para trocar" : ""}
        {equipe && total > 0 && <> · <button className="underline" onClick={verNomes}>{nomes ? "esconder nomes" : "ver quem respondeu"}</button></>}
      </p>
      {nomes && (
        <div className="rounded-xl bg-painel2 p-2 text-xs">
          {Array.from(new Set(nomes.map((n) => n.opcao))).map((o) => <p key={o}><b>{o}:</b> {nomes.filter((n) => n.opcao === o).map((n) => n.nome).join(", ")}</p>)}
        </div>
      )}
    </div>
  );
}
