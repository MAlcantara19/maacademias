-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 06
-- Rode no SQL Editor. NÃO apaga dados.
-- 1) Planos novos: Base, Intermediário, Completo (+ Fundador, Social, Exclusivo)
-- 2) Histórico de tudo que é feito em cada academia + registro de erros
-- 3) Pré-check-in ("vou na aula")
-- 4) Aceite dos Termos de Uso e da Política de Privacidade
-- 5) Fotos do feed somem depois de X dias (padrão 30) + uso de espaço
-- 6) Calendário do master sem limite de datas; temporadas por semestre
-- 7) Opção de o professor acompanhar as mensalidades dos alunos dele
-- =====================================================================

-- ---------- 1) Planos ----------
alter table academias drop constraint if exists academias_plano_check;
update academias set plano = 'base'          where plano = 'essencial';
update academias set plano = 'intermediario' where plano = 'profissional';
alter table academias alter column plano set default 'base';
alter table academias add constraint academias_plano_check
  check (plano in ('base','intermediario','completo','fundador','social','exclusivo'));

alter table academias add column if not exists feed_retencao_dias int default 30;
alter table academias add column if not exists professor_ve_mensalidades boolean default false;

-- ---------- 7) Professor acompanha mensalidades (se o admin liberar) ----------
drop policy if exists ver on cobrancas;
create policy ver on cobrancas for select
  using (membro_id in (select meus_membros()) or sou_admin(academia_id)
         or ((select professor_ve_mensalidades from academias where id = academia_id) and sou_professor_do_membro(membro_id)));

-- ---------- 2) Histórico de alterações ----------
-- O histórico fica mesmo se a academia for apagada
alter table historico drop constraint if exists historico_academia_id_fkey;
-- Quem fez o quê, em qual academia, e o que mudou.
create or replace function academia_da_linha(tabela text, linha jsonb) returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if linha ? 'academia_id' and linha->>'academia_id' is not null then return (linha->>'academia_id')::uuid; end if;
  if tabela = 'academias' then return (linha->>'id')::uuid; end if;
  if linha ? 'membro_id' then return acad_membro((linha->>'membro_id')::uuid); end if;
  if linha ? 'turma_id' then return acad_turma((linha->>'turma_id')::uuid); end if;
  if tabela = 'perfis' then
    return (select m.academia_id from membros m where m.perfil_id = (linha->>'id')::uuid order by m.entrou_em limit 1);
  end if;
  return null;
end $$;

