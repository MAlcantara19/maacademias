-- #####################################################################
-- MA ACADEMIAS — INSTALAR TUDO (um arquivo só)
-- ATENÇÃO: apaga TODOS os dados do app e recria do zero (os logins do
-- Authentication continuam). Para atualizar SEM perder dados, rode só os
-- arquivos ATUALIZAR-xx.sql novos.
-- #####################################################################


-- #####################################################################
-- PARTE 1 — RECOMEÇAR DO ZERO
-- #####################################################################

-- =====================================================================
-- RECOMEÇAR DO ZERO: apaga todas as tabelas do app (NÃO apaga os logins)
-- =====================================================================
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
drop trigger if exists trg_vincula_login on auth.users;


-- #####################################################################
-- PARTE 2 — ESTRUTURA DO BANCO
-- #####################################################################

-- =====================================================================
-- MA ACADEMIAS — BANCO COMPLETO (Supabase / Postgres)
-- Arquivo único: rode inteiro, uma vez só, num projeto Supabase novo.
--
-- Um sistema para várias academias. Quase tudo é separado por academia.
-- Papéis: master (você), admin da academia, professor, aluno e
-- responsável (pai/mãe que acessa no lugar da criança).
--
-- Índice
--   1. Academias e página pública
--   2. Pessoas, papéis e responsáveis
--   3. Modalidades, professores e turmas
--   4. Horários, aulas e calendário
--   5. Presença, check-in, atrasos e ranking
--   6. Acompanhamento do atleta (faixa, peso, categoria)
--   7. Campeonatos e inscrições
--   8. Carteirinhas (academia e federação) com histórico
--   9. Mensalidades e recibos
--  10. Avisos, aula experimental e feedback
--  11. Material de apoio
--  12. Feed
--  13. Consentimentos (LGPD) e reconhecimento facial
--  14. Notificações
--  15. Histórico de alterações (+ vínculo login ↔ perfil)
--  16. Funções de segurança
--  17. Check-in pelo QR fixo
--  18. Regras de acesso (RLS)
--  19. Armazenamento de arquivos
--  20. Agendamento dos lembretes (pg_cron)
-- =====================================================================

-- Gera um código aleatório (usado em QR e carteirinhas)
create or replace function novo_codigo() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;


-- =====================================================================
-- 1. ACADEMIAS E PÁGINA PÚBLICA
-- =====================================================================
create table academias (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,          -- endereço: /clube-de-luta
  dominio        text unique,                   -- clubedeluta.com.br (opcional)
  nome           text not null,
  slogan         text,
  logo_url       text,
  capa_url       text,                          -- imagem/vídeo do topo
  cores          jsonb default '{}'::jsonb,     -- {"primaria":"#5b21b6","secundaria":"#0b0b0f"}
  tema           jsonb default '{}'::jsonb,     -- fontes, efeitos, fundo
  sobre          text,                          -- "Sobre nós" / história
  endereco       text,
  cidade         text,
  latitude       double precision,              -- mapa e check-in
  longitude      double precision,
  maps_url       text,
  whatsapp       text,
  instagram      text,
  email          text,
  cnpj           text,
  pix_chave      text,                          -- chave Pix para as mensalidades
  pix_nome       text,                          -- nome do recebedor (até 25 letras)
  pix_cidade     text,                          -- cidade do recebedor (até 15 letras)
  no_diretorio   boolean default false,         -- aparece na página geral/mapa?
  tipo           text not null default 'academia' check (tipo in ('academia','projeto_social')),
  tecnicas_progressivas boolean default true,   -- aluno vê a matéria até a próxima faixa
  ativa          boolean default true,

  -- Módulos que a academia liga/desliga ("modo analógico" x "modo tecnológico")
  modulos        jsonb default '{
    "sobre": true, "propaganda": false, "calendario": true, "avisos": true,
    "ranking": true, "feed": false, "materiais": true, "mensalidades": false,
    "carteirinha": true, "campeonatos": true, "aula_experimental": true,
    "feedback": true, "ia": false, "tecnicas": false, "galeria": false
  }'::jsonb,

  -- Chamada: manual, qr_fixo, facial (pode ter mais de um)
  modos_chamada  text[] default array['manual'],

  -- Check-in pelo QR fixo na parede
  qr_fixo_token          text unique default novo_codigo(),
  checkin_raio_m         int default 150,   -- distância máxima da academia
  checkin_antes_min      int default 30,    -- pode marcar até X min antes da aula
  tolerancia_atraso_min  int default 10,    -- depois disso conta como atraso

  -- Alertas automáticos
  alerta_faltas_seguidas int default 2,     -- avisa após X faltas seguidas
  alerta_dias_sem_vir    int default 7,     -- ou X dias sem aparecer
  aviso_aniversario_dias int default 7,     -- avisa X dias antes do aniversário
  aviso_vencimento_dias  int default 3,     -- lembra a mensalidade X dias antes
  -- Financeiro
  gerar_mensalidades_auto boolean default true,  -- cria as cobranças do mês sozinho
  multa_pct              numeric(5,2) default 2,    -- multa por atraso (% uma vez)
  juros_mes_pct          numeric(5,2) default 1,    -- juros ao mês (% pro rata dia)
  juros_dias_uteis       boolean default false,     -- conta só dias úteis no atraso
  cobrar_apos_dias       int default 5,             -- lembrete de atraso X dias depois
  pendencia_apos_dias    int default 10,            -- vira pendência "conversar" após X dias
  alerta_mensalidades_atrasadas int default 2,      -- aviso no check-in a partir de X atrasadas
  -- Engajamento
  reengajar_dias         int default 14,            -- "sentimos sua falta" após X dias
  lembrete_peso_semanal  boolean default true,      -- segunda-feira: lembrar competidores do peso

  criado_em      timestamptz default now()
);

-- Banners de propaganda (aparecem só com o módulo "propaganda" ligado)
create table propagandas (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  titulo       text,
  texto        text,
  imagem_url   text not null,
  link         text,
  ordem        int default 0,
  inicio       date,
  fim          date,
  ativa        boolean default true
);


-- =====================================================================
-- 2. PESSOAS, PAPÉIS E RESPONSÁVEIS
-- Uma pessoa (perfil) pode estar em várias academias com papéis diferentes.
-- user_id vazio = pessoa sem login (ex.: criança, que acessa pelo responsável).
-- =====================================================================
create table perfis (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users(id) on delete set null,
  nome                  text not null,
  apelido               text,
  sexo                  text check (sexo in ('M','F')),   -- usado nas categorias de peso
  nascimento            date,           -- o ANO conta para a idade de campeonato
  telefone              text,
  email                 text,
  foto_url              text,           -- foto do perfil
  foto_carteirinha_url  text,           -- foto da carteirinha (se vazia, usa a do perfil)
  contato_emergencia_nome text,
  contato_emergencia_tel  text,
  trocar_senha          boolean default true,   -- senha provisória no 1º acesso
  ultimo_acesso         timestamptz,            -- atualizado pelo site a cada visita
  tours_vistos          text[] default '{}',    -- tours guiados já concluídos
  boas_vindas_em        timestamptz,            -- quando viu a tela de boas-vindas
  criado_em             timestamptz default now()
);

create table membros (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academias(id) on delete cascade,
  perfil_id        uuid not null references perfis(id) on delete cascade,
  papel            text not null check (papel in ('admin','professor','aluno')),
  apelido_interno  text,                         -- só a equipe vê
  observacoes      text,                         -- anotações da equipe
  ativo            boolean default true,
  entrou_em        date default current_date,   -- "aluno desde"
  saiu_em          date,                        -- encerrou o vínculo
  motivo_saida     text,
  unique (academia_id, perfil_id, papel)         -- admin também pode ser professor
);

