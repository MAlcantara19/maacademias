-- =====================================================================
-- RECOMEÇAR DO ZERO: apaga todas as tabelas do app (NÃO apaga os logins)
-- =====================================================================
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
drop trigger if exists trg_vincula_login on auth.users;
