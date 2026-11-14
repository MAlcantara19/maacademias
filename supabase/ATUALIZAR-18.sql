-- =====================================================================
-- MA ACADEMIAS — ATUALIZAÇÃO 18
-- Rode no SQL Editor. NÃO apaga dados (pode rodar de novo sem problema).
-- 1) Faltas seguidas (lista com mensagem pronta no WhatsApp)
-- 2) Documentos com validade: vencido vira pendência e gera lembrete
-- =====================================================================

-- ---------- 1) Quem faltou as últimas aulas seguidas ----------
create or replace function faltas_seguidas(p_acad uuid, p_min int default 3)
returns table (membro_id uuid, nome text, apelido text, turma_id uuid, turma text, seguidas int, ultima_presenca date, whatsapp text, menor boolean)
language sql stable security definer set search_path = public as $$
  with mats as (
    select mt.membro_id, mt.turma_id, coalesce(mt.desde, '1900-01-01'::date) as desde, t.nome as turma
      from matriculas mt
      join turmas t on t.id = mt.turma_id and t.ativa
      join membros m on m.id = mt.membro_id and m.ativo and m.papel = 'aluno'
     where t.academia_id = p_acad and mt.status = 'ativa' and vejo_aluno(m.id)
  ), aulas_m as (
    select ms.membro_id, ms.turma_id, a.data,
           exists (select 1 from presencas p where p.aula_id = a.id and p.membro_id = ms.membro_id) as veio,
           row_number() over (partition by ms.membro_id, ms.turma_id order by a.data desc, a.hora_inicio desc) as rn
      from mats ms
      join aulas a on a.turma_id = ms.turma_id and a.data >= ms.desde and a.data < current_date
                  and coalesce(a.status, 'normal') <> 'cancelada'
  ), corte as (
    select am.membro_id, am.turma_id, min(am.rn) filter (where am.veio) as rn_presenca, count(*) as total,
           max(am.data) filter (where am.veio) as ultima
      from aulas_m am group by 1, 2
  )
  select c.membro_id, pa.nome, pa.apelido, c.turma_id, ms.turma,
         (coalesce(c.rn_presenca, c.total + 1) - 1)::int, c.ultima, pa.whatsapp,
         coalesce(pa.idade < 18, false)
    from corte c
    join painel_alunos pa on pa.membro_id = c.membro_id
    join mats ms on ms.membro_id = c.membro_id and ms.turma_id = c.turma_id
   where coalesce(c.rn_presenca, c.total + 1) - 1 >= p_min
     and not coalesce(pa.afastado, false)
   order by 6 desc, 2;
$$;
grant execute on function faltas_seguidas(uuid, int) to authenticated;

-- ---------- 2) Documento vencido vira pendência do cadastro ----------
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

  -- documentos com validade (atestado, carteirinha da federação…): vale o mais recente de cada tipo
  for t in select d.tipo from documentos d where d.perfil_id = p.id and d.tipo <> 'ficha_pdf'
             group by d.tipo having max(coalesce(d.validade, 'infinity'::date)) < current_date loop
    v_falta := v_falta || ('Documento vencido: ' || case t when 'atestado' then 'atestado médico' when 'doc_responsavel' then 'documento do responsável'
      when 'doc_aluno' then 'documento do aluno' when 'guarda' then 'termo de guarda' else t end);
  end loop;

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

-- Lembrete semanal: também reabre o cadastro quando um documento vence e avisa 30 dias antes
create or replace function lembrete_cadastro() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update membros m set cadastro_status = 'pendente'
   where m.cadastro_status = 'completo'
     and (exists (select 1 from fichas_saude f where f.perfil_id = m.perfil_id and f.validade < v_hoje)
          or exists (select 1 from documentos d where d.perfil_id = m.perfil_id and d.tipo <> 'ficha_pdf'
                      group by d.tipo having max(coalesce(d.validade, 'infinity'::date)) < v_hoje));
  for r in
    select m.id, m.academia_id, m.perfil_id, fs.validade,
           (select min(x.v) from (select max(coalesce(d.validade, 'infinity'::date)) as v from documentos d
                                   where d.perfil_id = m.perfil_id and d.tipo <> 'ficha_pdf' group by d.tipo) x) as doc_validade
      from membros m left join fichas_saude fs on fs.perfil_id = m.perfil_id
     where m.ativo and m.papel = 'aluno'
  loop
    if not (coalesce(r.validade, v_hoje - 1) < v_hoje + 30 or coalesce(r.doc_validade, 'infinity'::date) < v_hoje + 30
            or (select cadastro_status from membros where id = r.id) <> 'completo') then continue; end if;
    insert into lembretes_enviados (chave) values ('cadastro:' || r.id || ':' || to_char(v_hoje, 'IYYY-IW')) on conflict do nothing;
    if not found then continue; end if;
    insert into notificacoes (academia_id, perfil_id, tipo, titulo, texto, link)
    select r.academia_id, x.pid, 'cadastro', '📋 Complete o cadastro',
           case when r.validade is not null and r.validade < v_hoje + 30 then 'A ficha de saúde precisa ser renovada.'
                when r.doc_validade < v_hoje + 30 then 'Um documento do cadastro (ex.: atestado) vence em breve ou já venceu.'
                else 'Ainda falta algum dado, documento ou termo no cadastro.' end,
           '/alunos/' || r.id || '/cadastro'
      from (select r.perfil_id as pid union select responsavel_id from responsaveis where dependente_id = r.perfil_id) x;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
