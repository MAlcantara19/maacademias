// Logins de demonstração das academias piloto (todos com a mesma senha: NEXT_PUBLIC_DEMO_SENHA)
export const PERFIS_DEMO = [
  { grupo: "Administração", itens: [{ rotulo: "Dono / Admin", icone: "🏢", chave: "admin", email: "admin.piloto@admin.com", obs: "vê e configura tudo" }] },
  {
    grupo: "Professor", itens: [
      { rotulo: "Jiu-jitsu", icone: "🥋", chave: "prof-jj", email: "prof.piloto@prof.com", obs: "só as turmas dele" },
      { rotulo: "Judô", icone: "🥋", chave: "prof-judo", email: "prof.judo.piloto@prof.com", obs: "só as turmas dele" },
      { rotulo: "Muay Thai", icone: "🥊", chave: "prof-mt", email: "prof.muaythai.piloto@prof.com", obs: "só as turmas dela" },
      { rotulo: "Taekwondo", icone: "🦵", chave: "prof-tkd", email: "prof.tkd.piloto@prof.com", obs: "só as turmas dele" },
    ],
  },
  {
    grupo: "Aluno", itens: [
      { rotulo: "Jiu-jitsu", icone: "🙋", chave: "aluno-jj", email: "aluno.piloto@aluno.com", obs: "faixa azul" },
      { rotulo: "Judô", icone: "🙋", chave: "aluno-judo", email: "judo.piloto@aluno.com", obs: "" },
      { rotulo: "Muay Thai", icone: "🙋", chave: "aluno-mt", email: "muaythai.piloto@aluno.com", obs: "" },
      { rotulo: "Taekwondo", icone: "🙋", chave: "aluno-tkd", email: "tkd.piloto@aluno.com", obs: "" },
    ],
  },
  { grupo: "Família", itens: [{ rotulo: "Responsável (pais)", icone: "👨‍👧", chave: "responsavel", email: "responsavel.piloto@resp.com", obs: "acompanha 2 crianças" }] },
];
