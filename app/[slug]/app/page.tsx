"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, NENHUM, hora, hojeISO, addDias, dataBR, dataHoraBR, primeiroNome, whatsapp } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Barra } from "@/components/Grafico";
import { Tour } from "@/components/Tour";

function Cartao({ titulo, children, href }: { titulo: string; children: React.ReactNode; href?: string }) {
  return (
    <section className="rounded-2xl bg-painel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{titulo}</h2>
        {href && <Link href={href} className="text-sm text-suave underline">Ver tudo</Link>}
      </div>
      {children}
    </section>
  );
}

function Numero({ valor, rotulo }: { valor: any; rotulo: string }) {
  return (
    <div className="rounded-2xl bg-painel p-4">
      <p className="numero text-4xl font-bold">{valor ?? "—"}</p>
      <p className="text-sm text-suave">{rotulo}</p>
    </div>
  );
}

export default function Inicio() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const hoje = hojeISO();
      const dow = new Date(hoje + "T12:00:00").getDay();
      const acad = ctx.academia.id;
      const comuns = await Promise.all([
        sb.from("avisos").select("*").eq("academia_id", acad).order("fixado", { ascending: false }).order("criado_em", { ascending: false }).limit(5),
        sb.from("eventos").select("*").eq("academia_id", acad).gte("inicio", new Date().toISOString()).order("inicio").limit(4),
      ]);
      const avisos = (comuns[0].data || []).filter((a: any) => (!a.expira_em || new Date(a.expira_em) > new Date()) && (a.escopo !== "dia" || a.data === hoje));
      const eventos = comuns[1].data || [];

      if (ctx.equipe) {
        const [mods, turmasCount, horariosCount, profsCount] = await Promise.all([
          sb.from("modalidades").select("id", { count: "exact", head: true }).eq("academia_id", acad),
          sb.from("turmas").select("id", { count: "exact", head: true }).eq("academia_id", acad),
          sb.from("horarios").select("id, turmas!inner(academia_id)", { count: "exact", head: true }).eq("turmas.academia_id", acad),
          sb.from("membros").select("id", { count: "exact", head: true }).eq("academia_id", acad).eq("papel", "professor"),
        ]);
        const [resumo, aulasHoje, respondidas, ausencias, experimentais, painel, aniversarios, checklist, graduar] = await Promise.all([
          sb.from("resumo_academia").select("*").eq("academia_id", acad).maybeSingle(),
          sb.from("horarios").select("*, turmas!inner(id, nome, academia_id, modalidades(nome, cor))").eq("turmas.academia_id", acad).eq("dia_semana", dow).order("hora_inicio"),
          sb.from("pendencias").select("id", { count: "exact", head: true }).eq("academia_id", acad).eq("status", "respondida"),
          sb.from("ausencias").select("id, membros!membro_id!inner(academia_id)", { count: "exact", head: true }).eq("membros.academia_id", acad).eq("status", "pendente"),
          sb.from("aulas_experimentais").select("id", { count: "exact", head: true }).eq("academia_id", acad).in("status", ["nova", "encaminhada"]),
          sb.from("painel_alunos").select("membro_id, nome, apelido, foto_url, cor_faixa, grau, dias_sem_vir, whatsapp, afastado").eq("academia_id", acad).eq("ativo", true).gte("dias_sem_vir", ctx.academia.alerta_dias_sem_vir || 7).order("dias_sem_vir", { ascending: false }).limit(5),
          sb.from("proximos_aniversarios").select("*").eq("academia_id", acad).gte("proximo_aniversario", hoje).lte("proximo_aniversario", addDias(hoje, 7)).order("proximo_aniversario"),
          sb.from("checklist_campeonato").select("*").eq("academia_id", acad).gte("data_evento", new Date().toISOString()).order("data_evento").limit(1),
          sb.from("sugestoes_graduacao").select("*").eq("academia_id", acad).order("aulas_na_faixa", { ascending: false }),
        ]);
        const anivUnicos = Array.from(new Map((aniversarios.data || []).map((a: any) => [a.membro_id, a])).values());
        setD({
          avisos, eventos, resumo: resumo.data, aulasHoje: aulasHoje.data || [],
          respondidas: respondidas.count || 0, ausencias: ausencias.count || 0, experimentais: experimentais.count || 0,
          sumidos: (painel.data || []).filter((p: any) => !p.afastado), aniversarios: anivUnicos, campeonato: checklist.data?.[0],
          graduar: graduar.data || [],
          passos: [
            { ok: !!ctx.academia.logo_url, t: "Colocar a logo", href: `${base}/config` },
            { ok: !!ctx.academia.sobre && !ctx.academia.sobre.includes("Escreva aqui"), t: "Escrever o “Sobre nós”", href: `${base}/config` },
            { ok: !!ctx.academia.whatsapp && !!ctx.academia.endereco, t: "WhatsApp e endereço", href: `${base}/config` },
            { ok: (mods.count || 0) > 0, t: "Cadastrar as modalidades e faixas", href: `${base}/gestao` },
            { ok: (turmasCount.count || 0) > 0, t: "Criar as turmas", href: `${base}/gestao` },
            { ok: (horariosCount.count || 0) > 0, t: "Colocar os horários", href: `${base}/gestao` },
            { ok: (profsCount.count || 0) > 0, t: "Cadastrar os professores", href: `${base}/gestao` },
            { ok: (resumo.data?.alunos_ativos || 0) > 0, t: "Cadastrar alunos (ou mandar o link de cadastro)", href: `${base}/alunos` },
          ],
        });
      } else {
        const ids = ctx.meusAlunos.map((a) => a.id);
        const [painel, horarios, pendencias] = await Promise.all([
          sb.from("painel_alunos").select("*").in("membro_id", ids.length ? ids : [NENHUM]),
          sb.from("matriculas").select("turmas(nome, modalidades(nome, cor), horarios(*))").in("membro_id", ids.length ? ids : [NENHUM]).eq("status", "ativa"),
          sb.from("pendencias").select("*").in("membro_id", ids.length ? ids : [NENHUM]).neq("status", "resolvida").eq("visivel_aluno", true),
        ]);
        // Próxima aula (hoje em diante)
        const lista: any[] = [];
        (horarios.data || []).forEach((m: any) => (m.turmas?.horarios || []).forEach((h: any) => {
          for (let k = 0; k < 7; k++) {
            const dia = addDias(hoje, k);
            if (new Date(dia + "T12:00:00").getDay() === h.dia_semana) lista.push({ ...h, dia, turma: m.turmas.nome, modalidade: m.turmas.modalidades });
          }
        }));
        const agora = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo" });
        const proximas = lista
          .filter((a) => a.dia > hoje || a.hora_fim > agora)
          .sort((a, b) => (a.dia + a.hora_inicio).localeCompare(b.dia + b.hora_inicio));
        const { count: indicados } = await sb.from("indicacoes").select("id", { count: "exact", head: true }).in("indicador_id", ids.length ? ids : [NENHUM]);
        setD({ avisos, eventos, painel: painel.data || [], proxima: proximas[0], pendencias: pendencias.data || [], indicados: indicados || 0 });
      }
    })();
  }, [ctx.academia.id]); // eslint-disable-line

  const tour = (
    <Tour id="inicio" perfilId={ctx.perfil?.id} vistos={ctx.perfil?.tours_vistos} passos={ctx.equipe ? [
      { titulo: "Bem-vindo!", texto: "Aqui é o resumo da academia: aulas de hoje, alunos sumidos, aniversários e o que precisa da sua atenção." },
      { titulo: "Chamada em segundos", texto: "Em “Chamada”, escolha a turma e toque nos alunos. Os ícones ao lado do nome avisam pendências, aniversários e ausências." },
      { titulo: "Alunos e ranking", texto: "Em “Alunos” você filtra todo mundo e chama no WhatsApp com um toque. O ranking mostra quantidade, porcentagem e faixa etária." },
      { titulo: "Tudo no menu", texto: "Campeonatos, pendências, calendário e o QR Code da parede ficam em “Mais”." },
    ] : [
      { titulo: "Bem-vindo!", texto: "Aqui você vê sua próxima aula, sua frequência e os avisos da academia." },
      { titulo: "Seu perfil", texto: "Acompanhe sua faixa, seu peso e seu histórico. Avise quando for faltar." },
      { titulo: "Carteirinha", texto: "Sua carteirinha digital fica no app, pronta para mostrar ou baixar." },
    ]} />
  );

  if (!d) return <p className="text-suave">Carregando…</p>;

  return (
    <div className="space-y-5">
      {tour}
      <h1 className="text-4xl font-extrabold">Olá, {primeiroNome(ctx.perfil?.apelido || ctx.perfil?.nome)}!</h1>

      {ctx.equipe ? (
        <>
          {ctx.admin && d.passos.some((p: any) => !p.ok) && (
            <section className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: "var(--cor)" }}>
              <h2 className="text-2xl font-bold">Primeiros passos da academia</h2>
              <p className="mb-2 text-sm text-suave">{d.passos.filter((p: any) => p.ok).length} de {d.passos.length} prontos</p>
              <ul className="space-y-1">
                {d.passos.map((p: any) => (
                  <li key={p.t}><Link href={p.href} className={`flex items-center gap-2 ${p.ok ? "text-suave line-through" : ""}`}><span>{p.ok ? "✅" : "⬜"}</span>{p.t}</Link></li>
                ))}
              </ul>
            </section>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Numero valor={d.resumo?.alunos_ativos} rotulo="alunos ativos" />
            <Numero valor={d.resumo?.novos_no_mes} rotulo="novos este mês" />
            <Numero valor={d.resumo?.menores} rotulo="menores de idade" />
            <Numero valor={d.resumo?.idade_media} rotulo="idade média" />
          </div>

          {(d.respondidas || d.ausencias || d.experimentais) > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.respondidas > 0 && <Link href={`${base}/pendencias`} className="chip border-alerta">📨 {d.respondidas} pendência(s) para confirmar</Link>}
              {d.ausencias > 0 && <Link href={`${base}/pendencias`} className="chip border-alerta">🙋 {d.ausencias} ausência(s) para avaliar</Link>}
              {d.experimentais > 0 && <Link href={`${base}/experimentais`} className="chip border-alerta">🆕 {d.experimentais} aula(s) experimental(is)</Link>}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao titulo={`Aulas de hoje · ${DIAS[new Date().getDay()]}`}>
              {d.aulasHoje.length === 0 && <p className="text-suave">Sem aulas hoje.</p>}
              <ul className="space-y-2">
                {d.aulasHoje.map((h: any) => (
                  <li key={h.id}>
                    <Link href={`${base}/chamada?turma=${h.turmas.id}&horario=${h.id}`} className="flex items-center gap-3 rounded-xl bg-painel2 p-3" style={{ borderLeft: `4px solid ${h.turmas.modalidades?.cor || "var(--cor)"}` }}>
                      <span className="numero text-xl font-bold">{hora(h.hora_inicio)}</span>
                      <span className="flex-1">{h.turmas.nome}{h.tipo_treino ? <span className="text-suave"> · {h.tipo_treino}</span> : null}</span>
                      <span className="text-sm text-suave">Fazer chamada</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao titulo="Sumiram do treino" href={`${base}/alunos?ordem=dias_sem_vir`}>
              {d.sumidos.length === 0 && <p className="text-suave">Todo mundo treinando. 💪</p>}
              <ul className="space-y-3">
                {d.sumidos.map((p: any) => {
                  const z = whatsapp(p.whatsapp, `Oi, ${primeiroNome(p.apelido || p.nome)}! Sentimos sua falta no treino. Tá tudo bem?`);
                  return (
                    <li key={p.membro_id} className="flex items-center gap-3">
                      <Avatar foto={p.foto_url} nome={p.nome} cor={p.cor_faixa} grau={p.grau} tamanho={40} />
                      <Link href={`${base}/alunos/${p.membro_id}`} className="flex-1">
                        <p className="font-semibold">{p.apelido || p.nome}</p>
                        <p className="text-sm text-suave">{p.dias_sem_vir} dias sem vir</p>
                      </Link>
                      {z && <a href={z} target="_blank" className="btn-sec text-sm">Chamar</a>}
                    </li>
                  );
                })}
              </ul>
            </Cartao>

            <Cartao titulo="Aniversários da semana">
              {d.aniversarios.length === 0 && <p className="text-suave">Nenhum aniversário nos próximos 7 dias.</p>}
              <ul className="space-y-2">
                {d.aniversarios.map((a: any) => (
                  <li key={a.membro_id} className="flex justify-between">
                    <span>🎂 {a.apelido || a.nome} <span className="text-suave">({a.vai_fazer} anos)</span></span>
                    <span className="numero">{a.proximo_aniversario === hojeISO() ? "Hoje!" : dataBR(a.proximo_aniversario).slice(0, 5)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>

            {d.graduar.length > 0 && (
              <Cartao titulo="Prontos para graduar 🥋">
                <ul className="space-y-2">
                  {d.graduar.map((g: any) => (
                    <li key={g.membro_id + g.modalidade_id} className="flex items-center gap-3">
                      <Avatar foto={g.foto_url} nome={g.nome} tamanho={36} mostrarFaixa={false} />
                      <div className="flex-1">
                        <p className="font-semibold">{g.apelido || g.nome}</p>
                        <p className="text-xs text-suave">{g.modalidade}: {g.faixa} → {g.proxima_faixa} · {g.aulas_na_faixa} aulas, {g.meses_na_faixa} meses</p>
                      </div>
                      <Link href={`${base}/tecnicas/exame?aluno=${g.membro_id}`} className="btn-sec text-sm">Exame</Link>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}

            {d.campeonato && (
              <Cartao titulo={d.campeonato.evento} href={`${base}/campeonatos/${d.campeonato.evento_id}`}>
                <p className="numero text-3xl font-bold">{d.campeonato.prontos} de {d.campeonato.atletas} atletas prontos</p>
                <div className="mt-2"><Barra pct={d.campeonato.pct_prontos} cor="var(--color-ok)" /></div>
                <p className="mt-2 text-sm text-suave">{dataHoraBR(d.campeonato.data_evento)}</p>
              </Cartao>
            )}
          </div>
        </>
      ) : (
        <>
          {d.proxima && (
            <section className="rounded-2xl p-5" style={{ background: "var(--cor)" }}>
              <p className="text-sm opacity-90">Próxima aula</p>
              <p className="numero text-4xl font-bold">
                {d.proxima.dia === hojeISO() ? "Hoje" : DIAS[d.proxima.dia_semana]} · {hora(d.proxima.hora_inicio)}
              </p>
              <p>{d.proxima.turma}{d.proxima.tipo_treino ? ` · treino ${d.proxima.tipo_treino}` : ""}</p>
            </section>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {d.painel.map((p: any) => (
              <Link key={p.membro_id} href={`${base}/alunos/${p.membro_id}`} className="flex items-center gap-4 rounded-2xl bg-painel p-4">
                <Avatar foto={p.foto_url} nome={p.nome} cor={p.cor_faixa} grau={p.grau} tamanho={56} />
                <div className="flex-1">
                  <p className="font-semibold">{p.apelido || p.nome}</p>
                  <p className="text-sm text-suave">Faixa {p.faixa?.toLowerCase() || "—"} · frequência {p.frequencia_30d ?? "—"}%</p>
                  <div className="mt-2"><Barra pct={p.frequencia_30d} /></div>
                </div>
              </Link>
            ))}
          </div>
          {ctx.meusAlunos[0] && (() => {
            const link = typeof window !== "undefined" ? `${window.location.origin}/${ctx.academia.slug}/cadastro?indicado=${ctx.meusAlunos[0].id}` : "";
            const texto = `Bora treinar comigo na ${ctx.academia.nome}? 🥋 Faz o cadastro por aqui: ${link}`;
            return (
              <Cartao titulo="🤝 Indique um amigo">
                <p className="text-sm text-suave">
                  Mande seu link para um amigo. Quando ele se cadastrar{ctx.academia.recompensa_indicacao ? <>, você ganha: <b className="text-texto">{ctx.academia.recompensa_indicacao}</b></> : ", você ganha o título 🤝 Embaixador"}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="btn text-sm" target="_blank" href={`https://wa.me/?text=${encodeURIComponent(texto)}`}>Mandar no WhatsApp</a>
                  <button className="btn-sec text-sm" onClick={() => navigator.clipboard.writeText(link)}>Copiar link</button>
                </div>
                {d.indicados > 0 && <p className="mt-2 text-sm">Você já trouxe <b>{d.indicados}</b> amigo(s). Valeu! 🙌</p>}
              </Cartao>
            );
          })()}
          {d.pendencias.length > 0 && (
            <Cartao titulo="Pendências" href={`${base}/pendencias`}>
              <ul className="space-y-2">
                {d.pendencias.map((p: any) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>{p.status === "respondida" ? "📨" : "📌"} {p.titulo}</span>
                    {p.prazo && <span className="text-sm text-suave">até {dataBR(p.prazo).slice(0, 5)}</span>}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </>
      )}

      {d.avisos.length > 0 && (
        <Cartao titulo="Avisos">
          <ul className="space-y-3">
            {d.avisos.map((a: any) => (
              <li key={a.id} className="border-l-4 pl-3" style={{ borderColor: "var(--cor)" }}>
                <p className="font-semibold">{a.fixado ? "📌 " : ""}{a.titulo}</p>
                {a.texto && <p className="text-sm text-suave">{a.texto}</p>}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {d.eventos.length > 0 && (
        <Cartao titulo="Próximos eventos" href={`${base}/calendario`}>
          <ul className="space-y-2">
            {d.eventos.map((e: any) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{e.tipo === "campeonato" ? "🥇" : e.tipo === "feriado" ? "🏖️" : "📅"} {e.titulo}</span>
                <span className="shrink-0 text-sm text-suave">{dataHoraBR(e.inicio)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
