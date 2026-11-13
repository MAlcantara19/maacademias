-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 14
-- Rode no SQL Editor. NÃO apaga dados.
-- 1) Endereço no cadastro da pessoa
-- 2) Estilo dos graus na faixa (barra preta do jiu-jitsu, branco ou colorido do judô)
-- 3) "Meus campeonatos": histórico de campeonatos de cada aluno (com até 3 fotos)
-- =====================================================================

alter table perfis add column if not exists endereco text;

-- barra = ponteira preta com graus brancos (jiu-jitsu)
-- branco / colorido = graus direto na faixa, sem ponteira (judô); colorido usa a cor da próxima faixa
alter table academias add column if not exists estilo_grau text default 'barra';
alter table academias drop constraint if exists academias_estilo_grau_check;
alter table academias add constraint academias_estilo_grau_check check (estilo_grau in ('barra','branco','colorido'));
-- academias só de judô começam com graus coloridos
update academias a set estilo_grau = 'colorido'
 where estilo_grau = 'barra'
   and exists (select 1 from modalidades m where m.academia_id = a.id)
   and not exists (select 1 from modalidades m where m.academia_id = a.id and m.nome not ilike 'jud%');

-- Graus por faixa: até 6 (o professor escolhe); faixa preta usa dan (1º a 10º)
alter table modalidades alter column graus_max set default 4;

create table if not exists campeonatos_aluno (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  membro_id    uuid not null references membros(id) on delete cascade,
  nome         text not null,
  data         date,
  local        text,
  categoria    text,
  colocacao    text,              -- ouro, prata, bronze, participação…
  adversarios  text,
  observacao   text,
  fotos        text[] default '{}',  -- até 3 (chave, pódio…)
  criado_em    timestamptz default now()
);
create index if not exists ix_campeonatos_aluno on campeonatos_aluno (membro_id, data desc);
alter table campeonatos_aluno enable row level security;
drop policy if exists ver on campeonatos_aluno;
drop policy if exists gerir on campeonatos_aluno;
create policy ver on campeonatos_aluno for select using (vejo_aluno(membro_id) or participo(academia_id));
create policy gerir on campeonatos_aluno for all
  using (membro_id in (select meus_membros()) or sou_admin(academia_id) or sou_professor_do_membro(membro_id))
  with check (membro_id in (select meus_membros()) or sou_admin(academia_id) or sou_professor_do_membro(membro_id));

-- Aniversariantes de hoje (todos da academia veem os nomes, para dar os parabéns)
create or replace function aniversariantes_hoje(p_acad uuid)
returns table (membro_id uuid, nome text, apelido text, foto_url text, idade int)
language sql stable security definer set search_path = public as $$
  select m.id, pf.nome, pf.apelido, pf.foto_url,
         extract(year from age((now() at time zone 'America/Sao_Paulo')::date, pf.nascimento))::int
    from membros m join perfis pf on pf.id = m.perfil_id
   where m.academia_id = p_acad and m.ativo and m.papel = 'aluno' and participo(p_acad)
     and pf.nascimento is not null
     and extract(month from pf.nascimento) = extract(month from (now() at time zone 'America/Sao_Paulo'))
     and extract(day from pf.nascimento) = extract(day from (now() at time zone 'America/Sao_Paulo'))
   order by pf.nome;
$$;
