export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export const FAIXAS_ETARIAS = [
  "Kids (até 12)", "Adolescentes (13–17)", "Adultos (18–29)", "Adultos (30–39)", "Master (40+)",
];

// Data de hoje no fuso de Brasília, no formato AAAA-MM-DD
export function hojeISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function dataBR(d?: string | null) {
  if (!d) return "—";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

export function dataHoraBR(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function hora(h?: string | null) {
  return h ? h.slice(0, 5) : "";
}

export function dinheiro(v?: number | string | null) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Link de WhatsApp com mensagem pronta
export function whatsapp(numero?: string | null, texto?: string) {
  if (!numero) return null;
  const n = numero.replace(/\D/g, "");
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function primeiroNome(nome?: string | null) {
  return (nome || "").split(" ")[0];
}

export function addDias(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const MOTIVOS_AUSENCIA: Record<string, string> = {
  lesao: "Lesão", doenca: "Doença", viagem: "Viagem", passeio: "Passeio",
  trabalho: "Trabalho", estudos: "Estudos", familia: "Família",
  trancamento: "Trancamento", outro: "Outro",
};

// Anexos privados ficam salvos como "privado:caminho"; gera um link temporário para abrir
export async function abrirAnexo(sb: any, url?: string | null) {
  if (!url) return;
  if (url.startsWith("privado:")) {
    const { data } = await sb.storage.from("privado").createSignedUrl(url.slice(8), 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  } else {
    window.open(url, "_blank");
  }
}

// id "vazio" para filtros quando a lista está vazia
export const NENHUM = "00000000-0000-0000-0000-000000000000";
