-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 07
-- Rode no SQL Editor. NÃO apaga dados.
-- Página "Minhas turmas": colegas da turma (só quem é da turma vê).
-- =====================================================================

create or replace function colegas_da_turma(p_turma uuid)
returns table (membro_id uuid, nome text, apelido text, foto_url text, faixa text, cor_faixa text, grau int)
language sql stable security definer set search_path = public as $$
  select m.id, pf.nome, pf.apelido, pf.foto_url, pa.faixa, pa.cor_faixa, pa.grau
    from matriculas mt
    join membros m on m.id = mt.membro_id and m.ativo
    join perfis pf on pf.id = m.perfil_id
    left join lateral (
      select g.faixa, g.grau, mo.cores_graduacoes[array_position(mo.graduacoes, g.faixa)] as cor_faixa
        from graduacoes g join modalidades mo on mo.id = g.modalidade_id
       where g.membro_id = m.id and g.modalidade_id = (select modalidade_id from turmas where id = p_turma)
       order by g.data desc limit 1
    ) pa on true
   where mt.turma_id = p_turma and mt.status = 'ativa'
     and (cuido_da_turma(p_turma)
          or exists (select 1 from matriculas x where x.turma_id = p_turma and x.status = 'ativa' and x.membro_id in (select meus_membros())))
   order by coalesce(pf.apelido, pf.nome);
$$;

-- Professor da turma (nome e foto) para quem participa da academia
create or replace function professor_da_turma(p_turma uuid)
returns table (nome text, foto_url text)
language sql stable security definer set search_path = public as $$
  select coalesce(pf.apelido, pf.nome), pf.foto_url
    from turmas t join membros m on m.id = t.professor_id join perfis pf on pf.id = m.perfil_id
   where t.id = p_turma and participo(t.academia_id);
$$;
