"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// Baixa uma planilha (.xlsx) com os dados principais da academia
export function Backup({ academia }: { academia: any }) {
  const [gerando, setGerando] = useState(false);

  async function baixar() {
    setGerando(true);
    const sb = supabaseNavegador();
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "MA Academias";
    const aba = (nome: string, linhas: any[], colunas: [string, string][]) => {
      const ws = wb.addWorksheet(nome);
      ws.columns = colunas.map(([k, h]) => ({ header: h, key: k, width: Math.max(12, h.length + 4) }));
      ws.getRow(1).font = { bold: true };
      linhas.forEach((l) => ws.addRow(l));
    };
    const acad = academia.id;
    const desde = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

    const [alunos, cobr, desp, aulas] = await Promise.all([
      sb.from("painel_alunos").select("*").eq("academia_id", acad).order("nome"),
      sb.from("cobrancas").select("*").eq("academia_id", acad).order("competencia"),
      sb.from("despesas").select("*").eq("academia_id", acad).order("data"),
      sb.from("aulas").select("id, data, hora_inicio, status, turmas!inner(nome, academia_id)").eq("turmas.academia_id", acad).gte("data", desde),
    ]);
    const nomes = new Map((alunos.data || []).map((a: any) => [a.membro_id, a.nome]));

    aba("Alunos", (alunos.data || []).map((a: any) => ({ ...a, turmas: (a.turmas || []).join(", "), ativo: a.ativo ? "sim" : "não" })), [
      ["nome", "Nome"], ["apelido", "Apelido"], ["nascimento", "Nascimento"], ["sexo", "Sexo"], ["whatsapp", "WhatsApp"], ["responsavel", "Responsável"],
      ["turmas", "Turmas"], ["faixa", "Faixa"], ["grau", "Grau"], ["aluno_desde", "Aluno desde"], ["ativo", "Ativo"], ["saiu_em", "Saiu em"],
      ["motivo_saida", "Motivo da saída"], ["ultima_aula", "Última aula"], ["frequencia_30d", "Frequência 30 dias (%)"], ["mensalidades_atrasadas", "Mensalidades atrasadas"],
    ]);

    const ids = (alunos.data || []).map((a: any) => a.membro_id);
    if (ids.length) {
      const { data: g } = await sb.from("graduacoes").select("faixa, grau, data, observacao, membro_id, modalidades(nome)").in("membro_id", ids).order("data");
      aba("Graduações", (g || []).map((x: any) => ({ ...x, aluno: nomes.get(x.membro_id), modalidade: x.modalidades?.nome })), [
        ["aluno", "Aluno"], ["modalidade", "Modalidade"], ["faixa", "Faixa"], ["grau", "Grau"], ["data", "Data"], ["observacao", "Observação"],
      ]);
    }

    const mapaAulas = new Map((aulas.data || []).map((a: any) => [a.id, a]));
    const pres: any[] = [];
    const idsAulas = Array.from(mapaAulas.keys());
    for (let i = 0; i < idsAulas.length; i += 200) {
      const { data } = await sb.from("presencas").select("aula_id, membro_id, metodo, atraso_min").in("aula_id", idsAulas.slice(i, i + 200));
      pres.push(...(data || []));
    }
    aba("Presenças (12 meses)", pres.map((p) => {
      const a: any = mapaAulas.get(p.aula_id);
      return { data: a?.data, hora: a?.hora_inicio?.slice(0, 5), turma: a?.turmas?.nome, aluno: nomes.get(p.membro_id), metodo: p.metodo, atraso: p.atraso_min };
    }).sort((x, y) => String(x.data).localeCompare(String(y.data))), [
      ["data", "Data"], ["hora", "Hora"], ["turma", "Turma"], ["aluno", "Aluno"], ["metodo", "Como marcou"], ["atraso", "Atraso (min)"],
    ]);

    aba("Mensalidades", (cobr.data || []).map((c: any) => ({ ...c, aluno: nomes.get(c.membro_id) })), [
      ["aluno", "Aluno"], ["competencia", "Mês"], ["vencimento", "Vencimento"], ["valor", "Valor"], ["status", "Situação"],
      ["pago_em", "Pago em"], ["valor_pago", "Valor pago"], ["forma", "Forma"], ["recibo_numero", "Recibo nº"],
    ]);
    aba("Despesas", desp.data || [], [["data", "Data"], ["descricao", "Descrição"], ["categoria", "Categoria"], ["valor", "Valor"]]);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${academia.slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    setGerando(false);
  }

  return (
    <div className="space-y-1">
      <button className="btn-sec" onClick={baixar} disabled={gerando}>{gerando ? "Gerando planilha…" : "💾 Baixar backup (Excel)"}</button>
      <p className="text-xs text-suave">Alunos, graduações, presenças dos últimos 12 meses, mensalidades e despesas. Toda segunda o admin recebe um lembrete.</p>
    </div>
  );
}
