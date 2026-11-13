-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 15
-- Rode no SQL Editor. NÃO apaga dados.
-- 1) Ficha de saúde (anamnese) no cadastro da pessoa
-- 2) Mural de recordes (exercícios criados pela academia)
-- 3) Recado para a próxima aula + aviso na véspera
-- 4) Conteúdo de judô do Dojô Alcântara: só o master libera para uma academia
-- 5) Curiosidades do judô nas roletas do Dojô
-- =====================================================================

-- ---------- 1) Ficha de saúde ----------
alter table perfis add column if not exists saude jsonb default '{}'::jsonb;

-- ---------- 2) Mural de recordes ----------
create table if not exists recordes_exercicios (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  nome         text not null,                     -- ex.: Parada de mão na parede
  descricao    text,
  unidade      text not null default 'quantidade' check (unidade in ('tempo','quantidade','distancia','pontos')),
  melhor       text not null default 'maior' check (melhor in ('maior','menor')),  -- tempo de zigue-zague: menor é melhor
  cada_n       numeric,                           -- a cada N (pulos, segundos…) = 1 ponto
  ativo        boolean default true,
  criado_em    timestamptz default now()
);
create table if not exists recordes_marcas (
  id            uuid primary key default gen_random_uuid(),
  exercicio_id  uuid not null references recordes_exercicios(id) on delete cascade,
  academia_id   uuid not null references academias(id) on delete cascade,
  membro_id     uuid not null references membros(id) on delete cascade,
  valor         numeric not null,                 -- tempo em segundos, quantidade, metros…
  data          date not null default current_date,
  observacao    text,
  registrado_por uuid references membros(id) on delete set null,
  criado_em     timestamptz default now()
);
create index if not exists ix_recordes_marcas on recordes_marcas (exercicio_id, valor);
alter table recordes_exercicios enable row level security;
alter table recordes_marcas enable row level security;
drop policy if exists ver on recordes_exercicios;  drop policy if exists gerir on recordes_exercicios;
drop policy if exists ver on recordes_marcas;      drop policy if exists gerir on recordes_marcas;
create policy ver on recordes_exercicios for select using (participo(academia_id));
create policy gerir on recordes_exercicios for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));
create policy ver on recordes_marcas for select using (participo(academia_id));
create policy gerir on recordes_marcas for all using (sou_equipe(academia_id)) with check (sou_equipe(academia_id));

-- Nomes de quem aparece no mural (todos da academia veem nome/apelido/foto)
create or replace function mural_recordes(p_acad uuid)
returns table (marca_id uuid, exercicio_id uuid, membro_id uuid, nome text, apelido text, foto_url text, valor numeric, data date)
language sql stable security definer set search_path = public as $$
  select r.id, r.exercicio_id, r.membro_id, pf.nome, pf.apelido, pf.foto_url, r.valor, r.data
    from recordes_marcas r join membros m on m.id = r.membro_id join perfis pf on pf.id = m.perfil_id
   where r.academia_id = p_acad and participo(p_acad);
$$;

-- ---------- 3) Recado para a aula + aviso na véspera ----------
create table if not exists recados_aula (
  id          uuid primary key default gen_random_uuid(),
  academia_id uuid not null references academias(id) on delete cascade,
  turma_id    uuid not null references turmas(id) on delete cascade,
  data        date not null,
  texto       text not null,
  criado_por  uuid references membros(id) on delete set null,
  criado_em   timestamptz default now(),
  unique (turma_id, data)
);
alter table recados_aula enable row level security;
drop policy if exists ver on recados_aula; drop policy if exists gerir on recados_aula;
create policy ver on recados_aula for select using (participo(academia_id));
create policy gerir on recados_aula for all using (cuido_da_turma(turma_id)) with check (cuido_da_turma(turma_id));

-- Toda tarde: o professor recebe quantos confirmaram a aula de amanhã;
-- os alunos recebem o recado da aula (se houver).
create or replace function lembrete_vespera() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_amanha date := (now() at time zone 'America/Sao_Paulo')::date + 1;
  h record; v_n int := 0; v_vao int; v_recado text;
