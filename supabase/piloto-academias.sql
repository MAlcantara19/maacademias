-- =====================================================================
-- MA ACADEMIAS — ACADEMIA PILOTO (dados de demonstração)
-- Rode DEPOIS do banco-academias.sql.
-- Pode rodar de novo quando quiser: ele apaga o piloto antigo e recria,
-- com as datas sempre atualizadas em relação a hoje.
--
-- Cria:
--   • Academia Piloto (completa, todos os módulos ligados)
--   • Clube de Luta Exemplo (simples, só para o diretório/mapa)
--   • 4 modalidades, 4 professores, 1 admin, 16 alunos, 4 crianças,
--     2 responsáveis, 6 turmas, horários da semana
--   • 8 semanas de chamadas (com atrasos e um aluno "sumido")
--   • faixas, histórico de peso, classes e categorias de peso
--   • campeonato com inscritos, cronograma de pesagem por categoria,
--     prova de faixa, eventos, feriado e um evento de teste de lembrete
--   • ausências avisadas (justificada, não justificada e pendente),
--     pendências/recados (uma respondida, uma em massa) e um aluno que saiu
--   • checklist do campeonato com atletas prontos e não prontos
--   • carteirinhas (com histórico 2025/2026 e da federação)
--   • planos, mensalidades pagas e atrasadas com recibo
--   • avisos, aulas experimentais no funil, feedbacks
--   • material de apoio (geral, por turma e só para competidores)
--   • posts no feed com fotos, curtidas e marcações
--
-- Logins de teste: crie no Supabase em Authentication → Add user
-- (marque "Auto Confirm User"), com qualquer senha:
--   admin.piloto@admin.com        → admin da academia
--   prof.piloto@prof.com         → professor de jiu-jitsu
--   aluno.piloto@aluno.com        → Aluno 01
--   responsavel.piloto@resp.com  → responsável pela Criança 01 e 02
-- O login se liga ao perfil sozinho pelo e-mail.
-- =====================================================================

-- ---------- Limpa o piloto anterior ----------
delete from academias where slug in ('academia-piloto', 'clube-de-luta-exemplo');
delete from perfis where email like '%.piloto@example.com'
   or email in ('admin.piloto@admin.com','prof.piloto@prof.com','aluno.piloto@aluno.com','responsavel.piloto@resp.com');

-- Ajudante temporário: cria pessoa + vínculo e devolve o id do membro
create or replace function pil_pessoa(
  p_acad uuid, p_nome text, p_email text, p_sexo text, p_nasc date, p_papel text
) returns uuid language plpgsql as $$
declare v_perfil uuid; v_membro uuid;
begin
  select id into v_perfil from perfis where email = p_email;
  if v_perfil is null then
    insert into perfis (nome, email, sexo, nascimento, trocar_senha)
    values (p_nome, p_email, p_sexo, p_nasc, false)
    returning id into v_perfil;
  end if;
  insert into membros (academia_id, perfil_id, papel)
  values (p_acad, v_perfil, p_papel)
  returning id into v_membro;
  return v_membro;
end $$;

do $$
declare
  ac   uuid;  ac2 uuid;
  mo_jj uuid; mo_judo uuid; mo_mt uuid; mo_tkd uuid;
  adm uuid; pr_jj uuid; pr_judo uuid; pr_mt uuid; pr_tkd uuid;
  pr_jj_admin uuid;
  t_jj uuid; t_jjk uuid; t_judo uuid; t_judok uuid; t_mt uuid; t_tkd uuid;
  alunos uuid[] := '{}';
  criancas uuid[] := '{}';
  resp1 uuid; resp2 uuid;
  m uuid; pf uuid; i int; k int;
  h record; d date; v_aula uuid; v_chance int; v_hash int;
  cl_s21 uuid; cl_sen uuid; cl_s15 uuid;
  ev_camp uuid; ev_prova uuid; ev_teste uuid;
  plano_2x uuid; plano_livre uuid; plano_kids uuid;
  mat uuid; post uuid; v_grupo uuid := gen_random_uuid();
  formas text[] := array['pix','cartao','dinheiro','pix'];
  hoje date := current_date;
