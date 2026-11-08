-- =====================================================================
-- PÓS-INSTALAÇÃO: liga os logins, confirma e-mails de teste e define masters
-- (rode depois de criar os usuários no Authentication; pode rodar de novo)
-- =====================================================================

-- Liga cada login ao cadastro com o mesmo e-mail
update perfis p
   set user_id = u.id
  from auth.users u
 where p.user_id is null
   and lower(p.email) = lower(u.email)
   and not exists (select 1 from perfis x where x.user_id = u.id);

-- Confirma os e-mails dos logins de teste do piloto
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email like '%.piloto@%';

-- Seus logins pessoais viram master (veem e administram tudo)
insert into masters (user_id)
select id from auth.users
 where lower(email) in ('judo.matheus.alcantara@gmail.com', 'matheusalcan19@gmail.com')
on conflict do nothing;

-- Agenda os lembretes a cada 10 minutos (se a extensão pg_cron estiver ligada)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembretes', '*/10 * * * *', 'select gerar_lembretes()');
  end if;
exception when others then
  raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;

-- Confira: cada login, se está confirmado, ligado e em quais academias
select u.email,
       u.email_confirmed_at is not null                      as email_confirmado,
       coalesce(p.nome, '❌ sem cadastro com este e-mail')     as cadastro,
       exists (select 1 from masters m where m.user_id = u.id) as master,
       (select string_agg(a.slug || ' (' || mb.papel || ')', ', ')
          from membros mb join academias a on a.id = mb.academia_id
         where mb.perfil_id = p.id)                          as academias
  from auth.users u
  left join perfis p on p.user_id = u.id
 order by u.email;
