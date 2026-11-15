-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 24 — MAIS NOTIFICAÇÕES E DIA A DIA
-- • Resumo da semana para o aluno (domingo 18h)
-- • Parabéns no aniversário do próprio aluno (8h)
-- • Graduação nova e mensalidade paga → aluno e responsável
-- • Aviso com "👍 Ciente" (a equipe vê quem leu) e foto no push
-- • Professor: "sua aula começa em 30 min, X confirmaram"
-- • Aluno que confirmou ✋: "sua aula começa em 30 min"
-- • Painel de entrega das notificações (master)
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

-- foto e contagem de envio por notificação
alter table notificacoes add column if not exists imagem text;
alter table notificacoes add column if not exists push_enviados int;

-- ---------- 1. AVISO COM FOTO (o push mostra a imagem) ----------
create or replace function notificar_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  if new.expira_em is not null and new.expira_em < now() then return new; end if;
  select perfil_id into v_autor from membros where id = new.autor_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link, imagem)
  select distinct new.academia_id, d.pid, 'aviso',
         '📣 ' || case when new.escopo = 'turma' then coalesce((select nome from turmas where id = new.turma_id) || ': ', '') else '' end || new.titulo,
         left(coalesce(new.texto, ''), 160), '/avisos', new.imagem_url
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

-- ---------- 2. "👍 CIENTE" NOS AVISOS ----------
create table if not exists avisos_lidos (
  aviso_id  uuid not null references avisos(id) on delete cascade,
  perfil_id uuid not null references perfis(id) on delete cascade,
  lido_em   timestamptz default now(),
  primary key (aviso_id, perfil_id)
);
alter table avisos_lidos enable row level security;
drop policy if exists ver on avisos_lidos; drop policy if exists marcar on avisos_lidos; drop policy if exists desmarcar on avisos_lidos;
create policy ver on avisos_lidos for select using (
  perfil_id in (select meus_perfis()) or exists (select 1 from avisos a where a.id = aviso_id and sou_equipe(a.academia_id)));
create policy marcar on avisos_lidos for insert with check (perfil_id in (select meus_perfis()));
create policy desmarcar on avisos_lidos for delete using (perfil_id in (select meus_perfis()));

-- Quem deveria ver o aviso e quem já deu ciente (para a equipe)
create or replace function leitura_aviso(p_aviso uuid)
returns table (perfil_id uuid, nome text, leu boolean, lido_em timestamptz)
language sql stable security definer set search_path = public as $$
  with a as (select * from avisos where id = p_aviso and sou_equipe(academia_id)),
  alvo as (
    select distinct m.perfil_id
      from a join membros m on m.academia_id = a.academia_id and m.ativo and m.papel = 'aluno'
     where a.escopo in ('geral', 'dia')
        or (a.escopo = 'turma' and exists (select 1 from matriculas mt where mt.membro_id = m.id and mt.turma_id = a.turma_id and mt.status = 'ativa'))
        or (a.escopo = 'modalidade' and exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id
                                                 where mt.membro_id = m.id and mt.status = 'ativa' and t.modalidade_id = a.modalidade_id))
  )
  select al.perfil_id, nome_curto(al.perfil_id),
         -- vale o ciente do aluno ou de um responsável dele
         exists (select 1 from avisos_lidos l where l.aviso_id = p_aviso and (l.perfil_id = al.perfil_id
                   or l.perfil_id in (select r.responsavel_id from responsaveis r where r.dependente_id = al.perfil_id))),
         (select min(l.lido_em) from avisos_lidos l where l.aviso_id = p_aviso and (l.perfil_id = al.perfil_id
                   or l.perfil_id in (select r.responsavel_id from responsaveis r where r.dependente_id = al.perfil_id)))
    from alvo al
   order by 3, 2;
$$;
grant execute on function leitura_aviso(uuid) to authenticated;


-- ---------- 3. GRADUAÇÃO NOVA ----------
create or replace function notificar_graduacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_acad uuid; v_mod text;
begin
  -- não avisa importação de planilha nem a faixa informada no cadastro
  if coalesce(new.observacao, '') ilike any (array['%importad%', '%informada no cadastro%']) then return new; end if;
  if new.data < current_date - 7 then return new; end if;
  select m.academia_id into v_acad from membros m where m.id = new.membro_id;
  select nome into v_mod from modalidades where id = new.modalidade_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select v_acad, d.pid, 'graduacao',
         case when coalesce(new.grau, 0) > 0
              then '🥋 Parabéns' || case when d.pid = (select perfil_id from membros where id = new.membro_id) then '' else ', ' || nome_curto((select perfil_id from membros where id = new.membro_id)) end
                   || '! ' || new.grau || 'º grau na faixa ' || lower(new.faixa)
              else '🥋 Parabéns' || case when d.pid = (select perfil_id from membros where id = new.membro_id) then '' else ', ' || nome_curto((select perfil_id from membros where id = new.membro_id)) end
                   || '! Agora é faixa ' || lower(new.faixa) end,
         coalesce(v_mod || ' · ', '') || 'Muito treino até aqui. Bora pro próximo passo! 💪', '/meu'
    from perfis_do_aluno(new.membro_id) d(pid);
  return new;
