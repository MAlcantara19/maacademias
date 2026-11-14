-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 17
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- 1) Logins de demonstração passam a usar @example.com (domínio reservado
--    para exemplos — não é de ninguém).
-- 2) Pré-matrícula completa pelo link da academia (com saúde, termos,
--    assinatura e documentos) + aprovação em um clique.
-- 3) Pendências do cadastro aparecem na lista de alunos.
-- 4) Histórico de lutas do placar na ficha de cada atleta.
-- =====================================================================

-- ---------- 1) E-mails dos logins de demonstração ----------
do $$
declare v_old text; v_new text;
begin
  foreach v_old in array array['admin.piloto@admin.com','prof.piloto@prof.com','prof.judo.piloto@prof.com','prof.muaythai.piloto@prof.com',
                               'prof.tkd.piloto@prof.com','aluno.piloto@aluno.com','judo.piloto@aluno.com','muaythai.piloto@aluno.com',
                               'tkd.piloto@aluno.com','responsavel.piloto@resp.com'] loop
    v_new := split_part(v_old, '@', 1) || '@example.com';
    -- só troca se o novo ainda não existir (para não duplicar)
    if not exists (select 1 from auth.users where lower(email) = v_new) then
      update auth.users set email = v_new where lower(email) = v_old;
      if to_regclass('auth.identities') is not null then
        execute 'update auth.identities set identity_data = jsonb_set(identity_data, ''{email}'', to_jsonb($1::text)) where identity_data->>''email'' = $2'
          using v_new, v_old;
      end if;
    end if;
    update perfis set email = v_new where lower(email) = v_old;
  end loop;
end $$;

-- ---------- 2) Pré-matrícula completa ----------
alter table solicitacoes_cadastro add column if not exists dados jsonb default '{}'::jsonb;   -- ficha completa
alter table solicitacoes_cadastro add column if not exists perfil_id uuid references perfis(id) on delete set null; -- quem virou

