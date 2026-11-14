-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 21 — PEDIDO DE NOVA SENHA
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- Quem toca em "Esqueci a senha" (com e-mail ou WhatsApp) gera um pedido
-- para a equipe; o professor/admin/master gera uma senha provisória nova.
-- =====================================================================

create table if not exists pedidos_senha (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references perfis(id) on delete cascade,
  contato      text,                 -- o que a pessoa digitou (e-mail ou WhatsApp)
  criado_em    timestamptz default now(),
  atendido_em  timestamptz,
  atendido_por uuid default null
);
create index if not exists ix_pedidos_senha on pedidos_senha (perfil_id, atendido_em);
alter table pedidos_senha enable row level security;
drop policy if exists ver on pedidos_senha; drop policy if exists atender on pedidos_senha;
create policy ver on pedidos_senha for select using (sou_equipe_do_perfil(perfil_id));
create policy atender on pedidos_senha for update using (sou_equipe_do_perfil(perfil_id));

-- Chamado na tela de entrar (sem login). Sempre responde igual, exista ou não
-- o cadastro, para ninguém descobrir quais e-mails/telefones estão no app.
create or replace function pedir_nova_senha(p_contato text) returns void
language plpgsql security definer set search_path = public as $$
declare v text := lower(trim(coalesce(p_contato, ''))); v_dig text; r record;
begin
  if length(v) < 6 then return; end if;
  v_dig := regexp_replace(v, '\D', '', 'g');
  for r in
    select distinct pf.id, coalesce(pf.apelido, pf.nome) as nome
      from perfis pf
     where pf.user_id is not null
       and ((position('@' in v) > 0 and lower(pf.email) = v)
            or (position('@' in v) = 0 and length(v_dig) >= 8 and right(regexp_replace(coalesce(pf.telefone, ''), '\D', '', 'g'), 9) = right(v_dig, 9)))
     limit 3
  loop
    -- no máximo um pedido a cada 30 minutos por pessoa
    insert into lembretes_enviados (chave) values ('senha:' || r.id || ':' || to_char(now(), 'YYYYMMDDHH24') || (extract(minute from now())::int / 30)) on conflict do nothing;
    if not found then continue; end if;
    insert into pedidos_senha (perfil_id, contato) values (r.id, left(p_contato, 120));
    -- avisa a equipe das academias da pessoa (ou dos filhos, se for responsável)
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select distinct eq.academia_id, eq.perfil_id, 'senha', '🔑 Pedido de nova senha',
           r.nome || ' esqueceu a senha. Toque para gerar uma senha provisória.', '/'
      from membros al
      join membros eq on eq.academia_id = al.academia_id and eq.ativo and eq.papel in ('admin', 'professor')
     where al.ativo and al.perfil_id in (select r.id union select dependente_id from responsaveis where responsavel_id = r.id)
       and (eq.papel = 'admin' or sou_professor_do_membro_de(eq.id, al.id));
  end loop;
end $$;
grant execute on function pedir_nova_senha(text) to anon, authenticated;
