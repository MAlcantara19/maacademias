-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 20
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- 1) Inscrição no campeonato pedida pelo aluno (o professor aprova)
-- 2) Título "📆 Constância" (bateu a meta 4 semanas seguidas)
-- 3) Página pública de resultados e de graduações (cerimônia)
-- 4) Aulas particulares (horários livres do professor + agendamento)
-- 5) Lembrete do relatório de impacto a cada trimestre
-- =====================================================================

-- ---------- 1) Pedido de inscrição no campeonato ----------
alter table inscricoes_evento add column if not exists status text default 'confirmada';
alter table inscricoes_evento drop constraint if exists inscricoes_evento_status_check;
alter table inscricoes_evento add constraint inscricoes_evento_status_check check (status in ('pendente', 'confirmada', 'recusada'));
alter table inscricoes_evento add column if not exists pedido_em timestamptz;

create or replace function pedir_inscricao(p_evento uuid, p_membro uuid, p_categoria text default null, p_obs text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare e record; m record; v_id uuid; v_peso numeric; v_faixa text;
begin
  if not vejo_aluno(p_membro) then raise exception 'Sem acesso a este aluno.'; end if;
  select * into e from eventos where id = p_evento;
  select * into m from membros where id = p_membro;
  if e.id is null or e.tipo <> 'campeonato' then raise exception 'Campeonato não encontrado.'; end if;
  if e.academia_id <> m.academia_id then raise exception 'Este campeonato é de outra academia.'; end if;
  if e.inicio < now() then raise exception 'As inscrições deste campeonato já fecharam.'; end if;
  if exists (select 1 from inscricoes_evento where evento_id = p_evento and membro_id = p_membro and status <> 'recusada') then
    raise exception 'Já existe uma inscrição ou pedido para este campeonato.';
  end if;
  delete from inscricoes_evento where evento_id = p_evento and membro_id = p_membro and status = 'recusada';
  select peso_kg into v_peso from medidas where perfil_id = m.perfil_id and peso_kg is not null order by data desc limit 1;
  select faixa into v_faixa from graduacoes where membro_id = p_membro order by data desc limit 1;
  insert into inscricoes_evento (evento_id, membro_id, categoria_peso, faixa, peso_inscricao, observacao, status, pedido_em)
  values (p_evento, p_membro, nullif(p_categoria, ''), v_faixa, v_peso, nullif(p_obs, ''), 'pendente', now())
  returning id into v_id;
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select e.academia_id, x.perfil_id, 'campeonato', '🥇 Pedido de inscrição',
         (select coalesce(pf.apelido, pf.nome) from perfis pf where pf.id = m.perfil_id) || ' quer lutar em ' || e.titulo || '. Toque para aprovar.',
         '/campeonatos/' || e.id
    from membros x
   where x.academia_id = e.academia_id and x.ativo and (x.papel = 'admin' or (x.papel = 'professor' and sou_professor_do_membro_de(x.id, p_membro)));
  return v_id;
end $$;

-- professor x é professor deste aluno? (usado acima, sem depender de quem está logado)
create or replace function sou_professor_do_membro_de(p_prof uuid, p_aluno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from matriculas mt join turmas t on t.id = mt.turma_id
                  where mt.membro_id = p_aluno and mt.status = 'ativa' and t.professor_id = p_prof);
$$;

create or replace function cancelar_pedido_inscricao(p_inscricao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i record;
begin
  select * into i from inscricoes_evento where id = p_inscricao;
  if i.id is null or not vejo_aluno(i.membro_id) then raise exception 'Pedido não encontrado.'; end if;
  if i.status <> 'pendente' then raise exception 'Só dá para cancelar pedido ainda não aprovado.'; end if;
  delete from inscricoes_evento where id = p_inscricao;
end $$;

-- ---------- 2) Título "Constância" ----------
create or replace function avaliar_constancia() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_seg date; k int; v_ok boolean;
begin
  v_seg := date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date; -- segunda desta semana
  for r in
    select m.id, m.academia_id, m.perfil_id, coalesce(m.meta_semanal, a.meta_semanal_padrao, 2) as meta
      from membros m join academias a on a.id = m.academia_id
     where m.ativo and m.papel = 'aluno'
       and not exists (select 1 from conquistas c where c.membro_id = m.id and c.codigo = 'constancia')
  loop
    v_ok := true;
    for k in 1..4 loop
      if (select count(*) from presencas p join aulas au on au.id = p.aula_id
           where p.membro_id = r.id and au.data >= v_seg - 7 * k and au.data < v_seg - 7 * (k - 1)) < r.meta then
        v_ok := false; exit;
      end if;
    end loop;
    if v_ok then
      insert into conquistas (membro_id, academia_id, codigo, titulo, icone) values (r.id, r.academia_id, 'constancia', 'Constância', '📆')
      on conflict do nothing;
      if found then
        insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
        values (r.academia_id, r.perfil_id, 'conquista', '📆 Novo título: Constância',
                'Você bateu a meta de treinos 4 semanas seguidas. Que disciplina! 🔥', '/meu');
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

-- ---------- 3) Páginas públicas: resultados e graduações ----------
-- Nome público: primeiro nome + inicial do sobrenome (ex.: "João S.")
create or replace function nome_publico(p_nome text) returns text language sql immutable as $$
  select case when regexp_replace(trim(coalesce(p_nome, '')), '^.* ', '') ~ '^[0-9]+$' then trim(p_nome)   -- "Aluno 07"
              when position(' ' in trim(coalesce(p_nome, ''))) > 0
              then split_part(trim(p_nome), ' ', 1) || ' ' || left(regexp_replace(trim(p_nome), '^.* ', ''), 1) || '.'
              else trim(coalesce(p_nome, '')) end;