begin
  -- =================================================================
  -- ACADEMIAS
  -- =================================================================
  insert into academias (slug, nome, slogan, sobre, endereco, cidade,
    latitude, longitude, maps_url, whatsapp, instagram, email,
    cores, no_diretorio, modulos, modos_chamada, qr_fixo_token)
  values ('academia-piloto', 'Academia Piloto', 'Treino sério, ambiente de família.',
    'A Academia Piloto é um exemplo de como fica a página da sua academia. '
    || 'Aqui vai a história: quando começou, quem fundou, as conquistas e o que '
    || 'a academia acredita. Jiu-jitsu, judô, muay thai e taekwondo para todas as idades.',
    'Rua Exemplo, 100 — Centro', 'Três Rios - RJ',
    -22.1165, -43.2092, 'https://maps.google.com/?q=-22.1165,-43.2092',
    '5500000000000', '@academiapiloto', 'contato@example.com',
    '{"primaria":"#7c3aed","secundaria":"#0b0b12","destaque":"#c4b5fd"}',
    true,
    '{"sobre":true,"propaganda":true,"calendario":true,"avisos":true,"ranking":true,
      "feed":true,"materiais":true,"mensalidades":true,"carteirinha":true,
      "campeonatos":true,"aula_experimental":true,"feedback":true,"ia":true}',
    array['manual','qr_fixo','facial'], 'PILOTO-QR-DEMO')
  returning id into ac;

  update academias set pix_chave = 'contato@example.com', pix_nome = 'ACADEMIA PILOTO', pix_cidade = 'TRES RIOS'
   where id = ac;

  -- Dois pedidos de cadastro esperando aprovação (vindos do link da academia)
  insert into solicitacoes_cadastro (academia_id, nome, email, telefone, nascimento, sexo, modalidade_id,
                                     responsavel_nome, responsavel_tel, aceite_imagem, mensagem)
  values
    (ac, 'Novo Aluno 01', 'novo01.piloto@example.com', '5500000000301', '1997-03-03', 'M', null, null, null, true,
     'Treinei 1 ano em outra academia.'),
    (ac, 'Nova Criança 01', null, null, '2016-06-06', 'F', null, 'Responsável Nova', '5500000000302', true,
     'Quer começar no judô kids.');

  insert into academias (slug, nome, slogan, cidade, latitude, longitude,
    whatsapp, cores, no_diretorio)
  values ('clube-de-luta-exemplo', 'Clube de Luta Exemplo', 'Segunda academia do mapa.',
    'Juiz de Fora - MG', -21.7642, -43.3503, '5500000000000',
    '{"primaria":"#dc2626","secundaria":"#111111"}', true)
  returning id into ac2;

  insert into propagandas (academia_id, titulo, texto, imagem_url, ordem)
  values
    (ac, 'Matrículas abertas', 'Primeira aula grátis em qualquer modalidade!',
     'https://picsum.photos/seed/piloto-banner1/1200/500', 1),
    (ac, 'Turma Kids', 'Disciplina e diversão a partir dos 5 anos.',
     'https://picsum.photos/seed/piloto-banner2/1200/500', 2);

  -- =================================================================
  -- MODALIDADES
  -- =================================================================
  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, ordem)
  values (ac, 'Jiu-jitsu', 'Arte suave, foco em solo e finalizações.', '#2563eb', '🥋',
          array['Branca','Azul','Roxa','Marrom','Preta'], 1) returning id into mo_jj;
  update modalidades set cores_graduacoes = array['#f5f5f5','#1d4ed8','#7c3aed','#78350f','#111111'] where id = mo_jj;
  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, ordem)
  values (ac, 'Judô', 'Projeções, imobilizações e disciplina.', '#7c3aed', '🥋',
          array['Branca','Azul','Amarela','Laranja','Verde','Roxa','Marrom','Preta'], 2) returning id into mo_judo;
  update modalidades set cores_graduacoes = array['#f5f5f5','#1d4ed8','#facc15','#f97316','#16a34a','#7c3aed','#78350f','#111111'] where id = mo_judo;
  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, graus_max, ordem)
  values (ac, 'Muay Thai', 'Trocação em pé, condicionamento forte.', '#dc2626', '🥊',
          array['Branco','Vermelho','Azul','Preto'], 0, 3) returning id into mo_mt;
  update modalidades set cores_graduacoes = array['#f5f5f5','#dc2626','#1d4ed8','#111111'] where id = mo_mt;
  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, ordem)
  values (ac, 'Taekwondo', 'Chutes, agilidade e formas (poomsae).', '#059669', '🦵',
          array['Branca','Amarela','Verde','Azul','Vermelha','Preta'], 4) returning id into mo_tkd;
  update modalidades set cores_graduacoes = array['#f5f5f5','#facc15','#16a34a','#1d4ed8','#dc2626','#111111'] where id = mo_tkd;

  insert into modalidades (academia_id, nome, cor, graduacoes)
  values (ac2, 'MMA', '#dc2626', array['Iniciante','Intermediário','Avançado']),
         (ac2, 'Boxe', '#f59e0b', array['Iniciante','Intermediário','Avançado']);

  -- =================================================================
  -- EQUIPE
  -- =================================================================
  adm     := pil_pessoa(ac, 'Admin Piloto',          'admin.piloto@admin.com',        'M', '1985-05-10', 'admin');
  pr_jj   := pil_pessoa(ac, 'Professor Jiu-jitsu',   'prof.piloto@prof.com',    'M', '1990-03-15', 'professor');
  pr_judo := pil_pessoa(ac, 'Professor Judô',        'prof.judo.piloto@example.com',    'M', '1992-08-20', 'professor');
  pr_mt   := pil_pessoa(ac, 'Professora Muay Thai',  'prof.muaythai.piloto@example.com','F', '1994-11-02', 'professor');
  pr_tkd  := pil_pessoa(ac, 'Professor Taekwondo',   'prof.tkd.piloto@example.com',     'M', '1988-01-25', 'professor');
  -- O admin também dá aula de jiu-jitsu (mostra que dá pra ter os dois papéis)
  pr_jj_admin := pil_pessoa(ac, 'Admin Piloto', 'admin.piloto@admin.com', 'M', '1985-05-10', 'professor');

  insert into professores_modalidades (membro_id, modalidade_id, whatsapp_publico, bio, graduacao) values
    (pr_jj,       mo_jj,   '5500000000001', 'Faixa preta, 15 anos de tatame. Foco em competição.', 'Faixa preta 2º grau'),
    (pr_jj_admin, mo_jj,   '5500000000000', 'Fundador da academia. Aulas de técnica às sextas.',  'Faixa preta 4º grau'),
    (pr_judo,     mo_judo, '5500000000002', 'Faixa preta, árbitro estadual.',                       'Faixa preta 2º dan'),
    (pr_mt,       mo_mt,   '5500000000003', 'Ex-atleta profissional, treino forte e técnico.',      'Kruang preto'),
    (pr_tkd,      mo_tkd,  '5500000000004', 'Especialista em poomsae e turma infantil.',             'Faixa preta 3º dan');

  -- =================================================================
  -- TURMAS E HORÁRIOS (0 = domingo ... 6 = sábado)
  -- =================================================================
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, vagas, cor)
    values (ac, mo_jj, pr_jj, 'Jiu-jitsu Adulto', 'adulto', 25, '#2563eb') returning id into t_jj;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, vagas, cor)
    values (ac, mo_jj, pr_jj, 'Jiu-jitsu Kids', 'infantil', 15, '#60a5fa') returning id into t_jjk;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, vagas, cor)
    values (ac, mo_judo, pr_judo, 'Judô Adulto', 'adulto', 20, '#7c3aed') returning id into t_judo;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, vagas, cor)
    values (ac, mo_judo, pr_judo, 'Judô Kids', 'infantil', 15, '#a78bfa') returning id into t_judok;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, cor)
    values (ac, mo_mt, pr_mt, 'Muay Thai', 'adulto', '#dc2626') returning id into t_mt;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico, cor)
    values (ac, mo_tkd, pr_tkd, 'Taekwondo', 'todas as idades', '#059669') returning id into t_tkd;

  insert into horarios (turma_id, dia_semana, hora_inicio, hora_fim, tipo_treino, local, vale_de) values
    -- Jiu-jitsu adulto: seg leve, qua pesado, sex técnico
    (t_jj, 1, '19:00', '20:30', 'leve',    'Tatame 1', hoje - 120),
    (t_jj, 3, '19:00', '20:30', 'pesado',  'Tatame 1', hoje - 120),
    (t_jj, 5, '19:00', '20:30', 'técnico', 'Tatame 1', hoje - 120),
    (t_jjk, 2, '17:00', '18:00', 'kids',   'Tatame 1', hoje - 120),
    (t_jjk, 4, '17:00', '18:00', 'kids',   'Tatame 1', hoje - 120),
    -- Judô: ter/qui
    (t_judo, 2, '19:00', '20:30', 'técnico', 'Tatame 2', hoje - 120),
    (t_judo, 4, '19:00', '20:30', 'randori', 'Tatame 2', hoje - 120),
    (t_judok, 6, '09:00', '10:00', 'kids',   'Tatame 2', hoje - 120),
    -- Muay Thai: seg/qua (mesmo horário do jiu-jitsu, outro espaço)
    (t_mt, 1, '19:00', '20:00', 'técnico', 'Sala de luta', hoje - 120),
    (t_mt, 3, '19:00', '20:00', 'pesado',  'Sala de luta', hoje - 120),
    -- Taekwondo: seg e qua, três horários seguidos
    (t_tkd, 1, '16:00', '17:00', 'kids',    'Tatame 2', hoje - 120),
    (t_tkd, 1, '17:00', '18:00', 'técnico', 'Tatame 2', hoje - 120),
    (t_tkd, 3, '16:00', '17:00', 'kids',    'Tatame 2', hoje - 120),
    (t_tkd, 3, '17:00', '18:00', 'poomsae', 'Tatame 2', hoje - 120);

  -- =================================================================
  -- ALUNOS (16 jovens/adultos) — idades e pesos variados
  -- =================================================================
  for i in 1..16 loop
    m := pil_pessoa(ac,
      'Aluno ' || lpad(i::text, 2, '0'),
      case when i = 1 then 'aluno.piloto@aluno.com'
           else 'aluno' || lpad(i::text, 2, '0') || '.piloto@example.com' end,
      case when i % 4 = 0 then 'F' else 'M' end,
      make_date(1990 + (i * 7) % 20, 1 + (i * 5) % 12, 1 + (i * 3) % 28),
      'aluno');
    alunos := alunos || m;
  end loop;

  -- Telefone (WhatsApp), "aluno desde", foto para metade (a outra metade
  -- mostra o bonequinho padrão) e último acesso ao site
  for i in 1..16 loop
    update membros set entrou_em = hoje - (60 + i * 37) where id = alunos[i];
    update perfis set
      telefone = '55000000002' || lpad(i::text, 2, '0'),
      foto_url = case when i % 2 = 1
                      then 'https://api.dicebear.com/9.x/adventurer/svg?seed=Aluno' || i end,
      ultimo_acesso = case when i % 3 <> 0 then now() - make_interval(hours => i * 9) end
     where id = (select perfil_id from membros where id = alunos[i]);
  end loop;
  -- Aluno 15 é novato (entrou há 10 dias)
  update membros set entrou_em = hoje - 10 where id = alunos[15];

  -- Aniversário de alguém daqui a poucos dias (para aparecer o aviso)
  update perfis set nascimento = make_date(2000, extract(month from hoje + 5)::int,
                                           least(extract(day from hoje + 5)::int, 28))
   where email = 'aluno03.piloto@example.com';

  -- Apelidos (público e interno)
  update perfis set apelido = 'Tanque'   where email = 'aluno02.piloto@example.com';
  update perfis set apelido = 'Formiga'  where email = 'aluno05.piloto@example.com';
  update membros set apelido_interno = 'Sempre chega atrasado' where id = alunos[4];
  update membros set observacoes = 'Lesão antiga no ombro direito — evitar kimura forte.' where id = alunos[6];

  -- Crianças (sem login) e responsáveis
  for i in 1..4 loop
    m := pil_pessoa(ac, 'Criança ' || lpad(i::text, 2, '0'),
                    'crianca' || lpad(i::text, 2, '0') || '.piloto@example.com',
                    case when i % 2 = 0 then 'F' else 'M' end,
                    make_date(2015 + i, 1 + i * 2, 10 + i), 'aluno');
    criancas := criancas || m;
  end loop;
  -- (crianças não terão login: o e-mail fica só para o piloto poder ser recriado)

  insert into perfis (nome, email, sexo, telefone, trocar_senha)
    values ('Responsável 01', 'responsavel.piloto@resp.com', 'F', '5500000000010', false)
    returning id into resp1;
  insert into perfis (nome, email, sexo, telefone, trocar_senha)
    values ('Responsável 02', 'responsavel02.piloto@example.com', 'M', '5500000000011', false)
    returning id into resp2;

  insert into responsaveis (responsavel_id, dependente_id, parentesco)
  select resp1, perfil_id, 'mãe' from membros where id in (criancas[1], criancas[2]);
  insert into responsaveis (responsavel_id, dependente_id, parentesco)
  select resp2, perfil_id, 'pai' from membros where id in (criancas[3], criancas[4]);

  -- =================================================================
  -- MATRÍCULAS
  -- =================================================================
  insert into matriculas (turma_id, membro_id, desde)
  select t_jj, alunos[x], hoje - 200 from generate_series(1, 10) g(x);
  insert into matriculas (turma_id, membro_id, desde)
  select t_judo, alunos[x], hoje - 200 from generate_series(7, 14) g(x);     -- 7 a 10 fazem os dois
  insert into matriculas (turma_id, membro_id, desde)
  select t_mt, alunos[x], hoje - 150 from generate_series(11, 16) g(x);
  insert into matriculas (turma_id, membro_id, desde)
  select t_tkd, alunos[x], hoje - 150 from generate_series(14, 16) g(x);
  insert into matriculas (turma_id, membro_id, desde) values
    (t_jjk, criancas[1], hoje - 200), (t_jjk, criancas[2], hoje - 200),
    (t_judok, criancas[3], hoje - 200), (t_judok, criancas[4], hoje - 200),
    (t_tkd, criancas[1], hoje - 120);
  update membros set entrou_em = hoje - 200 where id = any(criancas);
  update matriculas set desde = hoje - 10 where membro_id = alunos[15];
  -- Exemplo de matrícula trancada
  update matriculas set status = 'trancada' where membro_id = alunos[16] and turma_id = t_tkd;

  -- =================================================================
  -- CHAMADAS DAS ÚLTIMAS 8 SEMANAS
  -- Cada aluno tem uma "frequência" diferente; alguns atrasam;
  -- o Aluno 07 sumiu há 3 semanas (para o alerta de faltas).
  -- =================================================================
  for h in select * from horarios where turma_id in (t_jj, t_jjk, t_judo, t_judok, t_mt, t_tkd) loop
    for d in select g::date from generate_series(hoje - 56, hoje - 1, interval '1 day') g
             where extract(dow from g)::int = h.dia_semana loop

      insert into aulas (turma_id, horario_id, data, hora_inicio, hora_fim, tipo_treino, observacao)
      values (h.turma_id, h.id, d, h.hora_inicio, h.hora_fim, h.tipo_treino,
              case when h.tipo_treino = 'pesado' then 'Rola de 6 min, troca a cada round.'
                   when h.tipo_treino = 'técnico' then 'Passagem de guarda e raspagens.' end)
      on conflict (turma_id, data, hora_inicio) do nothing
      returning id into v_aula;

      if v_aula is null then continue; end if;

      for m in select membro_id from matriculas
               where turma_id = h.turma_id and status = 'ativa' and desde <= d loop
        k := array_position(alunos, m);
        v_chance := case
          when k in (1, 2)   then 95   -- os mais assíduos (empate no topo)
          when k in (3, 8)   then 85
          when k = 7 and d > hoje - 21 then 0   -- sumiu
          when k is null     then 80   -- crianças
          else 55 + (coalesce(k, 1) * 3) % 30 end;
        v_hash := abs(hashtext(m::text || d::text));
        if v_hash % 100 < v_chance then
          insert into presencas (aula_id, membro_id, metodo, chegou_em, atraso_min, confirmado_por)
          values (v_aula, m,
                  (array['manual','qr_fixo','qr_fixo','facial'])[1 + v_hash % 4],
                  (d + h.hora_inicio)::timestamp at time zone 'America/Sao_Paulo',
                  case when k = 4 then 10 + v_hash % 15          -- o atrasado de sempre
                       when v_hash % 10 = 0 then 5 + v_hash % 20  -- atraso eventual
                       else 0 end,
                  (select professor_id from turmas where id = h.turma_id));
        end if;
      end loop;
      v_aula := null;
    end loop;
  end loop;

  -- Uma aula cancelada (feriado) para aparecer no calendário
  update aulas set status = 'cancelada', observacao = 'Feriado municipal'
   where id = (select id from aulas where turma_id = t_jj order by data desc limit 1);
  delete from presencas
   where aula_id in (select id from aulas where status = 'cancelada');

  -- =================================================================
  -- FALTAS JUSTIFICADAS E SAÍDA DE ALUNO
  -- =================================================================
  -- justificada (lesão), não justificada (passeio), e uma ainda pendente
  insert into ausencias (membro_id, de, ate, motivo, observacao, status, avaliada_por, avaliada_em)
  values
    (alunos[6],  hoje - 30, hoje - 16, 'lesao',   'Lesão no ombro, liberado pelo médico.',
     'justificada', pr_jj, now() - interval '29 days'),
    (alunos[12], hoje - 12, hoje - 8,  'passeio', 'Viagem de férias com a família.',
     'nao_justificada', pr_judo, now() - interval '11 days'),
    (alunos[3],  hoje - 3,  hoje + 4,  'estudos', 'Semana de provas na faculdade.',
     'pendente', null, null);
  update ausencias a set avisada_por = m.perfil_id from membros m where m.id = a.membro_id;
  delete from presencas p using aulas a, ausencias j
   where a.id = p.aula_id and j.membro_id = p.membro_id
     and a.data between j.de and j.ate;

  -- Aluno 13 saiu da academia há 15 dias (mudou de cidade)
  update matriculas set status = 'encerrada', ate = hoje - 15 where membro_id = alunos[13];
  delete from presencas p using aulas a
   where a.id = p.aula_id and p.membro_id = alunos[13] and a.data > hoje - 15;
  update membros set ativo = false, saiu_em = hoje - 15, motivo_saida = 'Mudou de cidade'
   where id = alunos[13];

  -- =================================================================
  -- FAIXAS
  -- =================================================================
  for i in 1..16 loop
    insert into graduacoes (membro_id, modalidade_id, faixa, grau, data, registrado_por)
    select alunos[i], t.modalidade_id,
           (mo.graduacoes)[1 + (i % greatest(array_length(mo.graduacoes, 1) - 1, 1))],
           i % 4, hoje - (30 * (1 + i % 6)), t.professor_id
      from matriculas mt join turmas t on t.id = mt.turma_id
      join modalidades mo on mo.id = t.modalidade_id
     where mt.membro_id = alunos[i];
  end loop;
  insert into graduacoes (membro_id, modalidade_id, faixa, grau, registrado_por)
  select c, t.modalidade_id, 'Branca', 2, t.professor_id
    from unnest(criancas) c
    join matriculas mt on mt.membro_id = c
    join turmas t on t.id = mt.turma_id;
  -- Histórico: Aluno 01 trocou de faixa no jiu-jitsu
  insert into graduacoes (membro_id, modalidade_id, faixa, grau, data, registrado_por, observacao)
  values (alunos[1], mo_jj, 'Branca', 4, hoje - 400, pr_jj, 'Primeira faixa'),
         (alunos[1], mo_jj, 'Azul', 1, hoje - 20, pr_jj, 'Graduação de fim de semestre');

  -- =================================================================
  -- PESO E ALTURA (6 meses de histórico para os gráficos)
  -- =================================================================
  for i in 1..16 loop
    select perfil_id into pf from membros where id = alunos[i];
    for k in 0..5 loop
      insert into medidas (perfil_id, data, peso_kg, altura_cm, registrado_por)
      values (pf, hoje - (k * 30),
              (case when i % 4 = 0 then 55 else 68 end) + (i * 2.3) - (k * 0.6) + (i % 3),
              (case when i % 4 = 0 then 162 else 172 end) + (i % 9),
              pf);
    end loop;
  end loop;
  insert into medidas (perfil_id, data, peso_kg, altura_cm)
  select perfil_id, hoje - 10, 25 + (row_number() over ()) * 4, 120 + (row_number() over ()) * 6
    from membros where id = any(criancas);

  -- =================================================================
  -- CLASSES DE IDADE E CATEGORIAS DE PESO (EXEMPLO — confira na federação)
  -- =================================================================
  insert into classes_idade (academia_id, modalidade_id, nome, idade_min, idade_max, ordem)
    values (ac, mo_judo, 'Sub-15', 13, 14, 1) returning id into cl_s15;
  insert into classes_idade (academia_id, modalidade_id, nome, idade_min, idade_max, ordem)
    values (ac, mo_judo, 'Sub-18', 15, 17, 2);
  insert into classes_idade (academia_id, modalidade_id, nome, idade_min, idade_max, ordem)
    values (ac, mo_judo, 'Sub-21', 18, 20, 3) returning id into cl_s21;
  insert into classes_idade (academia_id, modalidade_id, nome, idade_min, idade_max, ordem)
    values (ac, mo_judo, 'Sênior', 21, null, 4) returning id into cl_sen;

  insert into categorias_peso (classe_id, sexo, nome, limite_kg, ordem)
  select c, 'M', x.nome, x.lim, x.ord
    from unnest(array[cl_s21, cl_sen]) c,
         (values ('-60 kg',60,1),('-66 kg',66,2),('-73 kg',73,3),('-81 kg',81,4),
                 ('-90 kg',90,5),('-100 kg',100,6),('+100 kg',null,7)) x(nome, lim, ord);
  insert into categorias_peso (classe_id, sexo, nome, limite_kg, ordem)
  select c, 'F', x.nome, x.lim, x.ord
    from unnest(array[cl_s21, cl_sen]) c,
         (values ('-48 kg',48,1),('-52 kg',52,2),('-57 kg',57,3),('-63 kg',63,4),
                 ('-70 kg',70,5),('-78 kg',78,6),('+78 kg',null,7)) x(nome, lim, ord);

  -- Jiu-jitsu: classes simples de exemplo
  insert into classes_idade (academia_id, modalidade_id, nome, idade_min, idade_max, ordem)
  values (ac, mo_jj, 'Juvenil', 16, 17, 1), (ac, mo_jj, 'Adulto', 18, 29, 2),
         (ac, mo_jj, 'Master', 30, null, 3);
  insert into categorias_peso (classe_id, sexo, nome, limite_kg, ordem)
  select c.id, 'M', x.nome, x.lim, x.ord
    from classes_idade c,
         (values ('Pena',70,1),('Leve',76,2),('Médio',82.3,3),('Meio-pesado',88.3,4),
                 ('Pesado',94.3,5),('Super-pesado',100.5,6),('Pesadíssimo',null,7)) x(nome, lim, ord)
   where c.modalidade_id = mo_jj;
  insert into categorias_peso (classe_id, sexo, nome, limite_kg, ordem)
  select c.id, 'F', x.nome, x.lim, x.ord
    from classes_idade c,
         (values ('Pena',58.5,1),('Leve',64,2),('Médio',69,3),('Pesado',null,4)) x(nome, lim, ord)
   where c.modalidade_id = mo_jj;

  -- =================================================================
  -- EVENTOS DO CALENDÁRIO
  -- =================================================================
  insert into eventos (academia_id, modalidade_id, tipo, titulo, descricao, inicio, fim,
                       local, pesagem_em, publico)
  values (ac, mo_judo, 'campeonato', 'Campeonato Estadual (exemplo)',
          'Inscrições até uma semana antes. Levar carteirinha da federação.',
          (hoje + 21) + time '08:00', (hoje + 21) + time '18:00',
          'Ginásio Municipal', (hoje + 20) + time '18:00', true)
  returning id into ev_camp;

  insert into eventos (academia_id, modalidade_id, tipo, titulo, descricao, inicio, local, publico)
  values (ac, mo_jj, 'prova', 'Graduação de fim de ano — Jiu-jitsu',
          'Troca de faixas e graus. Família convidada!', (hoje + 35) + time '10:00',
          'Academia Piloto', true)
  returning id into ev_prova;

  insert into eventos (academia_id, tipo, titulo, descricao, inicio, publico) values
    (ac, 'evento', 'Confraternização de fim de ano', 'Churrasco + amigo oculto 🎁',
     (hoje + 40) + time '13:00', true),
    (ac, 'evento', 'Aulão aberto de muay thai', 'Traga um amigo!', (hoje + 9) + time '10:00', true);
  insert into eventos (academia_id, tipo, titulo, inicio, publico, cancela_aulas)
  values (ac, 'feriado', 'Feriado municipal (exemplo)', (hoje + 14) + time '00:00', true, true);

  -- Inscritos no campeonato (com classe e categoria copiadas da ficha)
  insert into inscricoes_evento (evento_id, membro_id, classe, categoria_peso, faixa, peso_inscricao)
  select ev_camp, a.membro_id, a.classe, a.categoria_peso,
         (select faixa from graduacoes g where g.membro_id = a.membro_id
            and g.modalidade_id = mo_judo order by data desc limit 1),
         a.peso_kg
    from atletas_categoria a
   where a.academia_id = ac and a.modalidade_id = mo_judo and a.classe is not null
     and a.membro_id <> alunos[8]
   order by a.nome
   limit 5;

  -- Cronograma do Estadual: pesagem por classe/categoria e lutas
  insert into cronograma_evento (evento_id, tipo, titulo, classe, sexo, categorias,
                                 inicio, fim, local, observacao) values
    (ev_camp, 'pesagem', 'Pesagem', 'Sub-21', 'M', null,
     (hoje + 20) + time '18:00', (hoje + 20) + time '19:00', 'Ginásio Municipal — sala 2',
     'Levar documento com foto e carteirinha da federação.'),
    (ev_camp, 'pesagem', 'Pesagem', 'Sênior', 'M', array['-81 kg','-90 kg','-100 kg','+100 kg'],
     (hoje + 20) + time '19:00', (hoje + 20) + time '20:00', 'Ginásio Municipal — sala 2', null),
    (ev_camp, 'pesagem', 'Pesagem feminina', null, 'F', null,
     (hoje + 20) + time '18:00', (hoje + 20) + time '20:00', 'Ginásio Municipal — sala 3', null),
    (ev_camp, 'luta', 'Início das lutas', 'Sub-21', null, null,
     (hoje + 21) + time '08:30', null, 'Tatames 1 e 2', null),
    (ev_camp, 'luta', 'Início das lutas', 'Sênior', null, null,
     (hoje + 21) + time '11:00', null, 'Tatames 1 e 2', null),
    (ev_camp, 'premiacao', 'Premiação', null, null, null,
     (hoje + 21) + time '17:00', null, 'Pódio central', null);
  update inscricoes_evento set area = 'Tatame ' || (1 + abs(hashtext(membro_id::text)) % 2),
         horario_luta = (hoje + 21) + time '09:00'
                        + make_interval(mins => abs(hashtext(membro_id::text)) % 180)
   where evento_id = ev_camp;

  -- Evento de TESTE começando daqui a ~45 min: rode "select gerar_lembretes();"
  -- logo depois do piloto e veja as notificações de pesagem aparecendo.
  insert into eventos (academia_id, modalidade_id, tipo, titulo, descricao, inicio, local, publico)
  values (ac, mo_jj, 'evento', 'Seletiva interna (teste de notificação)',
          'Evento de teste para ver o lembrete de pesagem.', now() + interval '75 minutes',
          'Academia Piloto', false)
  returning id into ev_teste;
  insert into inscricoes_evento (evento_id, membro_id, classe, categoria_peso)
  select ev_teste, alunos[x], 'Adulto', 'Médio' from generate_series(1, 3) g(x);
  insert into cronograma_evento (evento_id, tipo, titulo, inicio, local)
  values (ev_teste, 'pesagem', 'Pesagem', now() + interval '45 minutes', 'Recepção');

  -- Um campeonato passado, com resultados (histórico de medalhas)
  insert into eventos (academia_id, modalidade_id, tipo, titulo, inicio, local, publico)
  values (ac, mo_judo, 'campeonato', 'Copa Regional (exemplo, já aconteceu)',
          (hoje - 45) + time '08:00', 'Ginásio Regional', true)
  returning id into ev_prova;
  insert into inscricoes_evento (evento_id, membro_id, classe, categoria_peso, peso_pesagem,
                                 pesagem_ok, resultado)
  select ev_prova, alunos[x], 'Sênior', '-81 kg', 80.4, true,
         (array['ouro','prata','bronze','participou'])[1 + (x % 4)]
    from generate_series(7, 10) g(x);

  -- =================================================================
  -- CARTEIRINHAS (2025 inativa → 2026 ativa = histórico)
  -- A imagem é gerada pelo site; aqui ficam só os registros.
  -- =================================================================
  insert into carteirinhas (academia_id, membro_id, tipo, ano, valida_ate)
  select ac, x, 'academia', 2025, make_date(2025, 12, 31) from unnest(alunos[1:6]) x;
  insert into carteirinhas (academia_id, membro_id, tipo, ano, valida_ate)
  select ac, x, 'academia', extract(year from hoje)::int,
         make_date(extract(year from hoje)::int, 12, 31)
    from unnest(alunos || criancas) x;
  insert into carteirinhas (academia_id, membro_id, tipo, entidade, numero, ano, valida_ate)
  select ac, alunos[x], 'federacao', 'Federação de Judô (exemplo)',
         'FJ-' || lpad((1000 + x)::text, 5, '0'), extract(year from hoje)::int,
         make_date(extract(year from hoje)::int, 12, 31)
    from generate_series(7, 12) g(x);

  -- =================================================================
  -- MENSALIDADES
  -- =================================================================
  insert into planos (academia_id, nome, valor, descricao) values
    (ac, '2x por semana', 120, 'Uma modalidade, duas aulas por semana') returning id into plano_2x;
  insert into planos (academia_id, nome, valor, descricao) values
    (ac, 'Livre', 180, 'Todas as modalidades, quantas aulas quiser') returning id into plano_livre;
  insert into planos (academia_id, nome, valor, descricao) values
    (ac, 'Kids', 100, 'Turmas infantis') returning id into plano_kids;

  insert into assinaturas (membro_id, plano_id, valor, dia_vencimento)
  select x, case when n % 3 = 0 then plano_livre else plano_2x end,
         case when n % 3 = 0 then 180 when n = 5 then 100 else 120 end,  -- Aluno 05 com desconto
         (array[5,10,15,20])[1 + n % 4]
    from unnest(alunos) with ordinality u(x, n);
  insert into assinaturas (membro_id, plano_id, valor, dia_vencimento)
  select x, plano_kids, 100, 10 from unnest(criancas) x;

  -- Últimos 3 meses + mês atual
  for k in 0..3 loop
    insert into cobrancas (academia_id, membro_id, competencia, vencimento, valor,
                           status, pago_em, valor_pago, forma, registrado_por)
    select ac, s.membro_id,
           (date_trunc('month', hoje) - make_interval(months => k))::date,
           (date_trunc('month', hoje) - make_interval(months => k))::date + (s.dia_vencimento - 1),
           s.valor,
           case
             when k = 0 and abs(hashtext(s.membro_id::text)) % 2 = 0 then 'aberta'
             when k = 1 and s.membro_id in (alunos[4], alunos[7]) then 'aberta'   -- atrasados
             else 'paga' end,
           case
             when k = 0 and abs(hashtext(s.membro_id::text)) % 2 = 0 then null
             when k = 1 and s.membro_id in (alunos[4], alunos[7]) then null
             else (date_trunc('month', hoje) - make_interval(months => k))::date
                  + (s.dia_vencimento - 1) - (abs(hashtext(s.membro_id::text)) % 4) end,
           case
             when k = 0 and abs(hashtext(s.membro_id::text)) % 2 = 0 then null
             when k = 1 and s.membro_id in (alunos[4], alunos[7]) then null
             else s.valor end,
           case
             when k = 0 and abs(hashtext(s.membro_id::text)) % 2 = 0 then null
             when k = 1 and s.membro_id in (alunos[4], alunos[7]) then null
             else formas[1 + abs(hashtext(s.membro_id::text || k::text)) % 4] end,
           adm
      from assinaturas s
     where s.membro_id = any(alunos || criancas);
  end loop;
  -- Pagamentos no futuro não fazem sentido: ajusta para hoje
  update cobrancas set pago_em = hoje where pago_em > hoje;

  -- =================================================================
  -- AVISOS
  -- =================================================================
  insert into avisos (academia_id, escopo, titulo, texto, fixado, publico, autor_id, expira_em) values
    (ac, 'geral', 'Bem-vindo à Academia Piloto! 👊',
     'Esta é uma academia de demonstração. Fuce à vontade em tudo.', true, true, adm, null),
    (ac, 'geral', 'Uniforme novo disponível',
     'Kimonos e camisas da academia na recepção.', false, true, adm, now() + interval '20 days');
  insert into avisos (academia_id, escopo, turma_id, titulo, texto, autor_id, expira_em) values
    (ac, 'turma', t_jj, 'Sexta é dia de técnica',
     'Tragam caderno: vamos montar a sequência de passagens.', pr_jj, now() + interval '10 days'),
    (ac, 'turma', t_judok, 'Festa das crianças',
     'Sábado depois da aula, cada um traz um lanche. 🎉', pr_judo, now() + interval '15 days');
  insert into avisos (academia_id, escopo, data, titulo, texto, autor_id) values
    (ac, 'dia', hoje, 'Hoje o ar-condicionado está em manutenção',
     'Tragam garrafa de água extra. 💧', adm);
  insert into avisos (academia_id, escopo, modalidade_id, titulo, texto, autor_id) values
    (ac, 'modalidade', mo_judo, 'Inscrições abertas para o Estadual',
     'Falem com o professor até sexta. Carteirinha da federação em dia!', pr_judo);

  -- =================================================================
  -- AULAS EXPERIMENTAIS (uma em cada etapa do funil)
  -- =================================================================
  insert into aulas_experimentais (academia_id, modalidade_id, professor_id, nome, telefone,
                                   nascimento, mensagem, status, criado_em, agendada_para) values
    (ac, mo_jj,   pr_jj,   'Visitante 01', '5500000000101', '1999-04-04',
     'Nunca treinei, posso ir?', 'nova', now() - interval '2 hours', null),
    (ac, mo_mt,   null,    'Visitante 02', '5500000000102', '1995-07-07',
     'Quero perder peso.', 'encaminhada', now() - interval '1 day', null),
    (ac, mo_judo, pr_judo, 'Visitante 03', '5500000000103', '2010-09-09',
     'É para meu filho de 16 anos.', 'agendada', now() - interval '3 days',
     (hoje + 2) + time '19:00'),
    (ac, mo_tkd,  pr_tkd,  'Visitante 04', '5500000000104', '2016-02-02',
     null, 'compareceu', now() - interval '6 days', (hoje - 4) + time '16:00'),
    (ac, mo_jj,   pr_jj,   'Visitante 05', '5500000000105', '1993-12-12',
     null, 'matriculou', now() - interval '20 days', (hoje - 18) + time '19:00'),
    (ac, mo_mt,   pr_mt,   'Visitante 06', '5500000000106', '2001-01-01',
     null, 'desistiu', now() - interval '25 days', (hoje - 22) + time '19:00');
  update aulas_experimentais set encaminhada_para = pr_mt where nome = 'Visitante 02';

  -- =================================================================
  -- PENDÊNCIAS / RECADOS (além das automáticas de carteirinha)
  -- =================================================================
  insert into pendencias (academia_id, membro_id, evento_id, tipo, titulo, descricao,
                          visivel_aluno, prazo, criada_por) values
    (ac, alunos[1], null, 'documento', 'Trazer atestado médico',
     'Atestado de aptidão para atividade física (validade de 1 ano).', true, hoje + 7, pr_jj),
    (ac, alunos[2], null, 'conversa', 'Conversar sobre a graduação',
     'Avaliar troca de faixa no fim do ano.', false, null, pr_jj),
    (ac, alunos[4], null, 'pagamento', 'Mensalidade atrasada',
     'Lembrar com jeito no fim da aula.', false, null, adm),
    (ac, alunos[10], ev_camp, 'documento', 'Trazer RG para a pesagem',
     'Original ou cópia autenticada.', true, hoje + 18, pr_judo);

  -- Aluno 01 já respondeu o atestado (anexou a foto) → professor só confirma
  update pendencias
     set status = 'respondida', resposta = 'Já enviei a foto do atestado!',
         anexo_url = 'https://picsum.photos/seed/piloto-atestado/800/1100',
         respondida_em = now() - interval '3 hours'
   where membro_id = alunos[1] and titulo = 'Trazer atestado médico';

  -- Pendência em massa: mesmo recado para toda a turma de Judô Kids
  -- (no site isso é a função criar_pendencias_em_massa)
  insert into pendencias (academia_id, membro_id, tipo, titulo, descricao, prazo,
                          criada_por, grupo_id)
  select ac, mt.membro_id, 'outro', 'Trazer kimono branco no sábado',
         'Foto da turma para o fim de ano 📸', hoje + 6, pr_judo, v_grupo
    from matriculas mt where mt.turma_id = t_judok and mt.status = 'ativa';

  -- Aluno 08 com peso desatualizado (para aparecer no checklist do campeonato)
  insert into inscricoes_evento (evento_id, membro_id, classe, categoria_peso, faixa)
  values (ev_camp, alunos[8], 'Sub-21', '-78 kg', 'Branca')
  on conflict do nothing;
  delete from medidas where perfil_id = (select perfil_id from membros where id = alunos[8])
     and data > hoje - 40;

  -- =================================================================
  -- FEEDBACKS
  -- =================================================================
  insert into feedbacks (academia_id, autor_id, tipo, sobre, texto, status, resposta) values
    (ac, null,      'sugestao', 'academia', 'Poderia ter aula de jiu-jitsu no sábado de manhã.', 'novo', null),
    (ac, alunos[2], 'elogio',   'aula',     'A aula de técnica de sexta está excelente!', 'lido', null),
    (ac, null,      'critica',  'academia', 'O vestiário feminino precisa de mais ganchos.', 'resolvido',
     'Instalamos 10 ganchos novos. Obrigado pelo aviso!'),
    (ac, alunos[9], 'sugestao', 'sistema',  'Seria legal receber aviso quando o professor postar material.', 'novo', null);

  -- =================================================================
  -- MATERIAL DE APOIO
  -- =================================================================
  insert into materiais (academia_id, autor_id, titulo, descricao, tipo, url)
  values (ac, adm, 'Regulamento interno', 'Regras de convivência e higiene no tatame.',
          'texto', null) returning id into mat;
  update materiais set conteudo = '1. Unhas cortadas. 2. Kimono limpo. 3. Chinelo fora do tatame. '
                               || '4. Respeito acima de tudo.' where id = mat;
  insert into material_destinos values (mat, 'academia', ac);

  insert into materiais (academia_id, autor_id, titulo, descricao, tipo, url)
  values (ac, pr_jj, 'Sequência de passagens — aula de sexta', 'Assista antes do treino.',
          'video', 'https://www.youtube.com/results?search_query=passagem+de+guarda+jiu+jitsu') returning id into mat;
  insert into material_destinos values (mat, 'turma', t_jj);

  insert into materiais (academia_id, autor_id, titulo, descricao, tipo, url)
  values (ac, pr_judo, 'Nage-waza da faixa azul (PDF)', 'Material para a próxima prova de faixa.',
          'pdf', 'https://example.com/apostila-exemplo.pdf') returning id into mat;
  insert into material_destinos values (mat, 'modalidade', mo_judo);

  -- Só para os competidores do Estadual
  insert into materiais (academia_id, autor_id, titulo, descricao, tipo, conteudo, e_atividade, prazo)
  values (ac, pr_judo, 'Preparação para o Estadual 🏆',
          'Plano das 3 semanas antes do campeonato.', 'texto',
          'Semana 1: volume de randori. Semana 2: situações de luta e golden score. '
          || 'Semana 3: polimento, corte de peso controlado e descanso.',
          true, hoje + 18) returning id into mat;
  insert into material_destinos (material_id, alvo, alvo_id)
  select mat, 'aluno', membro_id from inscricoes_evento where evento_id = ev_camp;
  insert into material_progresso (material_id, membro_id, visto_em, concluido_em)
  select mat, membro_id, now() - interval '1 day', null
    from inscricoes_evento where evento_id = ev_camp limit 2;

  -- =================================================================
  -- FEED
  -- =================================================================
  for i in 1..6 loop
    insert into posts (academia_id, autor_id, aula_id, legenda, criado_em)
    values (ac,
            (array[pr_jj, alunos[1], alunos[2], pr_judo, alunos[11], pr_mt])[i],
            (select id from aulas where turma_id = (array[t_jj,t_jj,t_jj,t_judo,t_mt,t_mt])[i]
               and status = 'normal' order by data desc offset (i % 2) limit 1),
            (array['Treino pesado de hoje! Orgulho dessa turma 💪',
                   'Primeiro treino com a faixa azul 🔵',
                   'Rola bom demais hoje 🔥',
                   'Randori de quinta no capricho 🥋',
                   'Muay thai sem dó 🥊',
                   'Turma completa hoje, obrigada pela presença!'])[i],
            now() - make_interval(days => i * 2))
    returning id into post;

    insert into post_midias (post_id, tipo, url, ordem)
    select post, 'foto', 'https://picsum.photos/seed/piloto-post' || i || '-' || n || '/900/900', n
      from generate_series(1, 1 + i % 3) n;

    insert into post_marcacoes (post_id, membro_id)
    select post, alunos[n] from generate_series(1, 4) n where (n + i) % 2 = 0;

    insert into curtidas (post_id, membro_id)
    select post, alunos[n] from generate_series(1, 16) n where (n * i) % 3 <> 0;
  end loop;

  -- =================================================================
  -- CONSENTIMENTOS (todos com direito de imagem; alguns com biometria)
  -- =================================================================
  insert into consentimentos (perfil_id, academia_id, tipo, versao_termo, aceito_por, e_responsavel)
  select m2.perfil_id, ac, 'imagem', 'v1-exemplo',
         case when m2.id = any(criancas) then 'Responsável (exemplo)' else p2.nome end,
         m2.id = any(criancas)
    from membros m2 join perfis p2 on p2.id = m2.perfil_id
   where m2.academia_id = ac and m2.papel = 'aluno';
  insert into consentimentos (perfil_id, academia_id, tipo, versao_termo, aceito_por)
  select m2.perfil_id, ac, 'biometria', 'v1-exemplo', p2.nome
    from membros m2 join perfis p2 on p2.id = m2.perfil_id
   where m2.id = any(alunos[1:8]);

  -- =================================================================
  -- NOTIFICAÇÕES DE EXEMPLO (para o Aluno 01 e o professor)
  -- =================================================================
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select ac, perfil_id, x.tipo, x.titulo, x.texto, x.link
    from membros,
         (values ('aviso', 'Novo aviso da academia', 'Uniforme novo disponível.', '/avisos'),
                 ('vencimento', 'Mensalidade vence em 3 dias', 'Plano 2x por semana — R$ 120,00', '/mensalidades'),
                 ('material', 'Novo material', 'Sequência de passagens — aula de sexta', '/materiais'))
         x(tipo, titulo, texto, link)
   where id = alunos[1];
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select ac, perfil_id, x.tipo, x.titulo, x.texto, x.link
    from membros,
         (values ('aniversario', 'Aniversário chegando 🎂', 'Aluno 03 faz aniversário em 5 dias.', '/aniversarios'),
                 ('falta', 'Aluno sumido', 'Aluno 07 não vem há 3 semanas.', '/alunos'),
                 ('experimental', 'Nova aula experimental', 'Visitante 01 quer conhecer o jiu-jitsu.', '/experimentais'))
         x(tipo, titulo, texto, link)
   where id = pr_jj;
end $$;

drop function pil_pessoa(uuid, text, text, text, date, text);

-- Resumo do que foi criado
select
  (select count(*) from membros m join academias a on a.id = m.academia_id
    where a.slug = 'academia-piloto' and m.papel = 'aluno') as alunos,
  (select count(*) from aulas au join turmas t on t.id = au.turma_id
     join academias a on a.id = t.academia_id where a.slug = 'academia-piloto') as aulas,
  (select count(*) from presencas p join aulas au on au.id = p.aula_id
     join turmas t on t.id = au.turma_id join academias a on a.id = t.academia_id
    where a.slug = 'academia-piloto') as presencas;
