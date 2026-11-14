"use client";
// PDF da chamada do dia (lista com presentes e faltas), gerado no próprio aparelho.

export type LinhaChamada = { nome: string; idade: number | null; presente: boolean; chegada?: string; obs?: string };

export async function gerarPdfChamada(x: {
  academia: any; turma: string; data: string; horario: string; tipo?: string | null; professor?: string | null;
  linhas: LinhaChamada[]; anotacao?: string; cancelada?: boolean;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 12, W = 186, FIM = 280;
  const cor = x.academia?.cores?.primaria || "#1d4ed8";
  const dia = new Date(x.data + "T12:00:00");
  let y = 14;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(x.academia?.nome || "Academia", L, y);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, L + W, y, { align: "right" }); doc.setTextColor(20);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Chamada · ${x.turma}`, L, y); y += 5.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const dataTxt = dia.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  doc.text(`${dataTxt} · ${x.horario}${x.tipo ? ` · treino ${x.tipo}` : ""}${x.professor ? ` · Professor(a): ${x.professor}` : ""}`, L, y); y += 5;
  const pres = x.linhas.filter((l) => l.presente).length, total = x.linhas.length;
  doc.setFont("helvetica", "bold");
  doc.text(x.cancelada ? "AULA CANCELADA" : `Presentes: ${pres} de ${total} (${total ? Math.round((pres / total) * 100) : 0}%) · Faltas: ${total - pres}`, L, y); y += 6;

  // cabeçalho da tabela
  const cols = [{ t: "#", w: 8 }, { t: "Aluno", w: 70 }, { t: "Idade", w: 14 }, { t: "Presença", w: 22 }, { t: "Chegada", w: 22 }, { t: "Observação", w: 50 }];
  const cab = () => {
    doc.setFillColor(cor); doc.rect(L, y, W, 7, "F"); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    let cx = L + 1.5; for (const c of cols) { doc.text(c.t, cx, y + 4.8); cx += c.w; }
    doc.setTextColor(20); y += 7;
  };
  cab();
  doc.setFontSize(9);
  x.linhas.forEach((l, i) => {
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(l.obs || "", cols[5].w - 2);
    const nome = doc.splitTextToSize(l.nome, cols[1].w - 2);
    const h = Math.max(6.5, Math.max(obs.length, nome.length) * 4 + 2.5);
    if (y + h > FIM) { doc.addPage(); y = 14; cab(); doc.setFontSize(9); }
    if (i % 2) { doc.setFillColor(244, 245, 248); doc.rect(L, y, W, h, "F"); }
    let cx = L + 1.5;
    const vals = [String(i + 1), nome, l.idade != null ? String(l.idade) : "-", "", l.chegada || "", obs];
    vals.forEach((v, k) => {
      if (k === 3) {
        doc.setFont("helvetica", "bold"); doc.setTextColor(l.presente ? 22 : 200, l.presente ? 140 : 40, l.presente ? 80 : 50);
        doc.text(x.cancelada ? "-" : l.presente ? "PRESENTE" : "FALTOU", cx, y + 4.5); doc.setTextColor(20); doc.setFont("helvetica", "normal");
      } else doc.text(v as any, cx, y + 4.5);
      cx += cols[k].w;
    });
    doc.setDrawColor(225); doc.line(L, y + h, L + W, y + h);
    y += h;
  });

  if (x.anotacao) {
    const t = doc.splitTextToSize(`Anotação da aula: ${x.anotacao}`, W);
    if (y + t.length * 4.5 + 6 > FIM) { doc.addPage(); y = 14; }
    y += 5; doc.text(t, L, y); y += t.length * 4.5;
  }
  if (y + 20 > FIM) { doc.addPage(); y = 14; }
  y += 16;
  doc.setDrawColor(120); doc.line(L, y, L + 80, y);
  doc.setFontSize(8.5); doc.text("Assinatura do(a) professor(a)", L, y + 4);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130);
    doc.text(`${x.academia?.nome || ""} · ${x.turma} · ${x.data.split("-").reverse().join("/")} · página ${i} de ${n}`, 105, 290, { align: "center" });
  }
  return doc.output("blob");
}
