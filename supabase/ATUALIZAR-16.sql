-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 16 — CADASTRO COMPLETO
-- Rode no SQL Editor. NÃO apaga dados.
-- Dados pessoais completos, responsável legal, ficha de saúde com acesso
-- restrito, termos com assinatura eletrônica, documentos, ocorrências,
-- pessoas autorizadas a buscar o menor e regras automáticas do cadastro.
-- =====================================================================

-- ---------- 1) Dados pessoais ----------
alter table perfis add column if not exists cpf text;
alter table perfis add column if not exists rg text;
alter table perfis add column if not exists endereco_detalhe jsonb default '{}'::jsonb;   -- cep, rua, numero, complemento, bairro, cidade, uf
alter table perfis add column if not exists experiencia text;                            -- experiência anterior em lutas
alter table perfis add column if not exists autorizados_retirada jsonb default '[]'::jsonb; -- quem pode buscar o menor
alter table membros add column if not exists cadastro_status text default 'pendente';
alter table membros add column if not exists cadastro_concluido_em timestamptz;

-- A equipe também cuida dos dados do RESPONSÁVEL dos seus alunos
create or replace function sou_equipe_do_perfil(pf uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_master() or exists (
    select 1 from membros m
     where m.perfil_id in (select pf union select r.dependente_id from responsaveis r where r.responsavel_id = pf)
       and (sou_admin(m.academia_id)
            or sou_professor_do_membro(m.id)
            or (m.papel <> 'aluno' and sou_equipe(m.academia_id)))
  );
$$;

-- ---------- 2) Ficha de saúde em tabela própria (acesso restrito) ----------
create table if not exists fichas_saude (
  perfil_id      uuid primary key references perfis(id) on delete cascade,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz default now(),
  atualizado_por uuid default auth.uid(),
  validade       date default (current_date + 365)      -- renovação anual
);
alter table fichas_saude enable row level security;
drop policy if exists ver on fichas_saude; drop policy if exists gerir on fichas_saude;
-- só a própria pessoa, o responsável e a equipe responsável por ela
create policy ver on fichas_saude for select using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
create policy gerir on fichas_saude for all
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id))
  with check (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
-- leva o que já estava preenchido e tira da tabela de perfis
insert into fichas_saude (perfil_id, dados)
select id, saude from perfis where saude is not null and saude <> '{}'::jsonb
on conflict (perfil_id) do nothing;
update perfis set saude = '{}'::jsonb where saude is not null and saude <> '{}'::jsonb;

-- ---------- 3) Documentos ----------
create table if not exists documentos (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  perfil_id    uuid not null references perfis(id) on delete cascade,   -- aluno a quem se refere
  tipo         text not null,     -- doc_responsavel, doc_aluno, guarda, atestado, outro
  nome         text,
  arquivo      text not null,     -- privado:caminho
  validade     date,
  enviado_por  uuid default auth.uid(),
  criado_em    timestamptz default now()
);
create index if not exists ix_documentos_perfil on documentos (perfil_id, tipo);
alter table documentos enable row level security;
drop policy if exists ver on documentos; drop policy if exists gerir on documentos;
create policy ver on documentos for select using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
create policy gerir on documentos for all
  using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id))
  with check (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));

-- ---------- 4) Termos e assinatura eletrônica ----------
alter table academias add column if not exists termos_cadastro jsonb default '{}'::jsonb;  -- textos próprios (opcional)
create table if not exists assinaturas_termos (
  id               uuid primary key default gen_random_uuid(),
  academia_id      uuid not null references academias(id) on delete cascade,
  perfil_id        uuid not null references perfis(id) on delete cascade,   -- aluno
  termo            text not null,   -- matricula, riscos, saude, treinos, competicoes, imagem, lgpd, retirada, ciencia_menor
  aceito           boolean not null,
  assinante_nome   text not null,
  assinante_cpf    text,
  assinante_papel  text not null default 'aluno',   -- aluno | responsavel | menor
  assinatura       text,           -- privado:caminho da assinatura desenhada
  texto_hash       text,           -- identifica a versão do texto aceito
  navegador        text,
  assinado_por     uuid default auth.uid(),
  assinado_em      timestamptz default now()
);
create index if not exists ix_assinaturas on assinaturas_termos (perfil_id, termo, assinado_em desc);
alter table assinaturas_termos enable row level security;
drop policy if exists ver on assinaturas_termos; drop policy if exists assinar on assinaturas_termos;
create policy ver on assinaturas_termos for select using (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
create policy assinar on assinaturas_termos for insert with check (perfil_id in (select meus_perfis()) or sou_equipe_do_perfil(perfil_id));
-- assinatura não se edita nem se apaga: vale o registro mais recente

-- ---------- 5) Ocorrências e acidentes ----------
create table if not exists ocorrencias (
  id            uuid primary key default gen_random_uuid(),
  academia_id   uuid not null references academias(id) on delete cascade,
  membro_id     uuid not null references membros(id) on delete cascade,
  data          date not null default current_date,
  tipo          text not null default 'acidente',   -- acidente, lesao, mal_estar, disciplinar, outro
  descricao     text not null,
  providencias  text,
  responsavel_avisado boolean default false,
  registrado_por uuid references membros(id) on delete set null,
  criado_em     timestamptz default now()
);
alter table ocorrencias enable row level security;
drop policy if exists ver on ocorrencias; drop policy if exists gerir on ocorrencias;
create policy ver on ocorrencias for select using (vejo_aluno(membro_id));
create policy gerir on ocorrencias for all
  using (sou_admin(academia_id) or sou_professor_do_membro(membro_id))
  with check (sou_admin(academia_id) or sou_professor_do_membro(membro_id));

