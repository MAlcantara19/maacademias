-- =====================================================================
-- CONSERTOS ÚTEIS (rode no SQL Editor do Supabase quando precisar)
-- =====================================================================

-- 0) Função nova (rode uma vez se o seu banco foi criado antes dela existir)
create or replace function vincular_minha_conta() returns int
language plpgsql security definer set search_path = public as $$
declare v_email text; v_n int;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  if exists (select 1 from perfis where user_id = auth.uid()) then return 0; end if;
  update perfis set user_id = auth.uid()
   where id = (select id from perfis
                where user_id is null and lower(email) = lower(v_email)
                order by criado_em limit 1);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 1) Ligar TODOS os logins aos cadastros com o mesmo e-mail
update perfis p
   set user_id = u.id
  from auth.users u
 where p.user_id is null
   and lower(p.email) = lower(u.email)
   and not exists (select 1 from perfis x where x.user_id = u.id);

-- 2) Ver quem tem login e se está ligado a um cadastro
select u.email,
       u.email_confirmed_at is not null as email_confirmado,
       p.nome as cadastro_ligado,
       (select string_agg(a.slug || ' (' || m.papel || ')', ', ')
          from membros m join academias a on a.id = m.academia_id
         where m.perfil_id = p.id) as academias
  from auth.users u
  left join perfis p on p.user_id = u.id
 order by u.email;

-- 3) Confirmar o e-mail de todos os logins de teste (se criou sem "Auto Confirm")
update auth.users
   set email_confirmed_at = now()
 where email_confirmed_at is null
   and email like '%@example.com';

-- 4) Virar master (troque pelo SEU e-mail)
insert into masters (user_id)
select id from auth.users where lower(email) = lower('SEU-EMAIL@AQUI.com')
on conflict do nothing;
