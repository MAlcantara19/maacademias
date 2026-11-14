-- =====================================================================
-- MA ACADEMIAS — SENHA DOS LOGINS DE DEMONSTRAÇÃO (opcional)
-- Coloca a MESMA senha em todos os logins de teste das academias piloto,
-- para a página /demo entrar como admin, professor, aluno ou responsável.
-- 1) Troque 'prof123' abaixo pela senha que quiser (a mesma de NEXT_PUBLIC_DEMO_SENHA).
-- 2) Rode no SQL Editor. Só muda os logins listados (que precisam já existir
--    em Authentication → Users).
-- =====================================================================
update auth.users
   set encrypted_password = extensions.crypt('prof123', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now())
 where email in (
   'admin.piloto@example.com',
   'prof.piloto@example.com', 'prof.judo.piloto@example.com', 'prof.muaythai.piloto@example.com', 'prof.tkd.piloto@example.com',
   'aluno.piloto@example.com', 'judo.piloto@example.com', 'muaythai.piloto@example.com', 'tkd.piloto@example.com',
   'responsavel.piloto@example.com'
 );

-- Confira quais existem (os que faltarem, crie em Authentication → Add user → Auto Confirm):
select e.email, (u.id is not null) as existe
  from unnest(array['admin.piloto@example.com','prof.piloto@example.com','prof.judo.piloto@example.com','prof.muaythai.piloto@example.com',
                    'prof.tkd.piloto@example.com','aluno.piloto@example.com','judo.piloto@example.com','muaythai.piloto@example.com',
                    'tkd.piloto@example.com','responsavel.piloto@example.com']) as e(email)
  left join auth.users u on u.email = e.email
 order by 2, 1;
