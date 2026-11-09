-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 01
-- Rode no SQL Editor. NÃO apaga nada: só acrescenta.
-- Novidades: vocabulário de judô (roletas e quiz), resultados do quiz,
-- Judô Clube Denis (base para mostrar ao professor).
-- =====================================================================

-- ---------- Vocabulário (palavras em japonês) ----------
create table if not exists vocabulario (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  termo          text not null,                  -- grafia correta
  grafia_antiga  text,                           -- como estava na folha antiga (referência)
  significado    text not null,
  categoria      text,                           -- Etiqueta, Arbitragem, Fundamentos...
  lista          text not null default 'basica' check (lista in ('basica','ampliada')),
  ordem          int default 0,
  criado_em      timestamptz default now()
);
create index if not exists vocabulario_acad on vocabulario (academia_id, lista, ordem);

-- ---------- Resultados dos quizzes (para o aluno ver a evolução) ----------
create table if not exists quiz_resultados (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  membro_id    uuid not null references membros(id) on delete cascade,
  modo         text not null,                    -- palavra-significado, tecnica-tipo...
  acertos      int not null,
  total        int not null,
  criado_em    timestamptz default now()
);

alter table vocabulario     enable row level security;
alter table quiz_resultados enable row level security;

drop policy if exists ver on vocabulario;
drop policy if exists gerir on vocabulario;
create policy ver on vocabulario for select using (participo(academia_id));
create policy gerir on vocabulario for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

drop policy if exists ver on quiz_resultados;
drop policy if exists registrar on quiz_resultados;
create policy ver on quiz_resultados for select
  using (membro_id in (select meus_membros()) or sou_equipe(academia_id));
create policy registrar on quiz_resultados for insert
  with check (membro_id in (select meus_membros()));

