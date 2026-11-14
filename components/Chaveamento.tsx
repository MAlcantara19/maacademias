"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";

type Atleta = { membro_id: string; nome: string; apelido?: string; sexo?: string; idade?: number | null; peso?: number | null; faixa?: string | null; cor_faixa?: string | null; ordemFaixa: number };
type Luta = { a: Atleta; b: Atleta | null; feita?: boolean };

// Chaveamento do treino: sorteia as lutas da turma juntando quem tem peso,
// idade e faixa parecidos. Toque em "Lutar" e o placar já abre com os dois.
export function Chaveamento({ onLutar }: { onLutar: (azul: { nome: string; membro: string }, branco: { nome: string; membro: string }) => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turma, setTurma] = useState("");
  const [atletas, setAtletas] = useState<Atleta[]>([]);
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [cfg, setCfg] = useState({ sexo: true, faixa: true, maxKg: 10 });
  const [lutas, setLutas] = useState<Luta[]>([]);

  useEffect(() => {
    sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!turma) return;
    (async () => {
      const { data: mats } = await sb.from("matriculas").select("membro_id").eq("turma_id", turma).eq("status", "ativa");
      const ids = (mats || []).map((m: any) => m.membro_id);
      if (!ids.length) { setAtletas([]); return; }
      const { data: al } = await sb.from("painel_alunos").select("membro_id, perfil_id, nome, apelido, sexo, idade, faixa, cor_faixa").in("membro_id", ids).eq("ativo", true);
      const perfis = (al || []).map((a: any) => a.perfil_id);
      const { data: med } = await sb.from("medidas").select("perfil_id, peso_kg, data").in("perfil_id", perfis).order("data", { ascending: false });
      const peso = new Map<string, number>();
      (med || []).forEach((m: any) => { if (!peso.has(m.perfil_id) && m.peso_kg) peso.set(m.perfil_id, Number(m.peso_kg)); });
      const { data: mods } = await sb.from("modalidades").select("graduacoes").eq("academia_id", ctx.academia.id);
      const ordem = (f?: string | null) => Math.max(0, ...(mods || []).map((m: any) => (m.graduacoes || []).indexOf(f)));
      setAtletas((al || []).map((a: any) => ({ ...a, peso: peso.get(a.perfil_id) ?? null, ordemFaixa: ordem(a.faixa) })));
      setFora(new Set()); setLutas([]);
    })();
  }, [turma]); // eslint-disable-line

  function sortear() {
    const presentes = atletas.filter((a) => !fora.has(a.membro_id));
    // grupos por sexo (opcional); dentro, ordena por peso (ou idade) com um pouco de sorte
    const grupos = cfg.sexo ? ["M", "F", ""].map((s) => presentes.filter((a) => (a.sexo || "") === s)) : [presentes];
    const novas: Luta[] = [];
    for (const g of grupos) {
      const l = [...g].map((a) => ({ a, k: (a.peso ?? (a.idade ?? 20) * 2.5) + (cfg.faixa ? a.ordemFaixa * 3 : 0) + (Math.random() - 0.5) * 4 }))
        .sort((x, y) => x.k - y.k).map((x) => x.a);
      while (l.length >= 2) {
        const a = l.shift()!;
        // o parceiro mais parecido entre os próximos (respeitando a diferença máxima de peso)
        let melhor = 0;
        for (let i = 0; i < Math.min(3, l.length); i++) {
          const dif = (x: Atleta) => Math.abs((x.peso ?? 0) - (a.peso ?? 0)) + (cfg.faixa ? Math.abs(x.ordemFaixa - a.ordemFaixa) * 4 : 0);
          if (dif(l[i]) < dif(l[melhor])) melhor = i;
        }
        const b = l.splice(melhor, 1)[0];
        if (a.peso && b.peso && Math.abs(a.peso - b.peso) > cfg.maxKg) { novas.push({ a, b: null }); l.unshift(b); continue; }
        novas.push({ a, b });
      }
      if (l.length) novas.push({ a: l[0], b: null });
    }
    setLutas(novas);
  }
  const nome = (a: Atleta) => a.apelido || a.nome;
  const info = (a: Atleta) => [a.peso ? `${a.peso} kg` : null, a.faixa ? a.faixa.toLowerCase() : null, a.idade != null ? `${a.idade}a` : null].filter(Boolean).join(" · ");

  return (
    <details className="rounded-2xl bg-painel p-3 text-sm">
      <summary className="cursor-pointer font-semibold">🎲 Chaveamento do treino (sortear as lutas)</summary>
      <div className="mt-2 space-y-2">
        <select className="campo" value={turma} onChange={(e) => setTurma(e.target.value)} aria-label="Turma">
          <option value="">Escolha a turma…</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {atletas.length > 0 && (
          <>
            <p className="text-xs text-suave">Toque para tirar quem não veio hoje. Sem peso cadastrado, usa a idade.</p>
            <div className="flex flex-wrap gap-1.5">
              {atletas.sort((a, b) => a.nome.localeCompare(b.nome)).map((a) => (
                <button key={a.membro_id} type="button" className="chip text-xs" onClick={() => { const s = new Set(fora); s.has(a.membro_id) ? s.delete(a.membro_id) : s.add(a.membro_id); setFora(s); }}
                  style={fora.has(a.membro_id) ? { opacity: 0.4, textDecoration: "line-through" } : { borderColor: a.cor_faixa || undefined }}>{nome(a)}{a.peso ? ` ${a.peso}kg` : ""}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-1"><input type="checkbox" checked={cfg.sexo} onChange={(e) => setCfg({ ...cfg, sexo: e.target.checked })} /> Separar por sexo</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={cfg.faixa} onChange={(e) => setCfg({ ...cfg, faixa: e.target.checked })} /> Considerar a faixa</label>
              <label className="flex items-center gap-1">Diferença máx. <input type="number" min={2} max={40} className="campo w-16 py-1" value={cfg.maxKg} onChange={(e) => setCfg({ ...cfg, maxKg: Number(e.target.value) })} /> kg</label>
            </div>
            <button className="btn w-full sm:w-auto" onClick={sortear}>🎲 {lutas.length ? "Sortear de novo" : "Sortear as lutas"}</button>
          </>
        )}
        {turma && !atletas.length && <p className="text-suave">Nenhum aluno nesta turma.</p>}
        {lutas.length > 0 && (
          <ol className="space-y-1.5">
            {lutas.map((l, i) => (
              <li key={i} className={`flex flex-wrap items-center gap-2 rounded-xl p-2 ${l.feita ? "opacity-50" : "bg-painel2"}`}>
                <span className="numero w-6 font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold" style={{ color: "#3b82f6" }}>{nome(l.a)}</span> <span className="text-xs text-suave">({info(l.a)})</span>
                  {l.b ? <> × <span className="font-semibold">{nome(l.b)}</span> <span className="text-xs text-suave">({info(l.b)})</span></>
                    : <span className="text-xs text-alerta"> · sem par (rodízio ou com o professor)</span>}
                </span>
                {l.b && <button className="btn px-3 py-1 text-xs" onClick={() => { onLutar({ nome: nome(l.a), membro: l.a.membro_id }, { nome: nome(l.b!), membro: l.b!.membro_id }); setLutas(lutas.map((x, k) => (k === i ? { ...x, feita: true } : x))); }}>{l.feita ? "↻ De novo" : "▶ Lutar"}</button>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