-- Master da plataforma (você). Cadastre seu user_id aqui pelo painel do Supabase.
create table masters (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Pai/mãe com login ligados aos filhos (sem login)
create table responsaveis (
  responsavel_id uuid not null references perfis(id) on delete cascade,
  dependente_id  uuid not null references perfis(id) on delete cascade,
  parentesco     text,
  principal      boolean default true,   -- recebe avisos e cobranças
  pode_buscar    boolean default true,   -- autorizado a buscar a criança
  primary key (responsavel_id, dependente_id),
  check (responsavel_id <> dependente_id)
);


-- =====================================================================
-- 3. MODALIDADES, PROFESSORES E TURMAS
-- =====================================================================
create table modalidades (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  nome         text not null,                 -- Jiu-jitsu, Muay Thai, Judô...
  descricao    text,
  cor          text,
  icone        text,
  graduacoes   text[],                        -- ordem das faixas da modalidade
  cores_graduacoes text[],                    -- cor de cada faixa (moldura da foto)
  graus_max    int default 4,                 -- graus por faixa
  ordem        int default 0,
  ativa        boolean default true
);

-- Professor por modalidade (com WhatsApp público na página da academia)
create table professores_modalidades (
  membro_id        uuid not null references membros(id) on delete cascade,
  modalidade_id    uuid not null references modalidades(id) on delete cascade,
  whatsapp_publico text,
  bio              text,
  graduacao        text,                      -- ex.: faixa preta 2º dan
  primary key (membro_id, modalidade_id)
);

create table turmas (
  id            uuid primary key default gen_random_uuid(),
  academia_id   uuid not null references academias(id) on delete cascade,
  modalidade_id uuid not null references modalidades(id) on delete cascade,
  professor_id  uuid references membros(id) on delete set null,
  nome          text not null,                -- "Jiu-jitsu Adulto", "Judô Kids"
  publico       text,                         -- infantil, adulto, feminino...
  vagas         int,                          -- lotação (vazio = sem limite)
  cor           text,
  ativa         boolean default true
);

create table matriculas (
  turma_id   uuid not null references turmas(id) on delete cascade,
  membro_id  uuid not null references membros(id) on delete cascade,
  status     text default 'ativa' check (status in ('ativa','trancada','encerrada')),
  desde      date default current_date,
  ate        date,                            -- preenchido ao encerrar
  primary key (turma_id, membro_id)
);


-- =====================================================================
-- 4. HORÁRIOS, AULAS E CALENDÁRIO
-- O professor cadastra a REGRA ("toda quinta 19h–20h, treino pesado")
-- e o calendário monta o mês sozinho. "aulas" guarda só o que aconteceu
-- de fato (chamada) ou exceções (cancelada, horário mudado).
-- Feriados nacionais vêm da BrasilAPI; municipais entram em "eventos".
-- =====================================================================
create table horarios (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references turmas(id) on delete cascade,
  dia_semana   int not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio  time not null,
  hora_fim     time not null,
  tipo_treino  text,                          -- leve, pesado, técnico...
  local        text,                          -- tatame 1, sala 2
  vale_de      date default current_date,
  vale_ate     date,
  check (hora_fim > hora_inicio)
);

create table aulas (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references turmas(id) on delete cascade,
  horario_id   uuid references horarios(id) on delete set null,
  data         date not null,
  hora_inicio  time not null,
  hora_fim     time,
  tipo_treino  text,
  status       text default 'normal' check (status in ('normal','cancelada','alterada')),
  observacao   text,                          -- anotação do professor sobre a aula
  unique (turma_id, data, hora_inicio)
);

-- Campeonatos, provas de faixa, eventos, feriados municipais
create table eventos (
  id            uuid primary key default gen_random_uuid(),
  academia_id   uuid not null references academias(id) on delete cascade,
  modalidade_id uuid references modalidades(id) on delete set null,  -- vazio = todas
  tipo          text not null check (tipo in ('campeonato','prova','evento','feriado','outro')),
  titulo        text not null,
  descricao     text,
  inicio        timestamptz not null,
  fim           timestamptz,
  local         text,
  maps_url      text,
  link          text,                          -- edital, inscrição oficial
  pesagem_em    timestamptz,                   -- campeonatos
  publico       boolean default true,          -- aparece na página pública?
  cancela_aulas boolean default false          -- feriado/evento que suspende as aulas
);


-- =====================================================================
-- 5. PRESENÇA, CHECK-IN, ATRASOS E RANKING
-- =====================================================================
create table presencas (
  aula_id        uuid not null references aulas(id) on delete cascade,
  membro_id      uuid not null references membros(id) on delete cascade,
  metodo         text not null check (metodo in ('manual','qr_fixo','carteirinha','facial')),
  chegou_em      timestamptz default now(),
  atraso_min     int default 0,               -- minutos após o início da aula
  confirmado_por uuid references membros(id) on delete set null,
  primary key (aula_id, membro_id)
);
create index on presencas (membro_id);

-- Ausências avisadas. O aluno/responsável só AVISA ("não vou, estou
-- viajando"); quem decide é o professor:
--   pendente        → aviso recebido, professor ainda não avaliou
--   justificada     → (lesão, doença...) não conta contra a porcentagem
--   nao_justificada → (passeio...) conta como falta normal
-- Em nenhum caso vira presença: o ranking por quantidade não muda.
create table ausencias (
  id             uuid primary key default gen_random_uuid(),
  membro_id      uuid not null references membros(id) on delete cascade,
  de             date not null,
  ate            date not null,
  motivo         text not null check (motivo in
                 ('lesao','doenca','viagem','passeio','trabalho','estudos','familia','trancamento','outro')),
  observacao     text,
  status         text not null default 'pendente'
                 check (status in ('pendente','justificada','nao_justificada')),
  avisada_por    uuid references perfis(id) on delete set null,   -- aluno ou responsável
  avaliada_por   uuid references membros(id) on delete set null,  -- professor
  avaliada_em    timestamptz,
  criada_em      timestamptz default now(),
  check (ate >= de)
);

-- Pendências e recados por aluno: "trazer documento", "conversar sobre
-- o campeonato", "renovar carteirinha"... Aparecem na tela da chamada
-- ao lado do nome e, se visível ao aluno, chegam como lembrete antes da aula.
create table pendencias (
  id                 uuid primary key default gen_random_uuid(),
  academia_id        uuid not null references academias(id) on delete cascade,
  membro_id          uuid not null references membros(id) on delete cascade,
  evento_id          uuid references eventos(id) on delete cascade,  -- ligada a um campeonato
  tipo               text not null default 'outro'
                     check (tipo in ('documento','carteirinha','pagamento','conversa','peso','outro')),
  titulo             text not null,
  descricao          text,
  visivel_aluno      boolean default true,    -- false = anotação só da equipe
  mostrar_na_chamada boolean default true,
  prazo              date,
  -- aberta → respondida (aluno marcou "já enviei"/anexou) → resolvida (professor confirmou)
  status             text not null default 'aberta' check (status in ('aberta','respondida','resolvida')),
  resposta           text,                    -- resposta do aluno
  anexo_url          text,                    -- foto do documento enviada pelo aluno
  respondida_em      timestamptz,
  grupo_id           uuid,                    -- mesmo recado criado para vários (em massa)
  automatica         boolean default false,   -- criada pelo sistema
  criada_por         uuid references membros(id) on delete set null,
  criada_em          timestamptz default now(),
  resolvida_por      uuid references membros(id) on delete set null,
  resolvida_em       timestamptz
);
create index on pendencias (membro_id, status);

-- Controle dos lembretes já enviados (evita notificação repetida)
create table lembretes_enviados (
  chave      text primary key,
  enviado_em timestamptz default now()
);


-- =====================================================================
-- 6. ACOMPANHAMENTO DO ATLETA
-- =====================================================================
create table graduacoes (
  id             uuid primary key default gen_random_uuid(),
  membro_id      uuid not null references membros(id) on delete cascade,
  modalidade_id  uuid not null references modalidades(id) on delete cascade,
  faixa          text not null,
  grau           int default 0,
  data           date default current_date,
  observacao     text,
  registrado_por uuid references membros(id) on delete set null
);

-- Peso e altura com histórico (gráficos). Aluno ou professor podem lançar.
create table medidas (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references perfis(id) on delete cascade,
  data           date default current_date,
  peso_kg        numeric(5,2),
  altura_cm      numeric(5,1),
  registrado_por uuid references perfis(id) on delete set null,
  observacao     text
);
create index on medidas (perfil_id, data desc);

-- Classes de idade por modalidade (Sub-18, Sub-21, Sênior...)
-- Idade de campeonato = ano atual − ano de nascimento.
create table classes_idade (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  modalidade_id  uuid not null references modalidades(id) on delete cascade,
  nome           text not null,
  idade_min      int not null,
  idade_max      int,                         -- vazio = sem limite
  ordem          int default 0
);

-- Categorias de peso dentro de cada classe
create table categorias_peso (
  id         uuid primary key default gen_random_uuid(),
  classe_id  uuid not null references classes_idade(id) on delete cascade,
  sexo       text not null check (sexo in ('M','F','misto')),
  nome       text not null,                   -- "-73 kg", "+100 kg"
  limite_kg  numeric(5,2),                    -- vazio = categoria aberta ("+100")
  ordem      int default 0
);


-- =====================================================================
-- 7. CAMPEONATOS E INSCRIÇÕES
-- Lista pronta no dia da pesagem: atleta, categoria, peso e carteirinhas.
-- =====================================================================
create table inscricoes_evento (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references eventos(id) on delete cascade,
  membro_id      uuid not null references membros(id) on delete cascade,
  classe         text,                        -- copiada na inscrição (fica no histórico)
  categoria_peso text,
  faixa          text,
  peso_inscricao numeric(5,2),
  peso_pesagem   numeric(5,2),                -- anotado no dia
  area           text,                        -- tatame/área da luta
  horario_luta   timestamptz,
  pesagem_ok     boolean,
  resultado      text check (resultado in ('ouro','prata','bronze','participou','nao_compareceu')),
  observacao     text,
  unique (evento_id, membro_id, categoria_peso)
);


-- Cronograma do evento: pesagem por classe/categoria, lutas, premiação.
-- Cada item gera lembretes automáticos (ex.: 60 e 15 min antes) para os
-- inscritos daquela categoria, seus responsáveis e a equipe.
create table cronograma_evento (
  id               uuid primary key default gen_random_uuid(),
  evento_id        uuid not null references eventos(id) on delete cascade,
  tipo             text not null check (tipo in ('pesagem','luta','apresentacao','premiacao','outro')),
  titulo           text,
  classe           text,                      -- vazio = todas as classes
  sexo             text check (sexo in ('M','F','misto')),
  categorias       text[],                    -- vazio = todas as categorias
  inicio           timestamptz not null,
  fim              timestamptz,
  local            text,
  observacao       text,
  avisar_min_antes int[] default array[60, 15],
  so_equipe        boolean default false      -- lembrete só para professores
);


-- =====================================================================
-- 8. CARTEIRINHAS COM HISTÓRICO
-- tipo 'academia': gerada pelo site (modelo único com cores e logo
--   da academia, foto e QR). Uma por ano: 2026, 2027...
-- tipo 'federacao': foto/arquivo da carteirinha oficial (federação,
--   confederação), com número e validade.
-- Nada é apagado: as antigas ficam no histórico do aluno.
-- =====================================================================
create table carteirinhas (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  membro_id    uuid not null references membros(id) on delete cascade,
  tipo         text not null check (tipo in ('academia','federacao')),
  entidade     text,                          -- ex.: Federação de Judô do RJ
  numero       text,                          -- registro na federação
  ano          int not null default extract(year from current_date)::int,
  foto_url     text,                          -- foto usada nesta carteirinha
  imagem_url   text,                          -- imagem final (gerada ou enviada)
  codigo       text unique not null default novo_codigo(),  -- vai no QR
  valida_ate   date,
  ativa        boolean default true,
  criada_em    timestamptz default now()
);
create index on carteirinhas (membro_id, ano desc);

-- Ao criar uma carteirinha nova, a anterior do mesmo tipo/entidade fica inativa
create or replace function desativa_carteirinha_antiga() returns trigger
language plpgsql as $$
begin
  update carteirinhas
     set ativa = false
   where membro_id = new.membro_id
     and tipo = new.tipo
     and coalesce(entidade,'') = coalesce(new.entidade,'')
     and id <> new.id;
  return new;
end $$;

create trigger trg_carteirinha_nova
after insert on carteirinhas
for each row execute function desativa_carteirinha_antiga();


-- Ao inscrever no campeonato: se o atleta não tem carteirinha da
-- federação válida na data do evento, cria a pendência sozinho.
create or replace function pendencia_carteirinha_campeonato() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ev eventos%rowtype;
begin
  select * into v_ev from eventos where id = new.evento_id;
  if v_ev.tipo <> 'campeonato' or v_ev.inicio < now() then return new; end if;
  if not exists (
    select 1 from carteirinhas c
     where c.membro_id = new.membro_id and c.tipo = 'federacao' and c.ativa
       and (c.valida_ate is null or c.valida_ate >= v_ev.inicio::date)
  ) and not exists (
    select 1 from pendencias p
     where p.membro_id = new.membro_id and p.evento_id = new.evento_id
       and p.tipo = 'carteirinha' and p.status <> 'resolvida'
  ) then
    insert into pendencias (academia_id, membro_id, evento_id, tipo, titulo, descricao,
                            prazo, automatica)
    values (v_ev.academia_id, new.membro_id, new.evento_id, 'carteirinha',
            'Carteirinha da federação',
            'Envie a foto da carteirinha válida para o ' || v_ev.titulo || '.',
            greatest((v_ev.inicio - interval '3 days')::date, current_date), true);
  end if;
  return new;
end $$;

create trigger trg_inscricao_carteirinha
after insert on inscricoes_evento
for each row execute function pendencia_carteirinha_campeonato();

-- Ao enviar a carteirinha da federação, resolve a pendência automática
create or replace function resolve_pendencia_carteirinha() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'federacao' then
    update pendencias p
       set status = 'resolvida', resolvida_em = now()
      from eventos e
     where p.membro_id = new.membro_id and p.tipo = 'carteirinha'
       and p.status <> 'resolvida' and p.automatica
       and e.id = p.evento_id
       and (new.valida_ate is null or new.valida_ate >= e.inicio::date);
  end if;
  return new;
end $$;

create trigger trg_carteirinha_resolve
after insert on carteirinhas
for each row execute function resolve_pendencia_carteirinha();


-- =====================================================================
-- 9. MENSALIDADES E RECIBOS
-- =====================================================================
create table planos (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  nome         text not null,                 -- "2x por semana", "Livre"
  valor        numeric(10,2) not null,
  descricao    text,
  ativo        boolean default true
);

create table assinaturas (
  id             uuid primary key default gen_random_uuid(),
  membro_id      uuid not null references membros(id) on delete cascade,
  plano_id       uuid references planos(id) on delete set null,
  valor          numeric(10,2) not null,      -- pode ter desconto próprio
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  inicio         date default current_date,
  ativa          boolean default true
);

create table cobrancas (
  id              uuid primary key default gen_random_uuid(),
  academia_id     uuid not null references academias(id) on delete cascade,
  membro_id       uuid not null references membros(id) on delete cascade,
  competencia     date not null,               -- mês de referência (dia 1)
  vencimento      date not null,
  valor           numeric(10,2) not null,
  status          text default 'aberta' check (status in ('aberta','paga','isenta','cancelada')),
  pago_em         date,
  valor_pago      numeric(10,2),
  forma           text check (forma in ('pix','cartao','dinheiro','outro')),
  recibo_numero   bigint generated always as identity,
  comprovante_url text,
  registrado_por  uuid references membros(id) on delete set null,
  unique (membro_id, competencia)
);
-- "Atrasada" não é guardado: é status 'aberta' com vencimento no passado.


-- =====================================================================
-- 10. AVISOS, AULA EXPERIMENTAL E FEEDBACK
-- =====================================================================
create table avisos (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  escopo       text not null check (escopo in ('geral','modalidade','turma','dia')),
  modalidade_id uuid references modalidades(id) on delete cascade,
  turma_id     uuid references turmas(id) on delete cascade,
  data         date,                           -- aviso "do dia"
  titulo       text not null,
  texto        text,
  imagem_url   text,
  fixado       boolean default false,
  publico      boolean default false,          -- aparece também na página pública
  expira_em    timestamptz,                    -- some sozinho
  autor_id     uuid references membros(id) on delete set null,
  criado_em    timestamptz default now()
);

-- Funil: nova → encaminhada → agendada → compareceu → matriculou
create table aulas_experimentais (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academias(id) on delete cascade,
  modalidade_id    uuid references modalidades(id) on delete set null,
  professor_id     uuid references membros(id) on delete set null,   -- se a pessoa escolheu
  horario_id       uuid references horarios(id) on delete set null,
  data_desejada    date,
  nome             text not null,
  telefone         text not null,
  email            text,
  nascimento       date,
  mensagem         text,
  status           text default 'nova' check (status in
                   ('nova','encaminhada','agendada','compareceu','matriculou','desistiu')),
  encaminhada_para uuid references membros(id) on delete set null,
  agendada_para    timestamptz,
  perfil_id        uuid references perfis(id) on delete set null, -- quando vira aluno
  criado_em        timestamptz default now(),
  atualizada_em    timestamptz default now()
);

-- Cadastro feito pelo próprio aluno (link/QR da academia). A equipe aprova.
create table solicitacoes_cadastro (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academias(id) on delete cascade,
  nome             text not null,
  email            text,
  telefone         text,
  nascimento       date,
  sexo             text check (sexo in ('M','F')),
  modalidade_id    uuid references modalidades(id) on delete set null,
  turma_id         uuid references turmas(id) on delete set null,
  responsavel_nome text,                       -- para menores de idade
  responsavel_email text,
  responsavel_tel  text,
  aceite_imagem    boolean default false,      -- autorização de uso de imagem
  mensagem         text,
  status           text not null default 'nova' check (status in ('nova','aprovada','recusada')),
  avaliada_por     uuid references membros(id) on delete set null,
  criada_em        timestamptz default now()
);

-- Lista de espera das turmas lotadas. Quando abre vaga, a equipe é avisada
-- com o nome do próximo da fila.
create table lista_espera (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  turma_id     uuid not null references turmas(id) on delete cascade,
  membro_id    uuid references membros(id) on delete set null,   -- se já é aluno
  nome         text not null,
  telefone     text,
  email        text,
  observacao   text,
  status       text not null default 'aguardando'
               check (status in ('aguardando','chamado','entrou','desistiu')),
  chamado_em   timestamptz,
  criado_em    timestamptz default now()
);
create index on lista_espera (turma_id, status, criado_em);

-- Sugestões, críticas e elogios (anônimo = autor vazio)
create table feedbacks (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  autor_id     uuid references membros(id) on delete set null,
  tipo         text check (tipo in ('sugestao','critica','elogio')),
  sobre        text,                           -- sistema, academia, aula, professor
  texto        text not null,
  status       text default 'novo' check (status in ('novo','lido','resolvido')),
  resposta     text,
  criado_em    timestamptz default now()
);


-- =====================================================================
-- 11. MATERIAL DE APOIO
-- Liberado para a academia, uma modalidade, uma turma ou alunos
-- específicos (ex.: só quem vai ao campeonato).
-- =====================================================================
create table materiais (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  autor_id     uuid references membros(id) on delete set null,
  titulo       text not null,
  descricao    text,
  tipo         text not null check (tipo in ('pdf','video','link','imagem','texto')),
  url          text,                           -- arquivo ou link (YouTube, Drive)
  conteudo     text,                           -- material em texto
  e_atividade  boolean default false,          -- tarefa para marcar como feita
  prazo        date,
  criado_em    timestamptz default now()
);

create table material_destinos (
  material_id  uuid not null references materiais(id) on delete cascade,
  alvo         text not null check (alvo in ('academia','modalidade','turma','aluno')),
  alvo_id      uuid not null,                  -- id da academia/modalidade/turma/membro
  primary key (material_id, alvo, alvo_id)
);

create table material_progresso (
  material_id  uuid not null references materiais(id) on delete cascade,
  membro_id    uuid not null references membros(id) on delete cascade,
  visto_em     timestamptz,
  concluido_em timestamptz,
  comentario   text,
  primary key (material_id, membro_id)
);


-- =====================================================================
-- 12. FEED (rede social interna da academia)
-- =====================================================================
create table posts (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  autor_id     uuid not null references membros(id) on delete cascade,
  aula_id      uuid references aulas(id) on delete set null,  -- post do treino
  legenda      text,
  oculto       boolean default false,          -- equipe pode esconder
  criado_em    timestamptz default now()
);

create table post_midias (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references posts(id) on delete cascade,
  tipo      text check (tipo in ('foto','video','link')),
  url       text not null,
  ordem     int default 0
);

create table post_marcacoes (
  post_id   uuid not null references posts(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  primary key (post_id, membro_id)
);

create table curtidas (
  post_id   uuid not null references posts(id) on delete cascade,
  membro_id uuid not null references membros(id) on delete cascade,
  primary key (post_id, membro_id)
);


-- =====================================================================
-- 13. CONSENTIMENTOS (LGPD) E RECONHECIMENTO FACIAL
-- Dois aceites separados: imagem (fotos/vídeos) e biometria (rosto).
-- Para menores, quem aceita é o responsável. Pode revogar quando quiser.
-- =====================================================================
create table consentimentos (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references perfis(id) on delete cascade,
  academia_id   uuid not null references academias(id) on delete cascade,
  tipo          text not null check (tipo in ('imagem','biometria')),
  versao_termo  text not null,                 -- qual texto foi aceito
  aceito_por    text not null,                 -- nome de quem aceitou
  e_responsavel boolean default false,
  aceito_em     timestamptz default now(),
  revogado_em   timestamptz
);

-- Só o "código" numérico do rosto (128 números), nunca a foto.
create table rostos (
  perfil_id  uuid primary key references perfis(id) on delete cascade,
  descritor  real[] not null,
  criado_em  timestamptz default now()
);

-- Se a biometria for revogada, o código do rosto é apagado na hora
create or replace function apaga_rosto_revogado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'biometria' and new.revogado_em is not null then
    delete from rostos where perfil_id = new.perfil_id;
  end if;
  return new;
end $$;

create trigger trg_revoga_biometria
after update of revogado_em on consentimentos
for each row execute function apaga_rosto_revogado();


-- =====================================================================
-- 14. NOTIFICAÇÕES (sino do site + push no celular)
-- =====================================================================
create table notificacoes (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid references academias(id) on delete cascade,
  perfil_id    uuid not null references perfis(id) on delete cascade,
  tipo         text not null,  -- aniversario, falta, vencimento, aviso, experimental, material...
  titulo       text not null,
  texto        text,
  link         text,
  lida         boolean default false,
  criada_em    timestamptz default now()
);
create index on notificacoes (perfil_id, lida, criada_em desc);

create table push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references perfis(id) on delete cascade,
  endpoint   text unique not null,
  chaves     jsonb not null,
  aparelho   text,
  criada_em  timestamptz default now()
);

create table preferencias_notificacao (
  perfil_id        uuid primary key references perfis(id) on delete cascade,
  tipos_desligados text[] default '{}'
);


-- =====================================================================
-- 15. HISTÓRICO (quem fez o quê e quando)
-- =====================================================================
create table historico (
  id           bigint generated always as identity primary key,
  academia_id  uuid references academias(id) on delete cascade,
  user_id      uuid default auth.uid(),
  acao         text not null,                 -- criou, editou, apagou, deu baixa
  tabela       text,
  registro_id  text,
  detalhes     jsonb,
  quando       timestamptz default now()
);


-- =====================================================================
-- 15b. VÍNCULO AUTOMÁTICO LOGIN ↔ PERFIL PELO E-MAIL
-- O professor cadastra o aluno com e-mail. Quando a pessoa cria o login
-- (ou o admin cria pelo painel), o perfil é ligado sozinho.
-- Funciona nos dois sentidos: login criado antes ou depois do perfil.
-- =====================================================================
create or replace function vincula_login_novo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfis
     set user_id = new.id
   where user_id is null
     and email is not null
     and lower(email) = lower(new.email);
  return new;
end $$;

create trigger trg_vincula_login
after insert on auth.users
for each row execute function vincula_login_novo();

create or replace function vincula_perfil_novo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(new.email)
       and not exists (select 1 from perfis p where p.user_id = u.id)
     limit 1;
  end if;
  return new;
end $$;

create trigger trg_vincula_perfil
before insert or update of email on perfis
for each row execute function vincula_perfil_novo();

-- Conserto pelo próprio usuário: liga o login ao cadastro com o mesmo e-mail
-- (usado pela página /minha-conta, caso o vínculo automático não tenha acontecido)
create or replace function vincular_minha_conta() returns int
language plpgsql security definer set search_path = public as $$
declare v_email text; v_n int;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  if exists (select 1 from perfis where user_id = auth.uid()) then return 0; end if;
  update perfis set user_id = auth.uid()
   where id = (select id from perfis
                where user_id is null and lower(email) = lower(v_email)
                order by criado_em limit 1);
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- =====================================================================
-- 15c. TÉCNICAS, PROGRAMA DE FAIXA, PLANOS DE AULA E EXAMES
-- =====================================================================

-- Banco de técnicas. "faixa" = faixa em que a técnica é cobrada no exame
-- (ex.: técnicas da faixa Azul são o que o faixa branca demonstra).
-- grupo: taiso, ukemi, nage-waza, osaekomi-waza, shime-waza, kansetsu-waza,
-- kata, defesa-pessoal, outro (texto livre)
create table tecnicas (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  modalidade_id  uuid not null references modalidades(id) on delete cascade,
  faixa          text,                        -- vazio = vale para todas as faixas
  grupo          text not null,
  nome           text not null,
  nome_original  text,                        -- ex.: nome em japonês
  descricao      text,
  video_url      text,
  imagem_url     text,                        -- ficha/panfleto da técnica
  classificacao  text,                        -- te-waza, koshi-waza, ashi-waza, ma-sutemi, yoko-sutemi...
  conjunto       text,                        -- ex.: 1º grupo, 6º grupo, Shinmeisho (cor na roleta)
  ordem          int default 0,
  criada_em      timestamptz default now()
);
create index on tecnicas (modalidade_id, faixa, grupo, ordem);

-- Galerias da academia ligadas a pastas do Google Drive
create table galerias (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  titulo       text not null,
  pasta_url    text not null,
  pasta_id     text not null,
  ordem        int default 0,
  criada_em    timestamptz default now()
);

-- Regras para sugerir graduação: tempo e aulas mínimas em cada faixa
create table regras_graduacao (
  id             uuid primary key default gen_random_uuid(),
  modalidade_id  uuid not null references modalidades(id) on delete cascade,
  faixa          text not null,               -- faixa ATUAL do aluno
  min_aulas      int not null default 40,
  min_meses      int not null default 6,
  idade_minima   int,
  unique (modalidade_id, faixa)
);

-- Plano de aula: blocos (aquecimento, técnica, rola...) e técnicas usadas
create table planos_aula (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  turma_id       uuid references turmas(id) on delete set null,
  data           date,                        -- vazio = modelo para reaproveitar
  titulo         text not null,
  blocos         jsonb default '[]'::jsonb,   -- [{"tipo":"Aquecimento","minutos":10,"texto":"..."}]
  tecnicas       uuid[] default '{}',
  visivel_alunos boolean default true,
  autor_id       uuid references membros(id) on delete set null,
  criado_em      timestamptz default now()
);
create index on planos_aula (turma_id, data);

-- Exame de faixa: notas por item, resultado e (se aprovado) graduação
create table exames_faixa (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  membro_id      uuid not null references membros(id) on delete cascade,
  modalidade_id  uuid not null references modalidades(id) on delete cascade,
  faixa_atual    text,
  faixa_alvo     text not null,
  data           date default current_date,
  itens          jsonb default '[]'::jsonb,   -- [{"grupo":"nage-waza","nome":"...","nota":8}]
  nota_final     numeric(4,1),
  resultado      text check (resultado in ('aprovado','reprovado','pendente')) default 'pendente',
  observacao     text,
  avaliador_id   uuid references membros(id) on delete set null,
  criado_em      timestamptz default now()
);


-- =====================================================================
-- 16. FUNÇÕES DE SEGURANÇA
-- =====================================================================
create or replace function sou_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from masters where user_id = auth.uid());
$$;

-- Meu perfil + perfis dos meus dependentes
create or replace function meus_perfis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from perfis where user_id = auth.uid()
  union
  select r.dependente_id
    from responsaveis r
    join perfis p on p.id = r.responsavel_id
   where p.user_id = auth.uid();
$$;

-- Meus vínculos com academias (e dos meus dependentes)
create or replace function meus_membros() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from membros where perfil_id in (select meus_perfis()) and ativo;
$$;

-- Tenho algum destes papéis nesta academia?
create or replace function tenho_papel(acad uuid, papeis text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or exists (
    select 1 from membros m
    join perfis p on p.id = m.perfil_id
    where m.academia_id = acad
      and p.user_id = auth.uid()
      and m.ativo
      and m.papel = any(papeis)
  );
$$;

-- Atalhos
create or replace function sou_equipe(acad uuid) returns boolean
language sql stable as $$ select tenho_papel(acad, array['admin','professor']); $$;

create or replace function sou_admin(acad uuid) returns boolean
language sql stable as $$ select tenho_papel(acad, array['admin']); $$;

-- Faço parte da academia (eu ou meu dependente)?
create or replace function participo(acad uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_equipe(acad) or exists (
    select 1 from membros where academia_id = acad and id in (select meus_membros())
  );
$$;

-- Descobrir a academia a partir de outros registros
create or replace function acad_turma(t uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from turmas where id = t;
$$;
create or replace function acad_aula(a uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select t.academia_id from aulas au join turmas t on t.id = au.turma_id where au.id = a;
$$;
create or replace function acad_membro(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from membros where id = m;
$$;
create or replace function acad_evento(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from eventos where id = e;
$$;
create or replace function acad_post(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from posts where id = p;
$$;
create or replace function acad_material(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from materiais where id = m;
$$;
create or replace function acad_classe(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select academia_id from classes_idade where id = c;
$$;

-- A equipe de alguma academia em que esta pessoa treina?
create or replace function sou_equipe_do_perfil(pf uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or exists (
    select 1 from membros m where m.perfil_id = pf and sou_equipe(m.academia_id)
  );
$$;

-- Este material foi liberado para mim (ou meu dependente)?
create or replace function material_liberado(mat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from material_destinos d
      join materiais ma on ma.id = d.material_id
      join membros m    on m.academia_id = ma.academia_id
                       and m.id in (select meus_membros())
     where d.material_id = mat
       and (
            (d.alvo = 'academia'   and d.alvo_id = ma.academia_id)
         or (d.alvo = 'aluno'      and d.alvo_id = m.id)
         or (d.alvo = 'turma'      and exists (select 1 from matriculas mt
                                               where mt.membro_id = m.id and mt.turma_id = d.alvo_id
                                                 and mt.status = 'ativa'))
         or (d.alvo = 'modalidade' and exists (select 1 from matriculas mt
                                               join turmas t on t.id = mt.turma_id
                                               where mt.membro_id = m.id and t.modalidade_id = d.alvo_id
                                                 and mt.status = 'ativa'))
       )
  );
$$;


-- Técnica liberada para mim? Equipe vê tudo. Aluno vê as faixas até a
-- próxima da dele (se a academia usar o modo progressivo).
create or replace function tecnica_liberada(t_acad uuid, t_mod uuid, t_faixa text) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_equipe(t_acad) or (
    participo(t_acad) and (
      t_faixa is null
      or not coalesce((select tecnicas_progressivas from academias where id = t_acad), true)
      or exists (
        select 1
          from modalidades mo
          join lateral (
            select g.faixa from graduacoes g
              join membros m on m.id = g.membro_id
             where m.id in (select meus_membros()) and g.modalidade_id = t_mod
             order by g.data desc limit 1
          ) minha on true
         where mo.id = t_mod
           and array_position(mo.graduacoes, t_faixa) <= coalesce(array_position(mo.graduacoes, minha.faixa), 1) + 1
      )
      -- sem graduação registrada: vê a 1ª e a 2ª faixa
      or (not exists (select 1 from graduacoes g join membros m on m.id = g.membro_id
                       where m.id in (select meus_membros()) and g.modalidade_id = t_mod)
          and array_position((select graduacoes from modalidades where id = t_mod), t_faixa) <= 2)
    )
  );
$$;

-- Ranking de hierarquia: faixa e grau primeiro, depois o total de aulas.
-- Todo mundo da academia vê (disputa sadia), mas só nome, faixa e aulas.
create or replace function ranking_hierarquia(p_acad uuid, p_modalidade uuid)
returns table (membro_id uuid, nome text, apelido text, foto_url text, faixa text, grau int,
               cor_faixa text, total_aulas int, posicao bigint)
language sql stable security definer set search_path = public as $$
  with ult as (
    select distinct on (g.membro_id) g.membro_id, g.faixa, g.grau
      from graduacoes g where g.modalidade_id = p_modalidade
     order by g.membro_id, g.data desc
  ), base as (
    select m.id, pf.nome, pf.apelido, pf.foto_url, u.faixa, coalesce(u.grau, 0) as grau,
           mo.cores_graduacoes[array_position(mo.graduacoes, u.faixa)] as cor,
           coalesce(array_position(mo.graduacoes, u.faixa), 0) as nivel,
           (select count(*) from presencas p join aulas a on a.id = p.aula_id
              join turmas t on t.id = a.turma_id
             where p.membro_id = m.id and t.modalidade_id = p_modalidade)::int as aulas
      from membros m
      join perfis pf      on pf.id = m.perfil_id
      join modalidades mo on mo.id = p_modalidade
      left join ult u     on u.membro_id = m.id
     where m.academia_id = p_acad and m.ativo and m.papel = 'aluno'
       and participo(p_acad)
       and (u.faixa is not null or exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id
                                            where mt.membro_id = m.id and t.modalidade_id = p_modalidade
                                              and mt.status = 'ativa'))
  )
  select id, nome, apelido, foto_url, faixa, grau, cor, aulas,
         row_number() over (order by nivel desc, grau desc, aulas desc, nome)
    from base
   order by 9;
$$;

-- Copiar técnicas de uma modalidade para outra (ex.: do Dojô para o projeto
-- social). Só funciona se você for admin das duas academias.
create or replace function copiar_tecnicas(p_origem uuid, p_destino uuid, p_substituir boolean default false)
returns int
language plpgsql security definer set search_path = public as $$
declare v_ao uuid; v_ad uuid; v_n int;
begin
  select academia_id into v_ao from modalidades where id = p_origem;
  select academia_id into v_ad from modalidades where id = p_destino;
  if not (sou_admin(v_ao) and sou_admin(v_ad)) then raise exception 'Você precisa ser admin das duas academias.'; end if;
  if p_substituir then delete from tecnicas where modalidade_id = p_destino; end if;
  insert into tecnicas (academia_id, modalidade_id, faixa, grupo, nome, nome_original, descricao, video_url,
                        imagem_url, classificacao, conjunto, ordem)
  select v_ad, p_destino, faixa, grupo, nome, nome_original, descricao, video_url, imagem_url, classificacao, conjunto, ordem
    from tecnicas where modalidade_id = p_origem;
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- =====================================================================
-- VIEWS (consultas prontas)
-- security_invoker = respeitam as regras de acesso de quem consulta
-- =====================================================================

-- Faixa etária (para filtros, ranking e estatísticas)
create or replace function faixa_etaria(nasc date) returns text
language sql immutable as $$
  select case
    when nasc is null then 'Sem data'
    when extract(year from age(nasc)) <= 12 then 'Kids (até 12)'
    when extract(year from age(nasc)) <= 17 then 'Adolescentes (13–17)'
    when extract(year from age(nasc)) <= 29 then 'Adultos (18–29)'
    when extract(year from age(nasc)) <= 39 then 'Adultos (30–39)'
    else 'Master (40+)'
  end;
$$;

-- Base da frequência: uma linha por aluno x aula que ele DEVERIA ter feito
-- (aulas da turma dele, desde a matrícula, sem as canceladas).
create view frequencia_aulas with (security_invoker = true) as
select
  t.academia_id,
  t.modalidade_id,
  mt.turma_id,
  mt.membro_id,
  a.id   as aula_id,
  a.data,
  exists (select 1 from presencas p
           where p.aula_id = a.id and p.membro_id = mt.membro_id)          as presente,
  exists (select 1 from ausencias j
           where j.membro_id = mt.membro_id and j.status = 'justificada'
             and a.data between j.de and j.ate)                         as justificada
from matriculas mt
join turmas t on t.id = mt.turma_id
join aulas a  on a.turma_id = mt.turma_id
             and a.status <> 'cancelada'
             and a.data >= mt.desde
             and (mt.ate is null or a.data <= mt.ate)
             and a.data <= current_date;

-- Ranking de um período qualquer (semana, mês, ano, tudo), com filtros.
-- Traz três posições: por quantidade, por porcentagem e por faixa etária.
-- Ex.: select * from ranking_periodo('<academia>', '2026-11-01', '2026-11-30');
create or replace function ranking_periodo(
  p_acad uuid, p_de date, p_ate date,
  p_modalidade uuid default null, p_turma uuid default null
) returns table (
  membro_id uuid, nome text, apelido text, foto_url text, cor_faixa text, grau int,
  idade int, faixa_etaria text, sexo text,
  aulas_possiveis int, presencas int, faltas_justificadas int, pct numeric,
  posicao_quantidade bigint, posicao_percentual bigint, posicao_faixa_etaria bigint
)
-- security definer: todo aluno da academia vê o ranking completo
language sql stable security definer set search_path = public as $$
  with agg as (
    select f.membro_id,
           count(*) filter (where f.presente or not f.justificada)::int as possiveis,
           count(*) filter (where f.presente)::int                       as pres,
           count(*) filter (where f.justificada and not f.presente)::int as just
      from frequencia_aulas f
     where f.academia_id = p_acad
       and participo(p_acad)
       and f.data between p_de and p_ate
       and (p_modalidade is null or f.modalidade_id = p_modalidade)
       and (p_turma is null or f.turma_id = p_turma)
     group by f.membro_id
  ), calc as (
    select a.*, round(100.0 * a.pres / nullif(a.possiveis, 0), 1) as pct_calc,
           pf.nome, pf.apelido, pf.foto_url, pf.sexo,
           extract(year from age(pf.nascimento))::int as idade_calc,
           faixa_etaria(pf.nascimento) as faixa,
           g.cor_faixa, g.grau
      from agg a
      join membros m on m.id = a.membro_id
      join perfis pf on pf.id = m.perfil_id
      left join lateral (
        select gr.grau, mo.cores_graduacoes[array_position(mo.graduacoes, gr.faixa)] as cor_faixa
          from graduacoes gr join modalidades mo on mo.id = gr.modalidade_id
         where gr.membro_id = a.membro_id
           and (p_modalidade is null or gr.modalidade_id = p_modalidade)
         order by gr.data desc limit 1
      ) g on true
  )
  select c.membro_id, c.nome, c.apelido, c.foto_url, c.cor_faixa, c.grau,
         c.idade_calc, c.faixa, c.sexo,
         c.possiveis, c.pres, c.just, c.pct_calc,
         dense_rank() over (order by c.pres desc),
         dense_rank() over (order by c.pct_calc desc nulls last),
         dense_rank() over (partition by c.faixa order by c.pct_calc desc nulls last)
    from calc c
   order by c.pct_calc desc nulls last, c.pres desc, c.nome;
$$;

-- Estatística de frequência por faixa etária (quem mais falta?)
-- Ex.: select * from estatisticas_frequencia('<academia>', current_date - 30, current_date);
create or replace function estatisticas_frequencia(
  p_acad uuid, p_de date, p_ate date, p_modalidade uuid default null
) returns table (
  faixa_etaria text, alunos bigint, aulas_possiveis bigint, presencas bigint,
  faltas bigint, faltas_justificadas bigint, pct_presenca numeric
)
language sql stable as $$
  select faixa_etaria(pf.nascimento),
         count(distinct f.membro_id),
         count(*) filter (where f.presente or not f.justificada),
         count(*) filter (where f.presente),
         count(*) filter (where not f.presente and not f.justificada),
         count(*) filter (where not f.presente and f.justificada),
         round(100.0 * count(*) filter (where f.presente)
               / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1)
    from frequencia_aulas f
    join membros m on m.id = f.membro_id
    join perfis pf on pf.id = m.perfil_id
   where f.academia_id = p_acad
     and f.data between p_de and p_ate
     and (p_modalidade is null or f.modalidade_id = p_modalidade)
   group by 1
   order by 1;
$$;

-- Ranking mensal com empate: 1º, 1º, 2º, 3º...
create view ranking_mensal with (security_invoker = true) as
select
  t.academia_id,
  t.modalidade_id,
  date_trunc('month', a.data)::date as mes,
  p.membro_id,
  count(*) as aulas,
  dense_rank() over (
    partition by t.academia_id, t.modalidade_id, date_trunc('month', a.data)
    order by count(*) desc
  ) as posicao
from presencas p
join aulas a  on a.id = p.aula_id
join turmas t on t.id = a.turma_id
where a.status <> 'cancelada'
group by t.academia_id, t.modalidade_id, date_trunc('month', a.data), p.membro_id;

-- Ranking mensal por turma (separa kids de adultos)
create view ranking_turma with (security_invoker = true) as
select
  t.academia_id,
  a.turma_id,
  date_trunc('month', a.data)::date as mes,
  p.membro_id,
  count(*) as aulas,
  dense_rank() over (
    partition by a.turma_id, date_trunc('month', a.data)
    order by count(*) desc
  ) as posicao
from presencas p
join aulas a  on a.id = p.aula_id
join turmas t on t.id = a.turma_id
where a.status <> 'cancelada'
group by t.academia_id, a.turma_id, date_trunc('month', a.data), p.membro_id;

-- Pontualidade: quem chega atrasado com frequência
create view pontualidade with (security_invoker = true) as
select
  t.academia_id,
  p.membro_id,
  count(*) as presencas,
  count(*) filter (where p.atraso_min > ac.tolerancia_atraso_min) as atrasos,
  round(avg(p.atraso_min) filter (where p.atraso_min > 0), 1)     as atraso_medio_min
from presencas p
join aulas a      on a.id = p.aula_id
join turmas t     on t.id = a.turma_id
join academias ac on ac.id = t.academia_id
group by t.academia_id, p.membro_id;

-- Última presença de cada aluno (base do alerta "sumiu")
create view ultima_presenca with (security_invoker = true) as
select m.id as membro_id, m.academia_id, max(a.data) as ultima_aula
from membros m
left join presencas p on p.membro_id = m.id
left join aulas a     on a.id = p.aula_id
where m.papel = 'aluno' and m.ativo
group by m.id, m.academia_id;

-- Próximos aniversários por turma (hoje conta; 29/02 vira 28/02 em ano comum)
create view proximos_aniversarios with (security_invoker = true) as
select
  m.academia_id,
  mt.turma_id,
  m.id as membro_id,
  pf.nome,
  pf.apelido,
  pf.nascimento,
  (pf.nascimento + make_interval(
      years => extract(year from age(current_date - 1, pf.nascimento))::int + 1
  ))::date as proximo_aniversario,
  extract(year from age(current_date - 1, pf.nascimento))::int + 1 as vai_fazer
from perfis pf
join membros m     on m.perfil_id = pf.id and m.ativo
join matriculas mt on mt.membro_id = m.id and mt.status = 'ativa'
where pf.nascimento is not null;

-- Ficha de atleta: idade de campeonato, último peso, classe e categoria
create view atletas_categoria with (security_invoker = true) as
select
  m.id            as membro_id,
  m.academia_id,
  mm.modalidade_id,
  pf.nome,
  pf.sexo,
  pf.nascimento,
  extract(year from current_date)::int - extract(year from pf.nascimento)::int as idade_campeonato,
  ult.peso_kg,
  ult.data        as pesado_em,
  cl.nome         as classe,
  cp.nome         as categoria_peso
from membros m
join perfis pf on pf.id = m.perfil_id
join (select distinct mt.membro_id, t.modalidade_id
        from matriculas mt join turmas t on t.id = mt.turma_id
       where mt.status = 'ativa') mm on mm.membro_id = m.id
left join lateral (
  select md.peso_kg, md.data from medidas md
   where md.perfil_id = pf.id and md.peso_kg is not null
   order by md.data desc limit 1
) ult on true
left join lateral (
  select c.id, c.nome from classes_idade c
   where c.modalidade_id = mm.modalidade_id
     and extract(year from current_date)::int - extract(year from pf.nascimento)::int
         between c.idade_min and coalesce(c.idade_max, 999)
   order by c.idade_min desc limit 1
) cl on true
left join lateral (
  select k.nome from categorias_peso k
   where k.classe_id = cl.id
     and k.sexo in (pf.sexo, 'misto')
     and (k.limite_kg is null or ult.peso_kg <= k.limite_kg)
   order by k.limite_kg asc nulls last limit 1
) cp on true
where m.papel = 'aluno' and m.ativo;

-- Dias úteis (seg a sex) entre duas datas, sem contar a primeira
create or replace function dias_uteis_entre(d1 date, d2 date) returns int
language sql immutable as $$
  select count(*)::int from generate_series(d1 + 1, d2, interval '1 day') g
   where extract(dow from g) not in (0, 6);
$$;

-- Cobranças com atraso, multa e juros calculados até hoje
create view cobrancas_situacao with (security_invoker = true) as
select c.*,
       case when c.status = 'aberta' and c.vencimento < current_date then
         case when ac.juros_dias_uteis then dias_uteis_entre(c.vencimento, current_date)
              else current_date - c.vencimento end
       else 0 end                                                     as dias_atraso,
       (c.status = 'aberta' and c.vencimento < current_date)            as atrasada,
       case when c.status = 'aberta' and c.vencimento < current_date
            then round(c.valor * ac.multa_pct / 100, 2) else 0 end      as multa,
       case when c.status = 'aberta' and c.vencimento < current_date
            then round(c.valor * ac.juros_mes_pct / 100 / 30 *
                       case when ac.juros_dias_uteis then dias_uteis_entre(c.vencimento, current_date)
                            else current_date - c.vencimento end, 2)
            else 0 end                                                  as juros
  from cobrancas c join academias ac on ac.id = c.academia_id;

-- Valor total atualizado (valor + multa + juros) — calculado à parte para ficar legível
create view cobrancas_atualizadas with (security_invoker = true) as
select cs.*, cs.valor + cs.multa + cs.juros as total_atualizado
  from cobrancas_situacao cs;

-- Sugestão de graduação: quem já cumpriu tempo e aulas na faixa atual
create view sugestoes_graduacao with (security_invoker = true) as
with ultima as (
  select distinct on (g.membro_id, g.modalidade_id)
         g.membro_id, g.modalidade_id, g.faixa, g.grau, g.data
    from graduacoes g
   order by g.membro_id, g.modalidade_id, g.data desc
)
select m.academia_id, u.membro_id, u.modalidade_id, mo.nome as modalidade,
       pf.nome, pf.apelido, pf.foto_url, u.faixa, u.grau, u.data as desde,
       mo.graduacoes[array_position(mo.graduacoes, u.faixa) + 1] as proxima_faixa,
       r.min_aulas, r.min_meses,
       (select count(*) from presencas p join aulas a on a.id = p.aula_id
          join turmas t on t.id = a.turma_id
         where p.membro_id = u.membro_id and t.modalidade_id = u.modalidade_id
           and a.data >= u.data)::int as aulas_na_faixa,
       (extract(year from age(current_date, u.data)) * 12
        + extract(month from age(current_date, u.data)))::int as meses_na_faixa
  from ultima u
  join membros m      on m.id = u.membro_id and m.ativo
  join perfis pf      on pf.id = m.perfil_id
  join modalidades mo on mo.id = u.modalidade_id
  join regras_graduacao r on r.modalidade_id = u.modalidade_id and r.faixa = u.faixa
 where mo.graduacoes[array_position(mo.graduacoes, u.faixa) + 1] is not null
   and (r.idade_minima is null or extract(year from age(pf.nascimento)) >= r.idade_minima)
   and (select count(*) from presencas p join aulas a on a.id = p.aula_id
          join turmas t on t.id = a.turma_id
         where p.membro_id = u.membro_id and t.modalidade_id = u.modalidade_id
           and a.data >= u.data) >= r.min_aulas
   and age(current_date, u.data) >= make_interval(months => r.min_meses);

-- Painel geral de alunos: tudo numa tabela para filtrar, ordenar e
-- chamar no WhatsApp direto (whatsapp = do aluno ou do responsável).
create view painel_alunos with (security_invoker = true) as
select
  m.id                as membro_id,
  m.academia_id,
  pf.id               as perfil_id,
  pf.nome,
  pf.apelido,
  m.apelido_interno,
  pf.foto_url,
  pf.sexo,
  pf.nascimento,
  extract(year from age(pf.nascimento))::int as idade,
  extract(year from current_date)::int - extract(year from pf.nascimento)::int as idade_campeonato,
  faixa_etaria(pf.nascimento) as faixa_etaria,
  coalesce(pf.telefone, resp.telefone) as whatsapp,
  resp.nome           as responsavel,
  m.ativo,
  m.entrou_em         as aluno_desde,
  m.saiu_em,
  m.motivo_saida,
  tur.turmas,
  tur.modalidades,
  grad.faixa,
  grad.grau,
  grad.cor_faixa,                               -- cor da moldura da foto
  grad.modalidade     as faixa_modalidade,
  up.ultima_aula,
  current_date - up.ultima_aula as dias_sem_vir,
  fr.pct_30d          as frequencia_30d,
  exists (select 1 from ausencias j
           where j.membro_id = m.id and j.status <> 'nao_justificada'
             and current_date between j.de and j.ate)                   as afastado,
  (select count(*) from pendencias pe
    where pe.membro_id = m.id and pe.status <> 'resolvida')             as pendencias_abertas,
  pf.ultimo_acesso,
  (pf.user_id is not null) as tem_login,
  cob.em_aberto       as mensalidades_em_aberto,
  cob.atrasadas       as mensalidades_atrasadas,
  cob.debito          as debito_atualizado,             -- soma com multa e juros
  (pf.boas_vindas_em is null) as nunca_entrou,
  exists (select 1 from carteirinhas c
           where c.membro_id = m.id and c.tipo = 'academia' and c.ativa) as carteirinha_ok
from membros m
join perfis pf on pf.id = m.perfil_id
left join lateral (
  select p2.nome, p2.telefone
    from responsaveis r join perfis p2 on p2.id = r.responsavel_id
   where r.dependente_id = pf.id
   order by r.principal desc limit 1
) resp on true
left join lateral (
  select array_agg(t.nome order by t.nome)  as turmas,
         array_agg(distinct mo.nome)        as modalidades
    from matriculas mt
    join turmas t       on t.id = mt.turma_id
    join modalidades mo on mo.id = t.modalidade_id
   where mt.membro_id = m.id and mt.status = 'ativa'
) tur on true
left join lateral (
  select g.faixa, g.grau, mo.nome as modalidade,
         mo.cores_graduacoes[array_position(mo.graduacoes, g.faixa)] as cor_faixa
    from graduacoes g join modalidades mo on mo.id = g.modalidade_id
   where g.membro_id = m.id
   order by g.data desc limit 1
) grad on true
left join lateral (
  select max(a.data) as ultima_aula
    from presencas p join aulas a on a.id = p.aula_id
   where p.membro_id = m.id
) up on true
left join lateral (
  select round(100.0 * count(*) filter (where f.presente)
               / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1) as pct_30d
    from frequencia_aulas f
   where f.membro_id = m.id and f.data > current_date - 30
) fr on true
left join lateral (
  select count(*) filter (where c.status = 'aberta')                              as em_aberto,
         count(*) filter (where c.status = 'aberta' and c.vencimento < current_date) as atrasadas,
         coalesce(sum(c.total_atualizado) filter (where c.atrasada), 0)              as debito
    from cobrancas_atualizadas c where c.membro_id = m.id
) cob on true
where m.papel = 'aluno';

-- Números gerais da academia (cards do topo do painel)
create view resumo_academia with (security_invoker = true) as
select
  a.id as academia_id,
  count(m.id) filter (where m.ativo)                                   as alunos_ativos,
  count(m.id) filter (where not m.ativo)                               as alunos_inativos,
  count(m.id) filter (where m.ativo and m.entrou_em >= date_trunc('month', current_date)) as novos_no_mes,
  count(m.id) filter (where m.saiu_em >= date_trunc('month', current_date))               as saidas_no_mes,
  count(m.id) filter (where m.ativo and pf.sexo = 'M')                 as masculino,
  count(m.id) filter (where m.ativo and pf.sexo = 'F')                 as feminino,
  count(m.id) filter (where m.ativo and extract(year from age(pf.nascimento)) <= 17) as menores,
  round(avg(extract(year from age(pf.nascimento))) filter (where m.ativo), 1) as idade_media,
  count(m.id) filter (where m.ativo and pf.user_id is null
                      and not exists (select 1 from responsaveis r where r.dependente_id = pf.id)) as sem_login
from academias a
left join membros m on m.academia_id = a.id and m.papel = 'aluno'
left join perfis pf on pf.id = m.perfil_id
group by a.id;

-- Ficha do campeonato: tudo que o professor precisa na pesagem
-- (o site transforma em PDF/imagem para imprimir ou mandar no grupo)
create view ficha_campeonato with (security_invoker = true) as
select
  e.id            as evento_id,
  e.academia_id,
  e.titulo        as evento,
  e.inicio        as data_evento,
  i.id            as inscricao_id,
  m.id            as membro_id,
  pf.nome,
  pf.foto_url,
  pf.sexo,
  pf.nascimento,
  extract(year from e.inicio)::int - extract(year from pf.nascimento)::int as idade_campeonato,
  coalesce(pf.telefone, resp.telefone) as whatsapp,
  i.faixa,
  i.classe,
  i.categoria_peso,
  (select md.peso_kg from medidas md where md.perfil_id = pf.id and md.peso_kg is not null
    order by md.data desc limit 1)        as ultimo_peso,
  (select md.data from medidas md where md.perfil_id = pf.id and md.peso_kg is not null
    order by md.data desc limit 1)        as pesado_em,
  i.peso_inscricao,
  i.peso_pesagem,
  i.pesagem_ok,
  i.area,
  i.horario_luta,
  i.resultado,
  cf.entidade     as federacao,
  cf.numero       as numero_federacao,
  cf.valida_ate   as federacao_valida_ate,
  cf.imagem_url   as carteirinha_federacao_url,
  (cf.id is not null and (cf.valida_ate is null or cf.valida_ate >= e.inicio::date))
                  as carteirinha_ok,
  ca.imagem_url   as carteirinha_academia_url,
  pend.qtd        as pendencias_abertas,
  lim.limite_kg   as limite_categoria_kg,
  -- Checklist: o que falta para o atleta estar pronto
  array_remove(array[
    case when e.tipo = 'campeonato'
          and not (cf.id is not null and (cf.valida_ate is null or cf.valida_ate >= e.inicio::date))
         then 'carteirinha' end,
    case when i.pesagem_ok is not true
          and (ult.peso_kg is null or ult.data < least(e.inicio::date, current_date) - 30)
         then 'peso desatualizado' end,
    case when i.pesagem_ok is not true
          and lim.limite_kg is not null and ult.peso_kg > lim.limite_kg
         then 'acima do peso' end,
    case when pend.docs > 0 then 'documento' end,
    case when i.classe is null or i.categoria_peso is null then 'categoria' end
  ], null)        as faltando,
  i.observacao
from inscricoes_evento i
join eventos e  on e.id = i.evento_id
join membros m  on m.id = i.membro_id
join perfis pf  on pf.id = m.perfil_id
left join lateral (
  select p2.telefone from responsaveis r join perfis p2 on p2.id = r.responsavel_id
   where r.dependente_id = pf.id order by r.principal desc limit 1
) resp on true
left join lateral (
  select * from carteirinhas c
   where c.membro_id = m.id and c.tipo = 'federacao' and c.ativa
   order by c.ano desc limit 1
) cf on true
left join lateral (
  select * from carteirinhas c
   where c.membro_id = m.id and c.tipo = 'academia' and c.ativa
   order by c.ano desc limit 1
) ca on true
left join lateral (
  select md.peso_kg, md.data from medidas md
   where md.perfil_id = pf.id and md.peso_kg is not null
   order by md.data desc limit 1
) ult on true
left join lateral (
  select k.limite_kg
    from categorias_peso k join classes_idade c on c.id = k.classe_id
   where c.academia_id = e.academia_id
     and (e.modalidade_id is null or c.modalidade_id = e.modalidade_id)
     and c.nome = i.classe and k.nome = i.categoria_peso
   limit 1
) lim on true
left join lateral (
  select count(*) as qtd,
         count(*) filter (where pe.tipo in ('documento','carteirinha')) as docs
    from pendencias pe
   where pe.membro_id = m.id and pe.status <> 'resolvida'
     and (pe.evento_id is null or pe.evento_id = e.id)
) pend on true;

-- Checklist do campeonato: "4 de 5 atletas prontos"
create view checklist_campeonato with (security_invoker = true) as
select
  f.evento_id,
  f.academia_id,
  f.evento,
  f.data_evento,
  count(*)                                              as atletas,
  count(*) filter (where cardinality(f.faltando) = 0)   as prontos,
  round(100.0 * count(*) filter (where cardinality(f.faltando) = 0) / count(*)) as pct_prontos,
  count(*) filter (where 'carteirinha'        = any(f.faltando)) as sem_carteirinha,
  count(*) filter (where 'peso desatualizado' = any(f.faltando)) as peso_desatualizado,
  count(*) filter (where 'acima do peso'      = any(f.faltando)) as acima_do_peso,
  count(*) filter (where 'documento'          = any(f.faltando)) as com_documento_pendente
from ficha_campeonato f
group by f.evento_id, f.academia_id, f.evento, f.data_evento;

-- Histórico de ausências e faltas por ano (ajuda a avaliar graduação)
create view historico_ausencias with (security_invoker = true) as
with freq as (
  select f.membro_id, extract(year from f.data)::int as ano,
         count(*) filter (where f.presente)                        as presencas,
         count(*) filter (where not f.presente and f.justificada)  as faltas_justificadas,
         count(*) filter (where not f.presente and not f.justificada) as faltas,
         count(*) filter (where f.presente or not f.justificada)   as aulas_possiveis
    from frequencia_aulas f
   group by 1, 2
), avis as (
  select a.membro_id, extract(year from a.de)::int as ano,
         count(*) filter (where a.status = 'justificada')     as avisos_justificados,
         count(*) filter (where a.status = 'nao_justificada') as avisos_nao_justificados,
         count(*) filter (where a.status = 'pendente')        as avisos_pendentes
    from ausencias a
   group by 1, 2
)
select coalesce(fr.membro_id, av.membro_id) as membro_id,
       m.academia_id,
       coalesce(fr.ano, av.ano)             as ano,
       coalesce(fr.aulas_possiveis, 0)      as aulas_possiveis,
       coalesce(fr.presencas, 0)            as presencas,
       coalesce(fr.faltas, 0)               as faltas,
       coalesce(fr.faltas_justificadas, 0)  as faltas_justificadas,
       round(100.0 * fr.presencas / nullif(fr.aulas_possiveis, 0), 1) as pct_presenca,
       coalesce(av.avisos_justificados, 0)     as avisos_justificados,
       coalesce(av.avisos_nao_justificados, 0) as avisos_nao_justificados,
       coalesce(av.avisos_pendentes, 0)        as avisos_pendentes
  from freq fr
  full join avis av on av.membro_id = fr.membro_id and av.ano = fr.ano
  join membros m on m.id = coalesce(fr.membro_id, av.membro_id);

-- Tela da chamada: tudo que o professor precisa ver ao lado de cada nome
-- (pendências, ausência avisada, aniversário, mensalidade, carteirinha, peso)
-- Ex.: select * from alertas_chamada('<turma>');
create or replace function alertas_chamada(p_turma uuid, p_data date default current_date)
returns table (membro_id uuid, nome text, foto_url text, faixa text, grau int,
               cor_faixa text, alertas jsonb)
language sql stable as $$
  select pa.membro_id, coalesce(pa.apelido, pa.nome), pa.foto_url, pa.faixa, pa.grau,
         pa.cor_faixa,
         coalesce((
           select jsonb_agg(x.alerta) from (
             -- pendências abertas
             select jsonb_build_object('tipo', 'pendencia',
                      'icone', case when pe.status = 'respondida' then '📨' else '📌' end,
                      'texto', pe.titulo, 'prazo', pe.prazo, 'status', pe.status,
                      'so_equipe', not pe.visivel_aluno) as alerta
               from pendencias pe
              where pe.membro_id = pa.membro_id and pe.status <> 'resolvida'
                and pe.mostrar_na_chamada
             union all
             -- ausência avisada para hoje
             select jsonb_build_object('tipo', 'ausencia', 'icone', '🙋',
                      'texto', 'Avisou ausência: ' || au.motivo, 'status', au.status)
               from ausencias au
              where au.membro_id = pa.membro_id and p_data between au.de and au.ate
             union all
             -- aniversário hoje ou nos próximos 7 dias
             select jsonb_build_object('tipo', 'aniversario', 'icone', '🎂',
                      'texto', case when an.proximo_aniversario = p_data then 'Aniversário hoje!'
                                    else 'Aniversário em ' || to_char(an.proximo_aniversario, 'DD/MM') end)
               from proximos_aniversarios an
              where an.membro_id = pa.membro_id and an.turma_id = p_turma
                and an.proximo_aniversario between p_data and p_data + 7
             union all
             -- mensalidade atrasada
             select jsonb_build_object('tipo', 'mensalidade', 'icone', '💳',
                      'texto', pa.mensalidades_atrasadas || ' mensalidade(s) atrasada(s)', 'so_equipe', true)
              where pa.mensalidades_atrasadas > 0
             union all
             -- peso desatualizado (mais de 30 dias) para quem está inscrito em campeonato futuro
             select jsonb_build_object('tipo', 'peso', 'icone', '⚖️',
                      'texto', 'Atualizar peso para o ' || e.titulo)
               from inscricoes_evento i join eventos e on e.id = i.evento_id
              where i.membro_id = pa.membro_id and e.inicio > now()
                and not exists (select 1 from medidas md
                                 where md.perfil_id = pa.perfil_id and md.data > p_data - 30)
           ) x
         ), '[]'::jsonb)
    from painel_alunos pa
    join matriculas mt on mt.membro_id = pa.membro_id and mt.turma_id = p_turma
                      and mt.status = 'ativa'
   order by coalesce(pa.apelido, pa.nome);
$$;

-- Lotação das turmas (pública: mostra "turma cheia" no cadastro)
create view turmas_vagas as
select t.id as turma_id, t.academia_id, t.vagas,
       (select count(*) from matriculas mt where mt.turma_id = t.id and mt.status = 'ativa') as ocupadas,
       (select count(*) from lista_espera le where le.turma_id = t.id and le.status = 'aguardando') as na_espera,
       t.vagas is not null
         and (select count(*) from matriculas mt where mt.turma_id = t.id and mt.status = 'ativa') >= t.vagas as lotada
  from turmas t
 where t.ativa;

-- Feed pronto para mostrar (todo mundo da academia vê nomes e fotos dos posts)
create view feed_posts as
select p.id, p.academia_id, p.autor_id, p.legenda, p.oculto, p.criado_em,
       pf.nome as autor_nome, pf.apelido as autor_apelido, pf.foto_url as autor_foto,
       coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'url', m.url, 'ordem', m.ordem) order by m.ordem)
                   from post_midias m where m.post_id = p.id), '[]'::jsonb) as midias,
       coalesce((select array_agg(c.membro_id) from curtidas c where c.post_id = p.id), '{}') as curtidas,
       coalesce((select array_agg(coalesce(px.apelido, px.nome))
                   from post_marcacoes pm join membros mx on mx.id = pm.membro_id
                   join perfis px on px.id = mx.perfil_id
                  where pm.post_id = p.id), '{}') as marcados
  from posts p
  join membros am on am.id = p.autor_id
  join perfis pf on pf.id = am.perfil_id
 where participo(p.academia_id)
   and (not p.oculto or sou_equipe(p.academia_id));

-- Colegas de academia (nome e apelido) para marcar nas fotos
create view colegas as
select m.id as membro_id, m.academia_id, pf.nome, pf.apelido, pf.foto_url
  from membros m join perfis pf on pf.id = m.perfil_id
 where m.ativo and m.papel = 'aluno' and participo(m.academia_id);

-- Professores para a página pública (só dados públicos, sem login)
create view professores_publicos as
select
  pm.modalidade_id,
  mo.academia_id,
  m.id as membro_id,
  coalesce(pf.apelido, pf.nome) as nome,
  pf.foto_url,
  pm.whatsapp_publico,
  pm.bio,
  pm.graduacao
from professores_modalidades pm
join membros m      on m.id = pm.membro_id and m.ativo
join perfis pf      on pf.id = m.perfil_id
join modalidades mo on mo.id = pm.modalidade_id and mo.ativa;

-- Diretório/mapa da página geral (só academias que aceitaram aparecer)
create view diretorio_academias as
select id, slug, dominio, nome, slogan, logo_url, cores, cidade,
       latitude, longitude, maps_url, whatsapp, instagram,
       (select array_agg(nome order by ordem) from modalidades
         where academia_id = academias.id and ativa) as modalidades
from academias
where ativa and no_diretorio;


-- =====================================================================
-- 17. CHECK-IN PELO QR FIXO
-- O site lê o QR da parede e chama: select fazer_checkin(token, lat, lng)
-- Confere login, distância da academia e se há aula do aluno agora.
-- =====================================================================
create or replace function fazer_checkin(p_token text, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_acad    academias%rowtype;
  v_agora   timestamp := (now() at time zone 'America/Sao_Paulo');
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dist    double precision;
  v_membro  uuid;
  v_h       record;
  v_aula    uuid;
  v_status  text;
  v_atraso  int;
begin
  select * into v_acad from academias where qr_fixo_token = p_token and ativa;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'QR Code inválido.');
  end if;

  -- Distância até a academia (fórmula de Haversine, em metros)
  if v_acad.latitude is not null then
    if p_lat is null or p_lng is null then
      return jsonb_build_object('ok', false, 'erro', 'Ative a localização do celular.');
    end if;
    v_dist := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - v_acad.latitude) / 2), 2) +
      cos(radians(v_acad.latitude)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_acad.longitude) / 2), 2)));
    if v_dist > v_acad.checkin_raio_m then
      return jsonb_build_object('ok', false, 'erro', 'Você precisa estar na academia.');
    end if;
  end if;

  select m.id into v_membro
    from membros m join perfis p on p.id = m.perfil_id
   where p.user_id = auth.uid() and m.academia_id = v_acad.id
     and m.papel = 'aluno' and m.ativo
   limit 1;
  if v_membro is null then
    return jsonb_build_object('ok', false, 'erro', 'Você não está cadastrado como aluno aqui.');
  end if;

  -- Aula da turma do aluno acontecendo agora (ou começando em breve)
  select h.id, h.turma_id, h.hora_inicio, h.hora_fim, h.tipo_treino, t.nome as turma
    into v_h
    from horarios h
    join matriculas mt on mt.turma_id = h.turma_id and mt.membro_id = v_membro
                      and mt.status = 'ativa'
    join turmas t on t.id = h.turma_id and t.ativa
   where h.dia_semana = extract(dow from v_hoje)::int
     and v_hoje >= h.vale_de
     and (h.vale_ate is null or v_hoje <= h.vale_ate)
     and v_agora::time between h.hora_inicio - make_interval(mins => v_acad.checkin_antes_min)
                           and h.hora_fim
   order by h.hora_inicio
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma aula sua neste horário.');
  end if;

  -- Cria a aula do dia (se ainda não existe) e pega o id
  insert into aulas (turma_id, horario_id, data, hora_inicio, hora_fim, tipo_treino)
  values (v_h.turma_id, v_h.id, v_hoje, v_h.hora_inicio, v_h.hora_fim, v_h.tipo_treino)
  on conflict (turma_id, data, hora_inicio) do update set turma_id = excluded.turma_id
  returning id, status into v_aula, v_status;

  if v_status = 'cancelada' then
    return jsonb_build_object('ok', false, 'erro', 'Esta aula foi cancelada.');
  end if;

  v_atraso := greatest(0, floor(extract(epoch from (v_agora::time - v_h.hora_inicio)) / 60))::int;

  insert into presencas (aula_id, membro_id, metodo, chegou_em, atraso_min)
  values (v_aula, v_membro, 'qr_fixo', now(), v_atraso)
  on conflict (aula_id, membro_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'turma', v_h.turma,
    'atraso_min', v_atraso,
    'atrasado', v_atraso > v_acad.tolerancia_atraso_min,
    -- aviso suave: não bloqueia, só informa
    'mensalidades_atrasadas', (select count(*) from cobrancas c
                                where c.membro_id = v_membro and c.status = 'aberta'
                                  and c.vencimento < v_hoje),
    'aviso_financeiro', (select count(*) from cobrancas c
                          where c.membro_id = v_membro and c.status = 'aberta'
                            and c.vencimento < v_hoje) >= v_acad.alerta_mensalidades_atrasadas
  );
