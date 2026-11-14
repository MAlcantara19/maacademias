"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, hojeISO } from "@/lib/util";
import { Avatar } from "@/components/Avatar";

// Exame de faixa em lote: mostra quem está apto (aulas desde a última faixa,
// tempo na faixa e simulado), gradua os escolhidos e gera os certificados de uma vez.
export default function ExameLote() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [mods, setMods] = useState<any[]>([]);
  const [modId, setModId] = useState("");
  const [crit, setCrit] = useState({ aulas: 30, meses: 6, simulado: 0 });
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [data, setData] = useState(hojeISO());
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    sb.from("modalidades").select("id, nome, graduacoes, cores_graduacoes").eq("academia_id", ctx.academia.id).eq("ativa", true).order("ordem")
      .then(({ data }) => { setMods(data || []); if (data?.[0]) setModId(data[0].id); });
  }, []); // eslint-disable-line
  const mod = mods.find((m) => m.id === modId);

  async function carregar() {
    if (!mod) return;
    setLinhas(null);
    const { data: tur } = await sb.from("turmas").select("id").eq("modalidade_id", mod.id).eq("ativa", true);
    const { data: mats } = (tur || []).length ? await sb.from("matriculas").select("membro_id").in("turma_id", tur!.map((t: any) => t.id)).eq("status", "ativa") : { data: [] as any[] };
    const ids = Array.from(new Set((mats || []).map((m: any) => m.membro_id)));
    if (!ids.length) return setLinhas([]);
    const [{ data: al }, { data: gr }, { data: qz }] = await Promise.all([
      sb.from("painel_alunos").select("membro_id, nome, foto_url, idade, ativo, aluno_desde").in("membro_id", ids).eq("ativo", true),
      sb.from("graduacoes").select("membro_id, faixa, grau, data").in("membro_id", ids).eq("modalidade_id", mod.id).order("data", { ascending: false }),
      sb.from("quiz_resultados").select("membro_id, acertos, total").in("membro_id", ids).eq("modo", "simulado"),
    ]);
    const ultima = new Map<string, any>();
    (gr || []).forEach((g: any) => { if (!ultima.has(g.membro_id)) ultima.set(g.membro_id, g); });
    const desde = (al || []).map((a: any) => ultima.get(a.membro_id)?.data || a.aluno_desde || "2000-01-01").sort()[0];
    const { data: pres } = await sb.from("presencas").select("membro_id, aulas!inner(data, turma_id)").in("membro_id", ids).gte("aulas.data", desde).in("aulas.turma_id", tur!.map((t: any) => t.id));
    const lista = (al || []).map((a: any) => {
      const g = ultima.get(a.membro_id);
      const base = g?.data || a.aluno_desde;
      const aulas = (pres || []).filter((p: any) => p.membro_id === a.membro_id && (!base || p.aulas.data >= base)).length;
      const meses = base ? Math.floor((Date.now() - new Date(base + "T12:00:00").getTime()) / 2629800000) : 0;
      const sims = (qz || []).filter((q: any) => q.membro_id === a.membro_id && q.total > 0);
      const simulado = sims.length ? Math.max(...sims.map((q: any) => Math.round((q.acertos / q.total) * 100))) : null;
      const atual = g?.faixa || mod.graduacoes?.[0] || "";
      const prox = mod.graduacoes?.[(mod.graduacoes.indexOf(atual) ?? -1) + 1] || null;
      const ok = { aulas: aulas >= crit.aulas, meses: meses >= crit.meses, simulado: !crit.simulado || (simulado ?? 0) >= crit.simulado };
      return { ...a, atual, prox, aulas, meses, simulado, ok, apto: !!prox && ok.aulas && ok.meses && ok.simulado, desde: base };
    }).sort((x: any, y: any) => Number(y.apto) - Number(x.apto) || x.nome.localeCompare(y.nome));
    setLinhas(lista);
    setSel(new Set(lista.filter((l: any) => l.apto).map((l: any) => l.membro_id)));
  }
  useEffect(() => { carregar(); }, [modId, crit.aulas, crit.meses, crit.simulado]); // eslint-disable-line

  const escolhidos = useMemo(() => (linhas || []).filter((l) => sel.has(l.membro_id) && l.prox), [linhas, sel]);

  async function executar(registrar: boolean) {
    if (!escolhidos.length || !mod) return setMsg("Escolha pelo menos um aluno.");
    if (registrar && !confirm(`Graduar ${escolhidos.length} aluno(s) em ${dataBR(data)}?`)) return;
    setOcupado(true); setMsg("");
    if (registrar) {
      const { error } = await sb.from("graduacoes").insert(escolhidos.map((l) => ({
        membro_id: l.membro_id, modalidade_id: mod.id, faixa: l.prox, grau: 0, data, registrado_por: ctx.membroId, observacao: "Exame de faixa (em lote)",
      })));
      if (error) { setOcupado(false); return setMsg(error.message); }
    }
    const { gerarCertificados } = await import("@/lib/pdfCertificado");
    const { data: pm } = ctx.membroId ? await sb.from("professores_modalidades").select("graduacao").eq("membro_id", ctx.membroId).eq("modalidade_id", mod.id).maybeSingle() : { data: null };
    const doc = await gerarCertificados({
      academia: ctx.academia, modalidade: mod.nome, professor: ctx.perfil?.nome, professorGrad: (pm as any)?.graduacao,
      itens: escolhidos.map((l) => ({ nome: l.nome, faixa: l.prox, cor: mod.cores_graduacoes?.[mod.graduacoes.indexOf(l.prox)], data })),
    });
    doc.save(`certificados-${mod.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${data}.pdf`);
    setOcupado(false);
    setMsg(registrar ? `🎉 ${escolhidos.length} graduação(ões) registrada(s) e certificados baixados.` : "Certificados baixados (sem registrar a graduação).");
    if (registrar) carregar();
  }

  if (!ctx.equipe) return <p className="text-suave">Só a equipe aplica exames.</p>;
  return (
    <div className="space-y-4">
      <Link href={`/${ctx.academia.slug}/app/alunos`} className="text-sm text-suave">← Alunos</Link>
      <h1 className="text-4xl font-extrabold">🎓 Exame de faixa em lote</h1>
      <div className="grid gap-2 rounded-2xl bg-painel p-3 sm:grid-cols-5">
        <select className="campo" value={modId} onChange={(e) => setModId(e.target.value)} aria-label="Modalidade">{mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
        <label className="text-sm"><span className="rotulo">Mín. de aulas na faixa</span><input type="number" min={0} className="campo" value={crit.aulas} onChange={(e) => setCrit({ ...crit, aulas: Number(e.target.value) })} /></label>
        <label className="text-sm"><span className="rotulo">Mín. de meses na faixa</span><input type="number" min={0} className="campo" value={crit.meses} onChange={(e) => setCrit({ ...crit, meses: Number(e.target.value) })} /></label>
        <label className="text-sm"><span className="rotulo">Simulado mín. (%) · 0 = não exige</span><input type="number" min={0} max={100} className="campo" value={crit.simulado} onChange={(e) => setCrit({ ...crit, simulado: Number(e.target.value) })} /></label>
        <label className="text-sm"><span className="rotulo">Data do exame</span><input type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} /></label>
      </div>
      {linhas === null && <p className="text-suave">Calculando…</p>}
      {linhas && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{linhas.filter((l) => l.apto).length} apto(s) de {linhas.length}</span>
            <button className="chip" onClick={() => setSel(new Set(linhas.filter((l) => l.apto).map((l) => l.membro_id)))}>Só os aptos</button>
            <button className="chip" onClick={() => setSel(new Set())}>Limpar</button>
          </div>
          <ul className="space-y-2">
            {linhas.map((l) => (
              <li key={l.membro_id}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 ${sel.has(l.membro_id) ? "bg-painel2 ring-2 ring-[var(--cor)]" : "bg-painel"} ${!l.prox ? "opacity-50" : ""}`}>
                  <input type="checkbox" disabled={!l.prox} checked={sel.has(l.membro_id)} onChange={(e) => { const s = new Set(sel); e.target.checked ? s.add(l.membro_id) : s.delete(l.membro_id); setSel(s); }} />
                  <Avatar foto={l.foto_url} nome={l.nome} tamanho={40} mostrarFaixa={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.nome} {l.apto && <span className="text-ok">· apto</span>}</span>
                    <span className="block text-xs text-suave">{l.atual || "sem faixa"} → <b>{l.prox || "última faixa"}</b> · desde {dataBR(l.desde)}</span>
                    <span className="mt-0.5 flex flex-wrap gap-2 text-xs">
                      <span className={l.ok.aulas ? "text-ok" : "text-alerta"}>{l.ok.aulas ? "✅" : "⚠️"} {l.aulas} aulas</span>
                      <span className={l.ok.meses ? "text-ok" : "text-alerta"}>{l.ok.meses ? "✅" : "⚠️"} {l.meses} meses</span>
                      {crit.simulado > 0 && <span className={l.ok.simulado ? "text-ok" : "text-alerta"}>{l.ok.simulado ? "✅" : "⚠️"} simulado {l.simulado ?? "—"}%</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {!linhas.length && <p className="text-suave">Nenhum aluno matriculado nesta modalidade.</p>}
          </ul>
          <div className="sticky bottom-20 flex flex-wrap gap-2 rounded-2xl bg-painel p-3 shadow-xl md:bottom-4">
            <button className="btn" disabled={ocupado || !escolhidos.length} onClick={() => executar(true)}>🎓 Graduar {escolhidos.length} e gerar certificados</button>
            <button className="btn-sec" disabled={ocupado || !escolhidos.length} onClick={() => executar(false)}>📄 Só gerar certificados</button>
          </div>
          {msg && <p className="text-sm text-ok">{msg}</p>}
        </>
      )}
    </div>
  );
}
