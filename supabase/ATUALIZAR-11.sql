-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 11
-- Rode no SQL Editor. NÃO apaga dados.
-- Professores: o admin escolhe se eles podem VER e se podem MEXER nas
-- mensalidades dos alunos das turmas deles.
-- =====================================================================

alter table academias add column if not exists professor_mexe_mensalidades boolean default false;

-- Quem pode mexer precisa poder ver
update academias set professor_mexe_mensalidades = false where not coalesce(professor_ve_mensalidades, false);

drop policy if exists gerir on cobrancas;
create policy gerir on cobrancas for all
  using (sou_admin(academia_id)
         or ((select professor_ve_mensalidades and professor_mexe_mensalidades from academias where id = academia_id)
             and sou_professor_do_membro(membro_id)))
  with check (sou_admin(academia_id)
         or ((select professor_ve_mensalidades and professor_mexe_mensalidades from academias where id = academia_id)
             and sou_professor_do_membro(membro_id)));