begin
  for h in
    select hr.*, t.nome as turma, t.academia_id, t.professor_id, p.perfil_id as prof_perfil
      from horarios hr join turmas t on t.id = hr.turma_id and t.ativa
      join academias a on a.id = t.academia_id and a.ativa
      left join membros p on p.id = t.professor_id
     where hr.dia_semana = extract(dow from v_amanha)::int
  loop
    select count(*) into v_vao from pre_checkins where horario_id = h.id and data = v_amanha;
    select texto into v_recado from recados_aula where turma_id = h.turma_id and data = v_amanha;

    if h.prof_perfil is not null then
      insert into lembretes_enviados (chave) values ('vespera-prof:' || h.id || ':' || v_amanha) on conflict do nothing;
      if found then
        insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
        values (h.academia_id, h.prof_perfil, 'vespera', '📅 Amanhã: ' || h.turma || ' às ' || to_char(h.hora_inicio, 'HH24:MI'),
                v_vao || ' aluno(s) confirmaram presença.' || coalesce(' Recado: ' || v_recado, ''), '/chamada');
        v_n := v_n + 1;
      end if;
    end if;

    if v_recado is not null then
      insert into lembretes_enviados (chave) values ('vespera-recado:' || h.id || ':' || v_amanha) on conflict do nothing;
      if found then
        insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
        select h.academia_id, x.pid, 'recado', '📌 Aula de amanhã — ' || h.turma, v_recado, '/turmas/' || h.turma_id
          from (select m.perfil_id as pid from matriculas mt join membros m on m.id = mt.membro_id and m.ativo
                 where mt.turma_id = h.turma_id and mt.status = 'ativa'
                union
                select r.responsavel_id from matriculas mt join membros m on m.id = mt.membro_id and m.ativo
                  join responsaveis r on r.dependente_id = m.perfil_id
                 where mt.turma_id = h.turma_id and mt.status = 'ativa') x;
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

-- Presença por aula de uma turma (para o gráfico), últimas 12 semanas
create or replace function presenca_turma(p_turma uuid)
returns table (data date, presentes int, matriculados int)
language sql stable security definer set search_path = public as $$
  select a.data, (select count(*) from presencas p where p.aula_id = a.id)::int,
         (select count(*) from matriculas mt where mt.turma_id = p_turma and mt.desde <= a.data
             and (mt.ate is null or mt.ate >= a.data) and mt.status <> 'encerrada')::int
    from aulas a
   where a.turma_id = p_turma and a.status <> 'cancelada' and a.data > current_date - 84 and a.data <= current_date
     and cuido_da_turma(p_turma)
   order by a.data;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembrete-vespera', '0 21 * * *', 'select lembrete_vespera()');   -- 18h
  end if;
exception when others then raise notice 'Véspera não agendada: %', sqlerrm;
end $$;

