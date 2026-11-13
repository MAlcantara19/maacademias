// Ficha de cadastro por WhatsApp: a academia manda o modelo, a pessoa preenche
// e devolve; o app lê a resposta e preenche o cadastro sozinho.

export function modeloFicha(academia: string) {
  return [
    `Olá! Para seu cadastro na ${academia}, responda copiando esta mensagem e preenchendo depois dos dois pontos:`,
    "",
    "Nome completo: ",
    "Apelido: ",
    "Data de nascimento: ",
    "Sexo (M/F): ",
    "WhatsApp: ",
    "E-mail: ",
    "Endereço: ",
    "Responsável (se menor de idade): ",
    "WhatsApp do responsável: ",
    "Faixa atual: ",
    "Problema de saúde ou alergia: ",
  ].join("\n");
}

const sem = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, "").trim();

function dataISO(t: string) {
  const m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return "";
  let a = Number(m[3]);
  if (a < 100) a += a > 30 ? 1900 : 2000;
  return `${a}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}
function fone(t: string) {
  const d = t.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? "55" + d : d;
}

// Lê "Campo: valor" (uma por linha) e devolve os campos do cadastro
export function lerFicha(texto: string) {
  const out: Record<string, string> = {};
  for (const linha of texto.split(/\r?\n/)) {
    const i = linha.indexOf(":");
    if (i < 0) continue;
    const k = sem(linha.slice(0, i)).replace(/[*_]/g, "");
    const v = linha.slice(i + 1).trim().replace(/^[*_]+|[*_]+$/g, "");
    if (!v) continue;
    if (k.startsWith("whatsapp do resp") || k.startsWith("telefone do resp")) out.responsavel_tel = fone(v);
    else if (k.startsWith("respons")) out.responsavel = v;
    else if (k.startsWith("nome")) out.nome = v;
    else if (k.startsWith("apelido")) out.apelido = v;
    else if (k.includes("nascimento")) out.nascimento = dataISO(v);
    else if (k.startsWith("sexo")) out.sexo = /^f/i.test(v) ? "F" : "M";
    else if (k.startsWith("whatsapp") || k.startsWith("telefone") || k.startsWith("celular")) out.telefone = fone(v);
    else if (k.replace("-", "").startsWith("email")) out.email = v.toLowerCase();
    else if (k.startsWith("endereco")) out.endereco = v;
    else if (k.startsWith("faixa")) out.faixa_texto = v;
    else if (k.includes("saude") || k.includes("alergia")) out.saude = v;
  }
  return out;
}
