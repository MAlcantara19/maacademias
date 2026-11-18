// Histórico do MA Academias. Ao lançar uma atualização, acrescente no TOPO das listas.

// Versões do banco (arquivos supabase/ATUALIZAR-xx.sql). grande = mexe em muita coisa: baixe o backup antes.
export const VERSOES_BANCO: { versao: number; titulo: string; grande?: boolean }[] = [
  { versao: 26, titulo: "Painel do master: versão do banco, data dos pilotos e alerta de erro" },
  { versao: 25, titulo: "Página principal, avisos agendados/enquete, botões na notificação, metas e engajamento", grande: true },
  { versao: 24, titulo: "Resumo semanal, parabéns, graduação, pagamento, ciente e aviso antes da aula", grande: true },
  { versao: 23, titulo: "Notificações no celular, eventos anuais e duplicar campeonato", grande: true },
  { versao: 22, titulo: "Check-in pelo GPS, senha provisória com prazo e contatos", grande: true },
  { versao: 21, titulo: "Pedido de nova senha" },
  { versao: 20, titulo: "Inscrição pelo aluno, particulares, mural e resultados", grande: true },
  { versao: 19, titulo: "Meta semanal, carteirinha digital e QR do dia" },
  { versao: 18, titulo: "Faltas seguidas, status do cadastro e lembretes" },
  { versao: 17, titulo: "Pré-matrícula e logins de demonstração", grande: true },
  { versao: 16, titulo: "Cadastro completo (termos, documentos e saúde restrita)", grande: true },
  { versao: 15, titulo: "Ficha de saúde e recordes" },
  { versao: 14, titulo: "Endereço, estilo do grau e campeonatos do aluno" },
  { versao: 13, titulo: "Correção urgente de permissões", grande: true },
  { versao: 12, titulo: "Modelo da carteirinha" },
  { versao: 11, titulo: "Professores e mensalidades" },
  { versao: 10, titulo: "O que o plano não inclui fica desligado", grande: true },
  { versao: 9, titulo: "Miniaturas do feed" },
  { versao: 8, titulo: "Índices (mais rápido) e contexto do app" },
  { versao: 7, titulo: "Colegas da turma" },
  { versao: 6, titulo: "Planos novos e registro de erros", grande: true },
  { versao: 5, titulo: "Planos comerciais por academia" },
  { versao: 4, titulo: "Permissões por papel (professor vê só as turmas dele)", grande: true },
  { versao: 3, titulo: "Desafio do dia, flashcards, simulado e títulos" },
  { versao: 2, titulo: "Meta de estudo e placar da turma" },
  { versao: 1, titulo: "Vocabulário de judô e quiz" },
];
export const VERSAO_BANCO_ATUAL = VERSOES_BANCO[0].versao;

// Novidades para mostrar às academias (página /novidades)
export const NOVIDADES: { data: string; titulo: string; itens: string[] }[] = [
  { data: "2026-11-18", titulo: "Painel do master mais esperto", itens: [
    "Status das integrações (notificações, e-mail e WhatsApp) e botão de teste de notificação",
    "Aviso de atualização do banco pendente, com lembrete de backup",
    "Alerta no celular quando alguma tela dá erro",
    "Esta página de novidades",
  ] },
  { data: "2026-11-15", titulo: "Avisos inteligentes e página principal", itens: [
    "Avisos agendados, enquete com um toque e “lembrar quem não leu”",
    "Botões na notificação: “não vou hoje” e “todos que confirmaram vieram”",
    "Ficha rápida de saúde pelo QR da carteirinha",
    "Meta pessoal do aluno e aulas da turma na agenda do celular",
    "Relatório de engajamento no app",
    "Diretório com academias reais e de demonstração, cidade e distância",
  ] },
  { data: "2026-11-15", titulo: "Notificações no celular", itens: [
    "Aviso da turma, eventos chegando, pendências e ranking no celular",
    "Resumo da semana, parabéns no aniversário, graduação e pagamento recebido",
    "Professor recebe quantos confirmaram 30 min antes da aula",
    "“👍 Ciente” nos avisos e foto na notificação",
    "Eventos que se repetem todo ano, duplicar campeonato e Google Agenda",
    "Contagem regressiva e checklist do campeonato",
  ] },
  { data: "2026-11-14", titulo: "Check-in pelo GPS e contas da família", itens: [
    "Check-in pelo GPS ao chegar na academia (o professor aceita na chamada)",
    "Editar e apagar eventos do calendário",
    "Entrar com e-mail ou WhatsApp, “lembrar de mim” e contas no aparelho",
    "Responsável troca entre os filhos sem sair da conta",
    "Pedido de nova senha pelo app",
  ] },
  { data: "2026-11-14", titulo: "Dia a dia da academia", itens: [
    "Backup mensal por e-mail, treino do dia e cerimônia de graduação",
    "Pix na cobrança, aulas particulares e mural da turma",
    "Chaveamento, exame em lote, telão com QR e modo competição",
    "Carteirinha digital com QR do dia e relatório de impacto",
    "Visualizar como aluno/professor, aniversários e visitantes na chamada",
    "Chamada em PDF, marcar todos e chamada rápida",
  ] },
  { data: "2026-11-14", titulo: "Cadastro completo", itens: [
    "Pré-matrícula online com termos, documentos e ficha de saúde",
    "Pendências na lista de alunos e PDF da ficha",
    "Placar olímpico de judô e histórico de lutas",
  ] },
  { data: "2026-11-13", titulo: "Placar ao vivo e recordes", itens: [
    "Placar ao vivo, efeitos da logo e planilhas",
    "Ficha de saúde, recordes e conteúdo protegido",
  ] },
];
