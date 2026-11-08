// Gera o "Pix copia e cola" (padrão BR Code do Banco Central) com valor.
// Funciona com qualquer chave Pix (CPF, CNPJ, e-mail, celular ou aleatória).

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, "0") + valor;
}

function crc16(texto: string) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function limpar(t: string, max: number) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max).trim();
}

export function gerarPix({ chave, nome, cidade, valor, txid }: { chave: string; nome: string; cidade: string; valor?: number; txid?: string }) {
  // Celular deve estar no formato +5524999999999; CPF/CNPJ só números
  const k = /^[\d.\-/]+$/.test(chave.trim()) ? chave.replace(/\D/g, "") : chave.trim();
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", k);
  let payload =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (valor ? campo("54", valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(nome || "RECEBEDOR", 25) || "RECEBEDOR") +
    campo("60", limpar(cidade || "BRASIL", 15) || "BRASIL") +
    campo("62", campo("05", (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***"));
  payload += "6304";
  return payload + crc16(payload);
}
