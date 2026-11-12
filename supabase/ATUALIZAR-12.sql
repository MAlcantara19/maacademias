-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 12
-- Rode no SQL Editor. NÃO apaga dados.
-- Modelo da carteirinha escolhido pelo admin (modelo, cor, campos, verso).
-- =====================================================================
alter table academias add column if not exists carteirinha jsonb default '{}'::jsonb;
