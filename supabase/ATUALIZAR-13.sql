-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 13  (CORREÇÃO URGENTE)
-- Rode no SQL Editor. NÃO apaga dados.
-- Corrige o erro "infinite recursion detected in policy for relation perfis"
-- ao cadastrar aluno ou professor.
-- =====================================================================

-- Quem pode cadastrar pessoas: master, ou admin/professor de alguma academia.
-- (função "security definer": consulta perfis/membros sem cair nas próprias regras)
create or replace function posso_cadastrar_pessoas() returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or exists (
    select 1 from membros m join perfis p on p.id = m.perfil_id
     where p.user_id = auth.uid() and m.ativo and m.papel in ('admin','professor')
  );
$$;

drop policy if exists criar on perfis;
create policy criar on perfis for insert with check (posso_cadastrar_pessoas());

-- O gatilho que liga o login pelo e-mail também passa a ignorar as regras
create or replace function vincula_perfil_novo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(new.email)
       and not exists (select 1 from perfis p where p.user_id = u.id)
     limit 1;
  end if;
  return new;
end $$;
