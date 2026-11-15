-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 23 — NOTIFICAÇÕES NO CELULAR E EVENTOS
-- • Aviso novo para a turma/modalidade/academia → notifica quem é de lá
-- • Pendência marcada pela equipe → notifica o aluno (e o responsável)
-- • Eventos chegando (7 dias e 1 dia antes) e campeonato para os inscritos
-- • Ranking: "fulano te passou" e "falta 1 treino para alcançar fulano"
-- • Fim do dia: check-ins pelo GPS que ficaram sem aceitar
-- • Eventos que se repetem todo ano e duplicar campeonato
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

-- Quem recebe os avisos de um aluno: ele mesmo e os responsáveis
create or replace function perfis_do_aluno(p_membro uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.perfil_id from membros m where m.id = p_membro
  union
  select r.responsavel_id from membros m join responsaveis r on r.dependente_id = m.perfil_id where m.id = p_membro;
$$;

-- nome curto para as mensagens: apelido, ou primeiro nome ("Aluno 01" fica inteiro)
create or replace function nome_curto(p_perfil uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.apelido, ''),
                  case when split_part(p.nome, ' ', 2) ~ '^[0-9]+$' then split_part(p.nome, ' ', 1) || ' ' || split_part(p.nome, ' ', 2)
                       else split_part(p.nome, ' ', 1) end)
    from perfis p where p.id = p_perfil;
$$;

-- (o push confere o que a pessoa desligou em "O que avisar no celular"; a lista no app mostra tudo)
create or replace function quer_aviso(p_perfil uuid, p_tipo text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from preferencias_notificacao pn where pn.perfil_id = p_perfil and p_tipo = any(pn.tipos_desligados));
$$;


-- ---------- 1. AVISO NOVO ----------
create or replace function notificar_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  if new.expira_em is not null and new.expira_em < now() then return new; end if;
  select perfil_id into v_autor from membros where id = new.autor_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select distinct new.academia_id, d.pid, 'aviso',
         '📣 ' || case when new.escopo = 'turma' then coalesce((select nome from turmas where id = new.turma_id) || ': ', '') else '' end || new.titulo,
         left(coalesce(new.texto, ''), 160), '/avisos'
    from membros al
    cross join lateral perfis_do_aluno(al.id) d(pid)
   where al.academia_id = new.academia_id and al.ativo and al.papel = 'aluno'
     and (new.escopo in ('geral', 'dia')
          or (new.escopo = 'turma' and exists (select 1 from matriculas mt where mt.membro_id = al.id and mt.turma_id = new.turma_id and mt.status = 'ativa'))
          or (new.escopo = 'modalidade' and exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id
                                                     where mt.membro_id = al.id and mt.status = 'ativa' and t.modalidade_id = new.modalidade_id)))
     and d.pid is distinct from v_autor;
  return new;
end $$;
drop trigger if exists trg_notificar_aviso on avisos;
create trigger trg_notificar_aviso after insert on avisos for each row execute function notificar_aviso();


-- ---------- 2. PENDÊNCIA MARCADA PELA EQUIPE ----------
create or replace function notificar_pendencia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.visivel_aluno, true) or coalesce(new.automatica, false) then return new; end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select new.academia_id, d.pid, 'pendencia',
         '📌 ' || case when d.pid = (select perfil_id from membros where id = new.membro_id) then 'Nova pendência: '
                       else 'Pendência de ' || coalesce((select nome_curto(m.perfil_id) from membros m where m.id = new.membro_id), 'seu filho(a)') || ': ' end
              || new.titulo,
         concat_ws(' · ', nullif(left(coalesce(new.descricao, ''), 120), ''), case when new.prazo is not null then 'prazo ' || to_char(new.prazo, 'DD/MM') end),
         '/pendencias'
    from perfis_do_aluno(new.membro_id) d(pid);
  return new;
end $$;
drop trigger if exists trg_notificar_pendencia on pendencias;
create trigger trg_notificar_pendencia after insert on pendencias for each row execute function notificar_pendencia();