end $$;


-- =====================================================================
-- 17a. PENDÊNCIAS: EM MASSA, RESPOSTA DO ALUNO E CONFIRMAÇÃO
-- =====================================================================

-- Mesmo recado para vários alunos de uma vez.
-- p_alvo: 'turma' | 'modalidade' | 'academia' | 'evento' (inscritos)
-- Ex.: select criar_pendencias_em_massa('turma', '<id da turma>',
--        'Trazer kimono branco no sábado', 'Graduação às 10h', 'outro', '2026-11-21');
create or replace function criar_pendencias_em_massa(
  p_alvo text, p_alvo_id uuid, p_titulo text, p_descricao text default null,
  p_tipo text default 'outro', p_prazo date default null,
  p_visivel_aluno boolean default true, p_mostrar_na_chamada boolean default true
) returns int
language plpgsql as $$   -- roda com as permissões de quem chama (regras RLS valem)
declare
  v_acad   uuid;
  v_evento uuid;
  v_grupo  uuid := gen_random_uuid();
  v_autor  uuid;
  v_n      int;
begin
  v_acad := case p_alvo
    when 'turma'      then (select academia_id from turmas where id = p_alvo_id)
    when 'modalidade' then (select academia_id from modalidades where id = p_alvo_id)
    when 'academia'   then p_alvo_id
    when 'evento'     then (select academia_id from eventos where id = p_alvo_id)
  end;
  if v_acad is null then raise exception 'Alvo inválido: %', p_alvo; end if;
  if not sou_equipe(v_acad) then raise exception 'Só professor/admin pode criar pendências.'; end if;
  if p_alvo = 'evento' then v_evento := p_alvo_id; end if;

  select m.id into v_autor from membros m join perfis p on p.id = m.perfil_id
   where p.user_id = auth.uid() and m.academia_id = v_acad and m.papel in ('admin','professor')
   limit 1;

  insert into pendencias (academia_id, membro_id, evento_id, tipo, titulo, descricao,
                          visivel_aluno, mostrar_na_chamada, prazo, criada_por, grupo_id)
  select distinct v_acad, x.membro_id, v_evento, p_tipo, p_titulo, p_descricao,
         p_visivel_aluno, p_mostrar_na_chamada, p_prazo, v_autor, v_grupo
    from (
      select mt.membro_id from matriculas mt
       where p_alvo = 'turma' and mt.turma_id = p_alvo_id and mt.status = 'ativa'
      union
      select mt.membro_id from matriculas mt join turmas t on t.id = mt.turma_id
       where p_alvo = 'modalidade' and t.modalidade_id = p_alvo_id and mt.status = 'ativa'
      union
      select m.id from membros m
       where p_alvo = 'academia' and m.academia_id = p_alvo_id and m.papel = 'aluno' and m.ativo
      union
      select i.membro_id from inscricoes_evento i
       where p_alvo = 'evento' and i.evento_id = p_alvo_id
    ) x;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Aluno/responsável responde: "já enviei" e/ou anexa a foto.
