-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 25
-- • Página principal personalizável pelo master (logo, cores, efeitos)
-- • Academias reais × pilotos (demonstração) no diretório
-- • Avisos: agendados, enquete rápida e "lembrar quem não leu"
-- • Ações direto na notificação: "não vou hoje" e "todos que confirmaram vieram"
-- • Dia do campeonato (quem está com você), ficha rápida pelo QR,
--   metas pessoais e relatório de engajamento
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

-- ---------- 1. PÁGINA PRINCIPAL (uma linha só) ----------
create table if not exists plataforma (
  id          int primary key default 1 check (id = 1),
  nome        text default 'MA Academias',
  titulo      text default 'Escolha seu tatame.',
  subtitulo   text default 'Horários, professores e aula experimental das academias de luta da região. Toque numa academia para ver tudo.',
  logo_url    text,
  cor         text default '#7c3aed',
  modo        text default 'escuro',
  efeito      text default 'nenhum',
  efeito_temporada boolean default false,
  abertura    boolean default false,
  mostrar_pilotos boolean default true,
  whatsapp    text,
  instagram   text,
  rodape      text,
  atualizado_em timestamptz default now()
);
insert into plataforma (id) values (1) on conflict do nothing;
alter table plataforma enable row level security;
drop policy if exists ver on plataforma; drop policy if exists mudar on plataforma;
create policy ver on plataforma for select using (true);
create policy mudar on plataforma for update using (sou_master()) with check (sou_master());
grant select on plataforma to anon, authenticated;

-- academia de demonstração (piloto) aparece separada das reais
alter table academias add column if not exists demonstracao boolean default false;
update academias set demonstracao = true where slug like 'piloto-%' or slug in ('academia-piloto', 'clube-de-luta-exemplo');
-- logo provisória dos pilotos (troque quando quiser em Personalizar academia)
update academias set logo_url = '/marca/' || slug || '.svg' where slug in ('piloto-base', 'piloto-intermediario', 'piloto-completo') and logo_url is null;

create or replace view diretorio_academias as
select id, slug, dominio, nome, slogan, logo_url, cores, cidade,
       latitude, longitude, maps_url, whatsapp, instagram,
       (select array_agg(nome order by ordem) from modalidades
         where academia_id = academias.id and ativa) as modalidades,
       coalesce(demonstracao, false) as demonstracao, tipo, endereco
from academias
where ativa and no_diretorio;
grant select on diretorio_academias to anon, authenticated;


-- ---------- 2. AVISOS: AGENDADO, ENQUETE E LEMBRETE ----------
alter table avisos add column if not exists publicar_em   timestamptz;   -- vazio = já
alter table avisos add column if not exists notificado_em timestamptz;
alter table avisos add column if not exists opcoes        text[];        -- enquete: ['👍 Vou', '👎 Não vou']
alter table avisos add column if not exists lembrado_em   timestamptz;

-- aluno só vê o aviso agendado depois da hora marcada (a equipe vê antes)
drop policy if exists ver on avisos;
create policy ver on avisos for select
  using ((publico or participo(academia_id)) and (publicar_em is null or publicar_em <= now() or sou_equipe(academia_id)));

-- quem deve receber um aviso (alunos + responsáveis)
create or replace function destinatarios_aviso(p_aviso uuid) returns table (perfil_id uuid, aluno_perfil uuid)
language sql stable security definer set search_path = public as $$
  select distinct d.pid, al.perfil_id
    from avisos a
    join membros al on al.academia_id = a.academia_id and al.ativo and al.papel = 'aluno'
    cross join lateral perfis_do_aluno(al.id) d(pid)
   where a.id = p_aviso
     and (a.escopo in ('geral', 'dia')
          or (a.escopo = 'turma' and exists (select 1 from matriculas mt where mt.membro_id = al.id and mt.turma_id = a.turma_id and mt.status = 'ativa'))
          or (a.escopo = 'modalidade' and exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id
                                                   where mt.membro_id = al.id and mt.status = 'ativa' and t.modalidade_id = a.modalidade_id)));
$$;

