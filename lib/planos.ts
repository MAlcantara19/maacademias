// Planos comerciais do MA Academias. Preços e o que cada um libera ficam AQUI.

export type PlanoId = "base" | "intermediario" | "completo" | "fundador" | "social" | "exclusivo";

// Nível de cada plano: libera tudo dos níveis abaixo
const NIVEL: Record<string, number> = {
  base: 1, essencial: 1, social: 1,
  intermediario: 2, profissional: 2,
  completo: 3, fundador: 3, exclusivo: 9,
};

// Plano mínimo de cada função
export const MINIMO: Record<string, number> = {
  // Base (1)
  sobre: 1, calendario: 1, avisos: 1, carteirinha: 1, aula_experimental: 1, cadastro_online: 1, feedback: 1,
  feed: 1, galeria: 1, notificacoes: 1, pre_checkin: 1, pendencias: 1, ausencias: 1, materiais: 1,
  // Intermediário (2)
  chamada_voz: 2, chamada_qr: 2, mensalidades: 2, recibo: 2, despesas: 2, peso: 2, aviso_falta: 2,
  ranking: 2, relatorio: 2, campeonatos: 2, historico_graduacao: 2, backup: 2, contrato: 2, propaganda: 2,
  certificado: 2,
  // Completo (3)
  chamada_facial: 3, totem: 3, feed_video: 3, campeonatos_completo: 3, titulos: 3, indicacoes: 3, pix_automatico: 3,
};

export function liberado(plano: string | undefined | null, funcao: string) {
  const n = NIVEL[plano || "base"] ?? 1;
  return n >= (MINIMO[funcao] ?? 1);
}

export function planoMinimoNome(funcao: string) {
  const m = MINIMO[funcao] ?? 1;
  return m === 1 ? "Base" : m === 2 ? "Intermediário" : "Completo";
}

export const PLANOS = [
  {
    id: "base", nome: "Base", preco: 29, slugDemo: "piloto-base", destaque: false,
    frase: "Para largar o caderno e organizar a academia.",
    itens: ["Alunos, turmas, horários e calendário", "Chamada por lista (toque no nome)", "Ficha do aluno: tempo de academia e faixa atual",
      "Carteirinha digital", "Pendências e ausências", "Feed de fotos do treino", "Pré-check-in (“vou na aula”)",
      "Avisos e notificações no celular", "Página da academia com WhatsApp"],
  },
  {
    id: "intermediario", nome: "Intermediário", preco: 49, slugDemo: "piloto-intermediario", destaque: true,
    frase: "Para cuidar do dinheiro e acompanhar a evolução.",
    itens: ["Tudo do Base", "Chamada por voz e check-in por QR Code", "Mensalidades com Pix (multa e juros automáticos)",
      "Comprovante pelo app, recibo e despesas", "Aluno registra peso e altura, com gráfico", "Aluno avisa quando vai faltar",
      "Ranking de presença e relatório do mês", "Campeonatos: inscritos, categoria e peso", "Histórico de faixas e certificado"],
  },
  {
    id: "completo", nome: "Completo", preco: 79, slugDemo: "piloto-completo", destaque: false,
    frase: "Para quem quer o máximo de tecnologia.",
    itens: ["Tudo do Intermediário", "Chamada por reconhecimento facial", "Modo totem (tablet na recepção)",
      "Campeonatos completos: pesagem, lembretes e ficha em PDF", "Vídeos curtos no feed (até 30 s)", "Títulos e temporadas por semestre", "Indique um amigo",
      "Baixa automática do Pix (em breve)"],
  },
] as const;

export const EXTRAS = [
  { nome: "Fundadores (6 primeiras academias)", preco: "Grátis até fev/2027", obs: "Depois, R$ 29/mês com tudo liberado por 12 meses" },
  { nome: "Domínio próprio (suaacademia.com.br)", preco: "R$ 100 uma vez", obs: "+ o domínio no registro.br (cerca de R$ 40/ano), em nome da academia" },
  { nome: "Implantação", preco: "R$ 150 uma vez", obs: "A gente cadastra turmas, horários e alunos para você" },
  { nome: "Totem de check-in", preco: "Comodato R$ 20/mês", obs: "Aparelho configurado e travado no app, ou compre o seu" },
  { nome: "Projeto social", preco: "Grátis", obs: "Plano Base sem custo" },
];

export const ROTULO_PLANO: Record<string, string> = {
  base: "Base", intermediario: "Intermediário", completo: "Completo", fundador: "Fundador", social: "Projeto social", exclusivo: "Exclusivo",
};
export const PRECO_PLANO: Record<string, number> = { base: 29, intermediario: 49, completo: 79, fundador: 29, social: 0, exclusivo: 0 };