end $$;
drop trigger if exists trg_notificar_graduacao on graduacoes;
create trigger trg_notificar_graduacao after insert on graduacoes for each row execute function notificar_graduacao();


-- ---------- 4. MENSALIDADE PAGA ----------
create or replace function notificar_pagamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'paga' or coalesce(old.status, '') = 'paga' then return new; end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select new.academia_id, d.pid, 'pagamento',
         '✅ Pagamento recebido: R$ ' || replace(to_char(coalesce(new.valor_pago, new.valor), 'FM999990.00'), '.', ','),
         'Mensalidade de ' || to_char(new.competencia, 'MM/YYYY')
           || case when d.pid <> (select perfil_id from membros where id = new.membro_id) then ' de ' || nome_curto((select perfil_id from membros where id = new.membro_id)) else '' end
           || '. O recibo está em Mensalidades. Obrigado!', '/mensalidades'
    from perfis_do_aluno(new.membro_id) d(pid);
  return new;
end $$;
drop trigger if exists trg_notificar_pagamento on cobrancas;
create trigger trg_notificar_pagamento after update of status on cobrancas for each row execute function notificar_pagamento();


-- ---------- 5. PARABÉNS PARA O ANIVERSARIANTE (8h) ----------
create or replace function parabens_do_dia() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  with aniv as (
    select distinct on (pf.id, a.id) pf.id as perfil_id, a.id as academia_id, a.nome as academia, m.id as membro_id,
           extract(year from age(v_hoje, pf.nascimento))::int as idade
      from membros m join perfis pf on pf.id = m.perfil_id join academias a on a.id = m.academia_id and a.ativa
     where m.ativo and m.papel = 'aluno' and pf.nascimento is not null
       and (to_char(pf.nascimento, 'MM-DD') = to_char(v_hoje, 'MM-DD')
            or (to_char(pf.nascimento, 'MM-DD') = '02-29' and to_char(v_hoje, 'MM-DD') = '02-28' and not (extract(year from v_hoje)::int % 4 = 0)))
  ), novos as (
    insert into lembretes_enviados (chave) select 'parabens:' || perfil_id || ':' || academia_id || ':' || v_hoje from aniv
    on conflict do nothing returning chave
  )
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select x.academia_id, d.pid, 'aniversario',
         case when d.pid = x.perfil_id then '🎉 Feliz aniversário, ' || nome_curto(x.perfil_id) || '!'
              else '🎉 Hoje é aniversário de ' || nome_curto(x.perfil_id) || '!' end,
         'A ' || x.academia || ' deseja um ano cheio de treinos, saúde e conquistas! 🥋' ||
           case when x.idade between 1 and 120 then ' (' || x.idade || ' anos)' else '' end, '/meu'
    from aniv x
    join novos n on n.chave = 'parabens:' || x.perfil_id || ':' || x.academia_id || ':' || v_hoje
    cross join lateral perfis_do_aluno(x.membro_id) d(pid);
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- ---------- 6. RESUMO DA SEMANA DO ALUNO (domingo 18h) ----------
create or replace function resumo_semana_aluno() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;   -- segunda
begin
  with alunos as (
    select m.id, m.academia_id, m.perfil_id, coalesce(m.meta_semanal, a.meta_semanal_padrao, 2) as meta,
           (select count(*) from presencas p join aulas au on au.id = p.aula_id
             where p.membro_id = m.id and au.data between v_ini and v_hoje and au.status <> 'cancelada')::int as treinos
      from membros m join academias a on a.id = m.academia_id and a.ativa
     where m.ativo and m.papel = 'aluno'
       -- só quem está treinando neste mês (não incomoda quem está parado)
       and exists (select 1 from presencas p join aulas au on au.id = p.aula_id where p.membro_id = m.id and au.data >= v_hoje - 30)
  ), novos as (
    insert into lembretes_enviados (chave) select 'semana:' || id || ':' || v_ini from alunos on conflict do nothing returning chave
  )
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select x.academia_id, d.pid, 'resumo',
         case when x.treinos >= x.meta then '🏆 ' else '📊 ' end
           || case when d.pid = x.perfil_id then 'Sua semana: ' else nome_curto(x.perfil_id) || ': ' end
           || x.treinos || case when x.treinos = 1 then ' treino' else ' treinos' end,
         case when x.treinos >= x.meta then 'Bateu a meta de ' || x.meta || ' por semana! Constância é o que faz a faixa mudar. 💪'
              when x.treinos = 0 then 'Essa semana não deu. Segunda é dia de recomeçar: a meta é ' || x.meta || '. 🥋'
              else 'Faltou ' || (x.meta - x.treinos) || ' para a meta de ' || x.meta || '. Semana que vem você chega lá!' end,
         '/meu'
    from alunos x
    join novos n on n.chave = 'semana:' || x.id || ':' || v_ini
    cross join lateral perfis_do_aluno(x.id) d(pid);
  get diagnostics v_n = row_count;
  return v_n;
