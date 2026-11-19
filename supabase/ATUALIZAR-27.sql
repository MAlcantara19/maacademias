-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 27 — FERRAMENTAS DO MASTER
-- • Erros agrupados por tela, com "já corrigi" (se voltar, o alerta chega de novo)
-- • Saúde das academias (quem está sem aula registrada)
-- • Uso do Supabase (banco e fotos) com alerta antes do limite grátis
-- • Avisar os admins de todas as academias da novidade
-- • Modo manutenção ("voltamos em 10 minutos")
-- • Registro de quem mexeu no plano, módulos e preço
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

do $$ begin
  if to_regclass('public.versoes_banco') is null then
    raise exception 'Rode antes o ATUALIZAR-26.sql (e os anteriores que faltarem).';
  end if;
end $$;


-- ---------- 1. MODO MANUTENÇÃO E NOVIDADE AVISADA ----------
alter table plataforma add column if not exists manutencao          boolean default false;
alter table plataforma add column if not exists manutencao_texto    text;
alter table plataforma add column if not exists manutencao_ate      timestamptz;
alter table plataforma add column if not exists novidade_avisada    text;
alter table plataforma add column if not exists novidade_avisada_em timestamptz;


-- ---------- 2. ERROS AGRUPADOS ----------
-- "Tela" sem os detalhes que mudam (academia, ids), para juntar o mesmo erro
create or replace function tela_erro(p text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p, ''), '^/[^/]+/(app|checkin|cadastro)', '/…/\1'),
             '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'gi'),
           '/[0-9]+(/|$)', '/:n\1', 'g');
$$;

create or replace function chave_erro(p_pagina text, p_msg text) returns text
language sql immutable as $$
  select md5(tela_erro(p_pagina) || '|' || left(coalesce(p_msg, ''), 200));
$$;

create table if not exists erros_resolvidos (
  chave         text primary key,
  resolvido_em  timestamptz default now(),
  resolvido_por uuid default auth.uid()
);
alter table erros_resolvidos enable row level security;
drop policy if exists master on erros_resolvidos;
create policy master on erros_resolvidos for all using (sou_master()) with check (sou_master());

create or replace function erros_agrupados(p_dias int default 30)
returns table (chave text, tela text, mensagem text, vezes int, vezes_7d int, pessoas int, academias int,
               primeira timestamptz, ultima timestamptz, resolvido_em timestamptz, voltou boolean,
               depois int, detalhe text, navegador text, pagina text)
language sql stable security definer set search_path = public as $$
  with e as (
    select x.*, chave_erro(x.pagina, x.mensagem) as k
      from erros_app x
     where sou_master() and x.criado_em > now() - make_interval(days => greatest(1, least(p_dias, 365)))
  ), g as (
    select k, min(tela_erro(e.pagina)) as tela, min(left(e.mensagem, 300)) as mensagem, count(*)::int as vezes,
           (count(*) filter (where e.criado_em > now() - interval '7 days'))::int as v7,
           count(distinct e.user_id)::int as pessoas, count(distinct e.academia_id)::int as acads,
           min(e.criado_em) as primeira, max(e.criado_em) as ultima, max(e.id) as ultimo_id
      from e group by k
  )
  select g.k, g.tela, g.mensagem, g.vezes, g.v7, g.pessoas, g.acads, g.primeira, g.ultima, r.resolvido_em,
         (r.resolvido_em is not null and g.ultima > r.resolvido_em),
         (select count(*)::int from e e2 where e2.k = g.k and r.resolvido_em is not null and e2.criado_em > r.resolvido_em),
         x.detalhe, x.navegador, x.pagina
    from g
    left join erros_resolvidos r on r.chave = g.k
    left join erros_app x on x.id = g.ultimo_id
   order by (r.resolvido_em is null or g.ultima > r.resolvido_em) desc, g.v7 desc, g.vezes desc;
$$;
grant execute on function erros_agrupados(int) to authenticated;