create or replace function enviar_aviso(p_aviso uuid) returns int
language plpgsql security definer set search_path = public as $$
declare a avisos%rowtype; v_autor uuid; v_n int;
begin
  update avisos set notificado_em = now() where id = p_aviso and notificado_em is null returning * into a;
  if not found then return 0; end if;
  if a.expira_em is not null and a.expira_em < now() then return 0; end if;
  select perfil_id into v_autor from membros where id = a.autor_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link, imagem)
  select a.academia_id, d.perfil_id, 'aviso',
         case when a.opcoes is not null then '🗳️ ' else '📣 ' end
           || case when a.escopo = 'turma' then coalesce((select nome from turmas where id = a.turma_id) || ': ', '') else '' end || a.titulo,
         case when a.opcoes is not null then 'Toque para responder: ' || array_to_string(a.opcoes, ' / ') else left(coalesce(a.texto, ''), 160) end,
         '/avisos', a.imagem_url
    from (select distinct perfil_id from destinatarios_aviso(a.id)) d
   where d.perfil_id is distinct from v_autor;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- o gatilho agora só manda na hora certa (agendado fica para o publicar_avisos_agendados)
create or replace function notificar_aviso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.publicar_em is not null and new.publicar_em > now() then return new; end if;
  perform enviar_aviso(new.id);
  return new;
end $$;

create or replace function publicar_avisos_agendados() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in select id from avisos where notificado_em is null and publicar_em is not null and publicar_em <= now() and publicar_em > now() - interval '3 days' loop
    v_n := v_n + enviar_aviso(r.id);
  end loop;
  return v_n;
end $$;

-- respostas da enquete (uma por pessoa; dá para trocar)
create table if not exists avisos_respostas (
  aviso_id  uuid not null references avisos(id) on delete cascade,
  perfil_id uuid not null references perfis(id) on delete cascade,
  opcao     text not null,
  em        timestamptz default now(),
  primary key (aviso_id, perfil_id)
);
alter table avisos_respostas enable row level security;
drop policy if exists ver on avisos_respostas; drop policy if exists responder on avisos_respostas;
drop policy if exists trocar on avisos_respostas; drop policy if exists tirar on avisos_respostas;
create policy ver on avisos_respostas for select using (
  perfil_id in (select meus_perfis()) or exists (select 1 from avisos a where a.id = aviso_id and sou_equipe(a.academia_id)));
create policy responder on avisos_respostas for insert with check (perfil_id in (select meus_perfis()));
create policy trocar on avisos_respostas for update using (perfil_id in (select meus_perfis()));
create policy tirar on avisos_respostas for delete using (perfil_id in (select meus_perfis()));

-- contagem para todo mundo ver (sem nomes); os nomes só a equipe vê
create or replace function contagem_enquete(p_aviso uuid) returns table (opcao text, votos int)
language sql stable security definer set search_path = public as $$
  select o.opcao, (select count(*) from avisos_respostas r where r.aviso_id = p_aviso and r.opcao = o.opcao)::int
    from avisos a cross join lateral unnest(a.opcoes) with ordinality o(opcao, n)
   where a.id = p_aviso and participo(a.academia_id)
   order by o.n;
$$;
grant execute on function contagem_enquete(uuid) to authenticated;

-- "Lembrar quem ainda não leu": manda de novo só para quem não deu ciente nem respondeu
create or replace function lembrar_aviso(p_aviso uuid) returns int
language plpgsql security definer set search_path = public as $$
declare a avisos%rowtype; v_n int;
begin
  select * into a from avisos where id = p_aviso;
  if not found or not sou_equipe(a.academia_id) then raise exception 'Sem permissão.'; end if;
  if a.lembrado_em is not null and a.lembrado_em > now() - interval '6 hours' then
    raise exception 'Já foi lembrado há pouco. Tente de novo mais tarde.';
  end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link, imagem)
  select a.academia_id, d.perfil_id, 'aviso', '🔔 Lembrete: ' || a.titulo,
         case when a.opcoes is not null then 'Ainda falta sua resposta: ' || array_to_string(a.opcoes, ' / ') else 'Toque para ler e dar o 👍 ciente.' end,
         '/avisos', a.imagem_url
    from (select distinct x.perfil_id
            from destinatarios_aviso(a.id) x
           where not exists (
             select 1 from destinatarios_aviso(a.id) y
              where y.aluno_perfil = x.aluno_perfil
                and (exists (select 1 from avisos_lidos l where l.aviso_id = a.id and l.perfil_id = y.perfil_id)
                     or exists (select 1 from avisos_respostas r where r.aviso_id = a.id and r.perfil_id = y.perfil_id)))
         ) d;
  get diagnostics v_n = row_count;
  update avisos set lembrado_em = now() where id = p_aviso;
  return v_n;
end $$;
grant execute on function lembrar_aviso(uuid) to authenticated;