-- ---------- 3. EVENTOS CHEGANDO (todo dia às 9h) ----------
alter table eventos add column if not exists repetir_anual boolean default false;
alter table eventos add column if not exists repete_de uuid references eventos(id) on delete set null;

create or replace function lembrete_eventos() returns int
language plpgsql security definer set search_path = public as $$
declare
  e record; v_n int := 0; v_k int; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando text; v_icone text; v_hora text;
begin
  for e in
    select ev.*, (ev.inicio at time zone 'America/Sao_Paulo')::date - v_hoje as faltam
      from eventos ev join academias a on a.id = ev.academia_id and a.ativa
     where (ev.inicio at time zone 'America/Sao_Paulo')::date - v_hoje in (1, 7)
  loop
    -- feriado / dia sem aula: só na véspera
    if (e.tipo = 'feriado' or e.cancela_aulas) and e.faltam <> 1 then continue; end if;
    insert into lembretes_enviados (chave) values ('ev:' || e.id || ':' || e.faltam || ':' || v_hoje) on conflict do nothing;
    if not found then continue; end if;
    v_quando := case when e.faltam = 1 then 'amanhã' else 'daqui a 1 semana' end;
    v_hora := to_char(e.inicio at time zone 'America/Sao_Paulo', 'HH24:MI');
    v_icone := case e.tipo when 'campeonato' then '🥇' when 'prova' then '🎓' when 'feriado' then '🏖️' else '📅' end;

    -- campeonato: os inscritos recebem o lembrete completo (pesagem e documentos)
    if e.tipo = 'campeonato' then
      insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
      select distinct e.academia_id, d.pid, 'campeonato',
             '🥇 ' || e.titulo || ' é ' || v_quando || '!',
             concat_ws(' · ',
               case when e.pesagem_em is not null then '⚖️ Pesagem ' || to_char(e.pesagem_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') end,
               case when i.categoria_peso is not null then 'categoria ' || i.categoria_peso end,
               '📄 Leve documento com foto e a carteirinha',
               case when (select count(*) from pendencias pe where pe.membro_id = i.membro_id and pe.status <> 'resolvida' and (pe.evento_id = e.id or pe.tipo in ('documento','carteirinha'))) > 0
                    then '📌 Você ainda tem pendências: confira no app' end),
             '/eventos/' || e.id
        from inscricoes_evento i
        cross join lateral perfis_do_aluno(i.membro_id) d(pid)
       where i.evento_id = e.id and coalesce(i.status, 'confirmada') = 'confirmada';
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;

    -- todo mundo da academia (ou da modalidade do evento), menos quem já recebeu acima
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct e.academia_id, d.pid, 'evento',
           case when e.tipo = 'feriado' or e.cancela_aulas then '🏖️ Amanhã não tem aula: ' || e.titulo
                else v_icone || ' ' || e.titulo || ' ' || v_quando end,
           concat_ws(' · ', to_char(e.inicio at time zone 'America/Sao_Paulo', 'DD/MM') || case when v_hora <> '00:00' then ' às ' || v_hora end, e.local),
           case when e.tipo = 'campeonato' then '/eventos/' || e.id else '/calendario' end
      from membros m
      cross join lateral (select * from perfis_do_aluno(m.id) union select m.perfil_id) d(pid)
     where m.academia_id = e.academia_id and m.ativo
       and (e.modalidade_id is null or m.papel <> 'aluno'
            or exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id where mt.membro_id = m.id and mt.status = 'ativa' and t.modalidade_id = e.modalidade_id))
       and not (e.tipo = 'campeonato' and exists (select 1 from inscricoes_evento i where i.evento_id = e.id and coalesce(i.status, 'confirmada') = 'confirmada' and d.pid in (select perfis_do_aluno(i.membro_id))));
    get diagnostics v_k = row_count; v_n := v_n + v_k;
  end loop;
  return v_n;
end $$;


-- ---------- 4. RANKING: TE PASSARAM / ESTÁ CHEGANDO PERTO (todo dia às 20h) ----------
create table if not exists ranking_foto (
  academia_id   uuid not null,
  modalidade_id uuid,
  mes           date not null,
  membro_id     uuid not null,
  aulas         int not null,
  posicao       int not null
);
create index if not exists ix_ranking_foto on ranking_foto (academia_id, membro_id, mes);
alter table ranking_foto enable row level security;  -- só as funções mexem aqui

