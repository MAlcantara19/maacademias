-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 10
-- Rode no SQL Editor. NÃO apaga dados das academias de verdade.
-- O que o plano não inclui também fica desligado "por dentro":
-- lembretes de peso, mensalidades automáticas, aviso de débito no check-in,
-- check-in por QR (a partir do Intermediário) e facial (Completo).
-- =====================================================================

create or replace function nivel_plano(p text) returns int
language sql immutable as $$
  select case p when 'intermediario' then 2 when 'profissional' then 2
                when 'completo' then 3 when 'fundador' then 3 when 'exclusivo' then 9
                else 1 end;
$$;

create or replace function ajustar_ao_plano() returns trigger
language plpgsql as $$
begin
  if nivel_plano(new.plano) < 2 then
    new.lembrete_peso_semanal := false;
    new.gerar_mensalidades_auto := false;
    new.alerta_mensalidades_atrasadas := 9999;   -- sem aviso de débito no check-in
    new.modos_chamada := array_remove(coalesce(new.modos_chamada, array['manual']), 'qr_fixo');
  end if;
  if nivel_plano(new.plano) < 3 then
    new.modos_chamada := array_remove(coalesce(new.modos_chamada, array['manual']), 'facial');
  end if;
  if nivel_plano(new.plano) >= 2 and new.alerta_mensalidades_atrasadas = 9999 then
    new.alerta_mensalidades_atrasadas := 2;      -- voltou para um plano com mensalidades
  end if;
  return new;
end $$;
drop trigger if exists trg_ajustar_ao_plano on academias;
create trigger trg_ajustar_ao_plano before insert or update on academias
for each row execute function ajustar_ao_plano();

-- Aplica nas academias que já existem
update academias set plano = plano;

-- Piloto Base: sem dados de mensalidade (o plano não tem)
delete from cobrancas   where academia_id in (select id from academias where slug = 'piloto-base');
delete from assinaturas where membro_id in (select m.id from membros m join academias a on a.id = m.academia_id where a.slug = 'piloto-base');
delete from planos      where academia_id in (select id from academias where slug = 'piloto-base');
delete from pendencias  where academia_id in (select id from academias where slug = 'piloto-base') and tipo = 'pagamento';