-- A equipe recebe uma notificação para confirmar.
create or replace function responder_pendencia(p_id uuid, p_resposta text, p_anexo_url text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_p pendencias%rowtype;
begin
  select * into v_p from pendencias where id = p_id;
  if not found or not v_p.visivel_aluno or v_p.status = 'resolvida'
     or v_p.membro_id not in (select meus_membros()) then
    return false;
  end if;

  update pendencias
     set status = 'respondida', resposta = p_resposta,
         anexo_url = coalesce(p_anexo_url, anexo_url), respondida_em = now()
   where id = p_id;

  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select v_p.academia_id, m.perfil_id, 'pendencia',
         '📨 Pendência respondida',
         (select coalesce(pf.apelido, pf.nome) from membros mm join perfis pf on pf.id = mm.perfil_id
           where mm.id = v_p.membro_id) || ' respondeu: ' || v_p.titulo,
         '/pendencias/' || p_id
    from membros m
   where m.id = v_p.criada_por
      or (v_p.criada_por is null and m.academia_id = v_p.academia_id
          and m.papel = 'admin' and m.ativo);
  return true;
end $$;

-- Professor confirma (resolvida) ou devolve (volta a "aberta" com um recado)
create or replace function avaliar_pendencia(p_id uuid, p_aceitar boolean, p_recado text default null)
returns boolean
language plpgsql as $$   -- regras RLS valem: só a equipe consegue alterar
declare v_eu uuid; v_p pendencias%rowtype;
begin
  select * into v_p from pendencias where id = p_id;
  if not found or not sou_equipe(v_p.academia_id) then return false; end if;
  select m.id into v_eu from membros m join perfis p on p.id = m.perfil_id
   where p.user_id = auth.uid() and m.academia_id = v_p.academia_id
     and m.papel in ('admin','professor') limit 1;

  if p_aceitar then
    update pendencias set status = 'resolvida', resolvida_em = now(), resolvida_por = v_eu
     where id = p_id;
  else
    update pendencias set status = 'aberta',
           descricao = coalesce(descricao || E'\n', '') || '↩️ ' || coalesce(p_recado, 'Revisar e enviar de novo.')
     where id = p_id;
  end if;
  return true;
end $$;


-- Aluno/responsável envia o comprovante do Pix; a equipe recebe aviso
-- e só confere e dá baixa.
create or replace function enviar_comprovante(p_cobranca uuid, p_url text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_c cobrancas%rowtype; v_nome text;
begin
  select * into v_c from cobrancas where id = p_cobranca;
  if not found or v_c.membro_id not in (select meus_membros()) or v_c.status = 'paga' then
    return false;
  end if;
  update cobrancas set comprovante_url = p_url where id = p_cobranca;
  select coalesce(pf.apelido, pf.nome) into v_nome
    from membros m join perfis pf on pf.id = m.perfil_id where m.id = v_c.membro_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select v_c.academia_id, m.perfil_id, 'vencimento', '🧾 Comprovante enviado',
         v_nome || ' enviou o comprovante da mensalidade de ' || to_char(v_c.competencia, 'MM/YYYY') || '.',
         '/mensalidades'
    from membros m
   where m.academia_id = v_c.academia_id and m.ativo and m.papel = 'admin';
  return true;
end $$;


-- Abriu vaga numa turma com fila → avisa admins e o professor da turma
create or replace function avisa_vaga_aberta() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_t turmas%rowtype; v_prox lista_espera%rowtype; v_ocup int;
begin
  if tg_op = 'UPDATE' and not (old.status = 'ativa' and new.status <> 'ativa') then return new; end if;
  select * into v_t from turmas where id = old.turma_id;
  if v_t.vagas is null then return coalesce(new, old); end if;
  select count(*) into v_ocup from matriculas where turma_id = v_t.id and status = 'ativa';
  if v_ocup >= v_t.vagas then return coalesce(new, old); end if;
  select * into v_prox from lista_espera
   where turma_id = v_t.id and status = 'aguardando' order by criado_em limit 1;
  if not found then return coalesce(new, old); end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select distinct v_t.academia_id, m.perfil_id, 'vaga', '🟢 Abriu vaga: ' || v_t.nome,
         'Próximo da lista de espera: ' || v_prox.nome || coalesce(' (' || v_prox.telefone || ')', '') || '.',
         '/gestao'
    from membros m
   where m.academia_id = v_t.academia_id and m.ativo
     and (m.papel = 'admin' or m.id = v_t.professor_id);
  return coalesce(new, old);
end $$;

create trigger trg_vaga_aberta_upd after update of status on matriculas
for each row execute function avisa_vaga_aberta();
create trigger trg_vaga_aberta_del after delete on matriculas
for each row execute function avisa_vaga_aberta();


-- Aula cancelada → avisa a turma inteira (e responsáveis) na hora
create or replace function avisa_aula_cancelada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_t turmas%rowtype;
begin
  if new.status <> 'cancelada' or coalesce(old.status, '') = 'cancelada' then return new; end if;
  if new.data < (now() at time zone 'America/Sao_Paulo')::date then return new; end if;
  select * into v_t from turmas where id = new.turma_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select distinct v_t.academia_id, d.pid, 'aula_cancelada', '🚫 Aula cancelada: ' || v_t.nome,
         'A aula de ' || to_char(new.data, 'DD/MM') || ' às ' || to_char(new.hora_inicio, 'HH24:MI') || ' não vai acontecer'
           || coalesce('. ' || new.observacao, '.'), '/calendario'
    from (select m.perfil_id as pid from matriculas mt join membros m on m.id = mt.membro_id
           where mt.turma_id = new.turma_id and mt.status = 'ativa' and m.ativo
          union
          select r.responsavel_id from matriculas mt join membros m on m.id = mt.membro_id
            join responsaveis r on r.dependente_id = m.perfil_id
           where mt.turma_id = new.turma_id and mt.status = 'ativa' and m.ativo) d;
  return new;
end $$;

create trigger trg_aula_cancelada after insert or update of status on aulas
for each row execute function avisa_aula_cancelada();

-- Boas-vindas: marca que a pessoa já viu (e já trocou a senha provisória)
create or replace function marcar_boas_vindas() returns void
language sql security definer set search_path = public as $$
  update perfis set boas_vindas_em = now(), trocar_senha = false where user_id = auth.uid();
$$;


-- =====================================================================
-- 17b. LEMBRETES AUTOMÁTICOS
-- Rode a cada 10 minutos (pg_cron, ver passo no fim do arquivo).
-- Gera notificações de: pesagem/cronograma de campeonato, aniversários,
-- vencimento de mensalidade, aluno sumido e pendências antes da aula. Nunca repete o mesmo aviso.
-- =====================================================================
create or replace function gerar_lembretes() returns int
language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total int := 0;
  v_n     int;
begin
  -- 1) Cronograma de eventos (pesagem, lutas...)
  for r in
    select c.*, e.academia_id, e.titulo as evento, e.modalidade_id, x.mins
      from cronograma_evento c
      join eventos e on e.id = c.evento_id
      cross join unnest(c.avisar_min_antes) as x(mins)
     where now() >= c.inicio - make_interval(mins => x.mins)
       and now() <  c.inicio
  loop
    insert into lembretes_enviados (chave) values ('crono:' || r.id || ':' || r.mins)
    on conflict do nothing;
    if not found then continue; end if;

    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct r.academia_id, d.perfil_id, r.tipo,
           case r.tipo when 'pesagem' then '⚖️ ' else '🏆 ' end
             || coalesce(r.titulo, initcap(r.tipo)) || ' em ' || r.mins || ' min',
           r.evento
             || coalesce(' — ' || r.classe, '')
             || coalesce(' ' || array_to_string(r.categorias, ', '), '')
             || ' às ' || to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24:MI')
             || coalesce(' · ' || r.local, ''),
           '/eventos/' || r.evento_id
      from (
        -- inscritos da classe/categoria (e seus responsáveis)
        select m.perfil_id
          from inscricoes_evento i
          join membros m on m.id = i.membro_id
          join perfis pf on pf.id = m.perfil_id
         where not r.so_equipe
           and i.evento_id = r.evento_id
           and (r.classe is null or i.classe = r.classe)
           and (r.categorias is null or cardinality(r.categorias) = 0
                or i.categoria_peso = any(r.categorias))
           and (r.sexo is null or r.sexo = 'misto' or pf.sexo = r.sexo)
        union
        select rs.responsavel_id
          from inscricoes_evento i
          join membros m on m.id = i.membro_id
          join responsaveis rs on rs.dependente_id = m.perfil_id
         where not r.so_equipe
           and i.evento_id = r.evento_id
           and (r.classe is null or i.classe = r.classe)
           and (r.categorias is null or cardinality(r.categorias) = 0
                or i.categoria_peso = any(r.categorias))
        union
        -- admins e professores da modalidade
        select m.perfil_id
          from membros m
         where m.academia_id = r.academia_id and m.ativo
           and (m.papel = 'admin'
                or (m.papel = 'professor' and (r.modalidade_id is null or exists (
                     select 1 from professores_modalidades pm
                      where pm.membro_id = m.id and pm.modalidade_id = r.modalidade_id))))
      ) d
      left join preferencias_notificacao pn on pn.perfil_id = d.perfil_id
     where not (r.tipo = any(coalesce(pn.tipos_desligados, '{}')));
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 2) Aniversários: professor X dias antes; colegas da turma no dia
  for r in
    select pa.*, t.professor_id, ac.aviso_aniversario_dias as dias
      from proximos_aniversarios pa
      join turmas t     on t.id = pa.turma_id
      join academias ac on ac.id = pa.academia_id
     where pa.proximo_aniversario in (v_hoje, v_hoje + ac.aviso_aniversario_dias)
  loop
    insert into lembretes_enviados (chave)
    values ('aniv:' || r.membro_id || ':' || r.turma_id || ':' || r.proximo_aniversario
            || ':' || (r.proximo_aniversario = v_hoje))
    on conflict do nothing;
    if not found then continue; end if;

    if r.proximo_aniversario = v_hoje then
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      select distinct r.academia_id, m.perfil_id, 'aniversario',
             '🎂 Hoje é aniversário de ' || coalesce(r.apelido, r.nome) || '!',
             'Dá os parabéns no treino! Vai fazer ' || r.vai_fazer || ' anos.', '/aniversarios'
        from matriculas mt join membros m on m.id = mt.membro_id
       where mt.turma_id = r.turma_id and mt.status = 'ativa' and m.id <> r.membro_id
      union
      select r.academia_id, m.perfil_id, 'aniversario',
             '🎂 Hoje é aniversário de ' || coalesce(r.apelido, r.nome) || '!',
             'Turma: vai fazer ' || r.vai_fazer || ' anos.', '/aniversarios'
        from membros m where m.id = r.professor_id;
    else
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      select r.academia_id, m.perfil_id, 'aniversario',
             '🎂 Aniversário em ' || r.dias || ' dias',
             coalesce(r.apelido, r.nome) || ' faz ' || r.vai_fazer || ' anos em '
               || to_char(r.proximo_aniversario, 'DD/MM') || '. Bora preparar algo?',
             '/aniversarios'
        from membros m where m.id = r.professor_id;
    end if;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 3) Mensalidades: cobrança escalonada (antes, no dia, depois) e pendência
  for r in
    select c.*, ac.aviso_vencimento_dias, ac.cobrar_apos_dias, ac.pendencia_apos_dias,
           m.perfil_id, coalesce(pf.apelido, pf.nome) as nome_aluno,
           v_hoje - c.vencimento as atraso,
           case when v_hoje = c.vencimento - ac.aviso_vencimento_dias then 'antes'
                when v_hoje = c.vencimento then 'hoje'
                when v_hoje = c.vencimento + ac.cobrar_apos_dias then 'atraso'
                when v_hoje >= c.vencimento + ac.pendencia_apos_dias then 'pendencia' end as etapa
      from cobrancas c
      join academias ac on ac.id = c.academia_id
      join membros m    on m.id = c.membro_id and m.ativo
      join perfis pf    on pf.id = m.perfil_id
     where c.status = 'aberta'
       and (v_hoje in (c.vencimento - ac.aviso_vencimento_dias, c.vencimento, c.vencimento + ac.cobrar_apos_dias)
            or v_hoje >= c.vencimento + ac.pendencia_apos_dias)
  loop
    insert into lembretes_enviados (chave) values ('venc:' || r.id || ':' || r.etapa) on conflict do nothing;
    if not found then continue; end if;

    if r.etapa = 'pendencia' then
      -- anotação só da equipe, aparece na chamada ao lado do nome
      insert into pendencias (academia_id, membro_id, tipo, titulo, descricao, visivel_aluno, automatica)
      values (r.academia_id, r.membro_id, 'pagamento', 'Conversar sobre mensalidade atrasada',
              'Mensalidade de ' || to_char(r.competencia, 'MM/YYYY') || ' com ' || r.atraso || ' dias de atraso.',
              false, true);
    else
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      select r.academia_id, d.pid, 'vencimento',
             case r.etapa when 'antes' then '💳 Mensalidade vence em ' || r.aviso_vencimento_dias || ' dias'
                          when 'hoje'  then '💳 Mensalidade vence hoje'
                          else '⚠️ Mensalidade em atraso' end,
             'Mensalidade de ' || to_char(r.competencia, 'MM/YYYY') || ' — R$ '
               || replace(to_char(r.valor, 'FM999990.00'), '.', ',')
               || case when r.etapa = 'atraso' then ' (venceu em ' || to_char(r.vencimento, 'DD/MM') || '). Pague pelo app com Pix.'
                       else ', vencimento ' || to_char(r.vencimento, 'DD/MM') || '.' end,
             '/mensalidades'
        from (select r.perfil_id as pid
              union
              select responsavel_id from responsaveis
               where dependente_id = r.perfil_id and principal) d;
    end if;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 4) Aluno sumido (sem falta justificada) → professor da turma e admins
  for r in
    select u.membro_id, u.academia_id, u.ultima_aula, pf.nome, pf.apelido,
           v_hoje - u.ultima_aula as dias
      from ultima_presenca u
      join membros m    on m.id = u.membro_id
      join perfis pf    on pf.id = m.perfil_id
      join academias ac on ac.id = u.academia_id
     where u.ultima_aula is not null
       and v_hoje - u.ultima_aula >= ac.alerta_dias_sem_vir
       and not exists (select 1 from ausencias j
                        where j.membro_id = u.membro_id and j.status <> 'nao_justificada'
                          and v_hoje between j.de and j.ate)
  loop
    insert into lembretes_enviados (chave)
    values ('sumido:' || r.membro_id || ':' || r.ultima_aula) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct r.academia_id, m.perfil_id, 'falta',
           '👀 ' || coalesce(r.apelido, r.nome) || ' sumiu',
           'Não vem há ' || r.dias || ' dias. Que tal mandar uma mensagem?',
           '/alunos/' || r.membro_id
      from membros m
     where m.academia_id = r.academia_id and m.ativo
       and (m.papel = 'admin' or m.id in (
             select t.professor_id from matriculas mt join turmas t on t.id = mt.turma_id
              where mt.membro_id = r.membro_id and mt.status = 'ativa'));
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 4b) Reengajamento: o próprio aluno recebe "sentimos sua falta"
  for r in
    select u.membro_id, u.academia_id, u.ultima_aula, m.perfil_id, coalesce(pf.apelido, pf.nome) as nome,
           ac.nome as academia, v_hoje - u.ultima_aula as dias,
           (select min(case when h.dia_semana >= extract(dow from v_hoje) then h.dia_semana - extract(dow from v_hoje)
                            else h.dia_semana + 7 - extract(dow from v_hoje) end)
              from matriculas mt join horarios h on h.turma_id = mt.turma_id
             where mt.membro_id = u.membro_id and mt.status = 'ativa')::int as em_dias
      from ultima_presenca u
      join membros m    on m.id = u.membro_id
      join perfis pf    on pf.id = m.perfil_id
      join academias ac on ac.id = u.academia_id
     where u.ultima_aula is not null
       and v_hoje - u.ultima_aula >= ac.reengajar_dias
       and not exists (select 1 from ausencias j
                        where j.membro_id = u.membro_id and j.status <> 'nao_justificada'
                          and v_hoje between j.de and j.ate)
  loop
    insert into lembretes_enviados (chave) values ('volta:' || r.membro_id || ':' || r.ultima_aula) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, d.pid, 'reengajar', '🥋 Sentimos sua falta, ' || r.nome || '!',
           'Faz ' || r.dias || ' dias que você não treina. '
             || case when r.em_dias = 0 then 'Tem aula hoje, bora?'
                     when r.em_dias = 1 then 'Tem aula amanhã, te esperamos!'
                     when r.em_dias is not null then 'A próxima aula da sua turma é em ' || r.em_dias || ' dias.'
                     else 'Volta pro tatame!' end,
           '/calendario'
      from (select r.perfil_id as pid
            union
            select responsavel_id from responsaveis where dependente_id = r.perfil_id and principal) d;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 4c) Gera as mensalidades do mês sozinho (uma vez por dia, sem duplicar)
  insert into lembretes_enviados (chave) values ('mens:' || v_hoje) on conflict do nothing;
  if found then
    insert into cobrancas (academia_id, membro_id, competencia, vencimento, valor)
    select m.academia_id, s.membro_id, date_trunc('month', v_hoje)::date,
           least(date_trunc('month', v_hoje)::date + (s.dia_vencimento - 1),
                 (date_trunc('month', v_hoje) + interval '1 month - 1 day')::date),
           s.valor
      from assinaturas s
      join membros m    on m.id = s.membro_id and m.ativo
      join academias ac on ac.id = m.academia_id and ac.gerar_mensalidades_auto
     where s.ativa
    on conflict (membro_id, competencia) do nothing;
  end if;

  -- 4d) Segunda-feira: lembrete de peso para quem vai competir
  if extract(dow from v_hoje) = 1 then
    for r in
      select distinct m.id as membro_id, m.perfil_id, e.academia_id, e.titulo
        from inscricoes_evento i
        join eventos e    on e.id = i.evento_id and e.tipo = 'campeonato'
                         and e.inicio between now() and now() + interval '60 days'
        join membros m    on m.id = i.membro_id and m.ativo
        join academias ac on ac.id = e.academia_id and ac.lembrete_peso_semanal
    loop
      insert into lembretes_enviados (chave) values ('peso:' || r.membro_id || ':' || v_hoje) on conflict do nothing;
      if not found then continue; end if;
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      select r.academia_id, d.pid, 'peso', '⚖️ Segunda é dia de pesar',
             'Registre seu peso no app para acompanhar a categoria no ' || r.titulo || '.', '/meu'
        from (select r.perfil_id as pid
              union
              select responsavel_id from responsaveis where dependente_id = r.perfil_id and principal) d;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end loop;
  end if;

  -- 4e) Domingo à noite: resumo da semana para professores e admins
  if extract(dow from v_hoje) = 0 and extract(hour from now() at time zone 'America/Sao_Paulo') >= 18 then
    for r in
      select m.id, m.perfil_id, m.academia_id, m.papel
        from membros m join academias ac on ac.id = m.academia_id and ac.ativa
       where m.ativo and m.papel in ('admin', 'professor')
    loop
      insert into lembretes_enviados (chave) values ('resumo:' || r.id || ':' || v_hoje) on conflict do nothing;
      if not found then continue; end if;
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      values (r.academia_id, r.perfil_id, 'resumo', '📊 Resumo da semana',
        (select count(*) from presencas p join aulas a on a.id = p.aula_id join turmas t on t.id = a.turma_id
          where t.academia_id = r.academia_id and a.data between v_hoje - 6 and v_hoje
            and (r.papel = 'admin' or t.professor_id = r.id)) || ' presenças · '
        || (select count(*) from painel_alunos pa where pa.academia_id = r.academia_id and pa.ativo
              and pa.dias_sem_vir >= 7 and not pa.afastado) || ' alunos sumidos · '
        || (select count(*) from proximos_aniversarios an where an.academia_id = r.academia_id
              and an.proximo_aniversario between v_hoje + 1 and v_hoje + 7) || ' aniversários na semana · '
        || (select count(*) from sugestoes_graduacao sg where sg.academia_id = r.academia_id) || ' prontos para graduar'
        || case when r.papel = 'admin' then ' · '
             || (select count(*) from cobrancas c where c.academia_id = r.academia_id and c.status = 'aberta'
                   and c.vencimento < v_hoje) || ' mensalidades atrasadas' else '' end,
        '/');
      v_total := v_total + 1;
    end loop;
  end if;

  -- 4f) Aniversário de academia: 6 meses, 1 ano, 2 anos...
  for r in
    select m.id, m.perfil_id, m.academia_id, coalesce(pf.apelido, pf.nome) as nome, m.entrou_em,
           (extract(year from age(v_hoje, m.entrou_em)) * 12 + extract(month from age(v_hoje, m.entrou_em)))::int as meses
      from membros m join perfis pf on pf.id = m.perfil_id
     where m.ativo and m.papel = 'aluno' and m.entrou_em < v_hoje
       and extract(day from m.entrou_em) = extract(day from v_hoje)
  loop
    if not (r.meses = 6 or (r.meses >= 12 and r.meses % 12 = 0)) then continue; end if;
    insert into lembretes_enviados (chave) values ('casa:' || r.id || ':' || r.meses) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, d.pid, 'conquista',
           '🎉 ' || case when r.meses = 6 then '6 meses' when r.meses = 12 then '1 ano' else (r.meses / 12) || ' anos' end
             || ' de academia!',
           case when d.equipe then r.nome || ' completa hoje ' else 'Hoje você completa ' end
             || case when r.meses = 6 then '6 meses' when r.meses = 12 then '1 ano' else (r.meses / 12) || ' anos' end
             || ' de treino com a gente. 👏', '/'
      from (select r.perfil_id as pid, false as equipe
            union
            select m2.perfil_id, true from membros m2
             where m2.academia_id = r.academia_id and m2.ativo and m2.papel = 'admin') d;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 4g) Janeiro: carteirinha do ano nova disponível
  if extract(month from v_hoje) = 1 then
    for r in
      select m.id, m.perfil_id, m.academia_id from membros m
        join academias ac on ac.id = m.academia_id and coalesce((ac.modulos->>'carteirinha')::boolean, true)
       where m.ativo and m.papel = 'aluno'
    loop
      insert into lembretes_enviados (chave) values ('cart:' || r.id || ':' || extract(year from v_hoje)) on conflict do nothing;
      if not found then continue; end if;
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      values (r.academia_id, r.perfil_id, 'carteirinha', '🪪 Carteirinha ' || extract(year from v_hoje) || ' liberada',
              'Confira sua foto e baixe a carteirinha nova no app.', '/carteirinha');
      v_total := v_total + 1;
    end loop;
  end if;

  -- 4h) Graduação sugerida: avisa o professor uma vez por faixa
  for r in
    select sg.*, t.professor_id
      from sugestoes_graduacao sg
      left join lateral (
        select tu.professor_id from matriculas mt join turmas tu on tu.id = mt.turma_id
         where mt.membro_id = sg.membro_id and tu.modalidade_id = sg.modalidade_id and mt.status = 'ativa'
         limit 1) t on true
  loop
    insert into lembretes_enviados (chave)
    values ('grad:' || r.membro_id || ':' || r.modalidade_id || ':' || r.faixa || ':' || r.desde) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct r.academia_id, m.perfil_id, 'graduacao', '🥋 Pronto para graduar: ' || coalesce(r.apelido, r.nome),
           r.aulas_na_faixa || ' aulas e ' || r.meses_na_faixa || ' meses na faixa ' || lower(r.faixa)
             || ' (' || r.modalidade || '). Próxima: ' || lower(r.proxima_faixa) || '.',
           '/alunos/' || r.membro_id
      from membros m
     where m.academia_id = r.academia_id and m.ativo
       and (m.id = r.professor_id or m.papel = 'admin');
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  -- 5) Pendências visíveis ao aluno: lembrete até 2h antes da aula dele
  for r in
    select distinct pe.id, pe.academia_id, pe.titulo, pe.descricao, m.perfil_id
      from pendencias pe
      join membros m     on m.id = pe.membro_id and m.ativo
      join matriculas mt on mt.membro_id = m.id and mt.status = 'ativa'
      join horarios h    on h.turma_id = mt.turma_id
     where pe.status = 'aberta' and pe.visivel_aluno
       and h.dia_semana = extract(dow from v_hoje)::int
       and v_hoje >= h.vale_de and (h.vale_ate is null or v_hoje <= h.vale_ate)
       and (now() at time zone 'America/Sao_Paulo')::time
           between h.hora_inicio - interval '2 hours' and h.hora_inicio
  loop
    insert into lembretes_enviados (chave) values ('pend:' || r.id || ':' || v_hoje)
    on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, d.pid, 'pendencia', '📌 Lembrete para o treino de hoje',
           r.titulo || coalesce(' — ' || r.descricao, ''), '/pendencias'
      from (select r.perfil_id as pid
            union
            select responsavel_id from responsaveis
             where dependente_id = r.perfil_id and principal) d;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  return v_total;
