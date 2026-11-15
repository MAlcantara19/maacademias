-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 22
-- Check-in pelo GPS (fica esperando o professor aceitar), histórico de
-- senhas, senha provisória com prazo, código pelo WhatsApp e contatos.
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

-- ---------- 1. CHECK-IN PELO GPS ----------
alter table academias add column if not exists checkin_gps      boolean default true;   -- aluno pode fazer check-in pelo GPS
alter table academias add column if not exists checkin_gps_auto boolean default false;  -- já vira presença, sem o professor aceitar

alter table presencas drop constraint if exists presencas_metodo_check;
alter table presencas add constraint presencas_metodo_check
  check (metodo in ('manual','qr_fixo','carteirinha','facial','totem','gps'));

create table if not exists checkins_gps (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  aula_id      uuid not null references aulas(id) on delete cascade,
  membro_id    uuid not null references membros(id) on delete cascade,
  distancia_m  int,
  atraso_min   int default 0,
  status       text not null default 'pendente' check (status in ('pendente','aceito','recusado')),
  criado_em    timestamptz default now(),
  decidido_em  timestamptz,
  decidido_por uuid references membros(id) on delete set null,
  unique (aula_id, membro_id)
);
create index if not exists ix_checkins_gps on checkins_gps (academia_id, status, criado_em desc);
alter table checkins_gps enable row level security;
drop policy if exists ver on checkins_gps;
create policy ver on checkins_gps for select using (sou_equipe(academia_id) or membro_id in (select meus_membros()));
-- (gravar e decidir só pelas funções abaixo)

-- O aluno (ou o responsável pela criança) chega perto da academia e toca em
-- "Cheguei". Confere a distância e se tem aula dele agora.
create or replace function checkin_gps(p_membro uuid, p_lat double precision, p_lng double precision, p_precisao double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m      membros%rowtype;
  v_acad   academias%rowtype;
  v_agora  timestamp := (now() at time zone 'America/Sao_Paulo');
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dist   double precision;
  v_limite double precision;
  v_h      record;
  v_aula   uuid;
  v_status text;
  v_atraso int;
begin
  select * into v_m from membros where id = p_membro and ativo and papel = 'aluno';
  if not found or p_membro not in (select meus_membros()) then
    return jsonb_build_object('ok', false, 'erro', 'Aluno não encontrado.');
  end if;
  select * into v_acad from academias where id = v_m.academia_id;
  if coalesce(v_acad.checkin_gps, true) = false then
    return jsonb_build_object('ok', false, 'erro', 'Esta academia não usa check-in pelo GPS.');
  end if;
  if v_acad.latitude is null or v_acad.longitude is null then
    return jsonb_build_object('ok', false, 'erro', 'A academia ainda não marcou a localização dela no app. Avise o professor.');
  end if;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'erro', 'Ative a localização do celular.');
  end if;

  v_dist := 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_lat - v_acad.latitude) / 2), 2) +
    cos(radians(v_acad.latitude)) * cos(radians(p_lat)) *
    power(sin(radians(p_lng - v_acad.longitude) / 2), 2)));
  -- dentro de prédio o GPS erra um pouco: soma a margem de erro do aparelho (até 100 m)
  v_limite := greatest(coalesce(v_acad.checkin_raio_m, 150), 100) + least(greatest(coalesce(p_precisao, 0), 0), 100);
  if v_dist > v_limite then
    return jsonb_build_object('ok', false, 'longe', true, 'distancia', round(v_dist),
      'erro', 'Você está a ' || case when v_dist >= 1000 then round((v_dist / 1000)::numeric, 1) || ' km' else round(v_dist) || ' m' end
              || ' da academia. Faça o check-in quando chegar.');
  end if;

  select h.id, h.turma_id, h.hora_inicio, h.hora_fim, h.tipo_treino, t.nome as turma
    into v_h
    from horarios h
    join matriculas mt on mt.turma_id = h.turma_id and mt.membro_id = p_membro and mt.status = 'ativa'
    join turmas t on t.id = h.turma_id and t.ativa
   where h.dia_semana = extract(dow from v_hoje)::int
     and v_hoje >= h.vale_de
     and (h.vale_ate is null or v_hoje <= h.vale_ate)
     and v_agora::time between h.hora_inicio - make_interval(mins => greatest(coalesce(v_acad.checkin_antes_min, 30), 30)) and h.hora_fim
   order by h.hora_inicio
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma aula sua neste horário.');
  end if;

  insert into aulas (turma_id, horario_id, data, hora_inicio, hora_fim, tipo_treino)
  values (v_h.turma_id, v_h.id, v_hoje, v_h.hora_inicio, v_h.hora_fim, v_h.tipo_treino)
  on conflict (turma_id, data, hora_inicio) do update set turma_id = excluded.turma_id
  returning id, status into v_aula, v_status;
  if v_status = 'cancelada' then
    return jsonb_build_object('ok', false, 'erro', 'Esta aula foi cancelada.');
  end if;

  if exists (select 1 from presencas where aula_id = v_aula and membro_id = p_membro) then
    return jsonb_build_object('ok', true, 'status', 'presente', 'turma', v_h.turma);
  end if;

  v_atraso := greatest(0, floor(extract(epoch from (v_agora::time - v_h.hora_inicio)) / 60))::int;

  if coalesce(v_acad.checkin_gps_auto, false) then
    insert into presencas (aula_id, membro_id, metodo, chegou_em, atraso_min)
    values (v_aula, p_membro, 'gps', now(), v_atraso) on conflict (aula_id, membro_id) do nothing;
    insert into checkins_gps (academia_id, aula_id, membro_id, distancia_m, atraso_min, status, decidido_em)
    values (v_acad.id, v_aula, p_membro, round(v_dist), v_atraso, 'aceito', now())
    on conflict (aula_id, membro_id) do update set status = 'aceito', decidido_em = now();
    return jsonb_build_object('ok', true, 'status', 'presente', 'turma', v_h.turma, 'atraso_min', v_atraso);
  end if;

  insert into checkins_gps (academia_id, aula_id, membro_id, distancia_m, atraso_min)
  values (v_acad.id, v_aula, p_membro, round(v_dist), v_atraso)
  on conflict (aula_id, membro_id) do update
     set status = case when checkins_gps.status = 'recusado' then 'pendente' else checkins_gps.status end,
         distancia_m = excluded.distancia_m;
  return jsonb_build_object('ok', true, 'status', 'pendente', 'turma', v_h.turma, 'atraso_min', v_atraso, 'hora', to_char(v_h.hora_inicio, 'HH24:MI'));
