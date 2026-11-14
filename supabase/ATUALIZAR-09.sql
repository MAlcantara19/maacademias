-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 09
-- Rode no SQL Editor. NÃO apaga dados das academias de verdade.
-- 1) Feed: miniatura de cada foto (carrega rápido e gasta menos internet)
-- 2) Academias piloto SEM técnicas, exames e estudo (conteúdo é exclusivo)
-- 3) Professores de muay thai e taekwondo do piloto com login de teste
-- =====================================================================

-- ---------- 1) Miniaturas no feed ----------
alter table post_midias add column if not exists miniatura text;

create or replace view feed_posts as
select p.id, p.academia_id, p.autor_id, p.legenda, p.oculto, p.criado_em,
       pf.nome as autor_nome, pf.apelido as autor_apelido, pf.foto_url as autor_foto,
       coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'url', m.url, 'miniatura', m.miniatura, 'ordem', m.ordem) order by m.ordem)
                   from post_midias m where m.post_id = p.id), '[]'::jsonb) as midias,
       coalesce((select array_agg(c.membro_id) from curtidas c where c.post_id = p.id), '{}') as curtidas,
       coalesce((select array_agg(coalesce(px.apelido, px.nome))
                   from post_marcacoes pm join membros mx on mx.id = pm.membro_id
                   join perfis px on px.id = mx.perfil_id
                  where pm.post_id = p.id), '{}') as marcados
  from posts p
  join membros am on am.id = p.autor_id
  join perfis pf on pf.id = am.perfil_id
 where participo(p.academia_id)
   and (not p.oculto or sou_equipe(p.academia_id));

-- A limpeza diária também apaga as miniaturas
create or replace function posts_vencidos()
returns table (post_id uuid, academia_id uuid, urls text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.academia_id,
         array_remove(array_agg(m.url) || array_agg(m.miniatura), null)
    from posts p
    join academias a on a.id = p.academia_id
    left join post_midias m on m.post_id = p.id
   where p.criado_em < now() - make_interval(days => coalesce(a.feed_retencao_dias, 30))
   group by p.id, p.academia_id;
$$;

-- ---------- 2) Pilotos sem técnicas/estudo ----------
update academias set modulos = coalesce(modulos, '{}'::jsonb) || '{"tecnicas":false}'::jsonb
 where slug like 'piloto-%' or slug = 'clube-de-luta-exemplo';
delete from vocabulario     where academia_id in (select id from academias where slug like 'piloto-%');
delete from desafios_dia    where academia_id in (select id from academias where slug like 'piloto-%');
delete from tecnicas        where academia_id in (select id from academias where slug like 'piloto-%');
delete from quiz_resultados where academia_id in (select id from academias where slug like 'piloto-%');

-- ---------- 3) Logins de teste dos outros professores ----------
update perfis set email = 'prof.muaythai.piloto@example.com' where email = 'prof.muaythai.piloto@example.com';
update perfis set email = 'prof.tkd.piloto@example.com'      where email = 'prof.tkd.piloto@example.com';
update perfis p set user_id = u.id from auth.users u
 where p.user_id is null and lower(p.email) = lower(u.email)
   and not exists (select 1 from perfis x where x.user_id = u.id);
