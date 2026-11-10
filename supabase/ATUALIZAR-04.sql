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
