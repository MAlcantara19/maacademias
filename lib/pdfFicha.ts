"use client";
// Monta o PDF da ficha completa do aluno (dados, responsável, saúde, termos com
// as assinaturas, documentos e ocorrências). Gerado no próprio aparelho.
import { TERMOS, mascaraCpf } from "@/lib/termosCadastro";

const dt = (d?: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "-");
const dth = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-");

async function imagemDe(sb: any, ref?: string | null): Promise<string | null> {
  if (!ref) return null;
  try {
    const caminho = ref.replace(/^privado:/, "");
    const { data } = await sb.storage.from("privado").createSignedUrl(caminho, 120);
    if (!data?.signedUrl) return null;
    const b = await (await fetch(data.signedUrl)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => ok(null); r.readAsDataURL(b); });
  } catch { return null; }
}

export async function gerarPdfFicha(sb: any, x: {
  academia: any; perfil: any; menor: boolean; responsaveis: any[]; saude: any; emergencia: any;
  assinaturas: any[]; documentos: any[]; ocorrencias: any[]; graduacao: any; status: any;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 15, W = 180, FIM = 282;
  let y = 15;
  const cor = x.academia?.cores?.primaria || "#1d4ed8";

  const quebra = (h: number) => { if (y + h > FIM) { doc.addPage(); y = 15; } };
  const titulo = (t: string) => {
    quebra(14); y += 3;
    doc.setFillColor(cor); doc.rect(L, y, W, 7, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(t.toUpperCase(), L + 2, y + 5);
    doc.setTextColor(20); y += 12;
  };
  const linha = (rotulo: string, valor?: any) => {
    const v = valor == null || valor === "" ? "-" : String(valor);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold"); const r = doc.splitTextToSize(rotulo, 45);
    doc.setFont("helvetica", "normal"); const partes = doc.splitTextToSize(v, W - 48);
    const n = Math.max(r.length, partes.length);
    quebra(n * 4.6 + 1);
    doc.setFont("helvetica", "bold"); doc.text(r, L, y);
    doc.setFont("helvetica", "normal"); doc.text(partes, L + 48, y);
    y += n * 4.6 + 0.8;
  };
  const texto = (t: string, tam = 9) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(tam);
    const partes = doc.splitTextToSize(t, W);
    quebra(partes.length * 4.2);
    doc.text(partes, L, y); y += partes.length * 4.2 + 1;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(x.academia?.nome || "Academia", L, y); y += 6;
  doc.setFontSize(12); doc.text("Ficha de cadastro do aluno", L, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(110);
  doc.text(`Gerada em ${new Date().toLocaleString("pt-BR")}`, L + W, y, { align: "right" }); doc.setTextColor(20); y += 4;
  texto(x.status?.completo ? "Situação: cadastro completo." : `Situação: pendente (${(x.status?.pendencias || []).join(", ")}).`, 8.5);

  const p = x.perfil, e = p.endereco_detalhe || {};
  titulo("1. Dados pessoais");
  linha("Nome", p.nome); if (p.apelido) linha("Apelido", p.apelido);
  linha("CPF", p.cpf ? mascaraCpf(p.cpf) : null); linha("RG", p.rg);
  linha("Nascimento", dt(p.nascimento)); linha("Sexo", p.sexo === "F" ? "Feminino" : p.sexo === "M" ? "Masculino" : null);
  linha("WhatsApp", p.telefone); linha("E-mail", p.email);
  linha("Endereço", [e.rua && `${e.rua}${e.numero ? `, ${e.numero}` : ""}`, e.complemento, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`, e.cep && `CEP ${e.cep}`].filter(Boolean).join(" - ") || p.endereco);
  linha("Graduação", x.graduacao ? `${x.graduacao.modalidades?.nome || ""} - faixa ${String(x.graduacao.faixa).toLowerCase()}${x.graduacao.grau ? ` (${x.graduacao.grau}º grau)` : ""} desde ${dt(x.graduacao.data)}` : null);
  linha("Experiência anterior", p.experiencia);

  if (x.menor || x.responsaveis.length) {
    titulo("2. Responsável legal");
    for (const r of x.responsaveis) {
      const rp = r.perfis || {};
      linha("Nome", rp.nome); linha("Parentesco", r.parentesco); linha("CPF", rp.cpf ? mascaraCpf(rp.cpf) : null); linha("RG/Documento", rp.rg);
      linha("Nascimento", dt(rp.nascimento)); linha("WhatsApp", rp.telefone); linha("E-mail", rp.email); linha("Endereço", rp.endereco); y += 2;
    }
    if (!x.responsaveis.length) texto("Nenhum responsável cadastrado.");
    const aut = (p.autorizados_retirada || []).filter((a: any) => a.nome);
    linha("Autorizados a buscar", aut.length ? aut.map((a: any) => `${a.nome}${a.parentesco ? ` (${a.parentesco})` : ""}${a.telefone ? ` ${a.telefone}` : ""}`).join("; ") : "somente o responsável");
  }

  titulo(`${x.menor ? 3 : 2}. Ficha de saúde (informação restrita)`);
  const s = x.saude?.dados || {};
  const sn = (k: string) => (s[k] === "sim" ? "Sim" : s[k] === "nao" ? "Não" : "-");
  linha("Tipo sanguíneo", s.tipo_sanguineo); linha("Plano de saúde", s.plano);
  linha("Cardíaco / Respiratório", `${sn("cardiaco")} / ${sn("respiratorio")}`); linha("Convulsões / Ortopédico", `${sn("convulsao")} / ${sn("ortopedico")}`);
  if (s.detalhe_condicoes) linha("Detalhes", s.detalhe_condicoes);
  linha("Doenças preexistentes", s.condicoes); linha("Alergias", s.alergias); linha("Medicamentos", s.medicamentos);
  linha("Lesões", s.lesoes); linha("Cirurgias", s.cirurgias); linha("Restrições", s.restricoes); linha("Observações", s.observacoes);
  linha("Emergência", [x.emergencia?.contato_emergencia_nome, x.emergencia?.contato_emergencia_tel].filter(Boolean).join(" - "));
  linha("Atualizada / validade", x.saude ? `${dt(x.saude.atualizado_em)} / ${dt(x.saude.validade)}` : "não preenchida");

  titulo(`${x.menor ? 4 : 3}. Autorizações e termos`);
  // última assinatura de cada termo
  const vistos = new Set<string>();
  const ultimas = x.assinaturas.filter((a) => (vistos.has(a.termo) ? false : (vistos.add(a.termo), true)));
  const imgs = new Map<string, string | null>();
  for (const a of ultimas) if (a.assinatura && !imgs.has(a.assinatura)) imgs.set(a.assinatura, await imagemDe(sb, a.assinatura));
  for (const t of TERMOS.filter((t) => !t.soMenor || x.menor)) {
    const a = ultimas.find((z) => z.termo === t.id);
    linha(t.titulo, a ? `${a.aceito ? "ACEITO" : "RECUSADO"} por ${a.assinante_nome}${a.assinante_cpf ? ` (CPF ${mascaraCpf(a.assinante_cpf)})` : ""} - ${a.assinante_papel} - ${dth(a.assinado_em)}` : "não assinado");
  }
  // assinaturas desenhadas (uma de cada)
  const desenhos = Array.from(new Set(ultimas.map((a) => a.assinatura).filter(Boolean)));
  for (const ref of desenhos) {
    const img = imgs.get(ref); if (!img) continue;
    const a = ultimas.find((z) => z.assinatura === ref)!;
    quebra(30);
    doc.setDrawColor(180); doc.rect(L, y, 80, 24);
    try { doc.addImage(img, "PNG", L + 1, y + 1, 78, 22); } catch { /* imagem inválida */ }
    doc.setFontSize(8.5); doc.text(`${a.assinante_nome} (${a.assinante_papel}) - ${dth(a.assinado_em)}`, L + 84, y + 13);
    y += 27;
  }
  texto("Assinaturas eletrônicas feitas no aplicativo, com registro de data, hora, navegador e identificação da versão do texto aceito.", 7.5);

  titulo(`${x.menor ? 5 : 4}. Documentos enviados`);
  if (!x.documentos.length) texto("Nenhum documento enviado.");
  for (const d of x.documentos.filter((d) => d.tipo !== "ficha_pdf")) linha(d.tipo.replace("_", " "), `${d.nome || "arquivo"} - enviado em ${dt(d.criado_em)}`);

  if (x.ocorrencias.length) {
    titulo(`${x.menor ? 6 : 5}. Ocorrências`);
    for (const o of x.ocorrencias) linha(`${dt(o.data)} - ${o.tipo}`, `${o.descricao}${o.providencias ? ` | Providências: ${o.providencias}` : ""}${o.responsavel_avisado ? " | responsável avisado" : ""}`);
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(130);
    doc.text(`${x.academia?.nome || ""} - ${p.nome} - página ${i} de ${n} - documento com dados pessoais e de saúde: guarde com sigilo (LGPD)`, 105, 292, { align: "center" });
  }
  return doc.output("blob");
}