end $$;


-- =====================================================================
-- 18. REGRAS DE ACESSO (RLS)
-- Resumo: público vê a vitrine; aluno/responsável vê o que é dele;
-- professor e admin gerenciam a academia; master vê tudo.
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------- Vitrine pública ----------
create policy ver on academias for select using (ativa or sou_equipe(id));
create policy editar on academias for update using (sou_admin(id)) with check (sou_admin(id));
create policy criar on academias for insert with check (sou_master());
create policy apagar on academias for delete using (sou_master());

create policy ver on propagandas for select using (true);
create policy gerir on propagandas for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));

create policy ver on modalidades for select using (true);
create policy gerir on modalidades for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));

create policy ver on professores_modalidades for select using (true);
create policy gerir on professores_modalidades for all
  using (sou_admin(acad_membro(membro_id))) with check (sou_admin(acad_membro(membro_id)));

create policy ver on turmas for select using (true);
create policy gerir on turmas for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

create policy ver on horarios for select using (true);
create policy gerir on horarios for all
  using (sou_equipe(acad_turma(turma_id))) with check (sou_equipe(acad_turma(turma_id)));

create policy ver on eventos for select using (publico or participo(academia_id));
create policy gerir on eventos for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

create policy ver on classes_idade for select using (true);
create policy gerir on classes_idade for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));

create policy ver on categorias_peso for select using (true);
create policy gerir on categorias_peso for all
  using (sou_admin(acad_classe(classe_id))) with check (sou_admin(acad_classe(classe_id)));

create policy ver on avisos for select
  using (publico or participo(academia_id));
create policy gerir on avisos for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

-- ---------- Pessoas ----------
create policy ver on perfis for select
  using (id in (select meus_perfis()) or sou_equipe_do_perfil(id));
create policy editar on perfis for update
  using (id in (select meus_perfis()) or sou_equipe_do_perfil(id));
-- Equipe de qualquer academia cadastra pessoas; o vínculo vem em "membros"
create policy criar on perfis for insert
  with check (sou_master() or exists (
    select 1 from membros m join perfis p on p.id = m.perfil_id
     where p.user_id = auth.uid() and m.ativo and m.papel in ('admin','professor')));

create policy ver on membros for select
  using (id in (select meus_membros()) or sou_equipe(academia_id));
-- Professor cadastra aluno; só admin cadastra professor/admin
create policy criar on membros for insert
  with check (sou_admin(academia_id) or (papel = 'aluno' and sou_equipe(academia_id)));
create policy editar on membros for update
  using (sou_admin(academia_id) or (papel = 'aluno' and sou_equipe(academia_id)));
create policy apagar on membros for delete using (sou_admin(academia_id));

create policy ver on responsaveis for select
  using (responsavel_id in (select meus_perfis()) or sou_equipe_do_perfil(dependente_id));
create policy gerir on responsaveis for all
  using (sou_equipe_do_perfil(dependente_id)) with check (sou_equipe_do_perfil(dependente_id));

create policy ver on matriculas for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_turma(turma_id)));
create policy gerir on matriculas for all
  using (sou_equipe(acad_turma(turma_id))) with check (sou_equipe(acad_turma(turma_id)));

-- ---------- Aulas e presença ----------
create policy ver on aulas for select using (participo(acad_turma(turma_id)));
create policy gerir on aulas for all
  using (sou_equipe(acad_turma(turma_id))) with check (sou_equipe(acad_turma(turma_id)));

create policy ver on presencas for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_aula(aula_id)));
create policy gerir on presencas for all
  using (sou_equipe(acad_aula(aula_id))) with check (sou_equipe(acad_aula(aula_id)));
-- (o aluno marca presença só pela função fazer_checkin)

-- ---------- Ausências ----------
create policy ver on ausencias for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_membro(membro_id)));
-- Aluno/responsável só avisa (fica "pendente"); a equipe registra como quiser
create policy avisar on ausencias for insert
  with check ((membro_id in (select meus_membros()) and status = 'pendente')
              or sou_equipe(acad_membro(membro_id)));
create policy avaliar on ausencias for update
  using (sou_equipe(acad_membro(membro_id)));
create policy apagar on ausencias for delete
  using (sou_equipe(acad_membro(membro_id))
         or (membro_id in (select meus_membros()) and status = 'pendente'));

-- ---------- Pendências ----------
create policy ver on pendencias for select
  using (sou_equipe(academia_id)
         or (visivel_aluno and membro_id in (select meus_membros())));
create policy gerir on pendencias for all
  using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));
-- (lembretes_enviados: sem regras, só a função gerar_lembretes mexe)

-- ---------- Atleta ----------
create policy ver on graduacoes for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_membro(membro_id)));
create policy gerir on graduacoes for all
  using (sou_equipe(acad_membro(membro_id))) with check (sou_equipe(acad_membro(membro_id)));

-- Peso: o próprio aluno (ou responsável) e a equipe lançam
create policy ver on medidas for select
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
create policy gerir on medidas for all
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id))
  with check (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));

create policy ver on inscricoes_evento for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_evento(evento_id)));
create policy gerir on inscricoes_evento for all
  using (sou_equipe(acad_evento(evento_id))) with check (sou_equipe(acad_evento(evento_id)));

create policy ver on carteirinhas for select
  using (membro_id in (select meus_membros()) or sou_equipe(academia_id));
create policy gerir on carteirinhas for all
  using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));
-- Aluno/responsável envia a foto da carteirinha da federação
create policy enviar_federacao on carteirinhas for insert
  with check (tipo = 'federacao' and membro_id in (select meus_membros()));

-- ---------- Mensalidades ----------
create policy ver on planos for select using (participo(academia_id));
create policy gerir on planos for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));

create policy ver on assinaturas for select
  using (membro_id in (select meus_membros()) or sou_equipe(acad_membro(membro_id)));
create policy gerir on assinaturas for all
  using (sou_equipe(acad_membro(membro_id))) with check (sou_equipe(acad_membro(membro_id)));

create policy ver on cobrancas for select
  using (membro_id in (select meus_membros()) or sou_equipe(academia_id));
create policy gerir on cobrancas for all
  using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

-- ---------- Lista de espera ----------
create policy entrar on lista_espera for insert with check (status = 'aguardando');
create policy ver on lista_espera for select
  using (sou_equipe(academia_id) or membro_id in (select meus_membros()));
create policy gerir on lista_espera for update using (sou_equipe(academia_id));
create policy apagar on lista_espera for delete using (sou_equipe(academia_id));

