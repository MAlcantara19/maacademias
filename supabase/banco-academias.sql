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
  ativa          boolean default true,

  -- Módulos que a academia liga/desliga ("modo analógico" x "modo tecnológico")
  modulos        jsonb default '{
    "sobre": true, "propaganda": false, "calendario": true, "avisos": true,
    "ranking": true, "feed": false, "materiais": true, "mensalidades": false,
    "carteirinha": true, "campeonatos": true, "aula_experimental": true,
    "feedback": true, "ia": false
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
         count(*) filter (where c.status = 'aberta' and c.vencimento < current_date) as atrasadas
    from cobrancas c where c.membro_id = m.id
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
    'atrasado', v_atraso > v_acad.tolerancia_atraso_min
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

  -- 3) Mensalidade vencendo (para o aluno ou o responsável)
  for r in
    select c.*, ac.aviso_vencimento_dias as dias, m.perfil_id
      from cobrancas c
      join academias ac on ac.id = c.academia_id
      join membros m    on m.id = c.membro_id
     where c.status = 'aberta'
       and c.vencimento = v_hoje + ac.aviso_vencimento_dias
  loop
    insert into lembretes_enviados (chave) values ('venc:' || r.id) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, d.pid, 'vencimento',
           '💳 Mensalidade vence em ' || r.dias || ' dias',
           'Valor: R$ ' || replace(to_char(r.valor, 'FM999990.00'), '.', ',') || ' — vencimento '
             || to_char(r.vencimento, 'DD/MM'), '/mensalidades'
      from (select r.perfil_id as pid
            union
            select responsavel_id from responsaveis
             where dependente_id = r.perfil_id and principal) d;
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