-- leitura do aviso: quem respondeu a enquete conta como "leu"
create or replace function leitura_aviso(p_aviso uuid)
returns table (perfil_id uuid, nome text, leu boolean, lido_em timestamptz)
language sql stable security definer set search_path = public as $$
  with a as (select * from avisos where id = p_aviso and sou_equipe(academia_id)),
  alvo as (select distinct aluno_perfil from destinatarios_aviso(p_aviso) where exists (select 1 from a)),
  sinais as (
    select l.perfil_id, l.lido_em as em from avisos_lidos l where l.aviso_id = p_aviso
    union all select r.perfil_id, r.em from avisos_respostas r where r.aviso_id = p_aviso
  )
  select al.aluno_perfil, nome_curto(al.aluno_perfil),
         exists (select 1 from sinais s where s.perfil_id = al.aluno_perfil or s.perfil_id in (select r.responsavel_id from responsaveis r where r.dependente_id = al.aluno_perfil)),
         (select min(s.em) from sinais s where s.perfil_id = al.aluno_perfil or s.perfil_id in (select r.responsavel_id from responsaveis r where r.dependente_id = al.aluno_perfil))
    from alvo al
   order by 3, 2;
$$;

-- respostas com nome (equipe)
create or replace function respostas_enquete(p_aviso uuid) returns table (opcao text, nome text, em timestamptz)
language sql stable security definer set search_path = public as $$
  select r.opcao, nome_curto(r.perfil_id), r.em
    from avisos_respostas r join avisos a on a.id = r.aviso_id
   where r.aviso_id = p_aviso and sou_equipe(a.academia_id)
   order by r.opcao, 2;
$$;
grant execute on function respostas_enquete(uuid) to authenticated;


-- ---------- 3. AÇÕES NA NOTIFICAÇÃO ----------
alter table notificacoes add column if not exists acoes jsonb;   -- [{ "titulo": "...", "link": "/acao?..." }]

-- "🙋 Não vou hoje" (aluno ou responsável)
create or replace function nao_vou_hoje(p_membro uuid, p_horario uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_m membros%rowtype; v_turma text; v_prof uuid;
begin
  select * into v_m from membros where id = p_membro;
  if not found or p_membro not in (select meus_membros()) then return jsonb_build_object('ok', false, 'erro', 'Aluno não encontrado.'); end if;
  if not exists (select 1 from ausencias where membro_id = p_membro and v_hoje between de and ate) then
    insert into ausencias (membro_id, de, ate, motivo, observacao) values (p_membro, v_hoje, v_hoje, 'outro', 'Avisou pela notificação: não vai hoje');
  end if;
  if p_horario is not null then delete from pre_checkins where membro_id = p_membro and horario_id = p_horario and data = v_hoje; end if;
  select t.nome, t.professor_id into v_turma, v_prof from horarios h join turmas t on t.id = h.turma_id where h.id = p_horario;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select v_m.academia_id, m.perfil_id, 'falta', '🙋 ' || nome_curto(v_m.perfil_id) || ' não vai hoje',
         coalesce(v_turma || ' · ', '') || 'Avisou pelo app.', '/pendencias'
    from membros m where m.id = v_prof;
  return jsonb_build_object('ok', true, 'nome', nome_curto(v_m.perfil_id), 'turma', v_turma);
end $$;
grant execute on function nao_vou_hoje(uuid, uuid) to authenticated;

-- "✅ Todos que confirmaram vieram" (professor)
create or replace function confirmar_quem_confirmou(p_horario uuid, p_data date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h record; v_data date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date); v_aula uuid; v_eu uuid; v_n int;
begin
  select ho.*, t.academia_id, t.nome as turma into h from horarios ho join turmas t on t.id = ho.turma_id where ho.id = p_horario;
  if not found or not sou_equipe(h.academia_id) then return jsonb_build_object('ok', false, 'erro', 'Sem permissão.'); end if;
  select m.id into v_eu from membros m join perfis p on p.id = m.perfil_id where p.user_id = auth.uid() and m.academia_id = h.academia_id and m.papel in ('admin','professor') limit 1;
  insert into aulas (turma_id, horario_id, data, hora_inicio, hora_fim, tipo_treino)
  values (h.turma_id, h.id, v_data, h.hora_inicio, h.hora_fim, h.tipo_treino)
  on conflict (turma_id, data, hora_inicio) do update set turma_id = excluded.turma_id
  returning id into v_aula;
  insert into presencas (aula_id, membro_id, metodo, confirmado_por)
  select v_aula, pc.membro_id, 'manual', v_eu from pre_checkins pc
   where pc.horario_id = p_horario and pc.data = v_data
     and not exists (select 1 from ausencias au where au.membro_id = pc.membro_id and v_data between au.de and au.ate)
  on conflict (aula_id, membro_id) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marcados', v_n, 'turma', h.turma);
end $$;
grant execute on function confirmar_quem_confirmou(uuid, date) to authenticated;

-- aviso antes da aula agora leva os botões
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
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link, acoes)
    select r.academia_id, m.perfil_id, 'pre_aula',
           '⏰ ' || r.turma || ' às ' || to_char(r.hora_inicio, 'HH24:MI'),
           case when r.vao > 0 then '✋ ' || r.vao || ' confirmaram' else 'Ninguém confirmou ainda' end
             || case when r.faltam > 0 then ' · 🙋 ' || r.faltam || ' avisaram falta' else '' end
             || ' · ' || r.total || ' na turma. Toque para abrir a chamada.',
           '/chamada?turma=' || r.turma_id || '&horario=' || r.id,
           case when r.vao > 0 then jsonb_build_array(jsonb_build_object('titulo', '✅ Todos que confirmaram vieram', 'link', '/acao?tipo=vieram&horario=' || r.id || '&data=' || v_hoje)) end
      from membros m where m.id = r.professor_id and m.ativo;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link, acoes)
    select distinct on (d.pid, m.id) r.academia_id, d.pid, 'lembrete_aula',
           '🥋 ' || r.turma || ' começa às ' || to_char(r.hora_inicio, 'HH24:MI'),
           case when d.pid = m.perfil_id then 'Você confirmou presença. Não esquece a garrafinha! 💧'
                else nome_curto(m.perfil_id) || ' confirmou presença. Hora de ir! 🚗' end, '/',
           jsonb_build_array(jsonb_build_object('titulo', '🙋 Não vou hoje', 'link', '/acao?tipo=nao-vou&membro=' || m.id || '&horario=' || r.id))
      from pre_checkins pc join membros m on m.id = pc.membro_id
      cross join lateral perfis_do_aluno(m.id) d(pid)
     where pc.horario_id = r.id and pc.data = v_hoje;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
  end loop;
  return v_n;
