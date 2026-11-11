"use client";
import { comprimir } from "@/lib/imagem";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MOTIVOS_AUSENCIA, abrirAnexo, dataBR, dinheiro, hojeISO, primeiroNome, whatsapp } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Faixa } from "@/components/Faixa";
import { Barra } from "@/components/Grafico";
import { ComparaPeso } from "@/components/ComparaPeso";
import { CadastroRosto } from "@/components/CadastroRosto";
import { liberado } from "@/lib/planos";
import { DIAS, hora } from "@/lib/util";

function Bloco({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-painel p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-2xl font-bold">{titulo}</h2>{acao}</div>
      {children}
    </section>
  );
}

export default function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [a, setA] = useState<any>(null);
  const [x, setX] = useState<any>({});
  const [form, setForm] = useState<any>({});
  const [aberto, setAberto] = useState("");
  const [msg, setMsg] = useState("");
  const [login, setLogin] = useState<any>(null);
  const meu = ctx.meusAlunos.some((m) => m.id === id);

  async function carregar() {
    const { data: p } = await sb.from("painel_alunos").select("*").eq("membro_id", id).maybeSingle();
    if (!p) return setA(false);
    setA(p);
    const [med, grad, hist, aus, pend, mats, mods, turmas, cart, perfil, membro, exames, conq, simul] = await Promise.all([
      sb.from("medidas").select("*").eq("perfil_id", p.perfil_id).order("data"),
      sb.from("graduacoes").select("*, modalidades(nome, graduacoes, cores_graduacoes)").eq("membro_id", id).order("data", { ascending: false }),
      sb.from("historico_ausencias").select("*").eq("membro_id", id).order("ano", { ascending: false }),
      sb.from("ausencias").select("*").eq("membro_id", id).order("de", { ascending: false }).limit(10),
      sb.from("pendencias").select("*").eq("membro_id", id).order("criada_em", { ascending: false }),
      sb.from("matriculas").select("*, turmas(nome, modalidade_id, horarios(dia_semana, hora_inicio, hora_fim))").eq("membro_id", id),
      sb.from("modalidades").select("id, nome, graduacoes, cores_graduacoes").eq("academia_id", ctx.academia.id),
      ctx.equipe ? sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true) : Promise.resolve({ data: [] }),
      sb.from("carteirinhas").select("*").eq("membro_id", id).order("ano", { ascending: false }),
      sb.from("perfis").select("*").eq("id", p.perfil_id).maybeSingle(),
      ctx.equipe ? sb.from("membros").select("apelido_interno, observacoes").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("exames_faixa").select("*, modalidades(nome)").eq("membro_id", id).order("data", { ascending: false }),
      sb.from("conquistas").select("*").eq("membro_id", id).order("conquistada_em"),
      sb.from("quiz_resultados").select("acertos, total, criado_em").eq("membro_id", id).eq("modo", "simulado").order("criado_em", { ascending: false }).limit(3),
    ]);
    setX({
      medidas: med.data || [], graduacoes: grad.data || [], historico: hist.data || [], ausencias: aus.data || [],
      pendencias: pend.data || [], matriculas: mats.data || [], modalidades: mods.data || [], turmas: turmas.data || [],
      carteirinhas: cart.data || [], perfil: perfil.data, membro: membro.data, exames: exames.data || [],
      conquistas: conq.data || [], simulados: simul.data || [],
    });
  }
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line

  if (a === false) return <p className="text-suave">Aluno não encontrado ou sem permissão para ver.</p>;
  if (!a) return <p className="text-suave">Carregando…</p>;

  const f = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));
  const fechar = () => { setAberto(""); setForm({}); carregar(); };
  const ultimoPeso = x.medidas?.filter((m: any) => m.peso_kg).at(-1);

  async function salvarPeso() {
    if (!form.peso) return;
    await sb.from("medidas").insert({ perfil_id: a.perfil_id, peso_kg: Number(form.peso), altura_cm: form.altura ? Number(form.altura) : null, data: form.data || hojeISO(), registrado_por: ctx.perfil?.id });
    fechar();
  }
  async function salvarGraduacao() {
    if (!form.modalidade || !form.faixa) return;
    await sb.from("graduacoes").insert({ membro_id: id, modalidade_id: form.modalidade, faixa: form.faixa, grau: Number(form.grau || 0), data: form.data || hojeISO(), registrado_por: ctx.membroId, observacao: form.obs || null });
    fechar();
  }
  async function salvarAusencia() {
    if (!form.de || !form.motivo) return setMsg("Preencha o período e o motivo.");
    const { error } = await sb.from("ausencias").insert({
      membro_id: id, de: form.de, ate: form.ate || form.de, motivo: form.motivo, observacao: form.obs || null,
      status: ctx.equipe ? (form.status || "justificada") : "pendente", avisada_por: ctx.perfil?.id,
      ...(ctx.equipe ? { avaliada_por: ctx.membroId, avaliada_em: new Date().toISOString() } : {}),
    });
    if (error) return setMsg(error.message);
    setMsg(""); fechar();
  }
  async function avaliarAusencia(ausId: string, status: string) {
    await sb.from("ausencias").update({ status, avaliada_por: ctx.membroId, avaliada_em: new Date().toISOString() }).eq("id", ausId);
    carregar();
  }
  async function salvarPendencia() {
    if (!form.titulo) return;
    await sb.from("pendencias").insert({
      academia_id: ctx.academia.id, membro_id: id, titulo: form.titulo, descricao: form.descricao || null,
      tipo: form.tipo || "outro", prazo: form.prazo || null, visivel_aluno: form.so_equipe ? false : true, criada_por: ctx.membroId,
    });
    fechar();
  }
  async function responder(p: any) {
    const texto = prompt("Sua resposta (ex.: já enviei, levo na próxima aula):");
    if (texto == null) return;
    await sb.rpc("responder_pendencia", { p_id: p.id, p_resposta: texto });
    carregar();
  }
  async function avaliarPendencia(p: any, aceitar: boolean) {
    const recado = aceitar ? null : prompt("O que falta? (o aluno vai ver)") || null;
    await sb.rpc("avaliar_pendencia", { p_id: p.id, p_aceitar: aceitar, p_recado: recado });
    carregar();
  }
  async function salvarDados() {
    const upd: any = {};
    ["telefone", "nascimento", "sexo", "apelido", "email", "contato_emergencia_nome", "contato_emergencia_tel"].forEach((k) => { if (form[k] !== undefined) upd[k] = form[k] || null; });
    if (form.arquivo) {
      const ext = form.arquivo.name.split(".").pop();
      const caminho = `${ctx.academia.id}/fotos/${a.perfil_id}-${Date.now()}.${ext}`;
      const up = await sb.storage.from("publico").upload(caminho, await comprimir(form.arquivo));
      if (up.error) return setMsg("Não foi possível enviar a foto: " + up.error.message);
      upd.foto_url = sb.storage.from("publico").getPublicUrl(caminho).data.publicUrl;
    }
    const { error } = await sb.from("perfis").update(upd).eq("id", a.perfil_id);
    if (error) return setMsg(error.message);
    setMsg(""); fechar();
  }
  async function salvarEquipe() {
    await sb.from("membros").update({ apelido_interno: form.apelido_interno ?? x.membro?.apelido_interno, observacoes: form.observacoes ?? x.membro?.observacoes }).eq("id", id);
    fechar();
  }
  async function matricular() {
    if (!form.turma) return;
    await sb.from("matriculas").upsert({ turma_id: form.turma, membro_id: id, status: "ativa", desde: hojeISO(), ate: null });
    fechar();
  }
  async function mudarMatricula(m: any, status: string) {
    await sb.from("matriculas").update({ status, ate: status === "encerrada" ? hojeISO() : null }).eq("turma_id", m.turma_id).eq("membro_id", id);
    carregar();
  }
  async function encerrarVinculo() {
    const motivo = prompt("Motivo da saída (ex.: mudou de cidade):");
    if (motivo == null) return;
    await sb.from("matriculas").update({ status: "encerrada", ate: hojeISO() }).eq("membro_id", id).eq("status", "ativa");
    await sb.from("membros").update({ ativo: false, saiu_em: hojeISO(), motivo_saida: motivo || null }).eq("id", id);
    carregar();
  }
  async function reativar() {
    await sb.from("membros").update({ ativo: true, saiu_em: null, motivo_saida: null }).eq("id", id);
    carregar();
  }

  async function criarLogin() {
    setMsg("");
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch("/api/criar-login", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ perfil_id: a.perfil_id }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.erro || "Não foi possível criar o login.");
    setLogin(j); carregar();
  }

  // Tempo de academia: "8 meses", "1 ano e 3 meses"
  const meses = a.aluno_desde ? Math.max(0, Math.floor((Date.now() - new Date(a.aluno_desde + "T12:00:00").getTime()) / 2629800000)) : 0;
  const tempo = meses < 12 ? `${meses} ${meses === 1 ? "mês" : "meses"}` : `${Math.floor(meses / 12)} ${meses >= 24 ? "anos" : "ano"}${meses % 12 ? ` e ${meses % 12} ${meses % 12 === 1 ? "mês" : "meses"}` : ""}`;

  const z = whatsapp(a.whatsapp, `Oi, ${primeiroNome(a.apelido || a.nome)}! Aqui é da ${ctx.academia.nome}.`);
  const podeEditar = ctx.equipe || meu;

  return (
    <div className="space-y-4">
      {ctx.equipe && <Link href={`${base}/alunos`} className="text-sm text-suave">← Alunos</Link>}

      {/* Cabeçalho */}
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-painel p-6 text-center sm:flex-row sm:text-left">
        <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={104} />
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold">{a.nome}</h1>
          <p className="text-suave">
            {a.apelido ? `“${a.apelido}” · ` : ""}{a.idade != null ? `${a.idade} anos · ` : ""}{a.faixa_etaria}
          </p>
          <p className="mt-1">{a.faixa ? `Faixa ${a.faixa.toLowerCase()}${a.grau ? ` · ${a.grau}º grau` : ""} (${a.faixa_modalidade})` : "Sem graduação registrada"}</p>
          <p className="text-sm text-suave">
            {a.ativo ? `Aluno desde ${dataBR(a.aluno_desde)}` : `Saiu em ${dataBR(a.saiu_em)}${a.motivo_saida ? ` · ${a.motivo_saida}` : ""}`}
            {a.ultimo_acesso ? ` · último acesso ao app ${dataBR(a.ultimo_acesso)}` : ""}
          </p>
          {ctx.equipe && x.membro?.apelido_interno && <p className="mt-1 text-sm text-alerta">🔒 {x.membro.apelido_interno}</p>}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {(() => { const t = x.conquistas?.find((c: any) => c.codigo === x.perfil?.titulo_escolhido); return t ? <span className="chip" style={{ borderColor: "var(--cor)" }}>{t.icone} {t.titulo}</span> : null; })()}
            {a.ativo && meses >= 1 && <span className="chip">🏠 {tempo} de academia</span>}
            {ctx.equipe && a.debito_atualizado > 0 && <span className="chip border-erro text-erro">💳 deve {dinheiro(a.debito_atualizado)}</span>}
            {ctx.equipe && !a.tem_login && <span className="chip">🔑 sem login</span>}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {z && ctx.equipe && <a href={z} target="_blank" className="btn">WhatsApp</a>}
          {podeEditar && <button className="btn-sec" onClick={() => setAberto("dados")}>Editar dados</button>}
          {ctx.equipe && !a.tem_login && x.perfil?.email && <button className="btn-sec" onClick={criarLogin}>Criar login</button>}
          {ctx.equipe && <Link className="btn-sec" href={`${base}/tecnicas/exame?aluno=${id}`}>Exame de faixa</Link>}
        </div>
      </section>

      {msg && !aberto && <p className="text-sm text-alerta">{msg}</p>}
      {login && (
        <section className="rounded-2xl border-2 border-ok bg-painel p-4">
          <p className="font-semibold">Login criado ✓</p>
          <p className="text-sm">E-mail: <b>{login.email}</b> · Senha provisória: <b className="numero text-lg">{login.senha}</b></p>
          <p className="text-xs text-suave">No primeiro acesso a pessoa cria a própria senha.</p>
          {whatsapp(a.whatsapp) && (
            <a className="btn mt-2" target="_blank" href={whatsapp(a.whatsapp, `Oi, ${primeiroNome(a.nome)}! Seu acesso ao app da ${ctx.academia.nome} está pronto 🥋\n\nEntre em: ${typeof window !== "undefined" ? window.location.origin : ""}/login\nE-mail: ${login.email}\nSenha provisória: ${login.senha}\n\nNo primeiro acesso você cria sua senha.`)!}>Mandar pelo WhatsApp</a>
          )}
        </section>
      )}

      {aberto === "dados" && (
        <Bloco titulo="Dados">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo">Foto</label><input type="file" accept="image/*" className="campo" onChange={(e) => f("arquivo", e.target.files?.[0])} /></div>
            <div><label className="rotulo">Apelido</label><input className="campo" defaultValue={x.perfil?.apelido || ""} onChange={(e) => f("apelido", e.target.value)} /></div>
            <div><label className="rotulo">WhatsApp</label><input className="campo" defaultValue={x.perfil?.telefone || ""} onChange={(e) => f("telefone", e.target.value)} /></div>
            <div><label className="rotulo">Nascimento</label><input type="date" className="campo" defaultValue={x.perfil?.nascimento || ""} onChange={(e) => f("nascimento", e.target.value)} /></div>
            <div><label className="rotulo">Sexo</label>
              <select className="campo" defaultValue={x.perfil?.sexo || "M"} onChange={(e) => f("sexo", e.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></select>
            </div>
            {ctx.equipe && <div><label className="rotulo">E-mail do login</label><input className="campo" defaultValue={x.perfil?.email || ""} onChange={(e) => f("email", e.target.value)} /></div>}
            <div><label className="rotulo">Contato de emergência</label><input className="campo" defaultValue={x.perfil?.contato_emergencia_nome || ""} onChange={(e) => f("contato_emergencia_nome", e.target.value)} /></div>
            <div><label className="rotulo">Telefone de emergência</label><input className="campo" defaultValue={x.perfil?.contato_emergencia_tel || ""} onChange={(e) => f("contato_emergencia_tel", e.target.value)} /></div>
          </div>
          {msg && <p className="mt-2 text-sm text-alerta">{msg}</p>}
          <div className="mt-3 flex gap-2"><button className="btn" onClick={salvarDados}>Salvar</button><button className="btn-sec" onClick={() => setAberto("")}>Cancelar</button></div>
        </Bloco>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Frequência */}
        <Bloco titulo="Frequência">
          <p className="numero text-5xl font-bold">{a.frequencia_30d ?? "—"}%</p>
          <p className="text-sm text-suave">nos últimos 30 dias{a.ultima_aula ? ` · última aula em ${dataBR(a.ultima_aula)}` : ""}</p>
          <div className="mt-3"><Barra pct={a.frequencia_30d} /></div>
          {x.historico?.map((h: any) => (
            <div key={h.ano} className="mt-4 grid grid-cols-3 gap-2 text-center">
              <p className="col-span-3 text-left text-sm font-semibold">{h.ano}</p>
              <div className="rounded-xl bg-painel2 p-2"><p className="numero text-2xl font-bold">{h.presencas}</p><p className="text-xs text-suave">presenças</p></div>
              <div className="rounded-xl bg-painel2 p-2"><p className="numero text-2xl font-bold">{h.faltas}</p><p className="text-xs text-suave">faltas</p></div>
              <div className="rounded-xl bg-painel2 p-2"><p className="numero text-2xl font-bold">{h.faltas_justificadas}</p><p className="text-xs text-suave">justificadas</p></div>
              <p className="col-span-3 text-left text-xs text-suave">
                Avisos de ausência: {h.avisos_justificados} justificados, {h.avisos_nao_justificados} não justificados, {h.avisos_pendentes} aguardando.
              </p>
            </div>
          ))}
        </Bloco>

        {/* Peso */}
        {liberado(ctx.academia.plano, "peso") && <Bloco titulo="Peso" acao={podeEditar && <button className="btn-sec text-sm" onClick={() => setAberto(aberto === "peso" ? "" : "peso")}>Registrar</button>}>
          {aberto === "peso" && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <input className="campo" type="number" step="0.1" inputMode="decimal" placeholder="Peso (kg)" onChange={(e) => f("peso", e.target.value)} />
              <input className="campo" type="number" inputMode="numeric" placeholder="Altura (cm)" onChange={(e) => f("altura", e.target.value)} />
              <button className="btn" onClick={salvarPeso}>Salvar</button>
            </div>
          )}
          <p className="numero text-5xl font-bold">{ultimoPeso ? `${Number(ultimoPeso.peso_kg)} kg` : "—"}</p>
          <p className="mb-3 text-sm text-suave">{ultimoPeso ? `em ${dataBR(ultimoPeso.data)}` : "Nenhum peso registrado"}</p>
          <ComparaPeso medidas={(x.medidas || []).filter((m: any) => m.peso_kg)} membroId={id} />
        </Bloco>}

        {/* Graduação */}
        <Bloco titulo="Graduação" acao={ctx.equipe && <button className="btn-sec text-sm" onClick={() => setAberto(aberto === "grad" ? "" : "grad")}>Graduar</button>}>
          {aberto === "grad" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <select className="campo" onChange={(e) => f("modalidade", e.target.value)} defaultValue="">
                <option value="" disabled>Modalidade</option>
                {x.modalidades.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select className="campo" onChange={(e) => f("faixa", e.target.value)} defaultValue="">
                <option value="" disabled>Faixa</option>
                {(x.modalidades.find((m: any) => m.id === form.modalidade)?.graduacoes || []).map((g: string) => <option key={g}>{g}</option>)}
              </select>
              <input className="campo" type="number" min="0" max="10" placeholder="Grau" onChange={(e) => f("grau", e.target.value)} />
              <input className="campo" type="date" defaultValue={hojeISO()} onChange={(e) => f("data", e.target.value)} />
              <input className="campo col-span-2" placeholder="Observação (opcional)" onChange={(e) => f("obs", e.target.value)} />
              <button className="btn col-span-2" onClick={salvarGraduacao}>Salvar graduação</button>
            </div>
          )}
          <ul className="space-y-3">
            {(liberado(ctx.academia.plano, "historico_graduacao") ? x.graduacoes : x.graduacoes?.slice(0, 1))?.map((g: any) => {
              const i = (g.modalidades?.graduacoes || []).indexOf(g.faixa);
              const cor = g.modalidades?.cores_graduacoes?.[i];
              return (
                <li key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{g.modalidades?.nome}: {g.faixa}{g.grau ? ` · ${g.grau}º grau` : ""}</span>
                    <span className="text-suave">{dataBR(g.data)}{liberado(ctx.academia.plano, "certificado") && <> · <Link className="underline" href={`${base}/certificado/${g.id}`}>certificado</Link></>}</span>
                  </div>
                  <Faixa cor={cor} graus={g.grau} altura={10} className="mt-1" />
                  {g.observacao && <p className="mt-1 text-xs text-suave">{g.observacao}</p>}
                </li>
              );
            })}
            {!x.graduacoes?.length && <p className="text-suave">Nenhuma graduação registrada.</p>}
          </ul>
        </Bloco>

        {(ctx.academia.modos_chamada || []).includes("facial") && liberado(ctx.academia.plano, "chamada_facial") && (
          <Bloco titulo="Chamada por foto">
            <CadastroRosto perfilId={a.perfil_id} academiaId={ctx.academia.id} nome={a.nome} podeEditar={ctx.equipe || meu} />
          </Bloco>
        )}

        {/* Títulos */}
        {liberado(ctx.academia.plano, "titulos") && <Bloco titulo="Títulos">
          {x.conquistas?.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                {x.conquistas.map((c: any) => {
                  const principal = x.perfil?.titulo_escolhido === c.codigo;
                  return (
                    <button key={c.codigo} disabled={!meu} onClick={async () => { await sb.from("perfis").update({ titulo_escolhido: c.codigo }).eq("id", a.perfil_id); carregar(); }}
                      className="chip py-2" style={principal ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{c.icone} {c.titulo}</button>
                  );
                })}
              </div>
              {meu && <p className="mt-2 text-xs text-suave">Toque num título para mostrar ele no seu perfil e nos rankings.</p>}
            </>
          ) : <p className="text-suave">Nenhum título ainda. Estude, treine e participe de campeonatos para ganhar!</p>}
          <p className="mt-3 text-xs text-suave">Títulos: 🎓 Primeiros passos · 💯 Gabaritou · 📚 Estudioso · 🈴 Mestre das palavras · 🔥 Disciplina · ⚡ Desafiante · 🥋 Pronto pro exame · 💪 50 · 🏅 100 · 🏆 250 treinos · 🤝 Embaixador · 🥇 Medalhista</p>
        </Bloco>}

        {/* Exames de faixa */}
        {ctx.academia.modulos?.tecnicas === true && <Bloco titulo="Exames de faixa" acao={<Link href={`${base}/tecnicas${ctx.equipe ? `/exame?aluno=${id}` : ""}`} className="btn-sec text-sm">{ctx.equipe ? "Novo exame" : "Ver matéria"}</Link>}>
          <ul className="space-y-2">
            {x.exames?.map((e: any) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-3">
                <span>{e.modalidades?.nome}: {e.faixa_atual || "—"} → <b>{e.faixa_alvo}</b> <span className="text-sm text-suave">{dataBR(e.data)}{e.nota_final != null ? ` · nota ${e.nota_final}` : ""}</span></span>
                <span className="flex items-center gap-2">
                  <span className={`chip ${e.resultado === "aprovado" ? "border-ok" : e.resultado === "reprovado" ? "border-erro" : ""}`}>{e.resultado}</span>
                  <Link className="text-sm underline" href={`${base}/tecnicas/exame?exame=${e.id}`}>abrir</Link>
                </span>
              </li>
            ))}
            {!x.exames?.length && <p className="text-suave">Nenhum exame registrado.</p>}
            {x.simulados?.length > 0 && <p className="text-sm text-suave">📝 Simulados recentes: {x.simulados.map((q: any) => `${q.acertos}/${q.total} (${dataBR(q.criado_em).slice(0, 5)})`).join(" · ")}</p>}
          </ul>
        </Bloco>}

        {/* Ausências */}
        <Bloco titulo="Ausências" acao={(ctx.equipe || (meu && liberado(ctx.academia.plano, "aviso_falta"))) && <button className="btn-sec text-sm" onClick={() => setAberto(aberto === "aus" ? "" : "aus")}>{ctx.equipe ? "Registrar" : "Avisar falta"}</button>}>
          {aberto === "aus" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div><label className="rotulo">De</label><input type="date" className="campo" defaultValue={hojeISO()} onChange={(e) => f("de", e.target.value)} onFocus={() => !form.de && f("de", hojeISO())} /></div>
              <div><label className="rotulo">Até</label><input type="date" className="campo" onChange={(e) => f("ate", e.target.value)} /></div>
              <select className="campo" defaultValue="" onChange={(e) => { f("motivo", e.target.value); if (!form.de) f("de", hojeISO()); }}>
                <option value="" disabled>Motivo</option>
                {Object.entries(MOTIVOS_AUSENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {ctx.equipe ? (
                <select className="campo" defaultValue="justificada" onChange={(e) => f("status", e.target.value)}>
                  <option value="justificada">Justificada</option><option value="nao_justificada">Não justificada</option>
                </select>
              ) : <span />}
              <input className="campo col-span-2" placeholder="Observação" onChange={(e) => f("obs", e.target.value)} />
              {msg && <p className="col-span-2 text-sm text-alerta">{msg}</p>}
              <button className="btn col-span-2" onClick={salvarAusencia}>{ctx.equipe ? "Registrar" : "Avisar o professor"}</button>
              {!ctx.equipe && <p className="col-span-2 text-xs text-suave">O professor decide se a falta é justificada. Falta avisada não vira presença.</p>}
            </div>
          )}
          <ul className="space-y-2">
            {x.ausencias?.map((u: any) => (
              <li key={u.id} className="rounded-xl bg-painel2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{MOTIVOS_AUSENCIA[u.motivo]} · {dataBR(u.de)}{u.ate !== u.de ? ` a ${dataBR(u.ate)}` : ""}</span>
                  <span className={`chip ${u.status === "justificada" ? "border-ok" : u.status === "nao_justificada" ? "border-erro" : "border-alerta"}`}>
                    {{ pendente: "Aguardando professor", justificada: "Justificada", nao_justificada: "Não justificada" }[u.status as string]}
                  </span>
                </div>
                {u.observacao && <p className="text-sm text-suave">{u.observacao}</p>}
                {ctx.equipe && u.status === "pendente" && (
                  <div className="mt-2 flex gap-2">
                    <button className="btn-sec text-sm" onClick={() => avaliarAusencia(u.id, "justificada")}>Justificar</button>
                    <button className="btn-sec text-sm" onClick={() => avaliarAusencia(u.id, "nao_justificada")}>Conta como falta</button>
                  </div>
                )}
              </li>
            ))}
            {!x.ausencias?.length && <p className="text-suave">Nenhuma ausência avisada.</p>}
          </ul>
        </Bloco>

        {/* Pendências */}
        <Bloco titulo="Pendências" acao={ctx.equipe && <button className="btn-sec text-sm" onClick={() => setAberto(aberto === "pend" ? "" : "pend")}>Nova</button>}>
          {aberto === "pend" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <input className="campo col-span-2" placeholder="Ex.: Trazer RG para a pesagem" onChange={(e) => f("titulo", e.target.value)} />
              <input className="campo col-span-2" placeholder="Detalhes (opcional)" onChange={(e) => f("descricao", e.target.value)} />
              <select className="campo" defaultValue="outro" onChange={(e) => f("tipo", e.target.value)}>
                {["documento", "carteirinha", "pagamento", "conversa", "peso", "outro"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
              <input type="date" className="campo" onChange={(e) => f("prazo", e.target.value)} />
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" onChange={(e) => f("so_equipe", e.target.checked)} /> Só a equipe vê (anotação interna)</label>
              <button className="btn col-span-2" onClick={salvarPendencia}>Criar pendência</button>
            </div>
          )}
          <ul className="space-y-2">
            {x.pendencias?.filter((p: any) => p.status !== "resolvida").map((p: any) => (
              <li key={p.id} className="rounded-xl bg-painel2 p-3">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{p.status === "respondida" ? "📨" : "📌"} {p.titulo}{!p.visivel_aluno && " 🔒"}</span>
                  {p.prazo && <span className="text-sm text-suave">até {dataBR(p.prazo)}</span>}
                </div>
                {p.descricao && <p className="whitespace-pre-line text-sm text-suave">{p.descricao}</p>}
                {p.resposta && <p className="mt-1 text-sm">💬 {p.resposta}</p>}
                {p.anexo_url && <button onClick={() => abrirAnexo(sb, p.anexo_url)} className="text-sm underline">Ver anexo</button>}
                <div className="mt-2 flex gap-2">
                  {!ctx.equipe && p.visivel_aluno && <button className="btn-sec text-sm" onClick={() => responder(p)}>Responder</button>}
                  {ctx.equipe && <button className="btn-sec text-sm" onClick={() => avaliarPendencia(p, true)}>Resolvida</button>}
                  {ctx.equipe && p.status === "respondida" && <button className="btn-sec text-sm" onClick={() => avaliarPendencia(p, false)}>Devolver</button>}
                </div>
              </li>
            ))}
            {!x.pendencias?.some((p: any) => p.status !== "resolvida") && <p className="text-suave">Nada pendente. ✅</p>}
          </ul>
        </Bloco>

        {/* Turmas */}
        <Bloco titulo="Turmas" acao={ctx.equipe && <button className="btn-sec text-sm" onClick={() => setAberto(aberto === "tur" ? "" : "tur")}>Matricular</button>}>
          {aberto === "tur" && (
            <div className="mb-4 flex gap-2">
              <select className="campo" defaultValue="" onChange={(e) => f("turma", e.target.value)}>
                <option value="" disabled>Escolha a turma</option>
                {x.turmas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button className="btn" onClick={matricular}>Salvar</button>
            </div>
          )}
          <ul className="space-y-2">
            {x.matriculas?.map((m: any) => (
              <li key={m.turma_id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {m.turmas?.nome} <span className="text-sm text-suave">desde {dataBR(m.desde)}{m.ate ? ` até ${dataBR(m.ate)}` : ""}</span>
                  {(m.turmas?.horarios || []).length > 0 && (
                    <span className="block text-xs text-suave">
                      🕒 {[...(m.turmas.horarios || [])].sort((p: any, q: any) => p.dia_semana - q.dia_semana || p.hora_inicio.localeCompare(q.hora_inicio))
                        .map((h: any) => `${DIAS[h.dia_semana].slice(0, 3)} ${hora(h.hora_inicio)}–${hora(h.hora_fim)}`).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="chip">{m.status}</span>
                  {ctx.equipe && m.status === "ativa" && <button className="text-sm text-suave underline" onClick={() => mudarMatricula(m, "trancada")}>Trancar</button>}
                  {ctx.equipe && m.status !== "ativa" && <button className="text-sm text-suave underline" onClick={() => mudarMatricula(m, "ativa")}>Reativar</button>}
                  {ctx.equipe && m.status !== "encerrada" && <button className="text-sm text-suave underline" onClick={() => mudarMatricula(m, "encerrada")}>Encerrar</button>}
                </span>
              </li>
            ))}
          </ul>
          {ctx.equipe && (
            <div className="mt-4 border-t border-linha pt-3">
              {a.ativo
                ? <button className="text-sm text-erro underline" onClick={encerrarVinculo}>Encerrar vínculo com a academia</button>
                : <button className="text-sm underline" onClick={reativar}>Reativar aluno</button>}
            </div>
          )}
        </Bloco>

        {/* Carteirinhas */}
        <Bloco titulo="Carteirinhas" acao={<Link href={`${base}/carteirinha?aluno=${id}`} className="btn-sec text-sm">Abrir</Link>}>
          <ul className="space-y-1">
            {x.carteirinhas?.map((c: any) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span>{c.tipo === "academia" ? `${ctx.academia.nome} ${c.ano}` : `${c.entidade} ${c.numero ? `nº ${c.numero}` : ""}`}</span>
                <span className={c.ativa ? "text-ok" : "text-suave"}>{c.ativa ? "ativa" : "histórico"}{c.valida_ate ? ` · até ${dataBR(c.valida_ate)}` : ""}</span>
              </li>
            ))}
            {!x.carteirinhas?.length && <p className="text-suave">Nenhuma carteirinha ainda.</p>}
          </ul>
        </Bloco>

        {/* Anotações da equipe */}
        {ctx.equipe && (
          <Bloco titulo="Anotações da equipe 🔒">
            <label className="rotulo">Apelido interno</label>
            <input className="campo mb-2" defaultValue={x.membro?.apelido_interno || ""} onChange={(e) => f("apelido_interno", e.target.value)} />
            <label className="rotulo">Observações</label>
            <textarea className="campo min-h-24" defaultValue={x.membro?.observacoes || ""} onChange={(e) => f("observacoes", e.target.value)} />
            <button className="btn-sec mt-2 text-sm" onClick={salvarEquipe}>Salvar anotações</button>
          </Bloco>
        )}
      </div>
    </div>
  );
}