create or replace function avisos_ranking() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_mes date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_semana text := to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-IW');
begin
  drop table if exists rk_agora;
  create temp table rk_agora as
  select rm.academia_id, rm.modalidade_id, rm.membro_id, rm.aulas::int as aulas, rm.posicao::int as posicao
    from ranking_mensal rm
    join academias a on a.id = rm.academia_id and a.ativa and coalesce(a.modulos->>'ranking', 'true') <> 'false'
    join membros m on m.id = rm.membro_id and m.ativo and m.papel = 'aluno'
   where rm.mes = v_mes;

  -- 4a) alguém te passou (só para quem está entre os 10 primeiros)
  for r in
    select n.*, f.posicao as antes,
           (select nome_curto(mm.perfil_id) from rk_agora x join membros mm on mm.id = x.membro_id
             where x.academia_id = n.academia_id and x.modalidade_id is not distinct from n.modalidade_id and x.posicao < n.posicao
               and coalesce((select f2.posicao from ranking_foto f2 where f2.academia_id = x.academia_id and f2.membro_id = x.membro_id and f2.mes = v_mes and f2.modalidade_id is not distinct from x.modalidade_id), 999) >= f.posicao
             order by x.posicao desc limit 1) as quem,
           (select nome from modalidades where id = n.modalidade_id) as modalidade
      from rk_agora n
      join ranking_foto f on f.academia_id = n.academia_id and f.membro_id = n.membro_id and f.mes = v_mes and f.modalidade_id is not distinct from n.modalidade_id
     where n.posicao > f.posicao and f.posicao <= 10
  loop
    insert into lembretes_enviados (chave) values ('rk:' || r.membro_id || ':' || (now() at time zone 'America/Sao_Paulo')::date) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, m.perfil_id, 'ranking',
           '😮 ' || coalesce(r.quem || ' te passou', 'Te passaram') || ' no ranking' || coalesce(' de ' || r.modalidade, ''),
           'Você estava em ' || r.antes || 'º e agora está em ' || r.posicao || 'º no mês. Bora pro treino! 💪', '/ranking'
      from membros m where m.id = r.membro_id;
    v_n := v_n + 1;
  end loop;

  -- 4b) falta 1 treino para alcançar quem está logo acima (uma vez por semana)
  for r in
    select n.*, acima.posicao as pos_acima, acima.aulas as aulas_acima,
           (select nome_curto(mm.perfil_id) from membros mm where mm.id = acima.membro_id) as quem,
           (select nome from modalidades where id = n.modalidade_id) as modalidade
      from rk_agora n
      cross join lateral (select * from rk_agora x where x.academia_id = n.academia_id and x.modalidade_id is not distinct from n.modalidade_id
                            and x.posicao = n.posicao - 1 order by x.aulas limit 1) acima
     where n.posicao between 2 and 11 and acima.aulas - n.aulas = 1
  loop
    insert into lembretes_enviados (chave) values ('rk-perto:' || r.membro_id || ':' || v_semana) on conflict do nothing;
    if not found then continue; end if;
    if exists (select 1 from lembretes_enviados where chave = 'rk:' || r.membro_id || ':' || (now() at time zone 'America/Sao_Paulo')::date) then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, m.perfil_id, 'ranking',
           '🔥 Falta 1 treino para alcançar ' || coalesce(r.quem, 'o ' || r.pos_acima || 'º'),
           'No ranking do mês' || coalesce(' de ' || r.modalidade, '') || ' você está em ' || r.posicao || 'º. Mais um treino e você empata em ' || r.pos_acima || 'º!', '/ranking'
      from membros m where m.id = r.membro_id;
    v_n := v_n + 1;
  end loop;

  -- guarda a foto de hoje para comparar amanhã
  delete from ranking_foto where mes < v_mes;
  delete from ranking_foto where mes = v_mes;
  insert into ranking_foto (academia_id, modalidade_id, mes, membro_id, aulas, posicao)
  select academia_id, modalidade_id, v_mes, membro_id, aulas, posicao from rk_agora;
  drop table if exists rk_agora;
  return v_n;