-- ---------- Cadastro feito pelo aluno ----------
create policy pedir on solicitacoes_cadastro for insert with check (status = 'nova');
create policy ver on solicitacoes_cadastro for select using (sou_equipe(academia_id));
create policy gerir on solicitacoes_cadastro for update using (sou_equipe(academia_id));
create policy apagar on solicitacoes_cadastro for delete using (sou_equipe(academia_id));

-- ---------- Experimental e feedback ----------
-- Qualquer visitante (mesmo sem login) pode pedir aula experimental
create policy pedir on aulas_experimentais for insert
  with check (status = 'nova' and perfil_id is null);
create policy ver on aulas_experimentais for select using (sou_equipe(academia_id));
create policy gerir on aulas_experimentais for update using (sou_equipe(academia_id));
create policy apagar on aulas_experimentais for delete using (sou_admin(academia_id));

create policy enviar on feedbacks for insert
  with check (participo(academia_id)
              and (autor_id is null or autor_id in (select meus_membros())));
create policy ver on feedbacks for select
  using (sou_admin(academia_id) or autor_id in (select meus_membros()));
create policy gerir on feedbacks for update using (sou_admin(academia_id));

-- ---------- Material de apoio ----------
create policy ver on materiais for select
  using (sou_equipe(academia_id) or material_liberado(id));
create policy gerir on materiais for all
  using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

create policy ver on material_destinos for select
  using (sou_equipe(acad_material(material_id)) or material_liberado(material_id));
create policy gerir on material_destinos for all
  using (sou_equipe(acad_material(material_id))) with check (sou_equipe(acad_material(material_id)));

create policy meu on material_progresso for all
  using (membro_id in (select meus_membros()))
  with check (membro_id in (select meus_membros()));
create policy equipe_ve on material_progresso for select
  using (sou_equipe(acad_material(material_id)));

-- ---------- Feed ----------
create policy ver on posts for select
  using (participo(academia_id) and (not oculto or sou_equipe(academia_id)));
create policy postar on posts for insert
  with check (autor_id in (select meus_membros()) and participo(academia_id));
create policy editar on posts for update
  using (autor_id in (select meus_membros()) or sou_equipe(academia_id));
create policy apagar on posts for delete
  using (autor_id in (select meus_membros()) or sou_equipe(academia_id));

create policy ver on post_midias for select using (participo(acad_post(post_id)));
create policy gerir on post_midias for all
  using (exists (select 1 from posts p where p.id = post_id
                 and (p.autor_id in (select meus_membros()) or sou_equipe(p.academia_id))))
  with check (exists (select 1 from posts p where p.id = post_id
                 and (p.autor_id in (select meus_membros()) or sou_equipe(p.academia_id))));

create policy ver on post_marcacoes for select using (participo(acad_post(post_id)));
create policy gerir on post_marcacoes for all
  using (participo(acad_post(post_id))) with check (participo(acad_post(post_id)));

create policy ver on curtidas for select using (participo(acad_post(post_id)));
create policy curtir on curtidas for all
  using (membro_id in (select meus_membros()))
  with check (membro_id in (select meus_membros()));

-- ---------- LGPD ----------
create policy ver on consentimentos for select
  using (perfil_id in (select meus_perfis()) or sou_equipe(academia_id));
create policy aceitar on consentimentos for insert
  with check (perfil_id in (select meus_perfis()) or sou_equipe(academia_id));
create policy revogar on consentimentos for update
  using (perfil_id in (select meus_perfis()) or sou_equipe(academia_id));

-- Rosto só pode ser cadastrado se houver aceite de biometria válido
create policy ver on rostos for select
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
create policy cadastrar on rostos for insert
  with check ((perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id))
              and exists (select 1 from consentimentos c
                           where c.perfil_id = rostos.perfil_id and c.tipo = 'biometria'
                             and c.revogado_em is null));
create policy apagar on rostos for delete
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));

-- ---------- Notificações ----------
create policy minhas on notificacoes for select using (perfil_id in (select meus_perfis()));
create policy marcar_lida on notificacoes for update using (perfil_id in (select meus_perfis()));
create policy equipe_envia on notificacoes for insert
  with check (academia_id is not null and sou_equipe(academia_id));

create policy meu on push_inscricoes for all
  using (perfil_id in (select meus_perfis())) with check (perfil_id in (select meus_perfis()));

create policy meu on preferencias_notificacao for all
  using (perfil_id in (select meus_perfis())) with check (perfil_id in (select meus_perfis()));

-- ---------- Cronograma de eventos ----------
create policy ver on cronograma_evento for select
  using (exists (select 1 from eventos e where e.id = evento_id
                  and (e.publico or participo(e.academia_id))));
create policy gerir on cronograma_evento for all
  using (sou_equipe(acad_evento(evento_id))) with check (sou_equipe(acad_evento(evento_id)));

-- ---------- Técnicas, regras, planos e exames ----------
create policy ver on tecnicas for select using (tecnica_liberada(academia_id, modalidade_id, faixa));
create policy gerir on tecnicas for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

create policy ver on regras_graduacao for select
  using (participo((select academia_id from modalidades where id = modalidade_id)));
create policy gerir on regras_graduacao for all
  using (sou_admin((select academia_id from modalidades where id = modalidade_id)))
  with check (sou_admin((select academia_id from modalidades where id = modalidade_id)));

create policy ver on planos_aula for select
  using (sou_equipe(academia_id) or (visivel_alunos and participo(academia_id)));
create policy gerir on planos_aula for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

create policy ver on exames_faixa for select
  using (sou_equipe(academia_id) or membro_id in (select meus_membros()));
create policy gerir on exames_faixa for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

-- ---------- Galerias (Google Drive) ----------
create policy ver on galerias for select using (participo(academia_id));
create policy gerir on galerias for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

-- ---------- Histórico ----------
create policy ver on historico for select using (sou_admin(academia_id));
create policy registrar on historico for insert with check (sou_equipe(academia_id));

-- (tabela "masters": sem regras = ninguém lê pelo site; só pelo painel do Supabase)


-- =====================================================================
-- 19. ARMAZENAMENTO DE ARQUIVOS (Supabase Storage)
-- publico: logos, capas, propagandas, fotos de professores
-- privado: carteirinhas, comprovantes, materiais, feed
-- Organize as pastas como <academia_id>/<tipo>/arquivo
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('publico', 'publico', true),
  ('privado', 'privado', false)
on conflict (id) do nothing;

-- Pasta = id da academia; equipe envia; quem participa da academia lê o privado
-- quem participa da academia envia (foto de perfil, por exemplo)
create policy "publico: participantes enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'publico'
              and participo(((storage.foldername(name))[1])::uuid));
create policy "publico: equipe apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'publico'
         and sou_equipe(((storage.foldername(name))[1])::uuid));

create policy "privado: participantes leem" on storage.objects for select to authenticated
  using (bucket_id = 'privado'
         and participo(((storage.foldername(name))[1])::uuid));
create policy "privado: participantes enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'privado'
              and participo(((storage.foldername(name))[1])::uuid));
create policy "privado: equipe apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'privado'
         and sou_equipe(((storage.foldername(name))[1])::uuid));

-- =====================================================================
-- 20. AGENDAR OS LEMBRETES (faça depois, uma vez)
-- No Supabase: Database → Extensions → ative "pg_cron". Depois rode:
--   select cron.schedule('lembretes', '*/10 * * * *', 'select gerar_lembretes()');
-- =====================================================================

-- FIM


-- #####################################################################
-- PARTE 3 — ACADEMIA PILOTO
-- #####################################################################

-- =====================================================================
-- MA ACADEMIAS — ACADEMIA PILOTO (dados de demonstração)
-- Rode DEPOIS do banco-academias.sql. Rodar de novo recria SÓ a Academia
-- Piloto (as outras academias não são tocadas).
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
--   prof.judo.piloto@prof.com     → professor de judô (só vê os alunos dele)
--   judo.piloto@aluno.com         → aluno de judô (Aluno 14)
--   muaythai.piloto@aluno.com     → aluno de muay thai (Aluno 12)
--   tkd.piloto@aluno.com          → aluno de taekwondo e muay thai (Aluno 15)
-- O login se liga ao perfil sozinho pelo e-mail.
-- =====================================================================

-- ---------- Limpa o piloto anterior ----------
delete from academias where slug in ('academia-piloto', 'clube-de-luta-exemplo');
delete from perfis where email like '%.piloto@example.com'
   or email in ('admin.piloto@admin.com','prof.piloto@prof.com','aluno.piloto@aluno.com','responsavel.piloto@resp.com',
                'judo.piloto@aluno.com','muaythai.piloto@aluno.com','tkd.piloto@aluno.com','prof.judo.piloto@prof.com');

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
      "campeonatos":true,"aula_experimental":true,"feedback":true,"ia":true,"tecnicas":true,"galeria":true}',
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
  pr_judo := pil_pessoa(ac, 'Professor Judô',        'prof.judo.piloto@prof.com',    'M', '1992-08-20', 'professor');
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
      case i when 1 then 'aluno.piloto@aluno.com' when 12 then 'muaythai.piloto@aluno.com'
             when 14 then 'judo.piloto@aluno.com' when 15 then 'tkd.piloto@aluno.com'
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
  -- Jiu-jitsu Kids lotado, com fila de espera
  update turmas set vagas = 2 where id = t_jjk;
  insert into lista_espera (academia_id, turma_id, nome, telefone, observacao, criado_em) values
    (ac, t_jjk, 'Criança da Fila 01', '5500000000401', 'Mãe prefere terça', now() - interval '12 days'),
    (ac, t_jjk, 'Criança da Fila 02', '5500000000402', null, now() - interval '4 days');

  -- Exemplo de matrícula trancada
  update matriculas set status = 'trancada' where membro_id = alunos[16] and turma_id = t_tkd;

  -- Mais 8 alunos espalhados pelas modalidades (judô, muay thai, taekwondo)
  for i in 17..24 loop
    m := pil_pessoa(ac, 'Aluno ' || i, 'aluno' || i || '.piloto@example.com',
                    case when i % 3 = 0 then 'F' else 'M' end,
                    make_date(case when i in (19, 20) then 2014 + (i % 3) else 1985 + (i * 3) % 25 end, 1 + i % 12, 1 + i % 27), 'aluno');
    alunos := alunos || m;
    update membros set entrou_em = hoje - (30 + i * 9) where id = m;
    update perfis set telefone = '5500000000' || (300 + i),
                      foto_url = case when i % 2 = 0 then 'https://api.dicebear.com/9.x/adventurer/svg?seed=Aluno' || i end
     where id = (select perfil_id from membros where id = m);
    insert into matriculas (turma_id, membro_id, desde)
    values ((array[t_judo, t_judo, t_judok, t_judok, t_mt, t_mt, t_tkd, t_tkd])[i - 16], m, hoje - 150);
  end loop;

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
  -- Faixas e peso dos alunos 17 a 24
  insert into graduacoes (membro_id, modalidade_id, faixa, grau, data, registrado_por)
  select alunos[x], t.modalidade_id, mo.graduacoes[1 + x % 3], x % 3, hoje - (40 + x * 5), t.professor_id
    from generate_series(17, 24) g(x)
    join matriculas mt on mt.membro_id = alunos[x]
    join turmas t on t.id = mt.turma_id
    join modalidades mo on mo.id = t.modalidade_id;
  insert into medidas (perfil_id, data, peso_kg, altura_cm)
  select (select perfil_id from membros where id = alunos[x]), hoje - mm.n * 30, 62 + x * 1.5 - mm.n * 0.4, 168 + x % 12
    from generate_series(17, 24) g(x), generate_series(0, 3) mm(n);

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
  -- PROGRAMA DE FAIXA DO JUDÔ (EXEMPLO — ajuste ao programa da sua federação)
  -- "faixa" = faixa que o aluno está disputando no exame
  -- =================================================================
  insert into tecnicas (academia_id, modalidade_id, faixa, grupo, nome, nome_original, descricao, ordem) values
    (ac, mo_judo, null, 'taiso', 'Aquecimento e ginástica', 'Taiso', 'Polichinelo, flexões, abdominais e deslocamentos (tai-sabaki).', 1),
    (ac, mo_judo, null, 'ukemi', 'Queda para trás', 'Ushiro-ukemi', null, 1),
    (ac, mo_judo, null, 'ukemi', 'Queda lateral', 'Yoko-ukemi', null, 2),
    (ac, mo_judo, null, 'ukemi', 'Queda para frente', 'Mae-ukemi', null, 3),
    (ac, mo_judo, null, 'ukemi', 'Rolamento para frente', 'Mae-mawari-ukemi', null, 4),
    (ac, mo_judo, 'Azul', 'nage-waza', 'Varrida no pé que avança', 'De-ashi-harai', null, 1),
    (ac, mo_judo, 'Azul', 'nage-waza', 'Roda no joelho', 'Hiza-guruma', null, 2),
    (ac, mo_judo, 'Azul', 'nage-waza', 'Calço no pé puxando', 'Sasae-tsurikomi-ashi', null, 3),
    (ac, mo_judo, 'Azul', 'nage-waza', 'Quadril flutuante', 'Uki-goshi', null, 4),
    (ac, mo_judo, 'Azul', 'osaekomi-waza', 'Imobilização lateral pela gola', 'Kesa-gatame', null, 1),
    (ac, mo_judo, 'Azul', 'osaekomi-waza', 'Imobilização pelo ombro', 'Kata-gatame', null, 2),
    (ac, mo_judo, 'Amarela', 'nage-waza', 'Grande ceifada externa', 'O-soto-gari', null, 1),
    (ac, mo_judo, 'Amarela', 'nage-waza', 'Grande quadril', 'O-goshi', null, 2),
    (ac, mo_judo, 'Amarela', 'nage-waza', 'Grande ceifada interna', 'O-uchi-gari', null, 3),
    (ac, mo_judo, 'Amarela', 'nage-waza', 'Projeção pelas costas', 'Seoi-nage', null, 4),
    (ac, mo_judo, 'Amarela', 'osaekomi-waza', 'Imobilização pela cabeça', 'Kami-shiho-gatame', null, 1),
    (ac, mo_judo, 'Amarela', 'osaekomi-waza', 'Imobilização lateral', 'Yoko-shiho-gatame', null, 2),
    (ac, mo_judo, 'Amarela', 'osaekomi-waza', 'Imobilização montada', 'Tate-shiho-gatame', null, 3),
    (ac, mo_judo, 'Laranja', 'shime-waza', 'Estrangulamento cruzado normal', 'Nami-juji-jime', null, 1),
    (ac, mo_judo, 'Laranja', 'shime-waza', 'Estrangulamento cruzado invertido', 'Gyaku-juji-jime', null, 2),
    (ac, mo_judo, 'Laranja', 'shime-waza', 'Estrangulamento pela gola deslizante', 'Okuri-eri-jime', null, 3),
    (ac, mo_judo, 'Laranja', 'kansetsu-waza', 'Chave de braço enroscada', 'Ude-garami', null, 1),
    (ac, mo_judo, 'Laranja', 'kansetsu-waza', 'Chave de braço em cruz', 'Ude-hishigi-juji-gatame', null, 2);

  insert into regras_graduacao (modalidade_id, faixa, min_aulas, min_meses, idade_minima) values
    (mo_judo, 'Branca', 8, 2, null), (mo_judo, 'Azul', 40, 6, null),
    (mo_judo, 'Amarela', 40, 6, null), (mo_judo, 'Laranja', 50, 8, null),
    (mo_jj, 'Branca', 15, 2, null), (mo_jj, 'Azul', 120, 24, 16),
    (mo_tkd, 'Branca', 16, 3, null), (mo_mt, 'Branco', 16, 3, null);

  -- Plano de aula da próxima quarta (treino pesado de jiu-jitsu) e um modelo
  insert into planos_aula (academia_id, turma_id, data, titulo, blocos, autor_id) values
    (ac, t_jj, hoje + ((3 - extract(dow from hoje)::int + 7) % 7), 'Pesado: passagem e rola',
     '[{"tipo":"Aquecimento","minutos":10,"texto":"Corrida, fuga de quadril, rolamentos"},
       {"tipo":"Técnica","minutos":25,"texto":"Passagem toreando + finalização no 100 kg"},
       {"tipo":"Rola","minutos":30,"texto":"5 rounds de 6 min, troca de dupla a cada round"},
       {"tipo":"Volta à calma","minutos":5,"texto":"Alongamento"}]', pr_jj),
    (ac, t_judo, null, 'Modelo: aula de projeção',
     '[{"tipo":"Taiso","minutos":10,"texto":"Aquecimento e ukemi"},
       {"tipo":"Uchikomi","minutos":15,"texto":"3 x 20 repetições da técnica do dia"},
       {"tipo":"Nage-komi","minutos":15,"texto":"Projeção com queda"},
       {"tipo":"Randori","minutos":20,"texto":"4 rounds de 4 min"}]', pr_judo);

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

-- Conteúdo de estudo e tema da Academia Piloto (quando as atualizações já existem)
do $$
declare v_ac uuid := (select id from academias where slug = 'academia-piloto');
begin
  update academias set tema = '{"modo":"escuro","fonte":"esportiva"}'::jsonb where id = v_ac;
  if exists (select 1 from pg_proc where proname = 'semear_vocabulario') then execute 'select semear_vocabulario($1)' using v_ac; end if;
  if exists (select 1 from pg_proc where proname = 'gerar_desafios') then perform gerar_desafios(); end if;
  if exists (select 1 from pg_proc where proname = 'avaliar_conquistas') then perform avaliar_conquistas(); end if;
  -- liga os logins de teste que já existirem
  update perfis p set user_id = u.id from auth.users u
   where p.user_id is null and lower(p.email) = lower(u.email)
     and not exists (select 1 from perfis x where x.user_id = u.id);
end $$;


-- #####################################################################
-- PARTE 4 — DOJÔ ALCÂNTARA E PROJETO SOCIAL
-- #####################################################################

-- =====================================================================
-- DOJÔ ALCÂNTARA (sua academia) E PROJETO SOCIAL
-- O conteúdo de técnicas fica só aqui: quem não é da academia não vê.
-- PROGRAMA DE TÉCNICAS: proposta inicial pelo Gokyo do Kodokan (5 grupos)
-- e katame-waza — ajuste à vontade no app (Técnicas e exames).
-- =====================================================================
delete from academias where slug in ('dojo-alcantara', 'projeto-social-michel');

do $$
declare
  dj uuid; mj uuid; pj uuid; mpj uuid;
  eu uuid; m_admin uuid; m_prof uuid;
  faixas text[] := array['Branca','Azul','Amarela','Laranja','Verde','Roxa','Marrom','Preta'];
  cores  text[] := array['#f5f5f5','#1d4ed8','#facc15','#f97316','#16a34a','#7c3aed','#78350f','#111111'];