$$;

create or replace function resultados_publicos(p_slug text)
returns table (evento_id uuid, evento text, data timestamptz, local text, atleta text, categoria text, faixa text, resultado text)
language sql stable security definer set search_path = public as $$
  select e.id, e.titulo, e.inicio, e.local, nome_publico(pf.nome), concat_ws(' · ', i.classe, i.categoria_peso), i.faixa, i.resultado
    from inscricoes_evento i
    join eventos e on e.id = i.evento_id and e.publico
    join academias a on a.id = e.academia_id and a.slug = p_slug and a.ativa
    join membros m on m.id = i.membro_id
    join perfis pf on pf.id = m.perfil_id
   where i.resultado in ('ouro', 'prata', 'bronze') and coalesce(i.status, 'confirmada') = 'confirmada'
   order by e.inicio desc, case i.resultado when 'ouro' then 1 when 'prata' then 2 else 3 end, pf.nome;
$$;
grant execute on function resultados_publicos(text) to anon, authenticated;

create or replace function graduacoes_publicas(p_slug text, p_de date, p_ate date)
returns table (atleta text, faixa text, grau int, modalidade text, cor text, data date)
language sql stable security definer set search_path = public as $$
  select nome_publico(pf.nome), g.faixa, g.grau, mo.nome,
         mo.cores_graduacoes[array_position(mo.graduacoes, g.faixa)], g.data
    from graduacoes g
    join membros m on m.id = g.membro_id
    join academias a on a.id = m.academia_id and a.slug = p_slug and a.ativa
    join perfis pf on pf.id = m.perfil_id
    join modalidades mo on mo.id = g.modalidade_id
   where g.data between p_de and p_ate and (p_ate - p_de) <= 31
   order by mo.nome, array_position(mo.graduacoes, g.faixa) desc, pf.nome;
$$;
grant execute on function graduacoes_publicas(text, date, date) to anon, authenticated;

-- ---------- 4) Aulas particulares ----------
create table if not exists particular_horarios (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  professor_id uuid not null references membros(id) on delete cascade,
  dia_semana   int not null check (dia_semana between 0 and 6),
  hora_inicio  time not null,
  hora_fim     time not null,
  duracao_min  int not null default 60,
  valor        numeric(8,2),
  ativo        boolean default true
);
alter table particular_horarios enable row level security;
drop policy if exists ver on particular_horarios; drop policy if exists gerir on particular_horarios;
create policy ver on particular_horarios for select using (participo(academia_id));
create policy gerir on particular_horarios for all
  using (sou_admin(academia_id) or professor_id in (select meus_membros()))
  with check (sou_admin(academia_id) or professor_id in (select meus_membros()));

