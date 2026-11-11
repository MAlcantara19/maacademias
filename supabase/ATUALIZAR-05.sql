-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 05
-- Rode no SQL Editor. NÃO apaga dados.
-- Planos comerciais por academia (Essencial, Profissional, Completo,
-- Fundador, Social e Exclusivo). O plano decide quais funções aparecem.
-- Técnicas/estudo continuam exclusivos: só o master liga.
-- =====================================================================

alter table academias add column if not exists plano text not null default 'essencial';
alter table academias drop constraint if exists academias_plano_check;
alter table academias add constraint academias_plano_check
  check (plano in ('essencial','profissional','completo','fundador','social','exclusivo'));

-- Academias que já existem
update academias set plano = 'completo'  where slug in ('academia-piloto', 'judo-clube-denis', 'clube-de-luta-exemplo') and plano = 'essencial';
update academias set plano = 'exclusivo' where slug = 'dojo-alcantara';
update academias set plano = 'social'    where tipo = 'projeto_social';

-- Só o master pode mudar o plano e ligar as técnicas
create or replace function proteger_plano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if sou_master() or auth.uid() is null then return new; end if;
  new.plano := old.plano;
  if coalesce((old.modulos->>'tecnicas')::boolean, false) is distinct from coalesce((new.modulos->>'tecnicas')::boolean, false) then
    new.modulos := jsonb_set(coalesce(new.modulos, '{}'::jsonb), '{tecnicas}', to_jsonb(coalesce((old.modulos->>'tecnicas')::boolean, false)));
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_plano on academias;
create trigger trg_proteger_plano before update on academias
for each row execute function proteger_plano();