-- ---------- 4) Conteúdo de judô (Dojô Alcântara) liberado pelo master ----------
create or replace function master_liberar_conteudo(p_destino uuid, p_origem_slug text default 'dojo-alcantara')
returns text language plpgsql security definer set search_path = public as $$
declare v_origem uuid; v_mod_origem uuid; v_mod_destino uuid; v_pal int := 0; v_tec int := 0;
begin
  if not sou_master() then raise exception 'Só o master pode liberar este conteúdo.'; end if;
  select id into v_origem from academias where slug = p_origem_slug;
  if v_origem is null or v_origem = p_destino then raise exception 'Academia de origem inválida.'; end if;

  if not exists (select 1 from vocabulario where academia_id = p_destino) then
    insert into vocabulario (academia_id, termo, grafia_antiga, significado, categoria, lista, ordem, kana)
    select p_destino, termo, grafia_antiga, significado, categoria, lista, ordem, kana from vocabulario where academia_id = v_origem;
    get diagnostics v_pal = row_count;
  end if;

  select id into v_mod_origem from modalidades where academia_id = v_origem and nome ilike 'jud%' order by ordem limit 1;
  select id into v_mod_destino from modalidades where academia_id = p_destino and nome ilike 'jud%' order by ordem limit 1;
  if v_mod_origem is not null and v_mod_destino is not null
     and not exists (select 1 from tecnicas where modalidade_id = v_mod_destino) then
    insert into tecnicas (academia_id, modalidade_id, faixa, grupo, nome, nome_original, descricao, video_url, imagem_url, classificacao, conjunto, ordem, kana)
    select p_destino, v_mod_destino, faixa, grupo, nome, nome_original, descricao, video_url, imagem_url, classificacao, conjunto, ordem, kana
      from tecnicas where modalidade_id = v_mod_origem;
    get diagnostics v_tec = row_count;
  end if;

  update academias set modulos = coalesce(modulos, '{}'::jsonb) || '{"tecnicas":true}'::jsonb where id = p_destino;
  return v_pal || ' palavras e ' || v_tec || ' técnicas liberadas';
end $$;

create or replace function master_desligar_conteudo(p_destino uuid, p_apagar boolean default false)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not sou_master() then raise exception 'Só o master pode fazer isso.'; end if;
  update academias set modulos = coalesce(modulos, '{}'::jsonb) || '{"tecnicas":false}'::jsonb where id = p_destino;
  if p_apagar then
    delete from vocabulario where academia_id = p_destino;
    delete from tecnicas where academia_id = p_destino;
  end if;
  return 'ok';
end $$;

-- ---------- 5) Curiosidades do judô (roletas e quiz do Dojô) ----------
insert into vocabulario (academia_id, termo, significado, categoria, lista, ordem)
select a.id, v.t, v.s, 'Curiosidades', 'ampliada', 500 + v.o
  from academias a,
  (values
    ('Criador do judô', 'Jigoro Kano', 1),
    ('Ano de fundação do Kodokan', '1882', 2),
    ('Cidade onde nasceu o Kodokan', 'Tóquio', 3),
    ('Significado de “judô”', 'Caminho suave', 4),
    ('Primeira Olimpíada com judô', 'Tóquio 1964', 5),
    ('Judô feminino passou a valer medalha olímpica em', 'Barcelona 1992', 6),
    ('Primeira medalha olímpica do Brasil no judô', 'Chiaki Ishii, bronze em Munique 1972', 7),
    ('Primeiro ouro olímpico do Brasil no judô', 'Aurélio Miguel, Seul 1988', 8),
    ('Ouro olímpico do Brasil em Barcelona 1992', 'Rogério Sampaio', 9),
    ('Primeira brasileira campeã olímpica no judô', 'Sarah Menezes, Londres 2012', 10),
    ('Brasileira campeã olímpica no Rio 2016', 'Rafaela Silva', 11),
    ('Ano de fundação da Federação Internacional de Judô (IJF)', '1951', 12),
    ('Ano de fundação da Confederação Brasileira de Judô (CBJ)', '1969', 13),
    ('Tempo de luta no sênior (regra IJF)', '4 minutos', 14),
    ('Quantos shidos dão hansoku-make', '3', 15),
    ('Tempo de osaekomi para ippon', '20 segundos', 16),
    ('Tempo de osaekomi para waza-ari', '10 a 19 segundos', 17),
    ('Tempo de osaekomi para yuko', '5 a 9 segundos', 18),
    ('Lado do atleta de azul, visto pelo árbitro', 'Esquerda', 19),
    ('Cor do judogi do primeiro atleta chamado', 'Branco', 20),
    ('Quantos grupos tem o Gokyo', '5', 21),
    ('Pontuação que voltou nas regras de 2025', 'Yuko', 22)
  ) as v(t, s, o)
 where a.slug = 'dojo-alcantara'
   and not exists (select 1 from vocabulario x where x.academia_id = a.id and x.termo = v.t);