begin
  -- Seu cadastro (o login judo.matheus.alcantara@gmail.com se liga sozinho)
  select id into eu from perfis where lower(email) = 'judo.matheus.alcantara@gmail.com' limit 1;
  if eu is null then
    insert into perfis (nome, apelido, email, telefone, sexo, nascimento, trocar_senha, boas_vindas_em)
    values ('Matheus Alcântara', 'Sensei Alcântara', 'judo.matheus.alcantara@gmail.com', '5524992924519', 'M', '1998-01-01', false, now())
    returning id into eu;
  end if;

  -- ---------- Dojô Alcântara ----------
  insert into academias (slug, nome, slogan, sobre, cidade, whatsapp, cores, no_diretorio, tipo, modulos)
  values ('dojo-alcantara', 'Dojô Alcântara', 'Judô com técnica, respeito e evolução.',
          'Espaço do sensei Alcântara para os alunos aprofundarem o judô: técnicas por faixa, vídeos, exames e carteirinha.',
          'Três Rios - RJ', '5524992924519', '{"primaria":"#6d28d9","secundaria":"#0b0b12"}', true, 'academia',
          '{"sobre":true,"propaganda":false,"calendario":true,"avisos":true,"ranking":true,"feed":true,
            "materiais":true,"mensalidades":false,"carteirinha":true,"campeonatos":true,"aula_experimental":false,
            "feedback":true,"ia":false,"tecnicas":true,"galeria":true}')
  returning id into dj;

  insert into modalidades (academia_id, nome, descricao, cor, icone, graduacoes, cores_graduacoes, ordem)
  values (dj, 'Judô', 'Programa por faixa baseado no Kodokan.', '#6d28d9', '🥋', faixas, cores, 1)
  returning id into mj;

  insert into membros (academia_id, perfil_id, papel) values (dj, eu, 'admin') returning id into m_admin;
  insert into membros (academia_id, perfil_id, papel) values (dj, eu, 'professor') returning id into m_prof;
  insert into professores_modalidades (membro_id, modalidade_id, whatsapp_publico, graduacao, bio)
  values (m_prof, mj, '5524992924519', 'Faixa preta 2º dan', 'Sensei do Dojô Alcântara.');

  insert into turmas (academia_id, modalidade_id, professor_id, nome, publico) values
    (dj, mj, m_prof, 'Judô Três Rios', 'todas as idades'),
    (dj, mj, m_prof, 'Judô Juiz de Fora', 'todas as idades');

  insert into regras_graduacao (modalidade_id, faixa, min_aulas, min_meses) values
    (mj, 'Branca', 54, 6), (mj, 'Azul', 54, 6), (mj, 'Amarela', 54, 8), (mj, 'Laranja', 54, 10),
    (mj, 'Verde', 54, 12), (mj, 'Roxa', 54, 12), (mj, 'Marrom', 54, 18);

  insert into tecnicas (academia_id, modalidade_id, faixa, grupo, nome, nome_original, descricao, classificacao, conjunto, ordem) values
    (dj, mj, null, 'taiso', 'Aquecimento e ginástica', 'Taiso', 'Deslocamentos (tai-sabaki), polichinelo, flexões, abdominais.', null, null, 1),
    (dj, mj, null, 'ukemi', 'Queda para trás', 'Ushiro-ukemi', null, null, null, 1),
    (dj, mj, null, 'ukemi', 'Queda lateral', 'Yoko-ukemi', null, null, null, 2),
    (dj, mj, null, 'ukemi', 'Queda para frente', 'Mae-ukemi', null, null, null, 3),
    (dj, mj, null, 'ukemi', 'Rolamento para frente', 'Mae-mawari-ukemi', null, null, null, 4),
    (dj, mj, 'Azul', 'nage-waza', 'Varrida no pé que avança', 'De-ashi-harai', null, 'ashi-waza', '1º grupo', 1),
    (dj, mj, 'Azul', 'nage-waza', 'Roda no joelho', 'Hiza-guruma', null, 'ashi-waza', '1º grupo', 2),
    (dj, mj, 'Azul', 'nage-waza', 'Calço no pé puxando', 'Sasae-tsurikomi-ashi', null, 'ashi-waza', '1º grupo', 3),
    (dj, mj, 'Azul', 'nage-waza', 'Quadril flutuante', 'Uki-goshi', null, 'koshi-waza', '1º grupo', 4),
    (dj, mj, 'Azul', 'nage-waza', 'Grande ceifada externa', 'O-soto-gari', null, 'ashi-waza', '1º grupo', 5),
    (dj, mj, 'Azul', 'nage-waza', 'Grande quadril', 'O-goshi', null, 'koshi-waza', '1º grupo', 6),
    (dj, mj, 'Azul', 'nage-waza', 'Grande ceifada interna', 'O-uchi-gari', null, 'ashi-waza', '1º grupo', 7),
    (dj, mj, 'Azul', 'nage-waza', 'Projeção pelas costas', 'Seoi-nage', null, 'te-waza', '1º grupo', 8),
    (dj, mj, 'Amarela', 'nage-waza', 'Pequena ceifada externa', 'Ko-soto-gari', null, 'ashi-waza', '2º grupo', 1),
    (dj, mj, 'Amarela', 'nage-waza', 'Pequena ceifada interna', 'Ko-uchi-gari', null, 'ashi-waza', '2º grupo', 2),
    (dj, mj, 'Amarela', 'nage-waza', 'Roda no quadril', 'Koshi-guruma', null, 'koshi-waza', '2º grupo', 3),
    (dj, mj, 'Amarela', 'nage-waza', 'Quadril puxando e levantando', 'Tsurikomi-goshi', null, 'koshi-waza', '2º grupo', 4),
    (dj, mj, 'Amarela', 'nage-waza', 'Varrida nos dois pés', 'Okuri-ashi-harai', null, 'ashi-waza', '2º grupo', 5),
    (dj, mj, 'Amarela', 'nage-waza', 'Queda do corpo', 'Tai-otoshi', null, 'te-waza', '2º grupo', 6),
    (dj, mj, 'Amarela', 'nage-waza', 'Quadril varrendo', 'Harai-goshi', null, 'koshi-waza', '2º grupo', 7),
    (dj, mj, 'Amarela', 'nage-waza', 'Por dentro da coxa', 'Uchi-mata', null, 'ashi-waza', '2º grupo', 8),
    (dj, mj, 'Laranja', 'nage-waza', 'Pequeno gancho externo', 'Ko-soto-gake', null, 'ashi-waza', '3º grupo', 1),
    (dj, mj, 'Laranja', 'nage-waza', 'Quadril levantando', 'Tsuri-goshi', null, 'koshi-waza', '3º grupo', 2),
    (dj, mj, 'Laranja', 'nage-waza', 'Queda lateral', 'Yoko-otoshi', null, 'yoko-sutemi', '3º grupo', 3),
    (dj, mj, 'Laranja', 'nage-waza', 'Roda na perna', 'Ashi-guruma', null, 'ashi-waza', '3º grupo', 4),
    (dj, mj, 'Laranja', 'nage-waza', 'Quadril com impulso', 'Hane-goshi', null, 'koshi-waza', '3º grupo', 5),
    (dj, mj, 'Laranja', 'nage-waza', 'Varrida no pé puxando', 'Harai-tsurikomi-ashi', null, 'ashi-waza', '3º grupo', 6),
    (dj, mj, 'Laranja', 'nage-waza', 'Projeção em círculo', 'Tomoe-nage', null, 'ma-sutemi', '3º grupo', 7),
    (dj, mj, 'Laranja', 'nage-waza', 'Roda nos ombros', 'Kata-guruma', null, 'te-waza', '3º grupo', 8),
    (dj, mj, 'Verde', 'nage-waza', 'Reversão pelo canto', 'Sumi-gaeshi', null, 'ma-sutemi', '4º grupo', 1),
    (dj, mj, 'Verde', 'nage-waza', 'Queda no vale', 'Tani-otoshi', null, 'yoko-sutemi', '4º grupo', 2),
    (dj, mj, 'Verde', 'nage-waza', 'Enrolando com impulso', 'Hane-makikomi', null, 'yoko-sutemi', '4º grupo', 3),
    (dj, mj, 'Verde', 'nage-waza', 'Projeção recolhendo', 'Sukui-nage', null, 'te-waza', '4º grupo', 4),
    (dj, mj, 'Verde', 'nage-waza', 'Mudança de quadril', 'Utsuri-goshi', null, 'koshi-waza', '4º grupo', 5),
    (dj, mj, 'Verde', 'nage-waza', 'Grande roda', 'O-guruma', null, 'ashi-waza', '4º grupo', 6),
    (dj, mj, 'Verde', 'nage-waza', 'Enrolando por fora', 'Soto-makikomi', null, 'yoko-sutemi', '4º grupo', 7),
    (dj, mj, 'Verde', 'nage-waza', 'Queda flutuante', 'Uki-otoshi', null, 'te-waza', '4º grupo', 8),
    (dj, mj, 'Roxa', 'nage-waza', 'Grande roda externa', 'O-soto-guruma', null, 'ashi-waza', '5º grupo', 1),
    (dj, mj, 'Roxa', 'nage-waza', 'Técnica flutuante', 'Uki-waza', null, 'yoko-sutemi', '5º grupo', 2),
    (dj, mj, 'Roxa', 'nage-waza', 'Separação lateral', 'Yoko-wakare', null, 'yoko-sutemi', '5º grupo', 3),
    (dj, mj, 'Roxa', 'nage-waza', 'Roda lateral', 'Yoko-guruma', null, 'yoko-sutemi', '5º grupo', 4),
    (dj, mj, 'Roxa', 'nage-waza', 'Quadril por trás', 'Ushiro-goshi', null, 'koshi-waza', '5º grupo', 5),
    (dj, mj, 'Roxa', 'nage-waza', 'Projeção para trás', 'Ura-nage', null, 'ma-sutemi', '5º grupo', 6),
    (dj, mj, 'Roxa', 'nage-waza', 'Queda pelo canto', 'Sumi-otoshi', null, 'te-waza', '5º grupo', 7),
    (dj, mj, 'Roxa', 'nage-waza', 'Gancho lateral', 'Yoko-gake', null, 'yoko-sutemi', '5º grupo', 8),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Imobilização lateral pela gola', 'Kesa-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Variação do kesa-gatame', 'Kuzure-kesa-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Azul', 'osaekomi-waza', 'Kesa-gatame invertido', 'Ushiro-kesa-gatame', 'Nome em desuso no dojô (*)', 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Imobilização pelo ombro', 'Kata-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Imobilização pela cabeça', 'Kami-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Amarela', 'osaekomi-waza', 'Variação do kami-shiho', 'Kuzure-kami-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização lateral', 'Yoko-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 1),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização montada', 'Tate-shiho-gatame', null, 'osaekomi-waza', 'Katame-waza', 2),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização flutuante', 'Uki-gatame', null, 'osaekomi-waza', 'Katame-waza', 3),
    (dj, mj, 'Laranja', 'osaekomi-waza', 'Imobilização invertida', 'Ura-gatame', null, 'osaekomi-waza', 'Katame-waza', 4),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento cruzado normal', 'Nami-juji-jime', null, 'shime-waza', 'Katame-waza', 1),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento cruzado invertido', 'Gyaku-juji-jime', null, 'shime-waza', 'Katame-waza', 2),
    (dj, mj, 'Laranja', 'shime-waza', 'Estrangulamento meio cruzado', 'Kata-juji-jime', null, 'shime-waza', 'Katame-waza', 3),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento sem a gola', 'Hadaka-jime', null, 'shime-waza', 'Katame-waza', 1),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento pela gola deslizante', 'Okuri-eri-jime', null, 'shime-waza', 'Katame-waza', 2),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com uma asa', 'Kataha-jime', null, 'shime-waza', 'Katame-waza', 3),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com uma mão', 'Katate-jime', null, 'shime-waza', 'Katame-waza', 4),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento com as duas mãos', 'Ryote-jime', null, 'shime-waza', 'Katame-waza', 5),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento em roda com a manga', 'Sode-guruma-jime', null, 'shime-waza', 'Katame-waza', 6),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento empurrando', 'Tsukkomi-jime', null, 'shime-waza', 'Katame-waza', 7),
    (dj, mj, 'Verde', 'shime-waza', 'Estrangulamento em triângulo', 'Sankaku-jime', null, 'shime-waza', 'Katame-waza', 8),
    (dj, mj, 'Verde', 'kansetsu-waza', 'Chave de braço enroscada', 'Ude-garami', null, 'kansetsu-waza', 'Katame-waza', 1),
    (dj, mj, 'Verde', 'kansetsu-waza', 'Chave de braço em cruz', 'Ude-hishigi-juji-gatame', null, 'kansetsu-waza', 'Katame-waza', 2),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o braço', 'Ude-hishigi-ude-gatame', null, 'kansetsu-waza', 'Katame-waza', 1),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o joelho', 'Ude-hishigi-hiza-gatame', null, 'kansetsu-waza', 'Katame-waza', 2),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a axila', 'Ude-hishigi-waki-gatame', null, 'kansetsu-waza', 'Katame-waza', 3),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com o abdômen', 'Ude-hishigi-hara-gatame', null, 'kansetsu-waza', 'Katame-waza', 4),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a perna', 'Ude-hishigi-ashi-gatame', null, 'kansetsu-waza', 'Katame-waza', 5),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço com a mão', 'Ude-hishigi-te-gatame', null, 'kansetsu-waza', 'Katame-waza', 6),
    (dj, mj, 'Roxa', 'kansetsu-waza', 'Chave de braço em triângulo', 'Ude-hishigi-sankaku-gatame', null, 'kansetsu-waza', 'Katame-waza', 7),
    (dj, mj, 'Marrom', 'kata', 'Formas de projeção', 'Nage-no-kata', 'Exigido do marrom para o 1º dan.', null, 'Kata', 1),
    (dj, mj, 'Preta', 'kata', 'Formas de controle no solo', 'Katame-no-kata', 'Exigido para o 2º dan.', null, 'Kata', 1);

  -- ---------- Projeto social (sem mensalidades) ----------
  insert into academias (slug, nome, slogan, sobre, cidade, cores, no_diretorio, tipo, modulos)
  values ('projeto-social-michel', 'Projeto Social de Judô', 'Judô para todos.',
          'Projeto social do sensei Michel nas comunidades de Minas Gerais. (Troque o nome e o texto em Personalizar academia.)',
          'Minas Gerais', '{"primaria":"#0f766e","secundaria":"#0b0b12"}', false, 'projeto_social',
          '{"sobre":true,"propaganda":false,"calendario":true,"avisos":true,"ranking":true,"feed":true,
            "materiais":true,"mensalidades":false,"carteirinha":true,"campeonatos":true,"aula_experimental":false,
            "feedback":false,"ia":false,"tecnicas":true,"galeria":true}')
  returning id into pj;
  insert into modalidades (academia_id, nome, cor, icone, graduacoes, cores_graduacoes, ordem)
  values (pj, 'Judô', '#0f766e', '🥋', faixas, cores, 1) returning id into mpj;
  insert into membros (academia_id, perfil_id, papel) values (pj, eu, 'admin');
  insert into turmas (academia_id, modalidade_id, nome, publico) values
    (pj, mpj, 'Chiador', 'infantil'), (pj, mpj, 'Parada Braga', 'infantil'), (pj, mpj, 'Penhalonga', 'infantil');
end $$;


-- #####################################################################
-- PARTE 5 — ATUALIZAÇÃO 01
-- #####################################################################

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


-- #####################################################################
-- PARTE 6 — ATUALIZAÇÃO 02
-- #####################################################################

-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 02
-- Rode no SQL Editor. NÃO apaga nada: só acrescenta.
-- Novidades: meta semanal de estudo, placar da turma, lembrete de estudo
-- na sexta, pronúncia (kana) nas palavras e técnicas.
-- =====================================================================

-- Meta semanal de estudo (quizzes e roletas) por academia
alter table academias add column if not exists meta_estudo_semanal int default 3;

-- Escrita em kana (japonês) para a pronúncia sair certa no áudio.
-- Se ficar vazio, o app converte o romaji sozinho.
alter table vocabulario add column if not exists kana text;
alter table tecnicas    add column if not exists kana text;

-- Placar de estudo: pontos = acertos nos quizzes (A, B, C) + 2 por sessão de roleta
create or replace function placar_estudo(p_acad uuid, p_de date, p_ate date)
returns table (membro_id uuid, nome text, apelido text, foto_url text,
               atividades int, quizzes int, roletas int, pontos int, meta_ok boolean, posicao bigint)
language sql stable security definer set search_path = public as $$
  with r as (
    select q.membro_id,
           count(*)::int                                           as atividades,
           count(*) filter (where q.modo like 'quiz%')::int        as quizzes,
           count(*) filter (where q.modo like 'roleta%')::int      as roletas,
           (coalesce(sum(q.acertos) filter (where q.modo like 'quiz%'), 0)
            + 2 * count(*) filter (where q.modo like 'roleta%'))::int as pontos
      from quiz_resultados q
     where q.academia_id = p_acad
       and (q.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
     group by q.membro_id
  )
  select r.membro_id, pf.nome, pf.apelido, pf.foto_url, r.atividades, r.quizzes, r.roletas, r.pontos,
         r.atividades >= coalesce(ac.meta_estudo_semanal, 3),
         dense_rank() over (order by r.pontos desc)
    from r
    join membros m   on m.id = r.membro_id and m.ativo
    join perfis pf   on pf.id = m.perfil_id
    join academias ac on ac.id = p_acad
   where participo(p_acad)
   order by r.pontos desc, pf.nome;
$$;

-- Sexta-feira: lembra quem ainda não bateu a meta da semana
create or replace function lembrete_estudo() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_seg  date := v_hoje - ((extract(isodow from v_hoje)::int) - 1);
  v_n int := 0; r record;
begin
  for r in
    select m.id, m.perfil_id, m.academia_id, ac.meta_estudo_semanal as meta,
           (select count(*) from quiz_resultados q where q.membro_id = m.id
             and (q.criado_em at time zone 'America/Sao_Paulo')::date >= v_seg) as feitas
      from membros m
      join academias ac on ac.id = m.academia_id and ac.ativa
                       and coalesce((ac.modulos->>'tecnicas')::boolean, false)
     where m.ativo and m.papel = 'aluno'
  loop
    if r.feitas >= r.meta then continue; end if;
    insert into lembretes_enviados (chave) values ('estudo:' || r.id || ':' || v_seg) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, d.pid, 'estudo', '🧠 Meta de estudo da semana',
           'Você fez ' || r.feitas || ' de ' || r.meta || ' atividades. Faltam ' || (r.meta - r.feitas)
             || ' até domingo: um quiz rapidinho já conta!', '/estudar'
      from (select r.perfil_id as pid
            union
            select responsavel_id from responsaveis where dependente_id = r.perfil_id and principal) d;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Agenda o lembrete para toda sexta às 10h (13h UTC), se o pg_cron estiver ligado
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembrete-estudo', '0 13 * * 5', 'select lembrete_estudo()');
  end if;
exception when others then
  raise notice 'Lembrete de estudo não agendado: %', sqlerrm;
end $$;


-- #####################################################################
-- PARTE 7 — ATUALIZAÇÃO 03
-- #####################################################################

-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 03
-- Rode no SQL Editor. NÃO apaga nada: só acrescenta.
-- Novidades: desafio do dia, flashcards, simulado, títulos/conquistas,
-- combinações e contragolpes, contrato digital, despesas, indique um
-- amigo, painel do dono da plataforma e lembrete de backup.
-- =====================================================================

-- ---------- Ajustes em tabelas existentes ----------
alter table academias add column if not exists contrato_texto       text;
alter table academias add column if not exists contrato_versao      text;
alter table academias add column if not exists recompensa_indicacao text;
alter table perfis    add column if not exists titulo_escolhido     text;
alter table solicitacoes_cadastro add column if not exists indicado_por uuid references membros(id) on delete set null;

alter table consentimentos drop constraint if exists consentimentos_tipo_check;
alter table consentimentos add constraint consentimentos_tipo_check check (tipo in ('imagem','biometria','contrato'));

-- ---------- Novas tabelas ----------
create table if not exists desafios_dia (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  data         date not null,
  tipo         text not null,              -- palavra | tecnica
  pergunta     text not null,
  resposta     text not null,
  opcoes       text[] not null,
  falar        text,                       -- termo em japonês para o áudio
  unique (academia_id, data)
);

create table if not exists flashcards (
  membro_id    uuid not null references membros(id) on delete cascade,
  tipo         text not null check (tipo in ('palavra','tecnica')),
  item_id      uuid not null,
  caixa        int not null default 1,     -- 1 a 5 (método Leitner)
  proxima      date not null default current_date,
  atualizado   timestamptz default now(),
  primary key (membro_id, tipo, item_id)
);

create table if not exists tecnica_relacoes (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  tecnica_id     uuid not null references tecnicas(id) on delete cascade,
  relacionada_id uuid not null references tecnicas(id) on delete cascade,
  tipo           text not null check (tipo in ('combinacao','contragolpe')),
  observacao     text,
  unique (tecnica_id, relacionada_id, tipo)
);

create table if not exists conquistas (
  membro_id      uuid not null references membros(id) on delete cascade,
  academia_id    uuid not null references academias(id) on delete cascade,
  codigo         text not null,
  titulo         text not null,
  icone          text,
  conquistada_em timestamptz default now(),
  primary key (membro_id, codigo)
);

create table if not exists indicacoes (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academias(id) on delete cascade,
  indicador_id     uuid not null references membros(id) on delete cascade,
  indicado_nome    text not null,
  indicado_membro  uuid references membros(id) on delete set null,
  status           text not null default 'aprovada' check (status in ('aprovada','recompensa_entregue')),
  criado_em        timestamptz default now()
);

create table if not exists despesas (
  id              uuid primary key default gen_random_uuid(),
  academia_id     uuid not null references academias(id) on delete cascade,
  data            date not null default current_date,
  descricao       text not null,
  categoria       text,                    -- aluguel, luz, água, material, manutenção...
  valor           numeric(10,2) not null,
  comprovante_url text,
  criado_por      uuid references membros(id) on delete set null,
  criado_em       timestamptz default now()
);

-- O que cada academia paga para você (dono da plataforma)
create table if not exists plataforma_contratos (
  academia_id    uuid primary key references academias(id) on delete cascade,
  valor_mensal   numeric(10,2) not null default 0,
  dia_vencimento int not null default 10,
  inicio         date default current_date,
  ativo          boolean default true,
  observacao     text
);
create table if not exists plataforma_pagamentos (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  competencia  date not null,
  valor        numeric(10,2) not null,
  pago_em      date default current_date,
  forma        text,
  unique (academia_id, competencia)
);

alter table desafios_dia          enable row level security;
alter table flashcards            enable row level security;
alter table tecnica_relacoes      enable row level security;
alter table conquistas            enable row level security;
alter table indicacoes            enable row level security;
alter table despesas              enable row level security;
alter table plataforma_contratos  enable row level security;
alter table plataforma_pagamentos enable row level security;

-- ---------- Regras de acesso ----------
drop policy if exists ver on desafios_dia;
create policy ver on desafios_dia for select using (participo(academia_id));

drop policy if exists meus on flashcards;
drop policy if exists equipe_ve on flashcards;
create policy meus on flashcards for all
  using (membro_id in (select meus_membros())) with check (membro_id in (select meus_membros()));
create policy equipe_ve on flashcards for select using (sou_equipe(acad_membro(membro_id)));

drop policy if exists ver on tecnica_relacoes;
drop policy if exists gerir on tecnica_relacoes;
create policy ver on tecnica_relacoes for select using (participo(academia_id));
create policy gerir on tecnica_relacoes for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

drop policy if exists ver on conquistas;
create policy ver on conquistas for select using (participo(academia_id));

drop policy if exists ver on indicacoes;
drop policy if exists gerir on indicacoes;
create policy ver on indicacoes for select using (indicador_id in (select meus_membros()) or sou_equipe(academia_id));
create policy gerir on indicacoes for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

drop policy if exists gerir on despesas;
create policy gerir on despesas for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));

drop policy if exists master on plataforma_contratos;
drop policy if exists master on plataforma_pagamentos;
create policy master on plataforma_contratos  for all using (sou_master()) with check (sou_master());
create policy master on plataforma_pagamentos for all using (sou_master()) with check (sou_master());

