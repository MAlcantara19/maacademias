// Planos comerciais do MA Academias. Mude preços e o que cada um inclui aqui.

export type PlanoId = "essencial" | "profissional" | "completo" | "fundador" | "social" | "exclusivo";

// Nível de cada plano: o plano libera tudo dos níveis abaixo
const NIVEL: Record<PlanoId, number> = { essencial: 1, profissional: 2, completo: 3, fundador: 3, social: 1, exclusivo: 9 };

// Plano mínimo de cada função (módulo ou tela)
export const MINIMO: Record<string, number> = {
  sobre: 1, calendario: 1, avisos: 1, carteirinha: 1, aula_experimental: 1, feedback: 1,
  propaganda: 2, materiais: 2, mensalidades: 2, relatorio: 2, backup: 2, contrato: 2,
  ranking: 3, feed: 3, galeria: 3, campeonatos: 3, chamada_qr: 3, chamada_facial: 3, indicacoes: 3,
};

export function liberado(plano: string | undefined, funcao: string) {
  const n = NIVEL[(plano as PlanoId) || "essencial"] ?? 1;
  return n >= (MINIMO[funcao] ?? 1);
}

export function planoMinimoNome(funcao: string) {
  const m = MINIMO[funcao] ?? 1;
  return m === 1 ? "Essencial" : m === 2 ? "Profissional" : "Completo";
}

export const PLANOS = [
  {
    id: "essencial", nome: "Essencial", preco: 59, destaque: false,
    frase: "Para organizar a academia e largar o caderno.",
    itens: ["Cadastro de alunos e turmas", "Chamada em segundos (manual e por voz)", "Faixas, peso e ficha do aluno", "Calendário, avisos e aniversários",
      "Página da academia com horários e mapa", "Aula experimental e cadastro online", "Carteirinha digital", "App no celular do aluno"],
  },
  {
    id: "profissional", nome: "Profissional", preco: 99, destaque: true,
    frase: "Para cuidar do dinheiro sem dor de cabeça.",
    itens: ["Tudo do Essencial", "Mensalidades com Pix (QR e copia e cola)", "Cobrança automática e aviso de atraso", "Multa e juros calculados sozinhos",
      "Recibo numerado e despesas", "Relatório do mês e lucro", "Contrato digital aceito no app", "Backup em Excel"],
  },
  {
    id: "completo", nome: "Completo", preco: 149, destaque: false,
    frase: "Para engajar os alunos e crescer.",
    itens: ["Tudo do Profissional", "Ranking, títulos e temporadas", "Feed de fotos e galeria do Drive", "Campeonatos: pesagem, checklist e ficha",
      "Check-in por QR e chamada por foto", "Indique um amigo e lista de espera", "Notificações no celular", "Painel de quem sumiu e quem está pronto para graduar"],
  },
] as const;

export const EXTRAS = [
  { nome: "Domínio próprio (suaacademia.com.br)", preco: "R$ 150 uma vez", obs: "+ o domínio no registro.br (cerca de R$ 40/ano, em nome da academia)" },
  { nome: "Implantação", preco: "R$ 150 a R$ 300 uma vez", obs: "Cadastramos turmas, horários e alunos para você" },
  { nome: "Plano Fundador", preco: "R$ 69/mês por 12 meses", obs: "Tudo do Completo, para as 5 primeiras academias" },
  { nome: "Projeto social", preco: "Grátis", obs: "Essencial sem custo para projetos sociais" },
];

export const ROTULO_PLANO: Record<string, string> = {
  essencial: "Essencial", profissional: "Profissional", completo: "Completo", fundador: "Fundador", social: "Projeto social", exclusivo: "Exclusivo",
};
export const PRECO_PLANO: Record<string, number> = { essencial: 59, profissional: 99, completo: 149, fundador: 69, social: 0, exclusivo: 0 };
