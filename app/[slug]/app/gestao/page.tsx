"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, dataBR, hora, primeiroNome, whatsapp } from "@/lib/util";
import { Faixa } from "@/components/Faixa";
import { Avatar } from "@/components/Avatar";
import { Equipe } from "./Equipe";
import { SeletorGraduacao } from "@/components/SeletorGraduacao";

const CORES_PADRAO: Record<string, string> = {
  branca: "#f5f5f5", branco: "#f5f5f5", cinza: "#9ca3af", amarela: "#facc15", amarelo: "#facc15", laranja: "#f97316",
  verde: "#16a34a", azul: "#1d4ed8", roxa: "#7c3aed", roxo: "#7c3aed", marrom: "#78350f", preta: "#111111", preto: "#111111",
  vermelha: "#dc2626", vermelho: "#dc2626", coral: "#f87171",
};

// Cadastro de modalidades, turmas, horários e professores (sem precisar de SQL)
export default function Gestao() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const acad = ctx.academia.id;
  const [aba, setAba] = useState("turmas");
  const [mods, setMods] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [hor, setHor] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState("");
  const [vagas, setVagas] = useState<Record<string, any>>({});
  const [fila, setFila] = useState<any[]>([]);
  const [novoFila, setNovoFila] = useState<Record<string, any>>({});
  const [regras, setRegras] = useState<Record<string, any>>({});

  async function carregar() {
    const [m, t, p, a] = await Promise.all([
      sb.from("modalidades").select("*").eq("academia_id", acad).order("ordem"),
      sb.from("turmas").select("*, horarios(*)").eq("academia_id", acad).order("nome"),
      sb.from("membros").select("id, perfil_id, papel, ativo, perfis(nome, apelido, email, foto_url, telefone), professores_modalidades(modalidade_id, whatsapp_publico, bio, graduacao)").eq("academia_id", acad).in("papel", ["professor", "admin"]),
      sb.from("membros").select("perfil_id, perfis(nome)").eq("academia_id", acad).eq("papel", "aluno").eq("ativo", true),
    ]);
    setMods(m.data || []); setTurmas(t.data || []); setProfs(p.data || []); setAlunos(a.data || []);
    const [v, f] = await Promise.all([
      sb.from("turmas_vagas").select("*").eq("academia_id", acad),
      sb.from("lista_espera").select("*").eq("academia_id", acad).in("status", ["aguardando", "chamado"]).order("criado_em"),
    ]);
    setVagas(Object.fromEntries((v.data || []).map((x: any) => [x.turma_id, x])));
    setFila(f.data || []);
    const { data: rg } = await sb.from("regras_graduacao").select("*").in("modalidade_id", (m.data || []).map((x: any) => x.id).concat(["00000000-0000-0000-0000-000000000000"]));
    setRegras(Object.fromEntries((rg || []).map((r: any) => [r.modalidade_id + "|" + r.faixa, r])));
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  const professores = profs.filter((p) => p.papel === "professor");
  const nomeProf = (id: string) => { const p = profs.find((x) => x.id === id); return p ? p.perfis?.apelido || p.perfis?.nome : "—"; };

  // ---------- Modalidades ----------
  async function salvarModalidade() {
    const faixas = (form.faixas || []).filter((f: any) => f.nome.trim());
    const dados = {
      academia_id: acad, nome: form.nome, descricao: form.descricao || null, cor: form.cor || "#7c3aed", icone: form.icone || "🥋",
      graduacoes: faixas.map((f: any) => f.nome.trim()), cores_graduacoes: faixas.map((f: any) => f.cor),
      ordem: form.ordem ?? mods.length + 1, graus_max: form.graus_max ?? 4,
    };
    const { error } = form.id ? await sb.from("modalidades").update(dados).eq("id", form.id) : await sb.from("modalidades").insert(dados);
    setMsg(error ? error.message : "Modalidade salva."); setForm(null); carregar();
  }
  function editarModalidade(m?: any) {
    setForm({
      tipo: "modalidade", ...(m || { cor: "#7c3aed", icone: "🥋" }),
      faixas: m ? (m.graduacoes || []).map((n: string, i: number) => ({ nome: n, cor: m.cores_graduacoes?.[i] || CORES_PADRAO[n.toLowerCase()] || "#888888" }))
        : ["Branca", "Azul", "Roxa", "Marrom", "Preta"].map((n) => ({ nome: n, cor: CORES_PADRAO[n.toLowerCase()] })),
    });
  }

  // ---------- Turmas e horários ----------
  async function salvarTurma() {
    const dados = { academia_id: acad, nome: form.nome, modalidade_id: form.modalidade_id, professor_id: form.professor_id || null, publico: form.publico || null, vagas: form.vagas ? Number(form.vagas) : null,
      whatsapp_grupo: form.whatsapp_grupo?.trim() || null };
    if (!dados.nome || !dados.modalidade_id) return setMsg("Preencha o nome e a modalidade.");
    const { error } = form.id ? await sb.from("turmas").update(dados).eq("id", form.id) : await sb.from("turmas").insert(dados);
    setMsg(error ? error.message : "Turma salva."); setForm(null); carregar();
  }
  async function addHorario(turmaId: string) {
    const h = hor[turmaId] || {};
    if (h.dia === undefined || !h.inicio || !h.fim) return setMsg("Escolha o dia, o início e o fim.");
    const { error } = await sb.from("horarios").insert({ turma_id: turmaId, dia_semana: Number(h.dia), hora_inicio: h.inicio, hora_fim: h.fim, tipo_treino: h.tipo || null, local: h.local || null });
    setMsg(error ? (error.message.includes("check") ? "O fim precisa ser depois do início." : error.message) : "");
    setHor({ ...hor, [turmaId]: {} }); carregar();
  }
  async function apagarHorario(id: string) {
    if (!confirm("Apagar este horário? As chamadas já feitas continuam salvas.")) return;
    await sb.from("horarios").delete().eq("id", id); carregar();
  }
  async function alternarTurma(t: any) {
    await sb.from("turmas").update({ ativa: !t.ativa }).eq("id", t.id); carregar();
  }

  // ---------- Regras de graduação ----------
  async function salvarRegra(modId: string, faixa: string, campo: string, valor: string) {
    const atual = regras[modId + "|" + faixa] || { min_aulas: 40, min_meses: 6 };
    const novo = { modalidade_id: modId, faixa, min_aulas: Number(atual.min_aulas), min_meses: Number(atual.min_meses), idade_minima: atual.idade_minima ?? null, [campo]: valor === "" ? null : Number(valor) };
    const { error } = await sb.from("regras_graduacao").upsert(novo, { onConflict: "modalidade_id,faixa" });
    if (error) return setMsg(error.message);
    setRegras({ ...regras, [modId + "|" + faixa]: novo });
  }

  // ---------- Lista de espera ----------
  async function addFila(turmaId: string) {
    const n = novoFila[turmaId] || {};
    if (!n.nome) return setMsg("Informe o nome para a lista de espera.");
    await sb.from("lista_espera").insert({ academia_id: acad, turma_id: turmaId, nome: n.nome, telefone: n.telefone || null });
    setNovoFila({ ...novoFila, [turmaId]: {} }); carregar();
  }
  async function mudarFila(id: string, status: string) {
    await sb.from("lista_espera").update({ status, chamado_em: status === "chamado" ? new Date().toISOString() : undefined }).eq("id", id);
    carregar();
  }

  // ---------- Professores ----------
  async function salvarProfessor() {
    let perfilId = form.perfil_id;
    if (!perfilId) {
      if (!form.nome || !form.email) return setMsg("Preencha nome e e-mail do professor.");
      perfilId = crypto.randomUUID();
      const r = await sb.from("perfis").insert({ id: perfilId, nome: form.nome, email: form.email.trim().toLowerCase(), telefone: form.whatsapp || null });
      if (r.error) return setMsg(r.error.message);
    }
    const membroId = crypto.randomUUID();
    const papel = form.papel === "admin_professor" ? "professor" : form.papel || "professor";
    const r2 = await sb.from("membros").insert({ id: membroId, academia_id: acad, perfil_id: perfilId, papel });
    if (r2.error) return setMsg(r2.error.message.includes("duplicate") ? "Essa pessoa já tem esse papel aqui." : r2.error.message);
    if (form.papel === "admin_professor") await sb.from("membros").insert({ academia_id: acad, perfil_id: perfilId, papel: "admin" });
    if ((form.modalidades || []).length) {
      await sb.from("professores_modalidades").insert(form.modalidades.map((m: string) => ({ membro_id: membroId, modalidade_id: m, whatsapp_publico: form.whatsapp || null, bio: form.bio || null, graduacao: form.graduacao || null })));
    }
    setMsg("Professor cadastrado. Ele entra pelo “Primeiro acesso” com esse e-mail."); setForm(null); carregar();
  }
  async function alternarModalidadeProf(p: any, modId: string) {
    const tem = (p.professores_modalidades || []).some((x: any) => x.modalidade_id === modId);
    if (tem) await sb.from("professores_modalidades").delete().eq("membro_id", p.id).eq("modalidade_id", modId);
    else await sb.from("professores_modalidades").insert({ membro_id: p.id, modalidade_id: modId, whatsapp_publico: p.perfis?.telefone || null });
    carregar();
  }
  async function alternarAtivo(p: any) {
    await sb.from("membros").update({ ativo: !p.ativo }).eq("id", p.id); carregar();
  }

  const f = (k: string, v: any) => setForm((x: any) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">{ctx.admin ? "Turmas e equipe" : "Minhas turmas"}</h1>
      {!ctx.admin && <p className="text-sm text-suave">Você vê e organiza os horários das suas turmas. Criar turmas, modalidades e professores é com o admin.</p>}
      <div className="flex gap-1 rounded-2xl bg-painel p-1">
        {[["turmas", "Turmas e horários"], ["modalidades", "Modalidades"], ["equipe", "Professores"]].map(([k, v]) => (
          <button key={k} onClick={() => { setAba(k); setForm(null); }} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${aba === k ? "bg-painel2" : "text-suave"}`}>{v}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {/* ===== Turmas ===== */}
      {aba === "turmas" && (
        <>
          {ctx.admin && <button className="btn" onClick={() => setForm({ tipo: "turma", modalidade_id: mods[0]?.id })} disabled={!mods.length}>Nova turma</button>}
          {!mods.length && <p className="text-suave">Cadastre uma modalidade primeiro.</p>}
          {form?.tipo === "turma" && (
            <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
              <input className="campo" placeholder="Nome (ex.: Jiu-jitsu Adulto)" value={form.nome || ""} onChange={(e) => f("nome", e.target.value)} />
              <select className="campo" value={form.modalidade_id || ""} onChange={(e) => f("modalidade_id", e.target.value)}>
                {mods.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <select className="campo" value={form.professor_id || ""} onChange={(e) => f("professor_id", e.target.value)}>
                <option value="">Professor responsável…</option>
                {profs.map((p) => <option key={p.id} value={p.id}>{p.perfis?.nome} ({p.papel})</option>)}
              </select>
              <input className="campo" placeholder="Público (ex.: infantil, adulto)" value={form.publico || ""} onChange={(e) => f("publico", e.target.value)} />
              <input className="campo" type="number" placeholder="Vagas (opcional)" value={form.vagas || ""} onChange={(e) => f("vagas", e.target.value)} />
              <input className="campo sm:col-span-2" placeholder="Link do grupo do WhatsApp da turma (opcional): https://chat.whatsapp.com/..." value={form.whatsapp_grupo || ""} onChange={(e) => f("whatsapp_grupo", e.target.value)} />
              <div className="flex gap-2"><button className="btn" onClick={salvarTurma}>Salvar</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
            </div>
          )}
          <div className="space-y-3">
            {turmas.filter((t) => ctx.admin || t.professor_id === ctx.professorId).map((t) => {
              const m = mods.find((x) => x.id === t.modalidade_id);
              const h = hor[t.id] || {};
              return (
                <section key={t.id} className={`rounded-2xl bg-painel p-4 ${t.ativa ? "" : "opacity-60"}`} style={{ borderLeft: `5px solid ${m?.cor || "var(--cor)"}` }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-2xl font-bold">{t.nome}</h2>
                      <p className="text-sm text-suave">{m?.nome} · {nomeProf(t.professor_id)}{t.publico ? ` · ${t.publico}` : ""}</p>
                      {t.vagas && vagas[t.id] && (
                        <p className={`text-sm font-semibold ${vagas[t.id].lotada ? "text-alerta" : "text-ok"}`}>
                          {vagas[t.id].ocupadas}/{t.vagas} vagas ocupadas{vagas[t.id].lotada ? " · LOTADA" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-sec text-sm" onClick={() => setForm({ tipo: "turma", ...t })}>Editar</button>
                      <button className="btn-sec text-sm" onClick={() => alternarTurma(t)}>{t.ativa ? "Desativar" : "Ativar"}</button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {(t.horarios || []).sort((a: any, b: any) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)).map((x: any) => (
                      <li key={x.id} className="flex items-center justify-between rounded-xl bg-painel2 px-3 py-2 text-sm">
                        <span><b>{DIAS[x.dia_semana]}</b> {hora(x.hora_inicio)}–{hora(x.hora_fim)}{x.tipo_treino ? ` · ${x.tipo_treino}` : ""}{x.local ? ` · ${x.local}` : ""}</span>
                        <button className="text-suave underline" onClick={() => apagarHorario(x.id)}>apagar</button>
                      </li>
                    ))}
                  </ul>
                  {(t.vagas || fila.some((x) => x.turma_id === t.id)) && (
                    <div className="mt-3 rounded-xl border border-linha p-3">
                      <p className="mb-2 text-sm font-semibold">⏳ Lista de espera ({fila.filter((x) => x.turma_id === t.id).length})</p>
                      <ol className="space-y-1">
                        {fila.filter((x) => x.turma_id === t.id).map((x, i) => {
                          const z = whatsapp(x.telefone, `Oi, ${primeiroNome(x.nome)}! Abriu uma vaga na turma ${t.nome} da ${ctx.academia.nome}. Ainda tem interesse?`);
                          return (
                            <li key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="numero w-6">{i + 1}º</span>
                              <span className="flex-1">{x.nome} <span className="text-suave">desde {dataBR(x.criado_em)}{x.status === "chamado" ? " · já chamado" : ""}</span></span>
                              {z && <a href={z} target="_blank" className="underline" onClick={() => mudarFila(x.id, "chamado")}>Chamar</a>}
                              <button className="underline" onClick={() => mudarFila(x.id, "entrou")}>Entrou</button>
                              <button className="text-suave underline" onClick={() => mudarFila(x.id, "desistiu")}>Desistiu</button>
                            </li>
                          );
                        })}
                      </ol>
                      <div className="mt-2 flex gap-2">
                        <input className="campo text-sm" placeholder="Nome" value={novoFila[t.id]?.nome || ""} onChange={(e) => setNovoFila({ ...novoFila, [t.id]: { ...novoFila[t.id], nome: e.target.value } })} />
                        <input className="campo text-sm" placeholder="WhatsApp" value={novoFila[t.id]?.telefone || ""} onChange={(e) => setNovoFila({ ...novoFila, [t.id]: { ...novoFila[t.id], telefone: e.target.value } })} />
                        <button className="btn-sec text-sm" onClick={() => addFila(t.id)}>+ Fila</button>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                    <select className="campo" value={h.dia ?? ""} onChange={(e) => setHor({ ...hor, [t.id]: { ...h, dia: e.target.value } })}>
                      <option value="" disabled>Dia</option>
                      {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                    <input className="campo" type="time" value={h.inicio || ""} onChange={(e) => setHor({ ...hor, [t.id]: { ...h, inicio: e.target.value } })} aria-label="Início" />
                    <input className="campo" type="time" value={h.fim || ""} onChange={(e) => setHor({ ...hor, [t.id]: { ...h, fim: e.target.value } })} aria-label="Fim" />
                    <input className="campo" placeholder="Tipo (leve…)" value={h.tipo || ""} onChange={(e) => setHor({ ...hor, [t.id]: { ...h, tipo: e.target.value } })} />
                    <input className="campo" placeholder="Local" value={h.local || ""} onChange={(e) => setHor({ ...hor, [t.id]: { ...h, local: e.target.value } })} />
                    <button className="btn-sec" onClick={() => addHorario(t.id)}>+ Horário</button>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* ===== Modalidades ===== */}
      {aba === "modalidades" && (
        <>
          {ctx.admin && <button className="btn" onClick={() => editarModalidade()}>Nova modalidade</button>}
          {form?.tipo === "modalidade" && (
            <div className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <input className="campo sm:col-span-2" placeholder="Nome (ex.: Jiu-jitsu)" value={form.nome || ""} onChange={(e) => f("nome", e.target.value)} />
                <input className="campo" placeholder="Ícone (emoji)" value={form.icone || ""} onChange={(e) => f("icone", e.target.value)} />
                <input type="color" className="h-12 w-full rounded-xl" value={form.cor || "#7c3aed"} onChange={(e) => f("cor", e.target.value)} aria-label="Cor" />
                <input className="campo sm:col-span-4" placeholder="Descrição curta" value={form.descricao || ""} onChange={(e) => f("descricao", e.target.value)} />
                <label className="flex items-center gap-2 text-sm sm:col-span-4">
                  Graus por faixa:
                  <select className="campo w-auto" value={form.graus_max ?? 4} onChange={(e) => f("graus_max", Number(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 0 ? "não usa graus" : `até ${n}`}</option>)}
                  </select>
                  <span className="text-xs text-suave">A faixa preta usa dan (1º ao 10º).</span>
                </label>
              </div>
              <p className="rotulo">Faixas, em ordem (a cor vira a moldura da foto do aluno)</p>
              {(form.faixas || []).map((fx: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="campo" value={fx.nome} onChange={(e) => { const l = [...form.faixas]; l[i] = { nome: e.target.value, cor: CORES_PADRAO[e.target.value.toLowerCase()] || fx.cor }; f("faixas", l); }} />
                  <input type="color" className="h-11 w-14 shrink-0 rounded-lg" value={fx.cor} onChange={(e) => { const l = [...form.faixas]; l[i] = { ...fx, cor: e.target.value }; f("faixas", l); }} />
                  <div className="hidden w-32 sm:block"><Faixa cor={fx.cor} graus={2} /></div>
                  <button className="text-suave" onClick={() => f("faixas", form.faixas.filter((_: any, k: number) => k !== i))} aria-label="Remover">✕</button>
                </div>
              ))}
              <button className="btn-sec text-sm" onClick={() => f("faixas", [...(form.faixas || []), { nome: "", cor: "#888888" }])}>+ Faixa</button>
              <div className="flex gap-2"><button className="btn" onClick={salvarModalidade}>Salvar</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {mods.map((m) => (
              <section key={m.id} className="rounded-2xl bg-painel p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">{m.icone} {m.nome}</h2>
                  {ctx.admin && <button className="btn-sec text-sm" onClick={() => editarModalidade(m)}>Editar</button>}
                </div>
                <div className="mt-3 space-y-1.5">
                  {(m.graduacoes || []).map((g: string, i: number) => {
                    const r = regras[m.id + "|" + g];
                    const ultima = i === (m.graduacoes || []).length - 1;
                    return (
                      <div key={g} className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm sm:grid-cols-[5rem_1fr_auto]">
                        <span>{g}</span><Faixa cor={m.cores_graduacoes?.[i]} graus={0} altura={8} />
                        {!ultima && ctx.admin && (
                          <span className="col-span-2 flex items-center gap-1 text-xs text-suave sm:col-span-1">
                            <input className="campo w-14 px-1 py-1 text-center" type="number" defaultValue={r?.min_aulas ?? ""} placeholder="—" onBlur={(e) => salvarRegra(m.id, g, "min_aulas", e.target.value)} aria-label={`Aulas mínimas na ${g}`} /> aulas
                            <input className="campo w-12 px-1 py-1 text-center" type="number" defaultValue={r?.min_meses ?? ""} placeholder="—" onBlur={(e) => salvarRegra(m.id, g, "min_meses", e.target.value)} aria-label={`Meses mínimos na ${g}`} /> meses
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {ctx.admin && <p className="pt-1 text-xs text-suave">Aulas e meses mínimos em cada faixa: quando o aluno completa, o professor recebe “pronto para graduar”.</p>}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* ===== Professores ===== */}
      {aba === "equipe" && (
        <>
          {ctx.admin ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => setForm({ tipo: "prof", papel: "professor", modalidades: [] })}>Novo professor</button>
              <button className="btn-sec" onClick={() => setForm({ tipo: "prof", papel: "professor", modalidades: [], promover: true })}>Tornar um aluno professor</button>
            </div>
          ) : <p className="text-suave">Só o admin cadastra professores.</p>}
          {form?.tipo === "prof" && (
            <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
              {form.promover ? (
                <select className="campo sm:col-span-2" value={form.perfil_id || ""} onChange={(e) => f("perfil_id", e.target.value)}>
                  <option value="" disabled>Escolha o aluno…</option>
                  {alunos.map((a) => <option key={a.perfil_id} value={a.perfil_id}>{a.perfis?.nome}</option>)}
                </select>
              ) : (
                <>
                  <input className="campo" placeholder="Nome" onChange={(e) => f("nome", e.target.value)} />
                  <input className="campo" type="email" placeholder="E-mail (para o login)" onChange={(e) => f("email", e.target.value)} />
                </>
              )}
              <input className="campo" placeholder="WhatsApp público (5524999999999)" onChange={(e) => f("whatsapp", e.target.value)} />
              {(() => { const m = mods.find((x) => x.id === (form.modalidades || [])[0]) || mods[0]; return m?.graduacoes?.length
                ? <SeletorGraduacao key={m.id} faixas={m.graduacoes} grausMax={m.graus_max ?? 4} valor={form.graduacao} onChange={(t) => f("graduacao", t)} />
                : <input className="campo" placeholder="Graduação (ex.: faixa preta 2º dan)" onChange={(e) => f("graduacao", e.target.value)} />; })()}
              <input className="campo sm:col-span-2" placeholder="Mini bio (aparece na página pública)" onChange={(e) => f("bio", e.target.value)} />
              <select className="campo" value={form.papel} onChange={(e) => f("papel", e.target.value)}>
                <option value="professor">Professor (só as turmas dele)</option>
                <option value="admin_professor">Admin e professor</option>
                <option value="admin">Só admin (gerencia, não dá aula)</option>
              </select>
              <div className="flex flex-wrap gap-2">
                {mods.map((m) => {
                  const on = form.modalidades.includes(m.id);
                  return <button key={m.id} type="button" className="chip" style={on ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                    onClick={() => f("modalidades", on ? form.modalidades.filter((x: string) => x !== m.id) : [...form.modalidades, m.id])}>{on ? "✓ " : ""}{m.nome}</button>;
                })}
              </div>
              <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvarProfessor}>Salvar</button><button className="btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
            </div>
          )}
          <Equipe linhas={profs} mods={mods} acad={acad} recarregar={carregar} />
          {professores.length === 0 && <p className="text-suave">Nenhum professor cadastrado ainda.</p>}
        </>
      )}
    </div>
  );
}