-- ---------- Títulos e conquistas ----------
create or replace function avaliar_conquistas(p_membro uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int := 0; r record; c record;
begin
  for r in
    select m.id, m.academia_id, m.perfil_id, coalesce(ac.meta_estudo_semanal, 3) as meta
      from membros m join academias ac on ac.id = m.academia_id
     where m.ativo and m.papel = 'aluno' and (p_membro is null or m.id = p_membro)
  loop
    for c in
      select * from (values
        ('primeiro-quiz', '🎓', 'Primeiros passos', exists (select 1 from quiz_resultados q where q.membro_id = r.id and q.modo like 'quiz%')),
        ('gabaritou', '💯', 'Gabaritou', exists (select 1 from quiz_resultados q where q.membro_id = r.id and q.total >= 10 and q.acertos = q.total)),
        ('estudioso', '📚', 'Estudioso', (select count(*) from quiz_resultados q where q.membro_id = r.id) >= 30),
        ('mestre-palavras', '🈴', 'Mestre das palavras', (select count(*) from quiz_resultados q where q.membro_id = r.id
                                     and q.modo in ('quiz-palavra','quiz-significado') and q.total > 0 and q.acertos >= q.total * 0.9) >= 5),
        ('disciplina', '🔥', 'Disciplina', (select count(*) from (select date_trunc('week', q.criado_em) from quiz_resultados q
                                     where q.membro_id = r.id group by 1 having count(*) >= r.meta) s) >= 4),
        ('desafiante', '⚡', 'Desafiante', (select count(*) from quiz_resultados q where q.membro_id = r.id and q.modo = 'desafio' and q.acertos = 1) >= 7),
        ('pronto-exame', '🥋', 'Pronto pro exame', exists (select 1 from quiz_resultados q where q.membro_id = r.id and q.modo = 'simulado' and q.total >= 10 and q.acertos >= 9)),
        ('treinos-50', '💪', '50 treinos', (select count(*) from presencas p where p.membro_id = r.id) >= 50),
        ('treinos-100', '🏅', '100 treinos', (select count(*) from presencas p where p.membro_id = r.id) >= 100),
        ('treinos-250', '🏆', '250 treinos', (select count(*) from presencas p where p.membro_id = r.id) >= 250),
        ('embaixador', '🤝', 'Embaixador', exists (select 1 from indicacoes i where i.indicador_id = r.id)),
        ('medalhista', '🥇', 'Medalhista', exists (select 1 from inscricoes_evento i where i.membro_id = r.id and i.resultado in ('ouro','prata','bronze')))
      ) as t(codigo, icone, titulo, ok)
    loop
      if not c.ok then continue; end if;
      insert into conquistas (membro_id, academia_id, codigo, titulo, icone)
      values (r.id, r.academia_id, c.codigo, c.titulo, c.icone) on conflict do nothing;
      if found then
        v_n := v_n + 1;
        insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
        values (r.academia_id, r.perfil_id, 'conquista', c.icone || ' Novo título: ' || c.titulo,
                'Você ganhou o título “' || c.titulo || '”. Escolha qual mostrar no seu perfil!', '/meu');
      end if;
    end loop;
  end loop;
  return v_n;
end $$;

-- Ao terminar um quiz/roleta, confere se ganhou título
create or replace function conquista_apos_estudo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform avaliar_conquistas(new.membro_id);
  return new;
end $$;
drop trigger if exists trg_conquista_estudo on quiz_resultados;
create trigger trg_conquista_estudo after insert on quiz_resultados
for each row execute function conquista_apos_estudo();

-- Títulos de cada aluno (para mostrar no ranking e no perfil)
create or replace view titulos_alunos as
select c.membro_id, c.academia_id,
       array_agg(c.icone || ' ' || c.titulo order by c.conquistada_em) as titulos,
       (select coalesce(c2.icone || ' ' || c2.titulo, null) from conquistas c2
          join membros m2 on m2.id = c2.membro_id join perfis p2 on p2.id = m2.perfil_id
         where c2.membro_id = c.membro_id and c2.codigo = p2.titulo_escolhido) as titulo_principal
  from conquistas c
 where participo(c.academia_id)
 group by c.membro_id, c.academia_id;

-- ---------- Desafio do dia ----------
create or replace function gerar_desafios() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  a record; v record; t record; v_n int := 0; v_ops text[];
begin
  for a in
    select ac.id from academias ac
     where ac.ativa and coalesce((ac.modulos->>'tecnicas')::boolean, false)
       and not exists (select 1 from desafios_dia d where d.academia_id = ac.id and d.data = v_hoje)
  loop
    -- dia par: palavra; dia ímpar: técnica (se houver)
    if extract(day from v_hoje)::int % 2 = 0 or not exists (select 1 from tecnicas where academia_id = a.id and nome_original is not null) then
      select * into v from vocabulario where academia_id = a.id order by random() limit 1;
      if not found then continue; end if;
      select array_agg(x) into v_ops from (
        select v.significado as x
        union all (select significado from vocabulario where academia_id = a.id and id <> v.id and significado <> v.significado order by random() limit 2)
      ) s;
      insert into desafios_dia (academia_id, data, tipo, pergunta, resposta, opcoes, falar)
      values (a.id, v_hoje, 'palavra', 'O que significa “' || v.termo || '”?', v.significado,
              (select array_agg(x order by random()) from unnest(v_ops) x), v.termo);
    else
      select * into t from tecnicas where academia_id = a.id and nome_original is not null
         and grupo not in ('taiso','ukemi','kata') order by random() limit 1;
      select array_agg(x) into v_ops from (
        select t.nome as x
        union all (select nome from tecnicas where academia_id = a.id and id <> t.id and nome <> t.nome
                    and grupo not in ('taiso','ukemi','kata') order by random() limit 2)
      ) s;
      insert into desafios_dia (academia_id, data, tipo, pergunta, resposta, opcoes, falar)
      values (a.id, v_hoje, 'tecnica', 'O que quer dizer “' || t.nome_original || '”?', t.nome,
              (select array_agg(x order by random()) from unnest(v_ops) x), t.nome_original);
    end if;

    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select a.id, m.perfil_id, 'desafio', '⚡ Desafio do dia', 'Uma pergunta rápida vale pontos no placar. Bora?', '/estudar'
      from membros m where m.academia_id = a.id and m.ativo and m.papel = 'aluno';
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------- Painel do dono da plataforma ----------
create or replace function resumo_master()
returns table (academia_id uuid, nome text, slug text, tipo text, ativa boolean,
               alunos_ativos int, novos_mes int, presenca_30d numeric, recebido_mes numeric, atrasado numeric,
               proximo_evento text, proximo_evento_data timestamptz,
               plataforma_valor numeric, plataforma_dia int, plataforma_pago_mes boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.nome, a.slug, a.tipo, a.ativa,
         (select count(*) from membros m where m.academia_id = a.id and m.papel = 'aluno' and m.ativo)::int,
         (select count(*) from membros m where m.academia_id = a.id and m.papel = 'aluno'
            and m.entrou_em >= date_trunc('month', current_date))::int,
         (select round(100.0 * count(*) filter (where f.presente) / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1)
            from frequencia_aulas f where f.academia_id = a.id and f.data > current_date - 30),
         (select coalesce(sum(coalesce(c.valor_pago, c.valor)), 0) from cobrancas c where c.academia_id = a.id
            and c.status = 'paga' and c.pago_em >= date_trunc('month', current_date)),
         (select coalesce(sum(c.valor), 0) from cobrancas c where c.academia_id = a.id and c.status = 'aberta' and c.vencimento < current_date),
         (select e.titulo from eventos e where e.academia_id = a.id and e.inicio > now() and e.tipo in ('campeonato','prova','evento') order by e.inicio limit 1),
         (select e.inicio from eventos e where e.academia_id = a.id and e.inicio > now() and e.tipo in ('campeonato','prova','evento') order by e.inicio limit 1),
         pc.valor_mensal, pc.dia_vencimento,
         exists (select 1 from plataforma_pagamentos pp where pp.academia_id = a.id and pp.competencia = date_trunc('month', current_date)::date)
    from academias a
    left join plataforma_contratos pc on pc.academia_id = a.id and pc.ativo
   where sou_master()
   order by a.nome;
$$;

create or replace function calendario_master(p_dias int default 45)
returns table (academia text, slug text, tipo text, titulo text, inicio timestamptz, local text)
language sql stable security definer set search_path = public as $$
  select a.nome, a.slug, e.tipo, e.titulo, e.inicio, e.local
    from eventos e join academias a on a.id = e.academia_id
   where sou_master() and e.inicio between now() and now() + make_interval(days => p_dias)
     and e.tipo <> 'feriado'
   order by e.inicio;
$$;

-- ---------- Lembrete de backup (segunda, para os admins) ----------
create or replace function lembrete_backup() returns int
language plpgsql security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n int;
begin
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select m.academia_id, m.perfil_id, 'backup', '💾 Backup da semana',
         'Baixe a planilha com alunos, presenças e mensalidades em Personalizar academia → Backup.', '/config'
    from membros m join academias ac on ac.id = m.academia_id and ac.ativa
   where m.ativo and m.papel = 'admin'
     and not exists (select 1 from lembretes_enviados le where le.chave = 'backup:' || m.id || ':' || v_hoje);
  get diagnostics v_n = row_count;
  insert into lembretes_enviados (chave)
  select 'backup:' || m.id || ':' || v_hoje from membros m where m.ativo and m.papel = 'admin'
  on conflict do nothing;
  return v_n;
end $$;

-- ---------- Agendamentos (se o pg_cron estiver ligado) ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('desafio-do-dia', '0 11 * * *', 'select gerar_desafios()');          -- 8h
    perform cron.schedule('conquistas',     '30 6 * * *', 'select avaliar_conquistas()');      -- 3h30
    perform cron.schedule('lembrete-backup', '0 12 * * 1', 'select lembrete_backup()');         -- seg 9h
  end if;
exception when others then
  raise notice 'Agendamentos não criados: %', sqlerrm;
end $$;

-- Gera o primeiro desafio e os títulos já agora
select gerar_desafios();
select avaliar_conquistas();

-- ---------- Placar: desafio do dia vale 3 pontos, flashcards e simulado contam ----------
create or replace function placar_estudo(p_acad uuid, p_de date, p_ate date)
returns table (membro_id uuid, nome text, apelido text, foto_url text,
               atividades int, quizzes int, roletas int, pontos int, meta_ok boolean, posicao bigint)
language sql stable security definer set search_path = public as $$
  with r as (
    select q.membro_id,
           count(*)::int                                                   as atividades,
           count(*) filter (where q.modo like 'quiz%' or q.modo in ('simulado','flashcards'))::int as quizzes,
           count(*) filter (where q.modo like 'roleta%')::int              as roletas,
           (coalesce(sum(q.acertos) filter (where q.modo like 'quiz%' or q.modo in ('simulado','flashcards')), 0)
            + 3 * coalesce(sum(q.acertos) filter (where q.modo = 'desafio'), 0)
            + 2 * count(*) filter (where q.modo like 'roleta%'))::int       as pontos
      from quiz_resultados q
     where q.academia_id = p_acad
       and (q.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
     group by q.membro_id
  )
  select r.membro_id, pf.nome, pf.apelido, pf.foto_url, r.atividades, r.quizzes, r.roletas, r.pontos,
         r.atividades >= coalesce(ac.meta_estudo_semanal, 3),
         dense_rank() over (order by r.pontos desc)
    from r
    join membros m    on m.id = r.membro_id and m.ativo
    join perfis pf    on pf.id = m.perfil_id
    join academias ac on ac.id = p_acad
   where participo(p_acad)
   order by r.pontos desc, pf.nome;
$$;


-- #####################################################################
-- PARTE 8 — ATUALIZAÇÃO 04
-- #####################################################################

-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 04
-- Rode no SQL Editor. NÃO apaga dados.
-- 1) Permissões por papel: o PROFESSOR só vê e mexe nos alunos das turmas
--    dele; o ADMIN vê tudo da academia (e pode também ser professor).
--    Mensalidades e despesas: só o admin.
-- 2) Temporadas (trimestres) com títulos de campeão.
-- 3) Tema minimalista (claro) como padrão das academias novas.
-- =====================================================================

-- ---------- Funções de permissão ----------
create or replace function turma_da_aula(a uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select turma_id from aulas where id = a;
$$;

-- Sou professor de alguma turma em que este aluno está?
create or replace function sou_professor_do_membro(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matriculas mt join turmas t on t.id = mt.turma_id
     where mt.membro_id = m and mt.status <> 'encerrada'
       and t.professor_id in (select meus_membros())
  );
$$;

-- Posso ver este aluno? (eu mesmo, admin da academia ou professor dele)
create or replace function vejo_aluno(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or m in (select meus_membros())
      or sou_admin(acad_membro(m)) or sou_professor_do_membro(m);
$$;

-- Posso cuidar desta turma? (admin ou o professor dela)
create or replace function cuido_da_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_admin(acad_turma(t))
      or exists (select 1 from turmas where id = t and professor_id in (select meus_membros()));
$$;

-- Equipe que pode ver os dados desta pessoa
create or replace function sou_equipe_do_perfil(pf uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or exists (
    select 1 from membros m
     where m.perfil_id = pf
       and (sou_admin(m.academia_id)
            or sou_professor_do_membro(m.id)
            or (m.papel <> 'aluno' and sou_equipe(m.academia_id)))
  );
$$;

-- ---------- Regras de acesso refeitas ----------
-- membros
drop policy if exists ver on membros;
drop policy if exists editar on membros;
create policy ver on membros for select
  using (id in (select meus_membros()) or sou_admin(academia_id)
         or (papel <> 'aluno' and sou_equipe(academia_id)) or sou_professor_do_membro(id));
create policy editar on membros for update
  using (sou_admin(academia_id) or (papel = 'aluno' and sou_professor_do_membro(id)));

-- turmas e horários
drop policy if exists gerir on turmas;
create policy gerir on turmas for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));
drop policy if exists gerir on horarios;
create policy gerir on horarios for all using (cuido_da_turma(turma_id)) with check (cuido_da_turma(turma_id));

-- matrículas, aulas e presenças
drop policy if exists ver on matriculas;
drop policy if exists gerir on matriculas;
create policy ver on matriculas for select using (membro_id in (select meus_membros()) or cuido_da_turma(turma_id));
create policy gerir on matriculas for all using (cuido_da_turma(turma_id)) with check (cuido_da_turma(turma_id));

drop policy if exists gerir on aulas;
create policy gerir on aulas for all using (cuido_da_turma(turma_id)) with check (cuido_da_turma(turma_id));

drop policy if exists ver on presencas;
drop policy if exists gerir on presencas;
create policy ver on presencas for select using (membro_id in (select meus_membros()) or cuido_da_turma(turma_da_aula(aula_id)));
create policy gerir on presencas for all using (cuido_da_turma(turma_da_aula(aula_id))) with check (cuido_da_turma(turma_da_aula(aula_id)));

-- graduações, exames, carteirinhas
drop policy if exists ver on graduacoes;
drop policy if exists gerir on graduacoes;
create policy ver on graduacoes for select using (vejo_aluno(membro_id));
create policy gerir on graduacoes for all
  using (sou_admin(acad_membro(membro_id)) or sou_professor_do_membro(membro_id))
  with check (sou_admin(acad_membro(membro_id)) or sou_professor_do_membro(membro_id));

drop policy if exists ver on exames_faixa;
drop policy if exists gerir on exames_faixa;
create policy ver on exames_faixa for select using (vejo_aluno(membro_id));
create policy gerir on exames_faixa for all
  using (sou_admin(academia_id) or sou_professor_do_membro(membro_id))
  with check (sou_admin(academia_id) or sou_professor_do_membro(membro_id));

drop policy if exists ver on carteirinhas;
drop policy if exists gerir on carteirinhas;
create policy ver on carteirinhas for select using (vejo_aluno(membro_id));
create policy gerir on carteirinhas for all
  using (sou_admin(academia_id) or sou_professor_do_membro(membro_id))
  with check (sou_admin(academia_id) or sou_professor_do_membro(membro_id));

-- ausências e pendências
drop policy if exists ver on ausencias;
drop policy if exists avaliar on ausencias;
drop policy if exists apagar on ausencias;
create policy ver on ausencias for select using (vejo_aluno(membro_id));
create policy avaliar on ausencias for update using (sou_admin(acad_membro(membro_id)) or sou_professor_do_membro(membro_id));
create policy apagar on ausencias for delete
  using (sou_admin(acad_membro(membro_id)) or sou_professor_do_membro(membro_id)
         or (membro_id in (select meus_membros()) and status = 'pendente'));
drop policy if exists avisar on ausencias;
create policy avisar on ausencias for insert
  with check ((membro_id in (select meus_membros()) and status = 'pendente')
              or sou_admin(acad_membro(membro_id)) or sou_professor_do_membro(membro_id));

drop policy if exists ver on pendencias;
drop policy if exists gerir on pendencias;
create policy ver on pendencias for select
  using (sou_admin(academia_id) or sou_professor_do_membro(membro_id)
         or (visivel_aluno and membro_id in (select meus_membros())));
create policy gerir on pendencias for all
  using (sou_admin(academia_id) or sou_professor_do_membro(membro_id))
  with check (sou_admin(academia_id) or sou_professor_do_membro(membro_id));

-- dinheiro: só o admin (e o próprio aluno vê o dele)
drop policy if exists ver on cobrancas;
drop policy if exists gerir on cobrancas;
create policy ver on cobrancas for select using (membro_id in (select meus_membros()) or sou_admin(academia_id));
create policy gerir on cobrancas for all using (sou_admin(academia_id)) with check (sou_admin(academia_id));
drop policy if exists ver on assinaturas;
drop policy if exists gerir on assinaturas;
create policy ver on assinaturas for select using (membro_id in (select meus_membros()) or sou_admin(acad_membro(membro_id)));
create policy gerir on assinaturas for all using (sou_admin(acad_membro(membro_id))) with check (sou_admin(acad_membro(membro_id)));

-- estudo
drop policy if exists ver on quiz_resultados;
create policy ver on quiz_resultados for select using (vejo_aluno(membro_id));

-- ---------- Temporadas (trimestres) ----------
-- No 1º dia de cada trimestre: os 3 primeiros do placar de estudo e os 3
-- mais assíduos do trimestre anterior ganham um título.
create or replace function fechar_temporada(p_ini date default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_ini date := coalesce(p_ini, (date_trunc('quarter', (now() at time zone 'America/Sao_Paulo')::date) - interval '3 months')::date);
  v_fim date := (v_ini + interval '3 months - 1 day')::date;
  v_nome text := extract(quarter from v_ini) || 'º tri/' || to_char(v_ini, 'YY');
  v_n int := 0; r record;
begin
  -- Estudo: pontos no trimestre
  for r in
    select * from (
      select q.academia_id, q.membro_id,
             sum(case when q.modo like 'quiz%' or q.modo in ('simulado','flashcards') then q.acertos
                      when q.modo = 'desafio' then 3 * q.acertos
                      when q.modo like 'roleta%' then 2 else 0 end) as pontos,
             dense_rank() over (partition by q.academia_id order by
               sum(case when q.modo like 'quiz%' or q.modo in ('simulado','flashcards') then q.acertos
                        when q.modo = 'desafio' then 3 * q.acertos
                        when q.modo like 'roleta%' then 2 else 0 end) desc) as pos
        from quiz_resultados q
        join membros m on m.id = q.membro_id and m.ativo
       where (q.criado_em at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
       group by q.academia_id, q.membro_id
    ) s where pos <= 3 and pontos > 0
  loop
    insert into conquistas (membro_id, academia_id, codigo, titulo, icone)
    values (r.membro_id, r.academia_id, 'estudo-' || to_char(v_ini, 'YYYY-Q'),
            case r.pos when 1 then 'Campeão de estudo ' when 2 then 'Vice de estudo ' else '3º no estudo ' end || v_nome,
            case r.pos when 1 then '🏆' when 2 then '🥈' else '🥉' end)
    on conflict do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;

  -- Presença: % no trimestre (mínimo 8 aulas)
  for r in
    select * from (
      select f.academia_id, f.membro_id,
             round(100.0 * count(*) filter (where f.presente) / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1) as pct,
             dense_rank() over (partition by f.academia_id order by
               round(100.0 * count(*) filter (where f.presente) / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1) desc nulls last) as pos
        from frequencia_aulas f
        join membros m on m.id = f.membro_id and m.ativo
       where f.data between v_ini and v_fim
       group by f.academia_id, f.membro_id
      having count(*) filter (where f.presente or not f.justificada) >= 8
    ) s where pos <= 3
  loop
    insert into conquistas (membro_id, academia_id, codigo, titulo, icone)
    values (r.membro_id, r.academia_id, 'presenca-' || to_char(v_ini, 'YYYY-Q'),
            case r.pos when 1 then 'Mais assíduo ' when 2 then '2º mais assíduo ' else '3º mais assíduo ' end || v_nome,
            case r.pos when 1 then '👑' when 2 then '⭐' else '✨' end)
    on conflict do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fechar-temporada', '0 10 1 1,4,7,10 *', 'select fechar_temporada()');
  end if;
exception when others then
  raise notice 'Temporada não agendada: %', sqlerrm;
end $$;

-- ---------- Tema padrão das academias novas: minimalista claro ----------
alter table academias alter column tema set default '{"modo":"claro","fonte":"simples"}'::jsonb;
update academias set tema = '{"modo":"claro","fonte":"simples"}'::jsonb
 where (tema is null or tema = '{}'::jsonb) and slug not in ('academia-piloto', 'dojo-alcantara');
update academias set tema = '{"modo":"escuro","fonte":"esportiva"}'::jsonb
 where (tema is null or tema = '{}'::jsonb) and slug in ('academia-piloto', 'dojo-alcantara');

-- ---------- Logins de teste por modalidade (Academia Piloto) ----------
update perfis set email = 'judo.piloto@aluno.com'     where email = 'aluno14.piloto@example.com';
update perfis set email = 'muaythai.piloto@aluno.com' where email = 'aluno12.piloto@example.com';
update perfis set email = 'tkd.piloto@aluno.com'      where email = 'aluno15.piloto@example.com';
update perfis set email = 'prof.judo.piloto@prof.com' where email = 'prof.judo.piloto@example.com';
update perfis p set user_id = u.id from auth.users u
 where p.user_id is null and lower(p.email) = lower(u.email)
   and not exists (select 1 from perfis x where x.user_id = u.id);


-- #####################################################################
-- PARTE 9 — LIGAR LOGINS E MASTERS
-- #####################################################################

-- =====================================================================
-- PÓS-INSTALAÇÃO: liga os logins, confirma e-mails de teste e define masters
-- (rode depois de criar os usuários no Authentication; pode rodar de novo)
-- =====================================================================

-- Liga cada login ao cadastro com o mesmo e-mail
update perfis p
   set user_id = u.id
  from auth.users u
 where p.user_id is null
   and lower(p.email) = lower(u.email)
   and not exists (select 1 from perfis x where x.user_id = u.id);

-- Confirma os e-mails dos logins de teste do piloto
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email like '%.piloto@%';

-- Seus logins pessoais viram master (veem e administram tudo)
insert into masters (user_id)
select id from auth.users
 where lower(email) in ('judo.matheus.alcantara@gmail.com', 'matheusalcan19@gmail.com')
on conflict do nothing;

-- Agenda os lembretes a cada 10 minutos (se a extensão pg_cron estiver ligada)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembretes', '*/10 * * * *', 'select gerar_lembretes()');
  end if;
exception when others then
  raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;

-- Confira: cada login, se está confirmado, ligado e em quais academias
select u.email,
       u.email_confirmed_at is not null                      as email_confirmado,
       coalesce(p.nome, '❌ sem cadastro com este e-mail')     as cadastro,
       exists (select 1 from masters m where m.user_id = u.id) as master,
       (select string_agg(a.slug || ' (' || mb.papel || ')', ', ')
          from membros mb join academias a on a.id = mb.academia_id
         where mb.perfil_id = p.id)                          as academias
  from auth.users u
  left join perfis p on p.user_id = u.id
 order by u.email;