-- Histórico: saúde, documentos e assinaturas registram SÓ que houve mudança (sem o conteúdo)
create or replace function registrar_historico_restrito() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_perfil uuid := ((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'perfil_id')::uuid;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  insert into historico (academia_id, user_id, acao, tabela, registro_id, detalhes)
  values ((select m.academia_id from membros m where m.perfil_id = v_perfil order by m.entrou_em limit 1), auth.uid(),
          case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'editou' else 'apagou' end, tg_table_name, v_perfil::text, '{}'::jsonb);
  return coalesce(new, old);
end $$;
do $$
declare t text;
begin
  foreach t in array array['fichas_saude','documentos','assinaturas_termos'] loop
    execute format('drop trigger if exists trg_historico on %I', t);
    execute format('create trigger trg_historico after insert or update or delete on %I for each row execute function registrar_historico_restrito()', t);
  end loop;
  execute 'drop trigger if exists trg_historico on ocorrencias';
  execute 'create trigger trg_historico after insert or update or delete on ocorrencias for each row execute function registrar_historico()';
end $$;

-- ---------- 6) Regras automáticas: o que falta no cadastro ----------
create or replace function status_cadastro(p_membro uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m record; p record; r record; v_menor boolean; v_falta text[] := '{}'; v_saude record;
  v_termos text[] := array['matricula','riscos','saude','treinos','lgpd'];
  t text; v_par text;
begin
  select * into m from membros where id = p_membro;
  if m.id is null or not vejo_aluno(p_membro) then return null; end if;
  select * into p from perfis where id = m.perfil_id;
  v_menor := p.nascimento is not null and p.nascimento > (current_date - interval '18 years');

  if p.nascimento is null then v_falta := v_falta || 'Data de nascimento'::text; end if;
  if coalesce(p.cpf, '') = '' then v_falta := v_falta || 'CPF do aluno'::text; end if;
  if coalesce(p.endereco, '') = '' and coalesce(p.endereco_detalhe->>'rua', '') = '' then v_falta := v_falta || 'Endereço'::text; end if;
  if not v_menor and coalesce(p.telefone, '') = '' and coalesce(p.email, '') = '' then v_falta := v_falta || 'WhatsApp ou e-mail'::text; end if;

  if v_menor then
    v_termos := v_termos || array['retirada'];
    select rp.cpf, rp.telefone, x.parentesco into r
      from responsaveis x join perfis rp on rp.id = x.responsavel_id
     where x.dependente_id = p.id order by x.principal desc nulls last limit 1;
    if not found then v_falta := v_falta || 'Responsável legal'::text;
    else
      v_par := lower(coalesce(r.parentesco, ''));
      if coalesce(r.cpf, '') = '' then v_falta := v_falta || 'CPF do responsável'::text; end if;
      if coalesce(r.telefone, '') = '' then v_falta := v_falta || 'WhatsApp do responsável'::text; end if;
      if not exists (select 1 from documentos d where d.perfil_id = p.id and d.tipo = 'doc_responsavel') then v_falta := v_falta || 'Documento do responsável'::text; end if;
      if v_par not in ('mãe','mae','pai') and not exists (select 1 from documentos d where d.perfil_id = p.id and d.tipo = 'guarda')
        then v_falta := v_falta || 'Documento de guarda ou tutela'::text; end if;
    end if;
    if not exists (select 1 from documentos d where d.perfil_id = p.id and d.tipo = 'doc_aluno') then v_falta := v_falta || 'Certidão ou documento do aluno'::text; end if;
  end if;

  select * into v_saude from fichas_saude where perfil_id = p.id;
  if not found then v_falta := v_falta || 'Ficha de saúde'::text;
  elsif v_saude.validade < current_date then v_falta := v_falta || 'Ficha de saúde vencida (renovar)'::text; end if;
  if coalesce(p.contato_emergencia_tel, '') = '' then v_falta := v_falta || 'Telefone de emergência'::text; end if;

  foreach t in array v_termos loop
    if not exists (select 1 from assinaturas_termos a where a.perfil_id = p.id and a.termo = t and a.aceito
                     and (not v_menor or a.assinante_papel = 'responsavel')) then
      v_falta := v_falta || ('Termo: ' || case t when 'matricula' then 'matrícula e serviços' when 'riscos' then 'ciência dos riscos'
        when 'saude' then 'declaração de saúde' when 'treinos' then 'participação nos treinos' when 'lgpd' then 'privacidade (LGPD)'
        when 'retirada' then 'retirada do menor' else t end);
    end if;
  end loop;

  return jsonb_build_object('menor', v_menor, 'pendencias', to_jsonb(v_falta), 'completo', coalesce(array_length(v_falta, 1), 0) = 0,
                            'status', m.cadastro_status, 'concluido_em', m.cadastro_concluido_em,
                            'saude_validade', v_saude.validade);
end $$;

-- Concluir o cadastro: bloqueado enquanto houver pendência obrigatória
create or replace function concluir_cadastro(p_membro uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb := status_cadastro(p_membro);
begin
  if v is null then raise exception 'Sem acesso a este cadastro.'; end if;
  if not (v->>'completo')::boolean then
    raise exception 'Ainda falta: %', (select string_agg(x, ', ') from jsonb_array_elements_text(v->'pendencias') x);
  end if;
  update membros set cadastro_status = 'completo', cadastro_concluido_em = now() where id = p_membro;
  return status_cadastro(p_membro);
end $$;

-- Se algo obrigatório volta a faltar (ex.: saúde venceu), o status volta para pendente
create or replace function cadastros_pendentes(p_acad uuid)
returns table (membro_id uuid, nome text, menor boolean, pendencias int)
language sql stable security definer set search_path = public as $$
  select m.id, pf.nome, (s->>'menor')::boolean, jsonb_array_length(s->'pendencias')
    from membros m join perfis pf on pf.id = m.perfil_id,
         lateral status_cadastro(m.id) s
   where m.academia_id = p_acad and m.ativo and m.papel = 'aluno' and s is not null
     and not (s->>'completo')::boolean;
$$;

-- Toda segunda: avisa quem tem cadastro pendente ou ficha de saúde vencendo
create or replace function lembrete_cadastro() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update membros m set cadastro_status = 'pendente'
   where m.cadastro_status = 'completo'
     and exists (select 1 from fichas_saude f where f.perfil_id = m.perfil_id and f.validade < v_hoje);
  for r in
    select m.id, m.academia_id, m.perfil_id, fs.validade
      from membros m left join fichas_saude fs on fs.perfil_id = m.perfil_id
     where m.ativo and m.papel = 'aluno'
       and (m.cadastro_status <> 'completo' or fs.validade is null or fs.validade < v_hoje + 30)
  loop
    insert into lembretes_enviados (chave) values ('cadastro:' || r.id || ':' || to_char(v_hoje, 'IYYY-IW')) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, x.pid, 'cadastro', '📋 Complete o cadastro',
           case when r.validade is not null and r.validade < v_hoje + 30 then 'A ficha de saúde precisa ser renovada.' else 'Ainda falta algum dado, documento ou termo no cadastro.' end,
           '/alunos/' || r.id || '/cadastro'
      from (select r.perfil_id as pid union select responsavel_id from responsaveis where dependente_id = r.perfil_id) x;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembrete-cadastro', '0 13 * * 1', 'select lembrete_cadastro()');   -- seg 10h
  end if;
exception when others then raise notice 'Lembrete de cadastro não agendado: %', sqlerrm;
end $$;

-- ---------- 7) Arquivos de documentos e assinaturas: só quem pode ver o aluno ----------
-- Caminho: <academia>/documentos/<perfil>/arquivo  ou  <academia>/assinaturas/<perfil>/arquivo
create or replace function posso_ver_arquivo_pessoal(nome text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when (storage.foldername(nome))[2] in ('documentos', 'assinaturas') then
      ((storage.foldername(nome))[3])::uuid in (select meus_perfis()) or sou_equipe_do_perfil(((storage.foldername(nome))[3])::uuid)
    else participo(((storage.foldername(nome))[1])::uuid)
  end;
$$;
drop policy if exists "privado: participantes leem" on storage.objects;
create policy "privado: participantes leem" on storage.objects for select to authenticated
  using (bucket_id = 'privado' and posso_ver_arquivo_pessoal(name));
drop policy if exists "privado: participantes enviam" on storage.objects;
create policy "privado: participantes enviam" on storage.objects for insert to authenticated
  with check (bucket_id = 'privado' and participo(((storage.foldername(name))[1])::uuid) and posso_ver_arquivo_pessoal(name));