end $$;


-- ---------- 4. DIA DO CAMPEONATO: QUEM ESTÁ COM VOCÊ ----------
create or replace function equipe_no_campeonato(p_evento uuid)
returns table (membro_id uuid, nome text, foto_url text, categoria text, classe text, faixa text)
language sql stable security definer set search_path = public as $$
  select i.membro_id, nome_curto(m.perfil_id), p.foto_url, i.categoria_peso, i.classe, i.faixa
    from inscricoes_evento i
    join eventos e on e.id = i.evento_id
    join membros m on m.id = i.membro_id
    join perfis p on p.id = m.perfil_id
   where i.evento_id = p_evento and coalesce(i.status, 'confirmada') = 'confirmada' and participo(e.academia_id)
   order by i.classe, i.categoria_peso, 2;
$$;
grant execute on function equipe_no_campeonato(uuid) to authenticated;


-- ---------- 5. FICHA RÁPIDA PELO QR DA CARTEIRINHA ----------
create or replace function ficha_rapida(p_membro uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'membro_id', m.id, 'nome', p.nome, 'apelido', p.apelido, 'foto_url', p.foto_url,
           'idade', extract(year from age(p.nascimento))::int, 'nascimento', p.nascimento,
           'saude', coalesce(fs.dados, '{}'::jsonb), 'saude_validade', fs.validade,
           'emergencia_nome', p.contato_emergencia_nome, 'emergencia_tel', p.contato_emergencia_tel,
           'responsavel', (select jsonb_build_object('nome', r2.nome, 'telefone', r2.telefone, 'parentesco', r.parentesco)
                             from responsaveis r join perfis r2 on r2.id = r.responsavel_id where r.dependente_id = p.id order by r.principal desc limit 1),
           'telefone', p.telefone,
           'turmas', (select array_agg(t.nome) from matriculas mt join turmas t on t.id = mt.turma_id where mt.membro_id = m.id and mt.status = 'ativa'))
    into v
    from membros m join perfis p on p.id = m.perfil_id
    left join fichas_saude fs on fs.perfil_id = p.id
   where m.id = p_membro and sou_equipe(m.academia_id);
  return v;