-- "Já corrigi" (p_resolvido = false desfaz)
create or replace function resolver_erro(p_chave text, p_resolvido boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_master() then raise exception 'Só o master.'; end if;
  if p_resolvido then
    insert into erros_resolvidos (chave, resolvido_em, resolvido_por) values (p_chave, now(), auth.uid())
    on conflict (chave) do update set resolvido_em = now(), resolvido_por = auth.uid();
  else
    delete from erros_resolvidos where chave = p_chave;
  end if;
end $$;
grant execute on function resolver_erro(text, boolean) to authenticated;

-- Alerta: no máximo 1 por hora para o mesmo erro; se voltar depois do "já corrigi", avisa na hora
create or replace function alertar_erro_master() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_k text; v_res timestamptz; v_voltou boolean := false;
begin
  if coalesce(new.mensagem, '') ilike any (array['ResizeObserver%', 'Script error%', '%Load failed%', '%NetworkError%', '%Failed to fetch%', '%AbortError%']) then
    return new;
  end if;
  v_k := chave_erro(new.pagina, new.mensagem);
  select resolvido_em into v_res from erros_resolvidos where chave = v_k;
  if v_res is not null then
    insert into lembretes_enviados (chave) values ('erro-voltou:' || v_k || ':' || extract(epoch from v_res)::bigint) on conflict do nothing;
    v_voltou := found;
  end if;
  if not v_voltou then
    insert into lembretes_enviados (chave) values ('erro:' || v_k || ':' || to_char(now(), 'YYYYMMDDHH24')) on conflict do nothing;
    if not found then return new; end if;
  end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select new.academia_id, p.id, 'erro',
         case when v_voltou then '🔁 Erro voltou' else '🐞 Erro no app' end
           || coalesce(' · ' || (select nome from academias where id = new.academia_id), ''),
         left(tela_erro(new.pagina) || ' — ' || coalesce(new.mensagem, ''), 200), '/master/atividade'
    from masters ms join perfis p on p.user_id = ms.user_id;
  return new;
end $$;
drop trigger if exists trg_alertar_erro on erros_app;
create trigger trg_alertar_erro after insert on erros_app for each row execute function alertar_erro_master();
create index if not exists erros_app_criado on erros_app (criado_em desc);


-- ---------- 3. SAÚDE DAS ACADEMIAS ----------
-- Academias reais: última aula com presença, aulas nos últimos 30 dias e contato do admin
create or replace function saude_academias()
returns table (academia_id uuid, nome text, slug text, alunos_ativos int, ultima_aula date, dias_sem_aula int,
               aulas_30d int, ultimo_acesso_equipe timestamptz, admin_nome text, admin_telefone text)
language sql stable security definer set search_path = public as $$
  select a.id, a.nome, a.slug,
         (select count(*)::int from membros m where m.academia_id = a.id and m.papel = 'aluno' and m.ativo),
         ua.ultima, (current_date - ua.ultima)::int,
         (select count(*)::int from aulas au join turmas t on t.id = au.turma_id
           where t.academia_id = a.id and au.data > current_date - 30 and au.data <= current_date
             and exists (select 1 from presencas p where p.aula_id = au.id)),
         (select max(p.ultimo_acesso) from membros m join perfis p on p.id = m.perfil_id
           where m.academia_id = a.id and m.papel in ('admin', 'professor') and m.ativo),
         adm.nome, adm.telefone
    from academias a
    left join lateral (
      select max(au.data) as ultima from aulas au join turmas t on t.id = au.turma_id
       where t.academia_id = a.id and au.data <= current_date
         and exists (select 1 from presencas p where p.aula_id = au.id)
    ) ua on true
    left join lateral (
      select p.nome, p.telefone from membros m join perfis p on p.id = m.perfil_id
       where m.academia_id = a.id and m.papel = 'admin' and m.ativo order by m.entrou_em limit 1
    ) adm on true
   where sou_master() and a.ativa and not coalesce(a.demonstracao, false)
   order by ua.ultima nulls first, a.nome;
$$;
grant execute on function saude_academias() to authenticated;


-- ---------- 4. USO DO SUPABASE ----------
-- Plano grátis: 500 MB de banco e 1 GB de arquivos
create or replace function uso_supabase()
returns table (banco_mb numeric, arquivos_mb numeric, arquivos int, limite_banco_mb int, limite_arquivos_mb int, maiores jsonb)
language sql stable security definer set search_path = public, storage as $$
  select round(pg_database_size(current_database()) / 1048576.0, 1),
         (select round(coalesce(sum((o.metadata->>'size')::bigint), 0) / 1048576.0, 1) from storage.objects o),
         (select count(*)::int from storage.objects),
         500, 1024,
         (select jsonb_agg(x) from (
            select c.relname as tabela, round(pg_total_relation_size(c.oid) / 1048576.0, 1) as mb
              from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r'
             order by pg_total_relation_size(c.oid) desc limit 6) x)
   where sou_master();
$$;
grant execute on function uso_supabase() to authenticated;

-- Avisa o master (no máximo 1 vez por semana) quando passar de 80% do grátis
create or replace function alertar_uso_supabase() returns void
language plpgsql security definer set search_path = public, storage as $$
declare v_banco numeric; v_arq numeric;
begin
  v_banco := pg_database_size(current_database()) / 1048576.0;
  select coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0 into v_arq from storage.objects;
  if v_banco < 400 and v_arq < 820 then return; end if;
  insert into lembretes_enviados (chave) values ('uso-supabase:' || to_char(now(), 'IYYY-IW')) on conflict do nothing;
  if not found then return; end if;
  insert into notificacoes (perfil_id, tipo, titulo, texto, link)
  select p.id, 'sistema', '💾 Supabase chegando no limite',
         'Banco: ' || round(v_banco) || ' de 500 MB · Fotos: ' || round(v_arq) || ' de 1.024 MB. Diminua o prazo das fotos do feed ou mude de plano.',
         '/master'
    from masters ms join perfis p on p.user_id = ms.user_id;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('uso-supabase', '0 12 * * *', 'select alertar_uso_supabase()');
  end if;
exception when others then
  raise notice 'Alerta de uso não agendado: %', sqlerrm;
end $$;


-- ---------- 5. AVISAR AS ACADEMIAS DA NOVIDADE ----------
create or replace function avisar_novidade(p_titulo text, p_texto text, p_versao text) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not sou_master() then raise exception 'Só o master.'; end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select distinct on (m.perfil_id) m.academia_id, m.perfil_id, 'novidade', left(p_titulo, 120), left(p_texto, 300), '/novidades'
    from membros m join academias a on a.id = m.academia_id
   where m.papel = 'admin' and m.ativo and a.ativa and not coalesce(a.demonstracao, false)
   order by m.perfil_id, a.nome;
  get diagnostics v = row_count;
  update plataforma set novidade_avisada = p_versao, novidade_avisada_em = now() where id = 1;
  return v;
end $$;
grant execute on function avisar_novidade(text, text, text) to authenticated;


-- ---------- 6. REGISTRO DE QUEM MEXEU NAS CONFIGURAÇÕES ----------
-- (academias já eram registradas; agora também o preço e a página principal)
do $$
declare t text;
begin
  foreach t in array array['plataforma_contratos', 'plataforma'] loop
    execute format('drop trigger if exists trg_historico on %I', t);
    execute format('create trigger trg_historico after insert or update or delete on %I for each row execute function registrar_historico()', t);
  end loop;
end $$;

create or replace function historico_config(p_limite int default 200)
returns table (quando timestamptz, academia text, quem text, acao text, tabela text, detalhes jsonb)
language sql stable security definer set search_path = public as $$
  select h.quando, a.nome, coalesce(p.nome, u.email, 'sistema'), h.acao, h.tabela, h.detalhes
    from historico h
    left join academias a on a.id = h.academia_id
    left join perfis p on p.user_id = h.user_id
    left join auth.users u on u.id = h.user_id
   where sou_master()
     and (
       h.tabela = 'plataforma_contratos'
       or (h.tabela = 'plataforma' and (h.detalhes - 'pilotos_recriados_em' - 'atualizado_em' - 'novidade_avisada' - 'novidade_avisada_em') <> '{}'::jsonb)
       or (h.tabela = 'academias' and (h.acao <> 'editou' or h.detalhes ?| array['plano', 'modulos', 'ativa', 'no_diretorio', 'dominio', 'slug',
            'demonstracao', 'feed_retencao_dias', 'professor_ve_mensalidades', 'professor_mexe_mensalidades', 'tipo']))
     )
   order by h.quando desc
   limit least(p_limite, 1000);
$$;
grant execute on function historico_config(int) to authenticated;


-- registra esta atualização
insert into versoes_banco (versao) values (27) on conflict do nothing;