end $$;


-- ---------- 5. FIM DO DIA: CHECK-INS PELO GPS SEM ACEITAR (22h) ----------
create or replace function resumo_checkins_gps() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select x.academia_id, eq.perfil_id, 'gps',
         '📍 ' || x.n || case when x.n = 1 then ' check-in pelo GPS ficou' else ' check-ins pelo GPS ficaram' end || ' sem aceitar hoje',
         'Toque para aceitar todos de uma vez (ou dizer quem não veio).', '/checkins-gps'
    from (select c.academia_id, count(*) n, array_agg(distinct a.turma_id) turmas
            from checkins_gps c join aulas a on a.id = c.aula_id
           where c.status = 'pendente' and a.data = v_hoje group by c.academia_id) x
    join membros eq on eq.academia_id = x.academia_id and eq.ativo and eq.papel in ('admin', 'professor')
   where (eq.papel = 'admin' or exists (select 1 from turmas t where t.id = any(x.turmas) and t.professor_id = eq.id));
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- ---------- 6. EVENTOS QUE SE REPETEM TODO ANO ----------
-- Quando falta pouco (ou já passou), cria o do ano seguinte, com o cronograma.
create or replace function copiar_evento(p_evento uuid, p_inicio timestamptz, p_repete boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare e eventos%rowtype; v_novo uuid; v_delta interval; v_titulo text;
begin
  select * into e from eventos where id = p_evento;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if auth.uid() is not null and not sou_equipe(e.academia_id) then raise exception 'Sem permissão.'; end if;
  v_delta := p_inicio - e.inicio;
  -- troca o ano no título (ex.: "Copa Regional 2026" → "Copa Regional 2027")
  v_titulo := regexp_replace(e.titulo, extract(year from e.inicio at time zone 'America/Sao_Paulo')::text, extract(year from p_inicio at time zone 'America/Sao_Paulo')::text);
  insert into eventos (academia_id, modalidade_id, tipo, titulo, descricao, inicio, fim, local, maps_url, link, pesagem_em, publico, cancela_aulas, repetir_anual, repete_de)
  values (e.academia_id, e.modalidade_id, e.tipo, v_titulo, e.descricao, p_inicio, e.fim + v_delta, e.local, e.maps_url, e.link,
          e.pesagem_em + v_delta, e.publico, e.cancela_aulas, case when p_repete then e.repetir_anual else false end, case when p_repete then e.id end)
  returning id into v_novo;
  insert into cronograma_evento (evento_id, tipo, titulo, classe, sexo, categorias, inicio, fim, local, observacao, avisar_min_antes)
  select v_novo, tipo, titulo, classe, sexo, categorias, inicio + v_delta, fim + v_delta, local, observacao, avisar_min_antes
    from cronograma_evento where evento_id = e.id;
  return v_novo;
end $$;
grant execute on function copiar_evento(uuid, timestamptz, boolean) to authenticated;

create or replace function gerar_eventos_anuais() returns int
language plpgsql security definer set search_path = public as $$
declare e record; v_n int := 0;
begin
  for e in
    select ev.* from eventos ev
     where ev.repetir_anual and ev.inicio < now() + interval '60 days'
       and not exists (select 1 from eventos f where f.repete_de = ev.id)
  loop
    perform copiar_evento(e.id, e.inicio + interval '1 year', true);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function gerar_eventos_anuais() to authenticated;


-- ---------- 7. AGENDAMENTOS ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembrete-eventos', '0 12 * * *', 'select lembrete_eventos()');          -- 9h
    perform cron.schedule('eventos-anuais',   '15 12 * * *', 'select gerar_eventos_anuais()');     -- 9h15
    perform cron.schedule('avisos-ranking',   '0 23 * * *', 'select avisos_ranking()');            -- 20h
    perform cron.schedule('resumo-gps',       '0 1 * * *',  'select resumo_checkins_gps()');       -- 22h
  end if;
exception when others then raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;