end $$;
grant execute on function ficha_rapida(uuid) to authenticated;


-- ---------- 6. METAS PESSOAIS ----------
create table if not exists metas_pessoais (
  id           uuid primary key default gen_random_uuid(),
  membro_id    uuid not null references membros(id) on delete cascade,
  tipo         text not null check (tipo in ('peso', 'treinos', 'graduar', 'livre')),
  titulo       text not null,
  alvo         numeric,      -- kg desejado ou nº de treinos
  inicial      numeric,      -- peso no dia em que criou
  prazo        date,
  criado_em    timestamptz default now(),
  concluida_em timestamptz
);
create index if not exists ix_metas_pessoais on metas_pessoais (membro_id);
alter table metas_pessoais enable row level security;
drop policy if exists ver on metas_pessoais; drop policy if exists minhas on metas_pessoais;
create policy ver on metas_pessoais for select using (membro_id in (select meus_membros()) or vejo_aluno(membro_id));
create policy minhas on metas_pessoais for all using (membro_id in (select meus_membros())) with check (membro_id in (select meus_membros()));


-- ---------- 7. ENGAJAMENTO (quem abre o app, lê avisos, confirma presença) ----------
create table if not exists acessos_dia (
  perfil_id   uuid not null references perfis(id) on delete cascade,
  academia_id uuid not null references academias(id) on delete cascade,
  dia         date not null,
  primary key (perfil_id, academia_id, dia)
);
alter table acessos_dia enable row level security;   -- só pelas funções

create or replace function registrar_acesso(p_academia uuid) returns void
language sql security definer set search_path = public as $$
  insert into acessos_dia (perfil_id, academia_id, dia)
  select p.id, p_academia, (now() at time zone 'America/Sao_Paulo')::date from perfis p where p.user_id = auth.uid()
  on conflict do nothing;
$$;
grant execute on function registrar_acesso(uuid) to authenticated;

create or replace function engajamento_mensal(p_acad uuid, p_meses int default 6)
returns table (mes date, alunos int, abriram_app int, deram_ciente int, avisos int, confirmaram_presenca int, confirmacoes int, treinaram int)
language sql stable security definer set search_path = public as $$
  with meses as (
    select generate_series(date_trunc('month', current_date) - make_interval(months => greatest(p_meses, 1) - 1), date_trunc('month', current_date), interval '1 month')::date as mes
  ), al as (
    select m.id, m.perfil_id, m.entrou_em, m.saiu_em from membros m where m.academia_id = p_acad and m.papel = 'aluno'
  )
  select ms.mes,
    (select count(*) from al where coalesce(al.entrou_em, '2000-01-01') < ms.mes + interval '1 month' and (al.saiu_em is null or al.saiu_em >= ms.mes))::int,
    (select count(distinct x.perfil_id) from acessos_dia x
      where x.academia_id = p_acad and x.dia >= ms.mes and x.dia < ms.mes + interval '1 month'
        and (x.perfil_id in (select perfil_id from al) or x.perfil_id in (select r.responsavel_id from responsaveis r where r.dependente_id in (select perfil_id from al))))::int,
    (select count(distinct l.perfil_id) from avisos_lidos l join avisos a on a.id = l.aviso_id
      where a.academia_id = p_acad and l.lido_em >= ms.mes and l.lido_em < ms.mes + interval '1 month')::int,
    (select count(*) from avisos a where a.academia_id = p_acad and a.criado_em >= ms.mes and a.criado_em < ms.mes + interval '1 month')::int,
    (select count(distinct pc.membro_id) from pre_checkins pc join al on al.id = pc.membro_id where pc.data >= ms.mes and pc.data < ms.mes + interval '1 month')::int,
    (select count(*) from pre_checkins pc join al on al.id = pc.membro_id where pc.data >= ms.mes and pc.data < ms.mes + interval '1 month')::int,
    (select count(distinct p.membro_id) from presencas p join aulas au on au.id = p.aula_id join al on al.id = p.membro_id
      where au.data >= ms.mes and au.data < ms.mes + interval '1 month')::int
  from meses ms
  where sou_equipe(p_acad)
  order by ms.mes;
$$;
grant execute on function engajamento_mensal(uuid, int) to authenticated;


-- ---------- 8. AGENDAMENTOS ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('avisos-agendados', '*/10 * * * *', 'select publicar_avisos_agendados()');
  end if;
exception when others then raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;
