-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 19
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- 1) Meta de treinos por semana (padrão da academia e por aluno)
-- 2) Carteirinha digital com QR que muda todo dia (+ opção de só aceitar ele)
-- 3) Lembrete mensal de backup para o admin
-- =====================================================================

-- ---------- 1) Meta de treinos por semana ----------
alter table academias add column if not exists meta_semanal_padrao int default 2;
alter table membros add column if not exists meta_semanal int;   -- vazio = usa a da academia

-- O aluno, o responsável ou a equipe ajustam a meta
create or replace function definir_meta(p_membro uuid, p_meta int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not vejo_aluno(p_membro) then raise exception 'Sem acesso a este aluno.'; end if;
  if p_meta is null or p_meta < 1 or p_meta > 14 then raise exception 'A meta precisa ser de 1 a 14 treinos por semana.'; end if;
  update membros set meta_semanal = p_meta where id = p_membro;
  return p_meta;
end $$;

-- limpeza de uma versão de teste desta atualização (se tiver rodado)
alter table academias drop column if exists meta_treinos_semana;
alter table membros drop column if exists meta_treinos_semana;

-- ---------- 2) QR do dia (carteirinha digital) ----------
alter table academias add column if not exists carteirinha_qr_diario boolean default false; -- true = só aceita o QR do dia
-- O segredo fica numa tabela que ninguém lê direto (só as funções abaixo)
create table if not exists qr_segredos (
  academia_id uuid primary key references academias(id) on delete cascade,
  segredo     text not null default encode(extensions.gen_random_bytes(16), 'hex')
);
alter table qr_segredos enable row level security;  -- sem políticas: nenhum acesso direto

create or replace function qr_assinatura(p_acad uuid, p_membro uuid, p_dia text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_seg text;
begin
  insert into qr_segredos (academia_id) values (p_acad) on conflict do nothing;
  select segredo into v_seg from qr_segredos where academia_id = p_acad;
  return left(encode(extensions.hmac(p_membro::text || '.' || p_dia, v_seg, 'sha256'), 'hex'), 12);
end $$;
revoke execute on function qr_assinatura(uuid, uuid, text) from public, anon, authenticated;

-- QR de hoje do aluno (o próprio aluno, o responsável ou a equipe)
create or replace function qr_do_dia(p_membro uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_acad uuid; v_dia text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYYMMDD');
begin
  if not vejo_aluno(p_membro) then raise exception 'Sem acesso.'; end if;
  select academia_id into v_acad from membros where id = p_membro;
  return 'MA1.' || p_membro || '.' || v_dia || '.' || qr_assinatura(v_acad, p_membro, v_dia);
end $$;

-- Confere o QR lido na chamada: QR do dia (digital) ou código impresso da carteirinha.
-- Devolve {ok, membro_id, motivo}.
drop function if exists validar_qr(text, uuid);
create or replace function validar_qr(p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v text[] := string_to_array(coalesce(p_texto, ''), '.');
  v_dia text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYYMMDD');
  v_membro uuid; v_acad uuid; v_so_diario boolean;
begin
  if array_length(v, 1) = 4 and v[1] = 'MA1' and v[2] ~ '^[0-9a-f-]{36}$' then
    v_membro := v[2]::uuid;
    select academia_id into v_acad from membros where id = v_membro;
    if v_acad is null or not sou_equipe(v_acad) then return jsonb_build_object('ok', false, 'motivo', 'Carteirinha de outra academia'); end if;
    if v[3] <> v_dia then return jsonb_build_object('ok', false, 'motivo', 'QR de outro dia (parece print antigo)'); end if;
    if v[4] <> qr_assinatura(v_acad, v_membro, v_dia) then return jsonb_build_object('ok', false, 'motivo', 'QR inválido'); end if;
    return jsonb_build_object('ok', true, 'membro_id', v_membro);
  end if;
  -- código impresso (ou o id do aluno, nas carteirinhas antigas)
  select c.membro_id into v_membro from carteirinhas c where c.codigo = p_texto and c.tipo = 'academia' order by c.ativa desc, c.ano desc limit 1;
  if v_membro is null and p_texto ~ '^[0-9a-f-]{36}$' then select id into v_membro from membros where id = p_texto::uuid; end if;
  if v_membro is null then return jsonb_build_object('ok', false, 'motivo', 'Carteirinha não reconhecida'); end if;
  select m.academia_id, coalesce(a.carteirinha_qr_diario, false) into v_acad, v_so_diario from membros m join academias a on a.id = m.academia_id where m.id = v_membro;
  if not sou_equipe(v_acad) then return jsonb_build_object('ok', false, 'motivo', 'Carteirinha de outra academia'); end if;
  if v_so_diario then return jsonb_build_object('ok', false, 'motivo', 'Esta academia só aceita o QR do dia (carteirinha digital no app)'); end if;
  return jsonb_build_object('ok', true, 'membro_id', v_membro);
end $$;

-- ---------- 3) Lembrete mensal de backup (dia 1, para os admins) ----------
create or replace function lembrete_backup() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select m.academia_id, m.perfil_id, 'backup', '📦 Hora do backup do mês',
         'Baixe a planilha com alunos, turmas, presenças, mensalidades e graduações e guarde no seu computador ou Drive.', '/exportar#backup'
    from membros m where m.papel = 'admin' and m.ativo;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembrete-backup', '0 12 1 * *', 'select lembrete_backup()');   -- dia 1, 9h
  end if;
exception when others then raise notice 'Lembrete de backup não agendado: %', sqlerrm;
end $$;

-- limpeza: tabela de teste (se tiver rodado uma versão de teste desta atualização)
drop table if exists backups;