-- Copiar o vocabulário para outra academia em que você também é admin
create or replace function copiar_vocabulario(p_origem uuid, p_destino uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not (sou_admin(p_origem) and sou_admin(p_destino)) then
    raise exception 'Você precisa ser admin das duas academias.';
  end if;
  insert into vocabulario (academia_id, termo, grafia_antiga, significado, categoria, lista, ordem)
  select p_destino, termo, grafia_antiga, significado, categoria, lista, ordem
    from vocabulario where academia_id = p_origem;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Lista base de vocabulário (60 palavras + ampliada) para academias de judô
create or replace function semear_vocabulario(p_acad uuid) returns void
language sql as $$
  insert into vocabulario (academia_id, termo, significado, categoria, lista, ordem)
  select p_acad, v.t, v.s, v.c, v.l, v.o
    from (values
      ('Rei', 'Saudação, cumprimento', 'Etiqueta', 'basica', 1),
      ('Ritsu-rei', 'Saudação em pé', 'Etiqueta', 'basica', 2),
      ('Za-rei', 'Saudação ajoelhado', 'Etiqueta', 'basica', 3),
      ('Seiza', 'Sentar ajoelhado sobre os calcanhares', 'Etiqueta', 'basica', 4),
      ('Anza', 'Sentar de pernas cruzadas', 'Etiqueta', 'basica', 5),
      ('Mokuso', 'Meditação, concentração', 'Etiqueta', 'basica', 6),
      ('Shomen ni rei', 'Saudação à frente (aos mestres)', 'Etiqueta', 'basica', 7),
      ('Sensei ni rei', 'Saudação ao professor', 'Etiqueta', 'basica', 8),
      ('Otagai ni rei', 'Saudação entre os alunos', 'Etiqueta', 'basica', 9),
      ('Onegaishimasu', 'Por favor (pedido para treinar junto)', 'Etiqueta', 'basica', 10),
      ('Arigato gozaimashita', 'Muito obrigado', 'Etiqueta', 'basica', 11),
      ('Dojo', 'Local de treino', 'Dojô', 'basica', 12),
      ('Judogi', 'Uniforme de judô', 'Dojô', 'basica', 13),
      ('Obi', 'Faixa', 'Dojô', 'basica', 14),
      ('Tatami', 'Tapete do treino', 'Dojô', 'basica', 15),
      ('Sensei', 'Professor, mestre', 'Dojô', 'basica', 16),
      ('Senpai', 'Aluno mais graduado ou mais antigo', 'Dojô', 'basica', 17),
      ('Kohai', 'Aluno menos graduado ou mais novo', 'Dojô', 'basica', 18),
      ('Judoka', 'Praticante de judô', 'Dojô', 'basica', 19),
      ('Tori', 'Quem aplica a técnica', 'Dojô', 'basica', 20),
      ('Uke', 'Quem recebe a técnica', 'Dojô', 'basica', 21),
      ('Kyu', 'Graduações antes da faixa preta', 'Dojô', 'basica', 22),
      ('Dan', 'Graduações da faixa preta', 'Dojô', 'basica', 23),
      ('Hajime', 'Começar', 'Arbitragem', 'basica', 24),
      ('Matte', 'Parar, esperar', 'Arbitragem', 'basica', 25),
      ('Sono-mama', 'Não se mexam, fiquem como estão', 'Arbitragem', 'basica', 26),
      ('Yoshi', 'Continuar (após sono-mama)', 'Arbitragem', 'basica', 27),
      ('Sore-made', 'Fim da luta', 'Arbitragem', 'basica', 28),
      ('Ippon', 'Ponto completo, vitória', 'Arbitragem', 'basica', 29),
      ('Waza-ari', 'Meio ponto', 'Arbitragem', 'basica', 30),
      ('Osaekomi', 'Imobilização valendo', 'Arbitragem', 'basica', 31),
      ('Toketa', 'Imobilização desfeita', 'Arbitragem', 'basica', 32),
      ('Shido', 'Punição leve', 'Arbitragem', 'basica', 33),
      ('Hansoku-make', 'Desclassificação', 'Arbitragem', 'basica', 34),
      ('Hantei', 'Decisão dos árbitros', 'Arbitragem', 'basica', 35),
      ('Maitta', 'Desisto (bater para desistir)', 'Arbitragem', 'basica', 36),
      ('Kumi-kata', 'Forma de pegar no judogi (pegada)', 'Fundamentos', 'basica', 37),
      ('Shisei', 'Postura', 'Fundamentos', 'basica', 38),
      ('Shizen-tai', 'Postura natural', 'Fundamentos', 'basica', 39),
      ('Jigo-tai', 'Postura defensiva', 'Fundamentos', 'basica', 40),
      ('Kuzushi', 'Desequilíbrio', 'Fundamentos', 'basica', 41),
      ('Tsukuri', 'Preparação, encaixe', 'Fundamentos', 'basica', 42),
      ('Kake', 'Execução, projeção', 'Fundamentos', 'basica', 43),
      ('Tai-sabaki', 'Giro, movimentação do corpo', 'Fundamentos', 'basica', 44),
      ('Shintai', 'Deslocamento', 'Fundamentos', 'basica', 45),
      ('Tsugi-ashi', 'Passo seguido (um pé segue o outro)', 'Fundamentos', 'basica', 46),
      ('Ayumi-ashi', 'Passo normal, alternado', 'Fundamentos', 'basica', 47),
      ('Ukemi', 'Queda, amortecimento', 'Fundamentos', 'basica', 48),
      ('Randori', 'Treino livre', 'Treino', 'basica', 49),
      ('Uchi-komi', 'Repetição da entrada da técnica', 'Treino', 'basica', 50),
      ('Nage-komi', 'Repetição com projeção', 'Treino', 'basica', 51),
      ('Kata', 'Forma, sequência pré-definida', 'Treino', 'basica', 52),
      ('Shiai', 'Competição, luta oficial', 'Treino', 'basica', 53),
      ('Nage-waza', 'Técnicas de projeção', 'Técnicas', 'basica', 54),
      ('Katame-waza', 'Técnicas de controle (solo)', 'Técnicas', 'basica', 55),
      ('Tachi-waza', 'Técnicas em pé', 'Técnicas', 'basica', 56),
      ('Ne-waza', 'Técnicas no solo', 'Técnicas', 'basica', 57),
      ('Osaekomi-waza', 'Técnicas de imobilização', 'Técnicas', 'basica', 58),
      ('Shime-waza', 'Técnicas de estrangulamento', 'Técnicas', 'basica', 59),
      ('Kansetsu-waza', 'Técnicas de chave de articulação', 'Técnicas', 'basica', 60),
      ('Te-waza', 'Técnicas de braço/mão', 'Técnicas', 'ampliada', 1),
      ('Koshi-waza', 'Técnicas de quadril', 'Técnicas', 'ampliada', 2),
      ('Ashi-waza', 'Técnicas de perna/pé', 'Técnicas', 'ampliada', 3),
      ('Sutemi-waza', 'Técnicas de sacrifício', 'Técnicas', 'ampliada', 4),
      ('Ma-sutemi-waza', 'Sacrifício de costas', 'Técnicas', 'ampliada', 5),
      ('Yoko-sutemi-waza', 'Sacrifício lateral', 'Técnicas', 'ampliada', 6),
      ('Gokyo', 'Os cinco grupos de técnicas do Kodokan', 'Técnicas', 'ampliada', 7),
      ('Kodokan', 'Instituto fundado por Jigoro Kano', 'História', 'ampliada', 8),
      ('Jigoro Kano', 'Criador do judô (1882)', 'História', 'ampliada', 9),
      ('Seiryoku zenyo', 'Máxima eficiência com mínimo esforço', 'Princípios', 'ampliada', 10),
      ('Jita kyoei', 'Bem-estar e benefício mútuo', 'Princípios', 'ampliada', 11),
      ('Ju', 'Suavidade, ceder', 'Princípios', 'ampliada', 12),
      ('Do', 'Caminho', 'Princípios', 'ampliada', 13),
      ('Kiai', 'Grito de energia', 'Treino', 'ampliada', 14),
      ('Taiso', 'Ginástica, aquecimento', 'Treino', 'ampliada', 15),
      ('Kaeshi-waza', 'Técnicas de contra-ataque', 'Técnicas', 'ampliada', 16),
      ('Renraku-waza', 'Combinação de técnicas', 'Técnicas', 'ampliada', 17),
      ('Migi', 'Direita', 'Direções', 'ampliada', 18),
      ('Hidari', 'Esquerda', 'Direções', 'ampliada', 19),
      ('Mae', 'Frente', 'Direções', 'ampliada', 20),
      ('Ushiro', 'Trás', 'Direções', 'ampliada', 21),
      ('Yoko', 'Lado', 'Direções', 'ampliada', 22),
      ('O', 'Grande', 'Palavras das técnicas', 'ampliada', 23),
      ('Ko', 'Pequeno', 'Palavras das técnicas', 'ampliada', 24),
      ('Uchi', 'Por dentro', 'Palavras das técnicas', 'ampliada', 25),
      ('Soto', 'Por fora', 'Palavras das técnicas', 'ampliada', 26),
      ('Gari', 'Ceifada', 'Palavras das técnicas', 'ampliada', 27),
      ('Harai', 'Varrida', 'Palavras das técnicas', 'ampliada', 28),
      ('Guruma', 'Roda', 'Palavras das técnicas', 'ampliada', 29),
      ('Otoshi', 'Queda', 'Palavras das técnicas', 'ampliada', 30),
      ('Gaeshi', 'Reversão', 'Palavras das técnicas', 'ampliada', 31),
      ('Nage', 'Projeção', 'Palavras das técnicas', 'ampliada', 32),
      ('Gatame', 'Controle, imobilização', 'Palavras das técnicas', 'ampliada', 33),
      ('Jime', 'Estrangulamento', 'Palavras das técnicas', 'ampliada', 34),
      ('Eri', 'Gola', 'Corpo e judogi', 'ampliada', 35),
      ('Sode', 'Manga', 'Corpo e judogi', 'ampliada', 36),
      ('Hiza', 'Joelho', 'Corpo e judogi', 'ampliada', 37),
      ('Kata (ombro)', 'Ombro', 'Corpo e judogi', 'ampliada', 38),
      ('Ude', 'Braço', 'Corpo e judogi', 'ampliada', 39),
      ('Ashi', 'Perna, pé', 'Corpo e judogi', 'ampliada', 40),
      ('Ichi', 'Um', 'Números', 'ampliada', 41),
      ('Ni', 'Dois', 'Números', 'ampliada', 42),
      ('San', 'Três', 'Números', 'ampliada', 43),
      ('Shi / Yon', 'Quatro', 'Números', 'ampliada', 44),
      ('Go', 'Cinco', 'Números', 'ampliada', 45),
      ('Roku', 'Seis', 'Números', 'ampliada', 46),
      ('Shichi / Nana', 'Sete', 'Números', 'ampliada', 47),
      ('Hachi', 'Oito', 'Números', 'ampliada', 48),
      ('Ku / Kyu', 'Nove', 'Números', 'ampliada', 49),
      ('Ju (número)', 'Dez', 'Números', 'ampliada', 50)
    ) as v(t, s, c, l, o)
   where not exists (select 1 from vocabulario where academia_id = p_acad);
$$;

select semear_vocabulario(id) from academias where slug in ('dojo-alcantara', 'academia-piloto', 'projeto-social-michel');

-- ---------- Judô Clube Denis (base para mostrar ao professor) ----------
do $$
declare jc uuid; mj uuid; eu uuid; m_prof uuid;
begin
  if exists (select 1 from academias where slug = 'judo-clube-denis') then return; end if;
  select id into eu from perfis where lower(email) = 'judo.matheus.alcantara@gmail.com' limit 1;

  insert into academias (slug, nome, slogan, sobre, cidade, cores, no_diretorio, tipo, modulos)
  values ('judo-clube-denis', 'Judô Clube Denis', 'Tradição e disciplina no tatame.',
          'Escreva aqui a história do clube: quando começou, quem fundou e as conquistas. (Edite em Personalizar academia.)',
          'Três Rios - RJ', '{"primaria":"#1d4ed8","secundaria":"#0b0b12"}', false, 'academia',
          '{"sobre":true,"propaganda":false,"calendario":true,"avisos":true,"ranking":true,"feed":true,
            "materiais":true,"mensalidades":true,"carteirinha":true,"campeonatos":true,"aula_experimental":true,
            "feedback":true,"ia":false,"tecnicas":false,"galeria":false}')
  returning id into jc;

  insert into modalidades (academia_id, nome, cor, icone, graduacoes, cores_graduacoes, ordem)
  values (jc, 'Judô', '#1d4ed8', '🥋',
          array['Branca','Azul','Amarela','Laranja','Verde','Roxa','Marrom','Preta'],
          array['#f5f5f5','#1d4ed8','#facc15','#f97316','#16a34a','#7c3aed','#78350f','#111111'], 1)
  returning id into mj;

  if eu is not null then
    insert into membros (academia_id, perfil_id, papel) values (jc, eu, 'admin');
    insert into membros (academia_id, perfil_id, papel) values (jc, eu, 'professor') returning id into m_prof;
    insert into professores_modalidades (membro_id, modalidade_id, graduacao) values (m_prof, mj, 'Faixa preta 2º dan');
  end if;
  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico)
  values (jc, mj, m_prof, 'Judô Infantil', 'infantil'), (jc, mj, m_prof, 'Judô Adulto', 'adulto');
end $$;
