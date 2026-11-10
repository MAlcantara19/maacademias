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
