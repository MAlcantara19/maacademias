-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 08
-- Rode no SQL Editor. NÃO apaga dados.
-- 1) Índices: deixam as buscas do banco bem mais rápidas
-- 2) Link do grupo de WhatsApp em cada turma
-- 3) Uma função só para montar o app (menos idas e voltas ao banco)
-- =====================================================================

-- ---------- 1) Índices ----------
create index if not exists ix_membros_academia      on membros (academia_id, papel, ativo);
create index if not exists ix_membros_perfil        on membros (perfil_id, ativo);
create index if not exists ix_perfis_user           on perfis (user_id);
create index if not exists ix_perfis_email          on perfis (lower(email));
create index if not exists ix_responsaveis_resp     on responsaveis (responsavel_id);
create index if not exists ix_responsaveis_dep      on responsaveis (dependente_id);
create index if not exists ix_turmas_academia       on turmas (academia_id, ativa);
create index if not exists ix_turmas_professor      on turmas (professor_id);
create index if not exists ix_horarios_turma        on horarios (turma_id, dia_semana);
create index if not exists ix_matriculas_membro     on matriculas (membro_id, status);
create index if not exists ix_matriculas_turma      on matriculas (turma_id, status);
create index if not exists ix_aulas_turma_data      on aulas (turma_id, data);
create index if not exists ix_presencas_aula        on presencas (aula_id);
create index if not exists ix_graduacoes_membro     on graduacoes (membro_id, data desc);
create index if not exists ix_cobrancas_academia    on cobrancas (academia_id, competencia);
create index if not exists ix_cobrancas_membro      on cobrancas (membro_id, status);
create index if not exists ix_eventos_academia      on eventos (academia_id, inicio);
create index if not exists ix_ausencias_membro      on ausencias (membro_id, de);
create index if not exists ix_modalidades_academia  on modalidades (academia_id);
create index if not exists ix_posts_academia        on posts (academia_id, criado_em desc);
create index if not exists ix_post_midias_post      on post_midias (post_id);
create index if not exists ix_quiz_membro           on quiz_resultados (membro_id, criado_em desc);
create index if not exists ix_quiz_academia         on quiz_resultados (academia_id, criado_em);
create index if not exists ix_historico_academia    on historico (academia_id, quando desc);
create index if not exists ix_pre_checkins_membro   on pre_checkins (membro_id);
create index if not exists ix_conquistas_academia   on conquistas (academia_id);
create index if not exists ix_despesas_academia     on despesas (academia_id, data);
create index if not exists ix_vocabulario_acad      on vocabulario (academia_id, lista, ordem);
create index if not exists ix_inscricoes_evento     on inscricoes_evento (evento_id);
create index if not exists ix_solicitacoes_academia on solicitacoes_cadastro (academia_id, status);

-- ---------- 2) Grupo de WhatsApp da turma ----------
alter table turmas add column if not exists whatsapp_grupo text;

-- ---------- 3) Tudo que o app precisa para abrir, numa chamada só ----------
create or replace function contexto_app(p_academia uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with eu as (
    select p.* from perfis p where p.user_id = auth.uid() limit 1
  ),
  deps as (
    select r.dependente_id from responsaveis r where r.responsavel_id = (select id from eu)
  )
  select jsonb_build_object(
    'perfil', (select to_jsonb(eu) from eu),
    'master', sou_master(),
    'meus', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'papel', m.papel, 'perfil_id', m.perfil_id))
                        from membros m where m.academia_id = p_academia and m.ativo and m.perfil_id = (select id from eu)), '[]'::jsonb),
    'dependentes', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'papel', m.papel, 'perfil_id', m.perfil_id,
                                'nome', pf.nome, 'apelido', pf.apelido, 'foto_url', pf.foto_url))
                        from membros m join perfis pf on pf.id = m.perfil_id
                       where m.academia_id = p_academia and m.ativo and m.perfil_id in (select dependente_id from deps)), '[]'::jsonb),
    'outras', coalesce((select jsonb_agg(distinct jsonb_build_object('slug', a.slug, 'nome', a.nome))
                        from membros m join academias a on a.id = m.academia_id
                       where m.ativo and a.id <> p_academia
                         and (m.perfil_id = (select id from eu) or m.perfil_id in (select dependente_id from deps))), '[]'::jsonb),
    'nao_lidas', (select count(*) from notificacoes n where n.perfil_id in (select meus_perfis()) and not n.lida)
  )
  where auth.uid() is not null;
$$;
