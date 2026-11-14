"use client";
import { useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, addDias, hojeISO } from "@/lib/util";

const mmdd = (d: string) => d.split("-").reverse().join("/");
const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");

// Relatório de impacto (para patrocinador, prefeitura, edital) e backup em planilha
export default function Exportar() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const acad = ctx.academia.id;
  const [de, setDe] = useState(hojeISO().slice(0, 4) + "-01-01");
  const [ate, setAte] = useState(hojeISO());
  const [fotos, setFotos] = useState(true);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState("");

  async function imagem(ref: string): Promise<string | null> {
    try {
      let url = ref;
      if (ref.startsWith("privado:")) url = (await sb.storage.from("privado").createSignedUrl(ref.slice(8), 120)).data?.signedUrl || "";
      if (!url) return null;
      const b = await (await fetch(url)).blob();
      return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => ok(null); r.readAsDataURL(b); });
    } catch { return null; }
  }

  async function relatorio() {
    setOcupado("impacto"); setMsg("Juntando os números…");
    try {
      const [{ data: al }, { data: fr }, { data: tu }, { data: gr }, { data: ins }, { data: posts }] = await Promise.all([
        sb.from("painel_alunos").select("membro_id, idade, faixa_etaria, sexo, aluno_desde, saiu_em, ativo").eq("academia_id", acad),
        sb.from("frequencia_aulas").select("turma_id, membro_id, aula_id, presente, justificada").eq("academia_id", acad).gte("data", de).lte("data", ate),
        sb.from("turmas").select("id, nome, ativa").eq("academia_id", acad),
        sb.from("graduacoes").select("faixa, data, membros!membro_id!inner(academia_id)").eq("membros.academia_id", acad).gte("data", de).lte("data", ate),
        sb.from("inscricoes_evento").select("resultado, eventos!inner(academia_id, inicio, titulo)").eq("eventos.academia_id", acad).gte("eventos.inicio", de).lte("eventos.inicio", ate + "T23:59:59"),
        fotos ? sb.from("posts").select("id, post_midias(tipo, url, miniatura)").eq("academia_id", acad).gte("criado_em", de).lte("criado_em", ate + "T23:59:59").order("criado_em", { ascending: false }).limit(20) : Promise.resolve({ data: [] as any[] }),
      ]);
      const atendidos = (al || []).filter((a: any) => (a.aluno_desde || "0") <= ate && (!a.saiu_em || a.saiu_em >= de));
      const novos = atendidos.filter((a: any) => a.aluno_desde && a.aluno_desde >= de);
      const l = fr || [];
      const aulas = new Set(l.map((x: any) => x.aula_id)).size;
      const presencas = l.filter((x: any) => x.presente).length;
      const possiveis = l.filter((x: any) => x.presente || !x.justificada).length;
      const conta = (arr: any[], k: (x: any) => string) => Object.entries(arr.reduce((m: any, x: any) => { const c = k(x) || "Não informado"; m[c] = (m[c] || 0) + 1; return m; }, {})).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
      const faixas = conta(atendidos, (a) => a.faixa_etaria);
      const sexo = conta(atendidos, (a) => (a.sexo === "F" ? "Feminino" : a.sexo === "M" ? "Masculino" : ""));
      const porTurma = (tu || []).map((t: any) => {
        const x = l.filter((f: any) => f.turma_id === t.id);
        const pos = x.filter((f: any) => f.presente || !f.justificada).length;
        return { nome: t.nome, alunos: new Set(x.map((f: any) => f.membro_id)).size, aulas: new Set(x.map((f: any) => f.aula_id)).size, pct: pos ? Math.round((100 * x.filter((f: any) => f.presente).length) / pos) : 0 };
      }).filter((t: any) => t.aulas > 0);
      const medalhas = conta((ins || []).filter((i: any) => ["ouro", "prata", "bronze"].includes(i.resultado)), (i) => i.resultado);

      setMsg("Montando o PDF…");
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const cor = ctx.academia.cores?.primaria || "#1d4ed8";
      const L = 15, W = 180; let y = 15;
      const quebra = (h: number) => { if (y + h > 280) { doc.addPage(); y = 15; } };
      const logo = ctx.academia.logo_url ? await imagem(ctx.academia.logo_url) : null;
      doc.setFillColor(cor); doc.rect(0, 0, 210, 34, "F");
      if (logo) try { doc.addImage(logo, logo.startsWith("data:image/png") ? "PNG" : "JPEG", 170, 6, 22, 22); } catch { /* */ }
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(ctx.academia.nome, L, 16);
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(`Relatório de impacto · ${mmdd(de)} a ${mmdd(ate)}`, L, 25);
      doc.setTextColor(20); y = 44;
      if (texto.trim()) { doc.setFontSize(10); const t = doc.splitTextToSize(texto.trim(), W); doc.text(t, L, y); y += t.length * 4.6 + 4; }
      // números grandes
      const cards: [string, string][] = [[String(atendidos.length), "alunos atendidos"], [String(novos.length), "novos no período"], [String(aulas), "aulas dadas"],
        [String(presencas), "presenças"], [possiveis ? `${Math.round((100 * presencas) / possiveis)}%` : "—", "frequência média"], [String((gr || []).length), "graduações (faixas)"]];
      cards.forEach(([n, r], i) => {
        const x = L + (i % 3) * 61, yy = y + Math.floor(i / 3) * 26;
        doc.setFillColor(244, 245, 248); doc.roundedRect(x, yy, 58, 22, 3, 3, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(cor); doc.text(n, x + 4, yy + 10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80); doc.text(r, x + 4, yy + 17);
      });
      y += 56; doc.setTextColor(20);
      const barras = (titulo: string, itens: [string, number][]) => {
        if (!itens.length) return;
        quebra(10 + itens.length * 7);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(titulo, L, y); y += 6;
        const max = Math.max(...itens.map((i) => i[1]));
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        for (const [k, v] of itens) {
          doc.text(k, L, y + 3.5); doc.setFillColor(cor); doc.rect(L + 52, y, Math.max(1, (v / max) * 105), 4.5, "F"); doc.text(String(v), L + 52 + Math.max(1, (v / max) * 105) + 2, y + 3.5); y += 6.5;
        }
        y += 4;
      };
      barras("Faixa etária", faixas);
      barras("Sexo", sexo);
      if (porTurma.length) {
        quebra(14 + porTurma.length * 6);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Turmas / polos", L, y); y += 6;
        doc.setFontSize(9); doc.text("Turma", L, y); doc.text("Alunos", L + 100, y); doc.text("Aulas", L + 125, y); doc.text("Frequência", L + 150, y); y += 5;
        doc.setFont("helvetica", "normal");
        for (const t of porTurma) { quebra(6); doc.text(t.nome, L, y); doc.text(String(t.alunos), L + 100, y); doc.text(String(t.aulas), L + 125, y); doc.text(`${t.pct}%`, L + 150, y); y += 5.5; }
        y += 4;
      }
      barras("Medalhas em campeonatos", medalhas.map(([k, v]) => [k === "ouro" ? "🥇 Ouro".slice(2) : k === "prata" ? "Prata" : "Bronze", v]));
      // fotos
      const imgs = ((posts || []) as any[]).flatMap((p: any) => p.post_midias || []).filter((m: any) => m.tipo === "foto").slice(0, 6);
      if (imgs.length) {
        quebra(70); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Fotos do período", L, y); y += 4;
        let k = 0;
        for (const m of imgs) {
          const d = await imagem(m.miniatura || m.url); if (!d) continue;
          const x = L + (k % 3) * 61, yy = y + Math.floor(k / 3) * 44;
          if (yy + 42 > 285) break;
          try { doc.addImage(d, "JPEG", x, yy, 58, 40, undefined, "FAST"); } catch { continue; }
          k++;
        }
        y += Math.ceil(k / 3) * 44 + 4;
      }
      quebra(30); y += 14;
      doc.setDrawColor(120); doc.line(L, y, L + 80, y); doc.setFontSize(9); doc.text(`Responsável — ${ctx.academia.nome}`, L, y + 4.5);
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130); doc.text(`${ctx.academia.nome} · gerado em ${new Date().toLocaleDateString("pt-BR")} · página ${i} de ${n}`, 105, 292, { align: "center" }); }
      doc.save(`relatorio-impacto-${slug(ctx.academia.nome)}-${de}-a-${ate}.pdf`);
      setMsg("✅ Relatório baixado.");
    } catch (e: any) { setMsg("Não deu para gerar: " + (e?.message || e)); }
    setOcupado("");
  }

  async function backup() {
    setOcupado("backup"); setMsg("Baixando os dados…");
    try {
      const desde = addDias(hojeISO(), -365);
      const [al, rs, tu, ma, fr, co, gr] = await Promise.all([
        sb.from("painel_alunos").select("nome, apelido, nascimento, idade, sexo, whatsapp, responsavel, turmas, modalidades, faixa, aluno_desde, ativo, saiu_em, motivo_saida, frequencia_30d").eq("academia_id", acad).order("nome"),
        sb.from("responsaveis").select("parentesco, dependente:perfis!responsaveis_dependente_id_fkey(nome), responsavel:perfis!responsaveis_responsavel_id_fkey(nome, telefone, email)"),
        sb.from("turmas").select("nome, ativa, vagas, horarios(dia_semana, hora_inicio, hora_fim)").eq("academia_id", acad),
        sb.from("matriculas").select("status, desde, turmas!inner(nome, academia_id), membros(perfis(nome))").eq("turmas.academia_id", acad),
        sb.from("frequencia_aulas").select("data, presente, justificada, turma_id, membro_id").eq("academia_id", acad).gte("data", desde),
        sb.from("cobrancas").select("competencia, vencimento, valor, valor_pago, status, forma, pago_em, membros!membro_id(perfis(nome))").eq("academia_id", acad).gte("competencia", desde.slice(0, 8) + "01"),
        sb.from("graduacoes").select("faixa, grau, data, modalidades(nome), membros!membro_id!inner(academia_id, perfis(nome))").eq("membros.academia_id", acad),
      ]);
      const nomeTurma = new Map((tu.data || []).map((t: any) => [t.id, t.nome]));
      const nomeAluno = new Map(); // presença: nome pelo membro
      const { data: nomes } = await sb.from("painel_alunos").select("membro_id, nome").eq("academia_id", acad);
      (nomes || []).forEach((n: any) => nomeAluno.set(n.membro_id, n.nome));
      const { data: tIds } = await sb.from("turmas").select("id, nome").eq("academia_id", acad);
      (tIds || []).forEach((t: any) => nomeTurma.set(t.id, t.nome));
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const aba = (nome: string, linhas: any[]) => {
        const ws = wb.addWorksheet(nome);
        if (!linhas.length) { ws.addRow(["(vazio)"]); return; }
        ws.columns = Object.keys(linhas[0]).map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(10, k.length + 4)) }));
        linhas.forEach((l) => ws.addRow(l));
        ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }];
      };
      aba("Alunos", (al.data || []).map((a: any) => ({ Nome: a.nome, Apelido: a.apelido, Nascimento: a.nascimento, Idade: a.idade, Sexo: a.sexo, WhatsApp: a.whatsapp, Responsavel: a.responsavel, Turmas: (a.turmas || []).join(", "), Modalidades: (a.modalidades || []).join(", "), Faixa: a.faixa, "Aluno desde": a.aluno_desde, Ativo: a.ativo ? "sim" : "não", "Saiu em": a.saiu_em, Motivo: a.motivo_saida, "Frequência 30d (%)": a.frequencia_30d })));
      aba("Responsáveis", (rs.data || []).filter((r: any) => nomeAluno.size === 0 || Array.from(nomeAluno.values()).includes(r.dependente?.nome)).map((r: any) => ({ Aluno: r.dependente?.nome, Responsavel: r.responsavel?.nome, Parentesco: r.parentesco, Telefone: r.responsavel?.telefone, Email: r.responsavel?.email })));
      aba("Turmas", (tu.data || []).map((t: any) => ({ Turma: t.nome, Ativa: t.ativa ? "sim" : "não", Vagas: t.vagas, Horarios: (t.horarios || []).map((h: any) => `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][h.dia_semana]} ${String(h.hora_inicio).slice(0, 5)}-${String(h.hora_fim || "").slice(0, 5)}`).join("; ") })));
      aba("Matrículas", (ma.data || []).map((m: any) => ({ Aluno: m.membros?.perfis?.nome, Turma: m.turmas?.nome, Status: m.status, Desde: m.desde })));
      aba("Presenças (12 meses)", (fr.data || []).map((f: any) => ({ Data: f.data, Turma: nomeTurma.get(f.turma_id), Aluno: nomeAluno.get(f.membro_id), Presente: f.presente ? "sim" : "não", Justificada: f.justificada ? "sim" : "" })));
      aba("Mensalidades", (co.data || []).map((c: any) => ({ Aluno: c.membros?.perfis?.nome, Competencia: c.competencia, Vencimento: c.vencimento, Valor: Number(c.valor), Pago: c.valor_pago != null ? Number(c.valor_pago) : null, Status: c.status, Forma: c.forma, "Pago em": c.pago_em })));
      aba("Graduações", (gr.data || []).map((g: any) => ({ Aluno: g.membros?.perfis?.nome, Modalidade: g.modalidades?.nome, Faixa: g.faixa, Grau: g.grau, Data: g.data })));
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `backup-${slug(ctx.academia.nome)}-${hojeISO()}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMsg("✅ Backup baixado. Guarde no Google Drive ou mande para o seu e-mail.");
    } catch (e: any) { setMsg("Não deu para gerar o backup: " + (e?.message || e)); }
    setOcupado("");
  }

  if (!ctx.admin) return <p className="text-suave">Só o admin da academia acessa esta página.</p>;
  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Relatórios e backup</h1>
      <section id="impacto" className="space-y-3 rounded-2xl bg-painel p-4">
        <h2 className="text-2xl font-bold">📄 Relatório de impacto</h2>
        <p className="text-sm text-suave">Para patrocinador, prefeitura, edital ou prestação de contas de projeto social: alunos atendidos, faixa etária, frequência, turmas/polos, graduações, medalhas e fotos do período.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm"><span className="rotulo">De</span><input type="date" className="campo" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label className="text-sm"><span className="rotulo">Até</span><input type="date" className="campo" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={fotos} onChange={(e) => setFotos(e.target.checked)} /> Incluir fotos do feed</label>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[["Este ano", hojeISO().slice(0, 4) + "-01-01"], ["Últimos 6 meses", addDias(hojeISO(), -182)], [`${MESES[new Date().getMonth()]}`, hojeISO().slice(0, 8) + "01"]].map(([r, d]) => (
            <button key={r} className="chip" onClick={() => { setDe(d); setAte(hojeISO()); }}>{r}</button>
          ))}
        </div>
        <textarea className="campo min-h-20" placeholder="Texto de apresentação (opcional): ex.: O projeto atende crianças de 6 a 14 anos da comunidade, com aulas gratuitas de judô…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn" disabled={!!ocupado} onClick={relatorio}>{ocupado === "impacto" ? "Gerando…" : "📄 Gerar relatório em PDF"}</button>
        <p className="text-xs text-suave">Não leva nomes nem dados de saúde: só números e fotos (confira se as famílias autorizaram o uso de imagem).</p>
      </section>
      <section id="backup" className="space-y-3 rounded-2xl bg-painel p-4">
        <h2 className="text-2xl font-bold">📦 Backup em planilha</h2>
        <p className="text-sm text-suave">Uma planilha com alunos, responsáveis, turmas, matrículas, presenças (12 meses), mensalidades e graduações. Todo dia 1º o app lembra você de baixar. Guarde no Drive ou no e-mail.</p>
        <button className="btn" disabled={!!ocupado} onClick={backup}>{ocupado === "backup" ? "Gerando…" : "📥 Baixar backup agora"}</button>
        <p className="text-xs text-suave">Fichas de saúde e documentos não entram no backup (dados sensíveis ficam só no app).</p>
      </section>
      {msg && <p className="text-sm text-suave">{msg}</p>}
    </div>
  );
}