end $$;
grant execute on function checkin_gps(uuid, double precision, double precision, double precision) to authenticated;

-- Professor aceita (vira presença) ou recusa os check-ins pelo GPS
create or replace function decidir_checkins_gps(p_ids uuid[], p_aceitar boolean)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_eu uuid;
begin
  for r in select c.* from checkins_gps c where c.id = any(p_ids) and c.status = 'pendente' and sou_equipe(c.academia_id) loop
    select m.id into v_eu from membros m join perfis p on p.id = m.perfil_id
     where p.user_id = auth.uid() and m.academia_id = r.academia_id and m.papel in ('admin','professor') limit 1;
    update checkins_gps set status = case when p_aceitar then 'aceito' else 'recusado' end, decidido_em = now(), decidido_por = v_eu where id = r.id;
    if p_aceitar then
      insert into presencas (aula_id, membro_id, metodo, chegou_em, atraso_min, confirmado_por)
      values (r.aula_id, r.membro_id, 'gps', r.criado_em, r.atraso_min, v_eu)
      on conflict (aula_id, membro_id) do nothing;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function decidir_checkins_gps(uuid[], boolean) to authenticated;


-- ---------- 2. SENHAS: PRAZO, HISTÓRICO E CÓDIGO ----------
alter table perfis add column if not exists senha_provisoria_ate timestamptz;  -- senha provisória vale 48 h

create table if not exists senhas_geradas (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references perfis(id) on delete cascade,
  gerada_por uuid,           -- usuário (auth) de quem gerou; vazio = a própria pessoa (código)
  quem       text,           -- nome de quem gerou
  via        text,           -- equipe, codigo_whats, codigo_email
  criada_em  timestamptz default now()
);
create index if not exists ix_senhas_geradas on senhas_geradas (perfil_id, criada_em desc);
alter table senhas_geradas enable row level security;
drop policy if exists ver on senhas_geradas;
create policy ver on senhas_geradas for select using (sou_equipe_do_perfil(perfil_id));

-- códigos de 6 dígitos mandados pelo WhatsApp (só o servidor mexe aqui)
create table if not exists codigos_senha (
  perfil_id   uuid primary key references perfis(id) on delete cascade,
  codigo_hash text not null,
  expira_em   timestamptz not null,
  tentativas  int default 0,
  criado_em   timestamptz default now()
);
alter table codigos_senha enable row level security;

-- ao trocar a senha no primeiro acesso, a provisória deixa de valer
create or replace function marcar_boas_vindas() returns void
language sql security definer set search_path = public as $$
  update perfis set boas_vindas_em = now(), trocar_senha = false, senha_provisoria_ate = null where user_id = auth.uid();
$$;

-- conferir o próprio WhatsApp no primeiro acesso (o e-mail é o do login)
create or replace function conferir_meu_whatsapp(p_telefone text) returns void
language sql security definer set search_path = public as $$
  update perfis set telefone = coalesce(nullif(trim(p_telefone), ''), telefone) where user_id = auth.uid();
$$;
grant execute on function conferir_meu_whatsapp(text) to authenticated;


-- ---------- 3. CONTATOS FALTANDO OU ESTRANHOS ----------
create or replace function contatos_com_problema(p_acad uuid)
returns table (membro_id uuid, perfil_id uuid, nome text, problemas text[])
language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, pf.id, coalesce(pf.apelido, pf.nome),
      array_remove(array[
        case when coalesce(pf.telefone, r.telefone) is null or trim(coalesce(pf.telefone, r.telefone)) = '' then 'sem WhatsApp'
             when length(regexp_replace(coalesce(pf.telefone, r.telefone), '\D', '', 'g')) not between 10 and 13 then 'WhatsApp estranho' end,
        case when coalesce(pf.email, r.email) is null or trim(coalesce(pf.email, r.email)) = '' then 'sem e-mail'
             when coalesce(pf.email, r.email) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then 'e-mail estranho' end
      ], null) as problemas
      from membros m
      join perfis pf on pf.id = m.perfil_id
      left join lateral (
        select p2.telefone, p2.email from responsaveis rr join perfis p2 on p2.id = rr.responsavel_id
         where rr.dependente_id = pf.id order by rr.principal desc limit 1
      ) r on true
     where m.academia_id = p_acad and m.ativo and m.papel = 'aluno' and sou_equipe(p_acad)
  ) x where cardinality(x.problemas) > 0
  order by 3;
$$;
grant execute on function contatos_com_problema(uuid) to authenticated;
