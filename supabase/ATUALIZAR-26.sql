-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 26 — PAINEL DO MASTER
-- • Versão do banco: o painel master mostra quais ATUALIZAR-xx faltam rodar
-- • Pilotos: guarda quando foram recriados pela última vez
-- • Alerta de erro: o master recebe uma notificação quando uma tela dá erro
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- =====================================================================

-- ---------- 1. VERSÃO DO BANCO ----------
-- Daqui para frente, cada ATUALIZAR-xx.sql se registra aqui no final.
create table if not exists versoes_banco (
  versao      int primary key,
  aplicada_em timestamptz default now()
);
alter table versoes_banco enable row level security;
drop policy if exists ver on versoes_banco;
create policy ver on versoes_banco for select using (sou_master());

-- Para as atualizações antigas (que não se registravam), confere se a
-- "marca" de cada uma existe no banco: uma função, tabela ou coluna que ela criou.
create or replace function status_versoes()
returns table (versao int, aplicada boolean, aplicada_em timestamptz)
language sql stable security definer set search_path = public as $$
  with marcas(versao, tipo, nome, tabela) as (values
    (1, 'f', 'copiar_vocabulario', null), (2, 'f', 'placar_estudo', null), (3, 'f', 'gerar_desafios', null),
    (4, 'f', 'turma_da_aula', null), (5, 'f', 'proteger_plano', null), (6, 'f', 'academia_da_linha', null),
    (7, 'f', 'colegas_da_turma', null), (8, 'f', 'contexto_app', null), (9, 'f', 'posts_vencidos', null),
    (10, 'f', 'ajustar_ao_plano', null), (11, 'c', 'professor_mexe_mensalidades', 'academias'), (12, 'c', 'carteirinha', 'academias'),
    (13, 'f', 'posso_cadastrar_pessoas', null), (14, 't', 'campeonatos_aluno', null), (15, 't', 'recordes_marcas', null),
    (16, 'f', 'registrar_historico_restrito', null), (17, 'f', 'pode_enviar_pre', null), (18, 'f', 'faltas_seguidas', null),
    (19, 'f', 'definir_meta', null), (20, 'f', 'pedir_inscricao', null), (21, 'f', 'pedir_nova_senha', null),
    (22, 't', 'checkins_gps', null), (23, 'f', 'avisos_ranking', null), (24, 'f', 'parabens_do_dia', null),
    (25, 'f', 'contagem_enquete', null)
  )
  select m.versao,
         case m.tipo
           when 'f' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = m.nome)
           when 't' then to_regclass('public.' || m.nome) is not null
           else exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = m.tabela and c.column_name = m.nome)
         end,
         null::timestamptz
    from marcas m
   where sou_master()
  union all
  select v.versao, true, v.aplicada_em from versoes_banco v where sou_master()
  order by 1;
$$;
grant execute on function status_versoes() to authenticated;


-- ---------- 2. PILOTOS: QUANDO FORAM RECRIADOS ----------
do $$ begin
  if to_regclass('public.plataforma') is null then
    raise exception 'Rode antes o ATUALIZAR-25.sql (e os anteriores que faltarem).';
  end if;
end $$;
alter table plataforma add column if not exists pilotos_recriados_em timestamptz;
create or replace function marcar_pilotos_recriados() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update plataforma set pilotos_recriados_em = now() where id = 1;
  return new;
end $$;
drop trigger if exists trg_pilotos_recriados on academias;
create trigger trg_pilotos_recriados after insert on academias
for each row when (new.slug = 'piloto-completo') execute function marcar_pilotos_recriados();


-- ---------- 3. ALERTA DE ERRO PARA O MASTER ----------
create or replace function alertar_erro_master() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_chave text;
begin
  -- ignora ruídos comuns do navegador
  if coalesce(new.mensagem, '') ilike any (array['ResizeObserver%', 'Script error%', '%Load failed%', '%NetworkError%', '%Failed to fetch%', '%AbortError%']) then
    return new;
  end if;
  -- no máximo um alerta por hora para o mesmo erro na mesma tela
  v_chave := 'erro:' || md5(coalesce(new.pagina, '') || coalesce(new.mensagem, '')) || ':' || to_char(now(), 'YYYYMMDDHH24');
  insert into lembretes_enviados (chave) values (v_chave) on conflict do nothing;
  if not found then return new; end if;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select new.academia_id, p.id, 'erro',
         '🐞 Erro no app' || coalesce(' · ' || (select nome from academias where id = new.academia_id), ''),
         left(coalesce(new.pagina, '') || ' — ' || coalesce(new.mensagem, ''), 200), '/master/atividade'
    from masters ms join perfis p on p.user_id = ms.user_id;
  return new;
end $$;
drop trigger if exists trg_alertar_erro on erros_app;
create trigger trg_alertar_erro after insert on erros_app for each row execute function alertar_erro_master();


-- registra esta atualização
insert into versoes_banco (versao) values (26) on conflict do nothing;
