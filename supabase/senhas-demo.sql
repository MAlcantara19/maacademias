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
   'admin.piloto@admin.com',
   'prof.piloto@prof.com', 'prof.judo.piloto@prof.com', 'prof.muaythai.piloto@prof.com', 'prof.tkd.piloto@prof.com',
   'aluno.piloto@aluno.com', 'judo.piloto@aluno.com', 'muaythai.piloto@aluno.com', 'tkd.piloto@aluno.com',
   'responsavel.piloto@resp.com'
 );

-- Confira quais existem (os que faltarem, crie em Authentication → Add user → Auto Confirm):
select e.email, (u.id is not null) as existe
  from unnest(array['admin.piloto@admin.com','prof.piloto@prof.com','prof.judo.piloto@prof.com','prof.muaythai.piloto@prof.com',
                    'prof.tkd.piloto@prof.com','aluno.piloto@aluno.com','judo.piloto@aluno.com','muaythai.piloto@aluno.com',
                    'tkd.piloto@aluno.com','responsavel.piloto@resp.com']) as e(email)
  left join auth.users u on u.email = e.email
 order by 2, 1;
