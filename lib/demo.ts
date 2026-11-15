// Logins de demonstração das academias piloto (todos com a mesma senha: NEXT_PUBLIC_DEMO_SENHA)
export const PERFIS_DEMO = [
  { grupo: "Administração", itens: [{ rotulo: "Dono / Admin", icone: "🏢", chave: "admin", email: "admin.piloto@example.com", obs: "vê e configura tudo" }] },
  {
    grupo: "Professor", itens: [
      { rotulo: "Jiu-jitsu", icone: "🥋", chave: "prof-jj", email: "prof.piloto@example.com", obs: "só as turmas dele" },
      { rotulo: "Judô", icone: "🥋", chave: "prof-judo", email: "prof.judo.piloto@example.com", obs: "só as turmas dele" },
      { rotulo: "Muay Thai", icone: "🥊", chave: "prof-mt", email: "prof.muaythai.piloto@example.com", obs: "só as turmas dela" },
      { rotulo: "Taekwondo", icone: "🦵", chave: "prof-tkd", email: "prof.tkd.piloto@example.com", obs: "só as turmas dele" },
    ],
  },
  {
    grupo: "Aluno", itens: [
      { rotulo: "Jiu-jitsu", icone: "🙋", chave: "aluno-jj", email: "aluno.piloto@example.com", obs: "faixa azul" },
      { rotulo: "Judô", icone: "🙋", chave: "aluno-judo", email: "judo.piloto@example.com", obs: "" },
      { rotulo: "Muay Thai", icone: "🙋", chave: "aluno-mt", email: "muaythai.piloto@example.com", obs: "" },
      { rotulo: "Taekwondo", icone: "🙋", chave: "aluno-tkd", email: "tkd.piloto@example.com", obs: "" },
    ],
  },
  { grupo: "Família", itens: [{ rotulo: "Responsável (pais)", icone: "👨‍👧", chave: "responsavel", email: "responsavel.piloto@example.com", obs: "acompanha 2 crianças" }] },
];

// Roteiro de demonstração: as telas na ordem certa, já com o perfil certo
// (perfil = chave de PERFIS_DEMO; vazio = não precisa de login)
// recurso: só aparece no roteiro do plano que tem aquela função
export const ROTEIRO_DEMO: { titulo: string; perfil: string; caminho: string; dica: string; recurso?: string }[] = [
  { titulo: "Página da academia", perfil: "", caminho: "", dica: "O que o público vê: horários, professores, mapa, resultados e o botão de aula experimental." },
  { titulo: "Início do dono", perfil: "admin", caminho: "/app", dica: "Resumo do dia: alunos sumidos, aniversários, check-ins pelo GPS, pedidos de senha e primeiros passos." },
  { titulo: "Alunos", perfil: "admin", caminho: "/app/alunos", dica: "Filtros, WhatsApp com um toque, cadastro completo, contatos para arrumar e quem nunca entrou." },
  { titulo: "Chamada", perfil: "prof-jj", caminho: "/app/chamada", dica: "O professor só vê as turmas dele. Toque no aluno, chamada rápida, por voz, e aceite quem chegou pelo GPS." },
  { titulo: "Calendário", perfil: "prof-jj", caminho: "/app/calendario", dica: "Aulas, eventos e feriados. Editar, duplicar, repetir todo ano e mandar para o Google Agenda." },
  { titulo: "Campeonatos", perfil: "admin", caminho: "/app/campeonatos", dica: "Inscritos, pesagem, checklist de documentos e lembrete automático 7 dias e 1 dia antes." , recurso: "campeonatos" },
  { titulo: "Mensalidades", perfil: "admin", caminho: "/app/mensalidades", dica: "Pix com QR e copia e cola, atrasadas com multa e recibo." , recurso: "mensalidades" },
  { titulo: "Relatório do mês", perfil: "admin", caminho: "/app/relatorio", dica: "Números do mês para o dono: alunos, frequência, financeiro e funil de matrículas." , recurso: "relatorio" },
  { titulo: "Telão da recepção", perfil: "admin", caminho: "/app/telao", dica: "Ranking, aniversariantes, avisos e o “Bem-vindo, fulano!” de quem faz check-in." },
  { titulo: "App do aluno", perfil: "aluno-jj", caminho: "/app", dica: "Próxima aula, “✋ Vou nessa aula” e “📍 Cheguei” pelo GPS." },
  { titulo: "Carteirinha", perfil: "aluno-jj", caminho: "/app/carteirinha", dica: "Carteirinha digital com foto, faixa e QR." },
  { titulo: "Ranking e selos", perfil: "aluno-jj", caminho: "/app/ranking", dica: "A frequência vira jogo: ranking do mês, selos e títulos." , recurso: "ranking" },
  { titulo: "Notificações", perfil: "aluno-jj", caminho: "/app/notificacoes", dica: "Avisos no celular: turma, eventos, pendências e ranking. Cada um escolhe o que receber." },
  { titulo: "Responsável", perfil: "responsavel", caminho: "/app", dica: "Os pais acompanham os filhos e trocam a “Vez de” cada criança." },
  { titulo: "Personalizar", perfil: "admin", caminho: "/app/config", dica: "Cores, logo, módulos, Pix e as regras do check-in." },
];