end $$;


-- ---------- 7. ANTES DA AULA (a cada 10 min) ----------
-- Professor: 30 min antes, quantos confirmaram e quem avisou falta.
-- Aluno que tocou em "✋ Vou nessa aula": lembrete 30 min antes.
create or replace function avisos_antes_da_aula() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_k int;
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo'); v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for r in
    select h.id, h.turma_id, h.hora_inicio, t.nome as turma, t.academia_id, t.professor_id,
           (select count(*) from pre_checkins pc where pc.horario_id = h.id and pc.data = v_hoje)::int as vao,
           (select count(*) from ausencias au join matriculas mt on mt.membro_id = au.membro_id and mt.turma_id = h.turma_id and mt.status = 'ativa'
             where v_hoje between au.de and au.ate)::int as faltam,
           (select count(*) from matriculas mt where mt.turma_id = h.turma_id and mt.status = 'ativa')::int as total
      from horarios h join turmas t on t.id = h.turma_id and t.ativa join academias a on a.id = t.academia_id and a.ativa
     where h.dia_semana = extract(dow from v_hoje)::int and v_hoje >= h.vale_de and (h.vale_ate is null or v_hoje <= h.vale_ate)
       and h.hora_inicio between (v_agora + interval '20 minutes')::time and (v_agora + interval '35 minutes')::time
       and not exists (select 1 from aulas au where au.turma_id = h.turma_id and au.data = v_hoje and au.hora_inicio = h.hora_inicio and au.status = 'cancelada')
       and not exists (select 1 from eventos e where e.academia_id = t.academia_id and e.cancela_aulas
                        and (e.inicio at time zone 'America/Sao_Paulo')::date = v_hoje
                        and (e.modalidade_id is null or e.modalidade_id = t.modalidade_id))
  loop
    insert into lembretes_enviados (chave) values ('preaula:' || r.id || ':' || v_hoje) on conflict do nothing;
    if not found then continue; end if;
    -- professor da turma
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, m.perfil_id, 'pre_aula',
           '⏰ ' || r.turma || ' às ' || to_char(r.hora_inicio, 'HH24:MI'),
           case when r.vao > 0 then '✋ ' || r.vao || ' confirmaram' else 'Ninguém confirmou ainda' end
             || case when r.faltam > 0 then ' · 🙋 ' || r.faltam || ' avisaram falta' else '' end
             || ' · ' || r.total || ' na turma. Toque para abrir a chamada.',
           '/chamada?turma=' || r.turma_id || '&horario=' || r.id
      from membros m where m.id = r.professor_id and m.ativo;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
    -- alunos que confirmaram presença
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct r.academia_id, d.pid, 'lembrete_aula',
           '🥋 ' || r.turma || ' começa às ' || to_char(r.hora_inicio, 'HH24:MI'),
           case when d.pid = m.perfil_id then 'Você confirmou presença. Não esquece a garrafinha! 💧'
                else nome_curto(m.perfil_id) || ' confirmou presença. Hora de ir! 🚗' end, '/'
      from pre_checkins pc join membros m on m.id = pc.membro_id
      cross join lateral perfis_do_aluno(m.id) d(pid)
     where pc.horario_id = r.id and pc.data = v_hoje;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
  end loop;
  return v_n;
end $$;


-- ---------- 8. PAINEL DE ENTREGA (master) ----------
create or replace function entrega_notificacoes()
returns table (academia_id uuid, academia text, slug text, pessoas int, com_push int, aparelhos int,
               enviadas_7d int, chegaram_7d int, lidas_7d int)
language sql stable security definer set search_path = public as $$
  select a.id, a.nome, a.slug,
         (select count(distinct m.perfil_id) from membros m where m.academia_id = a.id and m.ativo)::int,
         (select count(distinct m.perfil_id) from membros m join push_inscricoes pi on pi.perfil_id = m.perfil_id where m.academia_id = a.id and m.ativo)::int,
         (select count(*) from push_inscricoes pi where pi.perfil_id in (select m.perfil_id from membros m where m.academia_id = a.id and m.ativo))::int,
         (select count(*) from notificacoes n where n.academia_id = a.id and n.criada_em > now() - interval '7 days')::int,
         (select count(*) from notificacoes n where n.academia_id = a.id and n.criada_em > now() - interval '7 days' and coalesce(n.push_enviados, 0) > 0)::int,
         (select count(*) from notificacoes n where n.academia_id = a.id and n.criada_em > now() - interval '7 days' and n.lida)::int
    from academias a
   where sou_master()
   order by a.nome;
$$;
grant execute on function entrega_notificacoes() to authenticated;


-- ---------- 9. AGENDAMENTOS ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('parabens',        '0 11 * * *',   'select parabens_do_dia()');        -- 8h
    perform cron.schedule('resumo-aluno',    '0 21 * * 0',   'select resumo_semana_aluno()');    -- domingo 18h
    perform cron.schedule('antes-da-aula',   '*/10 * * * *', 'select avisos_antes_da_aula()');
  end if;
exception when others then raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;
