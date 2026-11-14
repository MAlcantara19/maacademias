"use client";
// Certificados de graduação em lote (um por página, A4 deitado), gerados no aparelho
import { MESES } from "@/lib/util";

async function dataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const b = await (await fetch(url)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => ok(null); r.readAsDataURL(b); });
  } catch { return null; }
}

export async function gerarCertificados(x: {
  academia: any; modalidade: string; professor?: string | null; professorGrad?: string | null;
  itens: { nome: string; faixa: string; grau?: number | null; cor?: string | null; data: string }[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const logo = await dataUrl(x.academia?.logo_url);
  const formato = logo?.startsWith("data:image/png") ? "PNG" : "JPEG";
  x.itens.forEach((it, i) => {
    if (i) doc.addPage();
    const cor = !it.cor || it.cor.toLowerCase() === "#f5f5f5" || it.cor.toLowerCase() === "#ffffff" ? "#999999" : it.cor;
    // moldura e faixa
    doc.setDrawColor(cor); doc.setLineWidth(1.2); doc.rect(8, 8, 281, 194);
    doc.setFillColor(cor); doc.rect(0, 202, 220, 8, "F");
    doc.setFillColor(cor.toLowerCase() === "#111111" ? "#c81e1e" : "#0a0a0a"); doc.rect(220, 202, 59, 8, "F");
    doc.setFillColor(cor); doc.rect(279, 202, 18, 8, "F");
    if (logo) {
      try {
        doc.saveGraphicsState(); (doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }));
        doc.addImage(logo, formato, 98, 55, 100, 100); doc.restoreGraphicsState();
        doc.addImage(logo, formato, 138.5, 18, 20, 20);
      } catch { /* logo em formato que o PDF não aceita */ }
    }
    doc.setTextColor(110); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text((x.academia?.nome || "").toUpperCase(), 148.5, 46, { align: "center", charSpace: 1.5 });
    doc.setTextColor(20); doc.setFontSize(34); doc.text("Certificado de Graduação", 148.5, 64, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); doc.text("Certificamos que", 148.5, 82, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.text(it.nome, 148.5, 97, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(14);
    const t = `foi aprovado(a) e promovido(a) à faixa ${it.faixa.toLowerCase()}${it.grau ? ` (${it.grau}º grau)` : ""} de ${x.modalidade}, demonstrando dedicação, técnica e respeito aos princípios da arte.`;
    doc.text(doc.splitTextToSize(t, 210), 148.5, 112, { align: "center" });
    const [a, m, d] = it.data.split("-");
    doc.setTextColor(90); doc.setFontSize(12);
    doc.text(`${x.academia?.cidade ? `${x.academia.cidade}, ` : ""}${Number(d)} de ${MESES[Number(m) - 1].toLowerCase()} de ${a}`, 148.5, 136, { align: "center" });
    doc.setDrawColor(120); doc.setLineWidth(0.3); doc.line(48, 168, 128, 168); doc.line(169, 168, 249, 168);
    doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(x.professor || "Professor(a)", 88, 174, { align: "center" }); doc.text(x.academia?.nome || "", 209, 174, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setTextColor(110); doc.setFontSize(10);
    doc.text(x.professorGrad || "Professor responsável", 88, 179, { align: "center" }); doc.text("Direção", 209, 179, { align: "center" });
  });
  return doc;
}