create table if not exists aulas_particulares (
  id           uuid primary key default gen_random_uuid(),
  academia_id  uuid not null references academias(id) on delete cascade,
  professor_id uuid not null references membros(id) on delete cascade,
  aluno_id     uuid not null references membros(id) on delete cascade,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  valor        numeric(8,2),
  status       text not null default 'pedida' check (status in ('pedida', 'confirmada', 'paga', 'cancelada')),
  observacao   text,
  comprovante  text,
  criado_por   uuid default auth.uid(),
  criado_em    timestamptz default now()
);
create unique index if not exists ux_particular_horario on aulas_particulares (professor_id, inicio) where status <> 'cancelada';
alter table aulas_particulares enable row level security;
drop policy if exists ver on aulas_particulares; drop policy if exists pedir on aulas_particulares; drop policy if exists gerir on aulas_particulares;
create policy ver on aulas_particulares for select using (sou_equipe(academia_id) or vejo_aluno(aluno_id));
create policy pedir on aulas_particulares for insert with check (vejo_aluno(aluno_id) and status = 'pedida');
create policy gerir on aulas_particulares for update using (sou_admin(academia_id) or professor_id in (select meus_membros()));

-- o aluno/responsável só pode cancelar (e mandar o comprovante do Pix)
create or replace function cancelar_particular(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update aulas_particulares set status = 'cancelada'
   where id = p_id and vejo_aluno(aluno_id) and status in ('pedida', 'confirmada') and inicio > now();
  if not found then raise exception 'Não dá para cancelar esta aula (já passou ou já foi paga).'; end if;
end $$;
create or replace function comprovante_particular(p_id uuid, p_arquivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update aulas_particulares set comprovante = p_arquivo where id = p_id and vejo_aluno(aluno_id);
end $$;

-- horários já ocupados do professor (sem mostrar quem marcou)
create or replace function particular_ocupados(p_prof uuid, p_de timestamptz, p_ate timestamptz)
returns table (inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  select ap.inicio, ap.fim from aulas_particulares ap
   where ap.professor_id = p_prof and ap.status <> 'cancelada' and ap.inicio < p_ate and ap.fim > p_de
     and participo((select academia_id from membros where id = p_prof));
$$;

-- avisa o professor quando um aluno pede uma aula
create or replace function avisar_particular() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select new.academia_id, m.perfil_id, 'particular', '🗓️ Pedido de aula particular',
           (select coalesce(pf.apelido, pf.nome) from membros x join perfis pf on pf.id = x.perfil_id where x.id = new.aluno_id)
           || ' pediu ' || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '. Toque para confirmar.', '/particulares'
      from membros m where m.id = new.professor_id;
  elsif new.status is distinct from old.status and new.status in ('confirmada', 'cancelada') then
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select new.academia_id, x.pid, 'particular',
           case new.status when 'confirmada' then '✅ Aula particular confirmada' else '❌ Aula particular cancelada' end,
           to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), '/particulares'
      from (select perfil_id as pid from membros where id = new.aluno_id
            union select r.responsavel_id from responsaveis r join membros mm on mm.perfil_id = r.dependente_id where mm.id = new.aluno_id) x;
  end if;
  return new;
end $$;
drop trigger if exists trg_avisar_particular on aulas_particulares;
create trigger trg_avisar_particular after insert or update on aulas_particulares for each row execute function avisar_particular();

-- ---------- 5) Lembretes automáticos (pg_cron) ----------
create or replace function lembrete_relatorio_trimestre() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
  select m.academia_id, m.perfil_id, 'relatorio', '📄 Relatório do trimestre pronto',
         'O relatório de impacto do último trimestre já pode ser gerado em PDF (bom para patrocinador, prefeitura e editais).', '/exportar?trimestre=anterior'
    from membros m where m.papel = 'admin' and m.ativo;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('constancia', '0 12 * * 1', 'select avaliar_constancia()');                         -- seg 9h
    perform cron.schedule('relatorio-trimestre', '0 12 1 1,4,7,10 *', 'select lembrete_relatorio_trimestre()'); -- 1º dia do trimestre
  end if;
exception when others then raise notice 'Lembretes não agendados: %', sqlerrm;
end $$;
