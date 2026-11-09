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