-- Arquivos da pré-matrícula: <academia>/pre/<id da solicitação>/arquivo
-- Qualquer pessoa pode ENVIAR (o link é público), só enquanto a ficha não foi avaliada.
create or replace function pode_enviar_pre(nome text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := storage.foldername(nome);
begin
  if coalesce(f[2], '') <> 'pre' or coalesce(f[1], '') !~ '^[0-9a-f-]{36}$' or coalesce(f[3], '') !~ '^[0-9a-f-]{36}$' then return false; end if;
  if lower(nome) !~ '\.(jpg|jpeg|png|pdf)$' then return false; end if;
  if not exists (select 1 from academias a where a.id = f[1]::uuid and coalesce(a.modulos->>'cadastro_online', 'true') <> 'false') then return false; end if;
  return not exists (select 1 from solicitacoes_cadastro x where x.id = f[3]::uuid and x.status <> 'nova');
end $$;

-- Quem pode LER: documentos/assinaturas só de quem cuida do aluno; pré-matrícula só a equipe
-- (e, depois de aprovada, o próprio aluno/responsável).
create or replace function posso_ver_arquivo_pessoal(nome text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := storage.foldername(nome); v_pf uuid;
begin
  if coalesce(f[1], '') !~ '^[0-9a-f-]{36}$' then return false; end if;
  if f[2] in ('documentos', 'assinaturas') then
    if coalesce(f[3], '') !~ '^[0-9a-f-]{36}$' then return false; end if;
    return f[3]::uuid in (select meus_perfis()) or sou_equipe_do_perfil(f[3]::uuid);
  elsif f[2] = 'pre' then
    if sou_equipe(f[1]::uuid) then return true; end if;
    if coalesce(f[3], '') !~ '^[0-9a-f-]{36}$' then return false; end if;
    select perfil_id into v_pf from solicitacoes_cadastro where id = f[3]::uuid;
    return v_pf is not null and (v_pf in (select meus_perfis()) or sou_equipe_do_perfil(v_pf));
  end if;
  return participo(f[1]::uuid);
end $$;

drop policy if exists "privado: pre-matricula envia" on storage.objects;
create policy "privado: pre-matricula envia" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'privado' and pode_enviar_pre(name));

-- Aprovar: cria o aluno com tudo que veio na ficha (dados, responsável, saúde,
-- termos assinados com a data original, documentos, turma, indicação).
create or replace function aprovar_solicitacao(p_id uuid, p_turma uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s record; d jsonb; r jsonb; t jsonb; v_menor boolean;
  v_perfil uuid; v_membro uuid := gen_random_uuid(); v_resp uuid; v_eu uuid; v_turma uuid;
begin
  select * into s from solicitacoes_cadastro where id = p_id for update;
  if s.id is null then raise exception 'Cadastro não encontrado.'; end if;
  if not sou_equipe(s.academia_id) then raise exception 'Sem permissão para aprovar.'; end if;
  if s.status <> 'nova' then raise exception 'Este cadastro já foi avaliado.'; end if;
  d := coalesce(s.dados, '{}'::jsonb);
  r := coalesce(d->'responsavel', '{}'::jsonb);
  v_menor := s.responsavel_nome is not null or (s.nascimento is not null and s.nascimento > current_date - interval '18 years');
  select id into v_eu from membros where academia_id = s.academia_id and perfil_id in (select meus_perfis()) order by papel limit 1;

  -- aluno (adulto com e-mail já cadastrado em outro lugar: aproveita o mesmo perfil)
  if not v_menor and coalesce(s.email, '') <> '' then
    select id into v_perfil from perfis where lower(email) = lower(s.email) order by user_id nulls last limit 1;
  end if;
  if v_perfil is not null and exists (select 1 from membros where academia_id = s.academia_id and perfil_id = v_perfil and papel = 'aluno') then
    raise exception '% já é aluno(a) desta academia.', s.nome;
  end if;
  if v_perfil is null then
    v_perfil := gen_random_uuid();
    insert into perfis (id, nome, email, telefone, nascimento, sexo)
    values (v_perfil, s.nome, case when v_menor then null else s.email end, case when v_menor then nullif(d->>'telefone', '') else s.telefone end, s.nascimento, s.sexo);
  end if;
  update perfis set
    cpf = coalesce(nullif(d->>'cpf', ''), cpf), rg = coalesce(nullif(d->>'rg', ''), rg),
    endereco = coalesce(nullif(d->>'endereco', ''), endereco),
    endereco_detalhe = case when d ? 'endereco_detalhe' then d->'endereco_detalhe' else endereco_detalhe end,
    experiencia = coalesce(nullif(d->>'experiencia', ''), experiencia),
    autorizados_retirada = case when jsonb_typeof(d->'autorizados') = 'array' then d->'autorizados' else autorizados_retirada end,
    contato_emergencia_nome = coalesce(nullif(d->>'emergencia_nome', ''), contato_emergencia_nome),
    contato_emergencia_tel = coalesce(nullif(d->>'emergencia_tel', ''), contato_emergencia_tel)
  where id = v_perfil;

  insert into membros (id, academia_id, perfil_id, papel, observacoes)
  values (v_membro, s.academia_id, v_perfil, 'aluno', nullif(s.mensagem, ''));

  v_turma := coalesce(p_turma, s.turma_id);
  if v_turma is not null then insert into matriculas (turma_id, membro_id) values (v_turma, v_membro) on conflict do nothing; end if;

  -- responsável (aproveita quem já existe pelo e-mail ou CPF)
  if v_menor then
    if coalesce(s.responsavel_email, '') <> '' then select id into v_resp from perfis where lower(email) = lower(s.responsavel_email) order by user_id nulls last limit 1; end if;
    if v_resp is null and coalesce(r->>'cpf', '') <> '' then select id into v_resp from perfis where cpf = r->>'cpf' limit 1; end if;
    if v_resp is null then
      v_resp := gen_random_uuid();
      insert into perfis (id, nome, email, telefone) values (v_resp, coalesce(s.responsavel_nome, r->>'nome', 'Responsável'), s.responsavel_email, s.responsavel_tel);
    end if;
    update perfis set
      cpf = coalesce(nullif(r->>'cpf', ''), cpf), rg = coalesce(nullif(r->>'rg', ''), rg),
      nascimento = coalesce(nullif(r->>'nascimento', '')::date, nascimento),
      telefone = coalesce(telefone, s.responsavel_tel),
      endereco = coalesce(nullif(r->>'endereco', ''), endereco, nullif(d->>'endereco', ''))
    where id = v_resp;
    insert into responsaveis (responsavel_id, dependente_id, parentesco, principal)
    values (v_resp, v_perfil, coalesce(nullif(r->>'parentesco', ''), 'Responsável'), true)
    on conflict (responsavel_id, dependente_id) do update set parentesco = excluded.parentesco, principal = true;
  end if;

  -- ficha de saúde (vale 1 ano a partir do envio)
  if jsonb_typeof(d->'saude') = 'object' then
    insert into fichas_saude (perfil_id, dados, atualizado_em, atualizado_por, validade)
    values (v_perfil, d->'saude', s.criada_em, null, (s.criada_em at time zone 'America/Sao_Paulo')::date + 365)
    on conflict (perfil_id) do update set dados = excluded.dados, atualizado_em = excluded.atualizado_em, validade = excluded.validade;
  end if;

  -- termos assinados no link (com a data e hora originais)
  for t in select * from jsonb_array_elements(coalesce(d->'termos', '[]'::jsonb)) loop
    insert into assinaturas_termos (academia_id, perfil_id, termo, aceito, assinante_nome, assinante_cpf, assinante_papel,
                                    assinatura, texto_hash, navegador, assinado_por, assinado_em)
    values (s.academia_id, v_perfil, t->>'termo', coalesce((t->>'aceito')::boolean, false),
            coalesce(t->>'assinante_nome', d->'assinante'->>'nome', s.nome), coalesce(t->>'assinante_cpf', d->'assinante'->>'cpf'),
            coalesce(t->>'papel', case when v_menor then 'responsavel' else 'aluno' end),
            coalesce(t->>'assinatura', d->>'assinatura'), t->>'texto_hash', left(d->>'navegador', 150), null, s.criada_em);
  end loop;

  -- documentos enviados no link
  for t in select * from jsonb_array_elements(coalesce(d->'documentos', '[]'::jsonb)) loop
    insert into documentos (academia_id, perfil_id, tipo, nome, arquivo, enviado_por, criado_em)
    values (s.academia_id, v_perfil, coalesce(t->>'tipo', 'outro'), t->>'nome', t->>'arquivo', null, s.criada_em);
  end loop;

  -- autorização de imagem (cadastro antigo, sem a ficha completa)
  if s.aceite_imagem and not (d ? 'termos') then
    insert into consentimentos (perfil_id, academia_id, tipo, versao_termo, aceito_por, e_responsavel)
    values (v_perfil, s.academia_id, 'imagem', 'cadastro-online-v1', coalesce(s.responsavel_nome, s.nome), v_menor);
  end if;

  if s.indicado_por is not null then
    insert into indicacoes (academia_id, indicador_id, indicado_nome, indicado_membro) values (s.academia_id, s.indicado_por, s.nome, v_membro);
  end if;

  update solicitacoes_cadastro set status = 'aprovada', avaliada_por = v_eu, perfil_id = v_perfil where id = p_id;
  return v_membro;
end $$;
grant execute on function aprovar_solicitacao(uuid, uuid) to authenticated;

-- ---------- 3) Pendências do cadastro na lista de alunos ----------
drop function if exists cadastros_pendentes(uuid);
create or replace function cadastros_pendentes(p_acad uuid)
returns table (membro_id uuid, nome text, menor boolean, pendencias int, itens text[])
language sql stable security definer set search_path = public as $$
  select m.id, pf.nome, (s->>'menor')::boolean, jsonb_array_length(s->'pendencias'),
         array(select jsonb_array_elements_text(s->'pendencias'))
    from membros m join perfis pf on pf.id = m.perfil_id,
         lateral status_cadastro(m.id) s
   where m.academia_id = p_acad and m.papel = 'aluno' and s is not null
     and not (s->>'completo')::boolean;
$$;

-- ---------- 4) Histórico de lutas do placar ----------
create table if not exists lutas (
  id             uuid primary key default gen_random_uuid(),
  academia_id    uuid not null references academias(id) on delete cascade,
  data           timestamptz default now(),
  azul_membro    uuid references membros(id) on delete set null,
  branco_membro  uuid references membros(id) on delete set null,
  azul_nome      text,
  branco_nome    text,
  vencedor       text check (vencedor in ('azul', 'branco')),   -- vazio = empate/sem decisão
  motivo         text,
  placar         jsonb default '{}'::jsonb,   -- {azul:{ippon,waza,yuko,shido}, branco:{...}}
  eventos        jsonb default '[]'::jsonb,   -- pontuações na ordem
  duracao        int,
  golden         boolean default false,
  gs             int default 0,
  categoria      text,
  fase           text,
  registrado_por uuid references membros(id) on delete set null
);
create index if not exists ix_lutas_azul on lutas (azul_membro, data desc);
create index if not exists ix_lutas_branco on lutas (branco_membro, data desc);
create index if not exists ix_lutas_acad on lutas (academia_id, data desc);
alter table lutas enable row level security;
drop policy if exists ver on lutas; drop policy if exists registrar on lutas; drop policy if exists apagar on lutas;
create policy ver on lutas for select using (
  sou_equipe(academia_id)
  or (azul_membro is not null and vejo_aluno(azul_membro))
  or (branco_membro is not null and vejo_aluno(branco_membro)));
create policy registrar on lutas for insert with check (sou_equipe(academia_id));
create policy apagar on lutas for delete using (sou_admin(academia_id) or registrado_por in (select meus_membros()));
