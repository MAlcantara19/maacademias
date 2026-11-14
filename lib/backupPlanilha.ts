// Planilha de backup da academia (usada no botão "Backup" e no envio mensal por e-mail)
import { addDias, hojeISO } from "@/lib/util";

export async function montarBackup(sb: any, acad: string): Promise<ArrayBuffer> {
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
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