create or replace function registrar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_novo jsonb; v_velho jsonb; v_mudou jsonb := '{}'::jsonb; k text;
begin
  -- só registra o que as pessoas fazem no app (não as rotinas automáticas)
  if auth.uid() is null then return coalesce(new, old); end if;
  v_novo := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_velho := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_novo) loop
      if k not in ('atualizado', 'atualizada_em', 'ultimo_acesso') and (v_novo->k) is distinct from (v_velho->k) then
        v_mudou := v_mudou || jsonb_build_object(k, jsonb_build_object('de', v_velho->k, 'para', v_novo->k));
      end if;
    end loop;
    if v_mudou = '{}'::jsonb then return new; end if;
  end if;
  insert into historico (academia_id, user_id, acao, tabela, registro_id, detalhes)
  values (academia_da_linha(tg_table_name, coalesce(v_novo, v_velho)), auth.uid(),
          case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'editou' else 'apagou' end,
          tg_table_name, coalesce(v_novo, v_velho)->>'id',
          case tg_op when 'UPDATE' then v_mudou
                     when 'INSERT' then jsonb_strip_nulls(v_novo - 'descritor' - 'chaves')
                     else jsonb_strip_nulls(v_velho - 'descritor' - 'chaves') end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['academias','perfis','membros','turmas','horarios','modalidades','matriculas','graduacoes',
                           'cobrancas','despesas','eventos','avisos','pendencias','ausencias','planos','assinaturas',
                           'solicitacoes_cadastro','aulas_experimentais','exames_faixa','carteirinhas','tecnicas']
  loop
    execute format('drop trigger if exists trg_historico on %I', t);
    execute format('create trigger trg_historico after insert or update or delete on %I for each row execute function registrar_historico()', t);
  end loop;
end $$;

drop policy if exists ver on historico;
drop policy if exists registrar on historico;
create policy ver on historico for select using (sou_master() or sou_admin(academia_id));

-- Erros que acontecem no app (para o suporte)
create table if not exists erros_app (
  id           bigint generated always as identity primary key,
  academia_id  uuid references academias(id) on delete set null,
  user_id      uuid default auth.uid(),
  pagina       text,
  mensagem     text,
  detalhe      text,
  navegador    text,
  criado_em    timestamptz default now()
);
alter table erros_app enable row level security;
drop policy if exists registrar on erros_app;
drop policy if exists ver on erros_app;
create policy registrar on erros_app for insert with check (true);
create policy ver on erros_app for select using (sou_master());

-- Histórico legível para o master (com nome de quem fez e da academia)
create or replace function atividade_master(p_academia uuid default null, p_limite int default 300)
returns table (quando timestamptz, academia text, quem text, acao text, tabela text, registro_id text, detalhes jsonb)
language sql stable security definer set search_path = public as $$
  select h.quando, a.nome, coalesce(p.nome, u.email, 'sistema'), h.acao, h.tabela, h.registro_id, h.detalhes
    from historico h
    left join academias a on a.id = h.academia_id
    left join perfis p on p.user_id = h.user_id
    left join auth.users u on u.id = h.user_id
   where sou_master() and (p_academia is null or h.academia_id = p_academia)
   order by h.quando desc
   limit p_limite;
$$;

-- ---------- 3) Pré-check-in ----------
create table if not exists pre_checkins (
  horario_id  uuid not null references horarios(id) on delete cascade,
  data        date not null,
  membro_id   uuid not null references membros(id) on delete cascade,
  criado_em   timestamptz default now(),
  primary key (horario_id, data, membro_id)
);
alter table pre_checkins enable row level security;
drop policy if exists meu on pre_checkins;
drop policy if exists ver on pre_checkins;
create policy meu on pre_checkins for all
  using (membro_id in (select meus_membros())) with check (membro_id in (select meus_membros()));
create policy ver on pre_checkins for select
  using (cuido_da_turma((select turma_id from horarios where id = horario_id)) or membro_id in (select meus_membros()));

-- Quantos vão em cada aula (todo mundo da academia vê só o número)
create or replace function contagem_pre_checkin(p_acad uuid, p_de date, p_ate date)
returns table (horario_id uuid, data date, vao int)
language sql stable security definer set search_path = public as $$
  select pc.horario_id, pc.data, count(*)::int
    from pre_checkins pc join horarios h on h.id = pc.horario_id join turmas t on t.id = h.turma_id
   where t.academia_id = p_acad and participo(p_acad) and pc.data between p_de and p_ate
   group by 1, 2;
$$;

-- ---------- 4) Termos de uso e privacidade ----------
create table if not exists aceites_plataforma (
  user_id    uuid not null default auth.uid(),
  documento  text not null check (documento in ('termos','privacidade')),
  versao     text not null,
  aceito_em  timestamptz default now(),
  navegador  text,
  primary key (user_id, documento, versao)
);
alter table aceites_plataforma enable row level security;
drop policy if exists meu on aceites_plataforma;
drop policy if exists master on aceites_plataforma;
create policy meu on aceites_plataforma for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy master on aceites_plataforma for select using (sou_master());

-- ---------- 5) Espaço usado por academia (fotos e arquivos) ----------
create or replace function uso_armazenamento()
returns table (academia_id uuid, nome text, arquivos int, mb numeric, mb_feed numeric)
language sql stable security definer set search_path = public, storage as $$
  select a.id, a.nome,
         count(o.*)::int,
         round(coalesce(sum((o.metadata->>'size')::bigint), 0) / 1048576.0, 1),
         round(coalesce(sum((o.metadata->>'size')::bigint) filter (where o.name like a.id || '/feed/%'), 0) / 1048576.0, 1)
    from academias a
    left join storage.objects o on o.name like a.id || '/%'
   where sou_master()
   group by a.id, a.nome
   order by 4 desc;
$$;

