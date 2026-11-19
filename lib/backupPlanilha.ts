// Planilha de backup da academia (usada no botão "Backup" e no envio mensal por e-mail)
import { addDias, hojeISO } from "@/lib/util";

// O Supabase devolve no máximo 1.000 linhas por vez: busca de 1.000 em 1.000
async function todas(consulta: (de: number, ate: number) => any) {
  const linhas: any[] = [];
  for (let de = 0; de < 200000; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) return { data: linhas, error };
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: linhas };
}

type Abas = Record<string, any[]>;

// Junta as linhas de cada aba da planilha de uma academia
export async function dadosBackup(sb: any, acad: string): Promise<Abas> {
  const desde = addDias(hojeISO(), -365);
  const [al, rs, tu, ma, fr, co, gr] = await Promise.all([
    sb.from("painel_alunos").select("nome, apelido, nascimento, idade, sexo, whatsapp, responsavel, turmas, modalidades, faixa, aluno_desde, ativo, saiu_em, motivo_saida, frequencia_30d").eq("academia_id", acad).order("nome"),
    sb.from("responsaveis").select("parentesco, dependente:perfis!responsaveis_dependente_id_fkey(nome), responsavel:perfis!responsaveis_responsavel_id_fkey(nome, telefone, email)"),
    sb.from("turmas").select("nome, ativa, vagas, horarios(dia_semana, hora_inicio, hora_fim)").eq("academia_id", acad),
    sb.from("matriculas").select("status, desde, turmas!inner(nome, academia_id), membros(perfis(nome))").eq("turmas.academia_id", acad),
    todas((de, ate) => sb.from("frequencia_aulas").select("data, presente, justificada, turma_id, membro_id").eq("academia_id", acad).gte("data", desde).order("data").range(de, ate)),
    todas((de, ate) => sb.from("cobrancas").select("competencia, vencimento, valor, valor_pago, status, forma, pago_em, membros!membro_id(perfis(nome))").eq("academia_id", acad).gte("competencia", desde.slice(0, 8) + "01").order("competencia").range(de, ate)),
    sb.from("graduacoes").select("faixa, grau, data, modalidades(nome), membros!membro_id!inner(academia_id, perfis(nome))").eq("membros.academia_id", acad),
  ]);
  const nomeTurma = new Map((tu.data || []).map((t: any) => [t.id, t.nome]));
  const nomeAluno = new Map(); // presença: nome pelo membro
  const { data: nomes } = await sb.from("painel_alunos").select("membro_id, nome").eq("academia_id", acad);
  (nomes || []).forEach((n: any) => nomeAluno.set(n.membro_id, n.nome));
  const { data: tIds } = await sb.from("turmas").select("id, nome").eq("academia_id", acad);
  (tIds || []).forEach((t: any) => nomeTurma.set(t.id, t.nome));
  const abas: Abas = {};
  const aba = (nome: string, linhas: any[]) => { abas[nome] = linhas; };
  aba("Alunos", (al.data || []).map((a: any) => ({ Nome: a.nome, Apelido: a.apelido, Nascimento: a.nascimento, Idade: a.idade, Sexo: a.sexo, WhatsApp: a.whatsapp, Responsavel: a.responsavel, Turmas: (a.turmas || []).join(", "), Modalidades: (a.modalidades || []).join(", "), Faixa: a.faixa, "Aluno desde": a.aluno_desde, Ativo: a.ativo ? "sim" : "não", "Saiu em": a.saiu_em, Motivo: a.motivo_saida, "Frequência 30d (%)": a.frequencia_30d })));
  // só os responsáveis de alunos desta academia
  const nomesDaqui = new Set(nomeAluno.values());
  aba("Responsáveis", (rs.data || []).filter((r: any) => nomesDaqui.has(r.dependente?.nome)).map((r: any) => ({ Aluno: r.dependente?.nome, Responsavel: r.responsavel?.nome, Parentesco: r.parentesco, Telefone: r.responsavel?.telefone, Email: r.responsavel?.email })));
  aba("Turmas", (tu.data || []).map((t: any) => ({ Turma: t.nome, Ativa: t.ativa ? "sim" : "não", Vagas: t.vagas, Horarios: (t.horarios || []).map((h: any) => `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][h.dia_semana]} ${String(h.hora_inicio).slice(0, 5)}-${String(h.hora_fim || "").slice(0, 5)}`).join("; ") })));
  aba("Matrículas", (ma.data || []).map((m: any) => ({ Aluno: m.membros?.perfis?.nome, Turma: m.turmas?.nome, Status: m.status, Desde: m.desde })));
  aba("Presenças (12 meses)", (fr.data || []).map((f: any) => ({ Data: f.data, Turma: nomeTurma.get(f.turma_id), Aluno: nomeAluno.get(f.membro_id), Presente: f.presente ? "sim" : "não", Justificada: f.justificada ? "sim" : "" })));
  aba("Mensalidades", (co.data || []).map((c: any) => ({ Aluno: c.membros?.perfis?.nome, Competencia: c.competencia, Vencimento: c.vencimento, Valor: Number(c.valor), Pago: c.valor_pago != null ? Number(c.valor_pago) : null, Status: c.status, Forma: c.forma, "Pago em": c.pago_em })));
  aba("Graduações", (gr.data || []).map((g: any) => ({ Aluno: g.membros?.perfis?.nome, Modalidade: g.modalidades?.nome, Faixa: g.faixa, Grau: g.grau, Data: g.data })));
  return abas;
}

async function escrever(abas: Abas): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "MA Academias";
  for (const [nome, linhas] of Object.entries(abas)) {
    const ws = wb.addWorksheet(nome);
    if (!linhas.length) { ws.addRow(["(vazio)"]); continue; }
    ws.columns = Object.keys(linhas[0]).map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(10, k.length + 4)) }));
    linhas.forEach((l) => ws.addRow(l));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function montarBackup(sb: any, acad: string): Promise<ArrayBuffer> {
  return escrever(await dadosBackup(sb, acad));
}

// Uma planilha só com todas as academias (coluna "Academia" em cada aba + aba Resumo)
export async function montarBackupGeral(sb: any, academias: { id: string; nome: string }[]): Promise<ArrayBuffer> {
  const juntas: Abas = { Resumo: [] };
  for (const a of academias) {
    const abas = await dadosBackup(sb, a.id);
    const alunos = abas["Alunos"] || [];
    juntas.Resumo.push({ Academia: a.nome, "Alunos ativos": alunos.filter((x) => x.Ativo === "sim").length, "Alunos (total)": alunos.length,
      Turmas: (abas["Turmas"] || []).length, "Presenças (12 meses)": (abas["Presenças (12 meses)"] || []).length, Mensalidades: (abas["Mensalidades"] || []).length });
    for (const [nome, linhas] of Object.entries(abas)) (juntas[nome] ||= []).push(...linhas.map((l) => ({ Academia: a.nome, ...l })));
  }
  return escrever(juntas);
}
