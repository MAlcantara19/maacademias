"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Menu "Visualizar como": escolhe um aluno, professor ou responsável e abre o app
// do jeito que essa pessoa vê. Só para a equipe (o admin vê todas as opções).
export function VerComo({ academiaId, nivel, onEscolher, className = "" }: {
  academiaId: string; nivel: "admin" | "equipe"; onEscolher: (valor: string) => void; className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"aluno" | "professor" | "responsavel">("aluno");
  const [l, setL] = useState<{ alunos: any[]; profs: any[]; resps: any[] } | null>(null);

  useEffect(() => {
    if (!aberto || l) return;
    const sb = supabaseNavegador();
    (async () => {
      const { data: al } = await sb.from("painel_alunos").select("membro_id, perfil_id, nome, apelido, idade, modalidades, turmas").eq("academia_id", academiaId).eq("ativo", true).order("nome");
      let profs: any[] = [], resps: any[] = [];
      if (nivel === "admin") {
        const { data: pr } = await sb.from("membros").select("id, papel, perfis(nome, apelido)").eq("academia_id", academiaId).in("papel", ["professor", "admin"]).eq("ativo", true);
        profs = (pr || []).map((x: any) => ({ id: x.id, nome: x.perfis?.apelido || x.perfis?.nome, papel: x.papel }));
        const ids = (al || []).map((a: any) => a.perfil_id);
        const { data: rs } = ids.length ? await sb.from("responsaveis").select("responsavel_id, dependente_id, perfis!responsaveis_responsavel_id_fkey(nome, apelido)").in("dependente_id", ids) : { data: [] as any[] };
        const porResp = new Map<string, { id: string; nome: string; filhos: string[] }>();
        for (const r of rs || []) {
          const filho = (al || []).find((a: any) => a.perfil_id === r.dependente_id);
          const x = porResp.get(r.responsavel_id) || { id: r.responsavel_id, nome: (r as any).perfis?.apelido || (r as any).perfis?.nome || "Responsável", filhos: [] };
          if (filho) x.filhos.push(filho.apelido || filho.nome);
          porResp.set(r.responsavel_id, x);
        }
        resps = Array.from(porResp.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      }
      setL({ alunos: al || [], profs, resps });
    })();
  }, [aberto, l, academiaId, nivel]);

  const t = busca.toLowerCase();
  const itens = useMemo(() => {
    if (!l) return [];
    if (tipo === "professor") return l.profs.filter((p) => !t || p.nome?.toLowerCase().includes(t)).map((p) => ({ v: `prof:${p.id}`, nome: p.nome, info: p.papel === "admin" ? "admin" : "professor" }));
    if (tipo === "responsavel") return l.resps.filter((r) => !t || r.nome.toLowerCase().includes(t) || r.filhos.join(" ").toLowerCase().includes(t)).map((r) => ({ v: `resp:${r.id}`, nome: r.nome, info: r.filhos.length ? `de ${r.filhos.join(", ")}` : "" }));
    return l.alunos.filter((a) => !t || a.nome.toLowerCase().includes(t) || (a.apelido || "").toLowerCase().includes(t) || (a.modalidades || []).join(" ").toLowerCase().includes(t))
      .map((a) => ({ v: a.membro_id, nome: a.nome, info: [a.idade != null ? `${a.idade} anos` : "", (a.modalidades || []).join(", ")].filter(Boolean).join(" · ") }));
  }, [l, tipo, t]);

  return (
    <div className={className}>
      <button type="button" onClick={() => setAberto(!aberto)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>👁️ Visualizar como…</span><span aria-hidden>{aberto ? "▴" : "▾"}</span>
      </button>
      {aberto && (
        <div className="mt-2 space-y-2 rounded-xl bg-painel2 p-2 text-sm text-texto">
          {nivel === "admin" && (
            <div className="grid grid-cols-3 gap-1">
              {([["aluno", "🙋 Aluno"], ["professor", "🥋 Prof."], ["responsavel", "👨‍👧 Resp."]] as const).map(([k, r]) => (
                <button key={k} type="button" className="chip justify-center px-1 py-1 text-xs" onClick={() => setTipo(k)}
                  style={tipo === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{r}</button>
              ))}
            </div>
          )}
          <input className="campo py-1.5 text-sm" placeholder="Buscar nome ou modalidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {!l && <li className="text-suave">Carregando…</li>}
            {itens.map((i) => (
              <li key={i.v}>
                <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-painel" onClick={() => { setAberto(false); onEscolher(i.v); }}>
                  <span className="block truncate font-semibold">{i.nome}</span>
                  {i.info && <span className="block truncate text-xs text-suave">{i.info}</span>}
                </button>
              </li>
            ))}
            {l && !itens.length && <li className="text-suave">Ninguém encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