-- Posts do feed mais velhos que o prazo da academia (a limpeza dos arquivos é feita pelo site)
create or replace function posts_vencidos()
returns table (post_id uuid, academia_id uuid, urls text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.academia_id, array_agg(m.url)
    from posts p
    join academias a on a.id = p.academia_id
    left join post_midias m on m.post_id = p.id
   where p.criado_em < now() - make_interval(days => coalesce(a.feed_retencao_dias, 30))
   group by p.id, p.academia_id;
$$;

-- ---------- 6) Calendário do master: qualquer período ----------
create or replace function calendario_master_periodo(p_de date, p_ate date)
returns table (academia text, slug text, tipo text, titulo text, inicio timestamptz, local text, descricao text)
language sql stable security definer set search_path = public as $$
  select a.nome, a.slug, e.tipo, e.titulo, e.inicio, e.local, e.descricao
    from eventos e join academias a on a.id = e.academia_id
   where sou_master() and (e.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
   order by e.inicio;
$$;

-- Temporadas por semestre (jan–jun e jul–dez)
create or replace function fechar_temporada_semestre() returns int
language sql security definer set search_path = public as $$
  select fechar_temporada(null);
$$;
create or replace function fechar_temporada(p_ini date default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := coalesce(p_ini, case when extract(month from v_hoje) <= 6
                                     then make_date(extract(year from v_hoje)::int - 1, 7, 1)
                                     else make_date(extract(year from v_hoje)::int, 1, 1) end);
  v_fim date := (v_ini + interval '6 months - 1 day')::date;
  v_nome text := case when extract(month from v_ini) = 1 then '1º sem/' else '2º sem/' end || to_char(v_ini, 'YY');
  v_cod text := to_char(v_ini, 'YYYY') || '-S' || case when extract(month from v_ini) = 1 then '1' else '2' end;
  v_n int := 0; r record;
begin
  for r in
    select * from (
      select q.academia_id, q.membro_id,
             sum(case when q.modo like 'quiz%' or q.modo in ('simulado','flashcards') then q.acertos
                      when q.modo = 'desafio' then 3 * q.acertos when q.modo like 'roleta%' then 2 else 0 end) as pontos,
             dense_rank() over (partition by q.academia_id order by
               sum(case when q.modo like 'quiz%' or q.modo in ('simulado','flashcards') then q.acertos
                        when q.modo = 'desafio' then 3 * q.acertos when q.modo like 'roleta%' then 2 else 0 end) desc) as pos
        from quiz_resultados q join membros m on m.id = q.membro_id and m.ativo
       where (q.criado_em at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
       group by q.academia_id, q.membro_id
    ) s where pos <= 3 and pontos > 0
  loop
    insert into conquistas (membro_id, academia_id, codigo, titulo, icone)
    values (r.membro_id, r.academia_id, 'estudo-' || v_cod,
            case r.pos when 1 then 'Campeão de estudo ' when 2 then 'Vice de estudo ' else '3º no estudo ' end || v_nome,
            case r.pos when 1 then '🏆' when 2 then '🥈' else '🥉' end)
    on conflict do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  for r in
    select * from (
      select f.academia_id, f.membro_id,
             round(100.0 * count(*) filter (where f.presente) / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1) as pct,
             dense_rank() over (partition by f.academia_id order by
               round(100.0 * count(*) filter (where f.presente) / nullif(count(*) filter (where f.presente or not f.justificada), 0), 1) desc nulls last) as pos
        from frequencia_aulas f join membros m on m.id = f.membro_id and m.ativo
       where f.data between v_ini and v_fim
       group by f.academia_id, f.membro_id
      having count(*) filter (where f.presente or not f.justificada) >= 12
    ) s where pos <= 3
  loop
    insert into conquistas (membro_id, academia_id, codigo, titulo, icone)
    values (r.membro_id, r.academia_id, 'presenca-' || v_cod,
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
    begin perform cron.unschedule('fechar-temporada'); exception when others then null; end;
    perform cron.schedule('fechar-temporada', '0 10 1 1,7 *', 'select fechar_temporada()');
  end if;
exception when others then
  raise notice 'Temporada não agendada: %', sqlerrm;
end $$;

-- Presença marcada pelo totem
alter table presencas drop constraint if exists presencas_metodo_check;
alter table presencas add constraint presencas_metodo_check
  check (metodo in ('manual','qr_fixo','carteirinha','facial','totem'));
