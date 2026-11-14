"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { abrirAnexo, dataBR, dataHoraBR, whatsapp } from "@/lib/util";
import { criarLogin, textoAcesso } from "@/lib/criarLogin";
import { comprimir } from "@/lib/imagem";
import { FichaSaude } from "@/components/FichaSaude";
import { AssinaturaPad } from "@/components/AssinaturaPad";
import { TERMOS, cpfValido, hashTexto, idade, mascaraCpf, textoDoTermo } from "@/lib/termosCadastro";

const PARENTESCOS = ["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Irmã", "Irmão", "Tutor(a) legal", "Guardião(ã)", "Outro"];
const TIPOS_DOC: Record<string, string> = {
  doc_responsavel: "Documento do responsável (RG/CNH)", doc_aluno: "Certidão de nascimento ou documento do aluno",
  guarda: "Termo de guarda ou tutela", atestado: "Atestado médico", outro: "Outro documento", ficha_pdf: "📄 Ficha completa (PDF)",
};
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

// Seção que abre e fecha, com o selo de "ok" ou "pendente"
function Etapa({ n, titulo, ok, aberta, children }: { n: number; titulo: string; ok?: boolean; aberta?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-painel" open={aberta}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="numero flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: ok ? "var(--color-ok)" : "var(--cor)" }}>{ok ? "✓" : n}</span>
        <span className="flex-1 text-lg font-bold leading-tight sm:text-xl">{titulo}</span>
        <span className="text-suave transition group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="space-y-3 border-t border-linha p-4">{children}</div>
    </details>
  );
}

export default function CadastroCompleto({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [m, setM] = useState<any>(null);
  const [p, setP] = useState<any>(null);
  const [st, setSt] = useState<any>(null);
  const [resp, setResp] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [ass, setAss] = useState<any[]>([]);
  const [oco, setOco] = useState<any[]>([]);
  const [grad, setGrad] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const meu = ctx.meusAlunos.some((x) => x.id === id);
  const pode = ctx.equipe || meu;

  async function carregar() {
    const { data: mm } = await sb.from("membros").select("*, perfis(*)").eq("id", id).maybeSingle();
    if (!mm) return;
    setM(mm); setP({ ...mm.perfis, endereco_detalhe: mm.perfis?.endereco_detalhe || {}, autorizados_retirada: mm.perfis?.autorizados_retirada || [] });
    const [s, r, d, a, o, g] = await Promise.all([
      sb.rpc("status_cadastro", { p_membro: id }),
      sb.from("responsaveis").select("*, perfis!responsaveis_responsavel_id_fkey(*)").eq("dependente_id", mm.perfil_id),
      sb.from("documentos").select("*").eq("perfil_id", mm.perfil_id).order("criado_em", { ascending: false }),
      sb.from("assinaturas_termos").select("*").eq("perfil_id", mm.perfil_id).order("assinado_em", { ascending: false }),
      sb.from("ocorrencias").select("*").eq("membro_id", id).order("data", { ascending: false }),
      sb.from("graduacoes").select("faixa, grau, data, modalidades(nome)").eq("membro_id", id).order("data", { ascending: false }).limit(1),
    ]);
    setSt(s.data); setResp(r.data || []); setDocs(d.data || []); setAss(a.data || []); setOco(o.data || []); setGrad(g.data?.[0] || null);
  }
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line

  if (!pode) return <p className="text-suave">Você não tem acesso a este cadastro.</p>;
  if (!m || !p) return <p className="text-suave">Carregando…</p>;

  const anos = idade(p.nascimento);
  const menor = anos !== null && anos < 18;
  const pend: string[] = st?.pendencias || [];
  const tem = (t: string) => pend.some((x) => x.toLowerCase().includes(t.toLowerCase()));

  async function concluir() {
    const { error } = await sb.rpc("concluir_cadastro", { p_membro: id });
    setMsg(error ? error.message : "✅ Cadastro concluído!"); carregar();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`${base}/alunos/${id}`} className="text-sm text-suave">← Ficha de {p.apelido || p.nome}</Link>
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Cadastro completo</h1>
        <p className="text-suave">{p.nome}{anos !== null ? ` · ${anos} anos` : ""} {menor && <span className="chip ml-1 text-xs">menor de idade</span>}</p>
      </div>

      {/* Situação do cadastro */}
      <section className="rounded-2xl p-4" style={{ background: st?.completo ? "color-mix(in srgb, var(--color-ok) 18%, transparent)" : "color-mix(in srgb, var(--color-alerta) 16%, transparent)" }}>
        {st?.completo ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">✅ Tudo preenchido{m.cadastro_status === "completo" ? ` · concluído em ${dataHoraBR(m.cadastro_concluido_em)}` : ""}</p>
            {m.cadastro_status !== "completo" && <button className="btn" onClick={concluir}>Concluir cadastro</button>}
          </div>
        ) : (
          <>
            <p className="font-semibold">📋 Faltam {pend.length} item(ns) para concluir o cadastro:</p>
            <ul className="mt-1 grid gap-x-4 text-sm sm:grid-cols-2">{pend.map((x) => <li key={x}>• {x}</li>)}</ul>
            <p className="mt-2 text-xs text-suave">O cadastro só pode ser concluído quando tudo que é obrigatório estiver pronto.</p>
          </>
        )}
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </section>

      <DadosPessoais p={p} setP={setP} grad={grad} recarregar={carregar} />
      {menor && <Responsavel aluno={p} resp={resp} recarregar={carregar} ok={!pend.some((x) => ["Responsável legal", "CPF do responsável", "WhatsApp do responsável"].includes(x))} />}
      <Etapa n={menor ? 3 : 2} titulo="Ficha de saúde" ok={!tem("saúde") && !tem("emergência")}>
        <FichaSaude perfilId={p.id} podeEditar={pode} onSalvo={carregar} />
      </Etapa>
      <Termos aluno={p} menor={menor} resp={resp} ass={ass} recarregar={carregar} n={menor ? 4 : 3} ok={!tem("termo")} />
      <Documentos aluno={p} menor={menor} resp={resp} docs={docs} recarregar={carregar} n={menor ? 5 : 4} ok={!tem("document") && !tem("certid") && !tem("guarda")} />
      {(ctx.equipe || oco.length > 0) && <Ocorrencias membroId={id} lista={oco} recarregar={carregar} n={menor ? 6 : 5} />}

      <PdfFicha dados={{ perfil: p, menor, responsaveis: resp, assinaturas: ass, documentos: docs, ocorrencias: oco, graduacao: grad, status: st }} recarregar={carregar} />

      <section className="flex flex-wrap gap-2 rounded-2xl bg-painel p-4 text-sm">
        <span className="w-full font-semibold">Também na ficha do aluno:</span>
        <Link className="btn-sec text-sm" href={`${base}/alunos/${id}`}>📅 Frequência</Link>
        <Link className="btn-sec text-sm" href={`${base}/alunos/${id}`}>🥋 Histórico de faixas</Link>
        {ctx.admin && <Link className="btn-sec text-sm" href="/master/atividade">🧾 Histórico de alterações</Link>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- 1. Dados pessoais
function DadosPessoais({ p, setP, grad, recarregar }: any) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [msg, setMsg] = useState("");
  const e = p.endereco_detalhe || {};
  const muda = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));
  const mudaEnd = (k: string, v: any) => setP((x: any) => ({ ...x, endereco_detalhe: { ...(x.endereco_detalhe || {}), [k]: v } }));

  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${d}`);
      if (!r.ok) return;
      const j = await r.json();
      setP((x: any) => ({ ...x, endereco_detalhe: { ...(x.endereco_detalhe || {}), cep: d, rua: j.street || "", bairro: j.neighborhood || "", cidade: j.city || "", uf: j.state || "" } }));
    } catch { /* sem internet: preenche à mão */ }
  }

  async function salvar() {
    if (!p.nome?.trim()) return setMsg("O nome é obrigatório.");
    if (p.cpf && !cpfValido(p.cpf)) return setMsg("CPF inválido. Confira os números.");
    const end = [e.rua && `${e.rua}${e.numero ? `, ${e.numero}` : ""}`, e.complemento, e.bairro, e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`, e.cep && `CEP ${e.cep}`].filter(Boolean).join(" - ");
    const { error } = await sb.from("perfis").update({
      nome: p.nome.trim(), apelido: p.apelido || null, cpf: p.cpf ? p.cpf.replace(/\D/g, "") : null, rg: p.rg || null,
      nascimento: p.nascimento || null, sexo: p.sexo || null, email: p.email || null, telefone: p.telefone || null,
      endereco_detalhe: e, endereco: end || p.endereco || null, experiencia: p.experiencia || null,
    }).eq("id", p.id);
    setMsg(error ? error.message : "Dados salvos."); if (!error) recarregar();
  }

  const ok = !!(p.nascimento && p.cpf && (e.rua || p.endereco));
  return (
    <Etapa n={1} titulo="Dados pessoais" ok={ok} aberta={!ok}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="rotulo">Nome completo *</label><input className="campo" value={p.nome || ""} onChange={(x) => muda("nome", x.target.value)} /></div>
        <div><label className="rotulo">Apelido</label><input className="campo" value={p.apelido || ""} onChange={(x) => muda("apelido", x.target.value)} /></div>
        <div>
          <label className="rotulo">CPF *</label>
          <input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={mascaraCpf(p.cpf)} onChange={(x) => muda("cpf", x.target.value.replace(/\D/g, ""))} />
          {p.cpf && p.cpf.length === 11 && !cpfValido(p.cpf) && <p className="text-xs text-erro">CPF inválido</p>}
        </div>
        <div><label className="rotulo">Data de nascimento *</label><input className="campo" type="date" value={p.nascimento || ""} onChange={(x) => muda("nascimento", x.target.value)} /></div>
        <div>
          <label className="rotulo">Sexo</label>
          <select className="campo" value={p.sexo || ""} onChange={(x) => muda("sexo", x.target.value)}><option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option></select>
        </div>
        <div><label className="rotulo">RG (opcional)</label><input className="campo" value={p.rg || ""} onChange={(x) => muda("rg", x.target.value)} /></div>
        <div><label className="rotulo">WhatsApp</label><input className="campo" type="tel" placeholder="5524999999999" value={p.telefone || ""} onChange={(x) => muda("telefone", x.target.value)} /></div>
        <div className="sm:col-span-2"><label className="rotulo">E-mail</label><input className="campo" type="email" value={p.email || ""} onChange={(x) => muda("email", x.target.value)} /></div>
      </div>

      <p className="rotulo pt-2">Endereço completo *</p>
      <div className="grid grid-cols-6 gap-2">
        <input className="campo col-span-3 sm:col-span-2" inputMode="numeric" placeholder="CEP" value={e.cep || ""} onChange={(x) => { mudaEnd("cep", x.target.value); buscarCep(x.target.value); }} />
        <input className="campo col-span-6 sm:col-span-4" placeholder="Rua" value={e.rua || ""} onChange={(x) => mudaEnd("rua", x.target.value)} />
        <input className="campo col-span-2" placeholder="Número" value={e.numero || ""} onChange={(x) => mudaEnd("numero", x.target.value)} />
        <input className="campo col-span-4" placeholder="Complemento" value={e.complemento || ""} onChange={(x) => mudaEnd("complemento", x.target.value)} />
        <input className="campo col-span-6 sm:col-span-2" placeholder="Bairro" value={e.bairro || ""} onChange={(x) => mudaEnd("bairro", x.target.value)} />
        <input className="campo col-span-4 sm:col-span-3" placeholder="Cidade" value={e.cidade || ""} onChange={(x) => mudaEnd("cidade", x.target.value)} />
        <select className="campo col-span-2 sm:col-span-1" value={e.uf || ""} onChange={(x) => mudaEnd("uf", x.target.value)} aria-label="UF"><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
      </div>
      {!e.rua && p.endereco && <p className="text-xs text-suave">Endereço anterior: {p.endereco}</p>}

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <div className="rounded-xl bg-painel2 p-3 text-sm">
          <p className="rotulo">Modalidade e graduação</p>
          {grad ? <p><b>{grad.modalidades?.nome}</b> · Faixa {String(grad.faixa).toLowerCase()}{grad.grau ? ` · ${grad.grau}º grau` : ""} <span className="text-suave">(desde {dataBR(grad.data)})</span></p> : <p className="text-suave">Sem graduação registrada.</p>}
          {ctx.equipe && <p className="mt-1 text-xs text-suave">Para mudar a faixa, registre a graduação na ficha do aluno (fica no histórico).</p>}
        </div>
        <div><label className="rotulo">Experiência anterior</label><textarea className="campo min-h-20" placeholder="Ex.: treinou judô 2 anos, faixa amarela, em outra academia" value={p.experiencia || ""} onChange={(x) => muda("experiencia", x.target.value)} /></div>
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <button className="btn w-full sm:w-auto" onClick={salvar}>Salvar dados pessoais</button>
    </Etapa>
  );
}

// ---------------------------------------------------------------- 2. Responsável legal
function Responsavel({ aluno, resp, recarregar, ok }: any) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const atual = resp.find((r: any) => r.principal) || resp[0];
  const [acesso, setAcesso] = useState<any>(null);
  const [f, setF] = useState<any>(() => ({ ...(atual?.perfis || {}), parentesco: atual?.parentesco || "", endereco_igual: !atual?.perfis?.endereco }));
  const [aut, setAut] = useState<any[]>(aluno.autorizados_retirada || []);
  const [msg, setMsg] = useState("");
  const muda = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    if (!f.nome?.trim() || !f.parentesco || !f.telefone) return setMsg("Preencha nome, grau de parentesco e WhatsApp do responsável.");
    if (!f.cpf || !cpfValido(f.cpf)) return setMsg("Informe um CPF válido do responsável.");
    const dados = {
      nome: f.nome.trim(), cpf: f.cpf.replace(/\D/g, ""), rg: f.rg || null, nascimento: f.nascimento || null,
      telefone: f.telefone, email: f.email || null, endereco: f.endereco_igual ? aluno.endereco : f.endereco || null,
    };
    let respId = atual?.responsavel_id;
    if (respId) {
      const { error } = await sb.from("perfis").update(dados).eq("id", respId);
      if (error) return setMsg(error.message);
      await sb.from("responsaveis").update({ parentesco: f.parentesco, principal: true }).eq("responsavel_id", respId).eq("dependente_id", aluno.id);
    } else {
      if (!ctx.equipe) return setMsg("Peça à academia para cadastrar o responsável.");
      respId = crypto.randomUUID();
      const r1 = await sb.from("perfis").insert({ id: respId, ...dados });
      if (r1.error) return setMsg(r1.error.message);
      const r2 = await sb.from("responsaveis").insert({ responsavel_id: respId, dependente_id: aluno.id, parentesco: f.parentesco, principal: true });
      if (r2.error) return setMsg(r2.error.message);
    }
    const r3 = await sb.from("perfis").update({ autorizados_retirada: aut.filter((a) => a.nome?.trim()) }).eq("id", aluno.id);
    setMsg(r3.error ? r3.error.message : "Responsável salvo."); recarregar();
  }

  const tutor = f.parentesco && !["Mãe", "Pai"].includes(f.parentesco);
  return (
    <Etapa n={2} titulo="Responsável legal" ok={ok} aberta={!ok}>
      <p className="text-sm text-suave">Obrigatório para menores de 18 anos.{tutor ? " Como não é mãe nem pai, envie também o documento de guarda ou tutela (etapa Documentos)." : ""}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="rotulo">Nome completo *</label><input className="campo" value={f.nome || ""} onChange={(x) => muda("nome", x.target.value)} /></div>
        <div><label className="rotulo">CPF *</label><input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={mascaraCpf(f.cpf)} onChange={(x) => muda("cpf", x.target.value.replace(/\D/g, ""))} /></div>
        <div><label className="rotulo">RG ou documento oficial</label><input className="campo" value={f.rg || ""} onChange={(x) => muda("rg", x.target.value)} /></div>
        <div><label className="rotulo">Data de nascimento</label><input className="campo" type="date" value={f.nascimento || ""} onChange={(x) => muda("nascimento", x.target.value)} /></div>
        <div>
          <label className="rotulo">Grau de parentesco *</label>
          <select className="campo" value={f.parentesco || ""} onChange={(x) => muda("parentesco", x.target.value)}><option value="">Escolha…</option>{PARENTESCOS.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div><label className="rotulo">WhatsApp *</label><input className="campo" type="tel" placeholder="5524999999999" value={f.telefone || ""} onChange={(x) => muda("telefone", x.target.value)} /></div>
        <div><label className="rotulo">E-mail</label><input className="campo" type="email" value={f.email || ""} onChange={(x) => muda("email", x.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!f.endereco_igual} onChange={(x) => muda("endereco_igual", x.target.checked)} /> Mesmo endereço do aluno</label>
        {!f.endereco_igual && <div className="sm:col-span-2"><label className="rotulo">Endereço do responsável</label><input className="campo" value={f.endereco || ""} onChange={(x) => muda("endereco", x.target.value)} /></div>}
      </div>

      <div className="space-y-2 rounded-xl bg-painel2 p-3">
        <p className="font-semibold">Quem mais pode buscar o aluno</p>
        {aut.map((a, i) => (
          <div key={i} className="grid grid-cols-6 gap-2">
            <input className="campo col-span-6 sm:col-span-3" placeholder="Nome" value={a.nome || ""} onChange={(x) => setAut(aut.map((y, k) => (k === i ? { ...y, nome: x.target.value } : y)))} />
            <input className="campo col-span-3 sm:col-span-1" placeholder="Parentesco" value={a.parentesco || ""} onChange={(x) => setAut(aut.map((y, k) => (k === i ? { ...y, parentesco: x.target.value } : y)))} />
            <input className="campo col-span-3 sm:col-span-2" type="tel" placeholder="Telefone" value={a.telefone || ""} onChange={(x) => setAut(aut.map((y, k) => (k === i ? { ...y, telefone: x.target.value } : y)))} />
          </div>
        ))}
        <button type="button" className="btn-sec text-sm" onClick={() => setAut([...aut, {}])}>+ Pessoa autorizada</button>
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn w-full sm:w-auto" onClick={salvar}>Salvar responsável</button>
        {ctx.equipe && atual?.perfis && !atual.perfis.user_id && atual.perfis.email && (
          <button className="btn-sec w-full sm:w-auto" onClick={async () => {
            const r = await criarLogin(supabaseNavegador(), atual.responsavel_id);
            if (r.erro) return setMsg(r.erro);
            setAcesso(r); recarregar();
          }}>🔑 Criar login do responsável</button>
        )}
      </div>
      {acesso && (
        <div className="rounded-xl border-2 border-ok p-3 text-sm">
          <p className="font-semibold">Login criado ✓</p>
          <p>E-mail: <b>{acesso.email}</b> · Senha provisória: <b className="numero">{acesso.senha}</b></p>
          <a className="btn-sec mt-2 text-sm" target="_blank" href={whatsapp(f.telefone, textoAcesso(ctx.academia.nome, acesso.email, acesso.senha, `${window.location.origin}/login`)) || undefined}>📲 Mandar pelo WhatsApp</a>
        </div>
      )}
    </Etapa>
  );
}

// ---------------------------------------------------------------- 4. Termos e assinatura
function Termos({ aluno, menor, resp, ass, recarregar, n, ok }: any) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const lista = TERMOS.filter((t) => !t.soMenor || menor);
  const ultimo = (id: string) => ass.find((a: any) => a.termo === id && (!menor || id === "ciencia_menor" || a.assinante_papel === "responsavel"));
  const pendentes = lista.filter((t) => t.id !== "ciencia_menor" && !ultimo(t.id)?.aceito);
  const r = (resp.find((x: any) => x.principal) || resp[0])?.perfis;
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [imagem, setImagem] = useState<"sim" | "nao" | "">("");
  const [assinante, setAssinante] = useState({ nome: menor ? r?.nome || "" : aluno.nome || "", cpf: menor ? r?.cpf || "" : aluno.cpf || "" });
  const [png, setPng] = useState<Blob | null>(null);
  const [pngMenor, setPngMenor] = useState<Blob | null>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(blob: Blob, sufixo: string) {
    const caminho = `${ctx.academia.id}/assinaturas/${aluno.id}/${Date.now()}-${sufixo}.png`;
    const up = await sb.storage.from("privado").upload(caminho, blob, { contentType: "image/png" });
    return up.error ? null : "privado:" + caminho;
  }

  async function assinar() {
    const escolhidos = lista.filter((t) => t.id !== "ciencia_menor" && t.id !== "imagem" && marcados[t.id]);
    if (!escolhidos.length && !imagem && !pngMenor) return setMsg("Marque os termos que vai aceitar.");
    if (!assinante.nome.trim() || !cpfValido(assinante.cpf)) return setMsg(`Informe o nome e um CPF válido de quem assina${menor ? " (o responsável)" : ""}.`);
    if (!png) return setMsg("Faça a assinatura no quadro.");
    setSalvando(true); setMsg("");
    const caminho = await enviar(png, "assinatura");
    if (!caminho) { setSalvando(false); return setMsg("Não consegui salvar a assinatura. Tente de novo."); }
    const base = { academia_id: ctx.academia.id, perfil_id: aluno.id, assinante_nome: assinante.nome.trim(), assinante_cpf: assinante.cpf.replace(/\D/g, ""),
      assinante_papel: menor ? "responsavel" : "aluno", assinatura: caminho, navegador: navigator.userAgent.slice(0, 150) };
    const linhas: any[] = escolhidos.map((t) => ({ ...base, termo: t.id, aceito: true, texto_hash: hashTexto(textoDoTermo(t, ctx.academia)) }));
    if (imagem) linhas.push({ ...base, termo: "imagem", aceito: imagem === "sim", texto_hash: hashTexto(textoDoTermo(TERMOS.find((t) => t.id === "imagem")!, ctx.academia)) });
    if (menor && pngMenor) {
      const cm = await enviar(pngMenor, "menor");
      if (cm) linhas.push({ ...base, termo: "ciencia_menor", aceito: true, assinante_nome: aluno.nome, assinante_cpf: aluno.cpf || null, assinante_papel: "menor", assinatura: cm,
        texto_hash: hashTexto(textoDoTermo(TERMOS.find((t) => t.id === "ciencia_menor")!, ctx.academia)) });
    }
    const { error } = await sb.from("assinaturas_termos").insert(linhas);
    setSalvando(false);
    setMsg(error ? error.message : `✅ ${linhas.length} termo(s) registrado(s) em ${new Date().toLocaleString("pt-BR")}.`);
    if (!error) { setMarcados({}); setPng(null); setPngMenor(null); recarregar(); }
  }

  return (
    <Etapa n={n} titulo="Autorizações e termos" ok={ok} aberta={!ok}>
      <p className="text-sm text-suave">{menor ? "Assinados pelo responsável legal." : "Assinados pelo próprio aluno."} Cada assinatura fica registrada com data, hora e o texto aceito.</p>
      <ul className="space-y-2">
        {lista.map((t) => {
          const u = ultimo(t.id);
          return (
            <li key={t.id} className="rounded-xl bg-painel2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex flex-1 items-start gap-2">
                  {t.id !== "imagem" && t.id !== "ciencia_menor" && <input type="checkbox" className="mt-1" checked={!!marcados[t.id]} onChange={(x) => setMarcados({ ...marcados, [t.id]: x.target.checked })} />}
                  <span className="font-semibold">{t.titulo}{t.obrigatorio && t.id !== "ciencia_menor" ? " *" : ""}</span>
                </label>
                <span className={`text-xs ${u?.aceito ? "text-ok" : u ? "text-alerta" : "text-suave"}`}>
                  {u ? `${u.aceito ? "✅ aceito" : "❌ recusado"} por ${u.assinante_nome} em ${dataHoraBR(u.assinado_em)}` : "pendente"}
                </span>
              </div>
              <details className="mt-1"><summary className="cursor-pointer text-xs text-suave">ler o texto</summary><p className="mt-1 whitespace-pre-line text-sm">{textoDoTermo(t, ctx.academia)}</p></details>
              {t.id === "imagem" && (
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {(["sim", "nao"] as const).map((v) => (
                    <button key={v} type="button" className="chip" onClick={() => setImagem(imagem === v ? "" : v)}
                      style={imagem === v ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{v === "sim" ? "Autorizo" : "Não autorizo"}</button>
                  ))}
                </div>
              )}
              {t.id === "ciencia_menor" && (
                <div className="mt-2"><p className="mb-1 text-xs text-suave">Assinatura do aluno (opcional):</p><AssinaturaPad onChange={setPngMenor} /></div>
              )}
            </li>
          );
        })}
      </ul>
      {pendentes.length > 0 && <button type="button" className="btn-sec text-sm" onClick={() => setMarcados(Object.fromEntries(pendentes.map((t) => [t.id, true])))}>Marcar todos os pendentes</button>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="rotulo">Quem assina {menor ? "(responsável)" : ""}</label><input className="campo" value={assinante.nome} onChange={(x) => setAssinante({ ...assinante, nome: x.target.value })} /></div>
        <div><label className="rotulo">CPF de quem assina</label><input className="campo" inputMode="numeric" value={mascaraCpf(assinante.cpf)} onChange={(x) => setAssinante({ ...assinante, cpf: x.target.value.replace(/\D/g, "") })} /></div>
      </div>
      <AssinaturaPad onChange={setPng} />
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <button className="btn w-full sm:w-auto" disabled={salvando} onClick={assinar}>{salvando ? "Registrando…" : "✍️ Assinar os termos marcados"}</button>
    </Etapa>
  );
}

// ---------------------------------------------------------------- 5. Documentos
function Documentos({ aluno, menor, resp, docs, recarregar, n, ok }: any) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [tipo, setTipo] = useState(menor ? "doc_responsavel" : "atestado");
  const [validade, setValidade] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");
  const par = ((resp.find((x: any) => x.principal) || resp[0])?.parentesco || "").toLowerCase();
  const exigidos = menor ? ["doc_responsavel", "doc_aluno", ...(par && !["mãe", "mae", "pai"].includes(par) ? ["guarda"] : [])] : [];

  async function enviar(arq?: File) {
    if (!arq) return;
    if (arq.size > 8 * 1024 * 1024) return setMsg("Arquivo muito grande (máximo 8 MB).");
    setEnviando(true); setMsg("");
    const ext = arq.type === "application/pdf" ? "pdf" : "jpg";
    const caminho = `${ctx.academia.id}/documentos/${aluno.id}/${Date.now()}-${tipo}.${ext}`;
    const up = await sb.storage.from("privado").upload(caminho, ext === "pdf" ? arq : await comprimir(arq, 1800, 0.8));
    if (up.error) { setEnviando(false); return setMsg("Não foi possível enviar: " + up.error.message); }
    const { error } = await sb.from("documentos").insert({ academia_id: ctx.academia.id, perfil_id: aluno.id, tipo, nome: arq.name, arquivo: "privado:" + caminho, validade: validade || null });
    setValidade("");
    setEnviando(false); setMsg(error ? error.message : "Documento enviado."); recarregar();
  }
  async function apagar(d: any) {
    if (!confirm("Apagar este documento?")) return;
    await sb.from("documentos").delete().eq("id", d.id);
    await sb.storage.from("privado").remove([d.arquivo.replace(/^privado:/, "")]);
    recarregar();
  }

  return (
    <Etapa n={n} titulo="Documentos" ok={ok} aberta={!ok && menor}>
      {exigidos.length > 0 && (
        <ul className="space-y-1 text-sm">
          {exigidos.map((t) => <li key={t}>{docs.some((d: any) => d.tipo === t) ? "✅" : "⬜"} {TIPOS_DOC[t]} *</li>)}
        </ul>
      )}
      <p className="text-xs text-suave">🔒 Os documentos só podem ser abertos pelo aluno, pelo responsável e pelos professores/admin dele. Foto ou PDF, até 8 MB. Se o documento vence (ex.: atestado), coloque a validade: o app avisa 30 dias antes.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="date" className="campo sm:w-auto" title="Validade (opcional): o app avisa quando vencer" value={validade} onChange={(x) => setValidade(x.target.value)} />
        <select className="campo sm:w-auto" value={tipo} onChange={(x) => setTipo(x.target.value)}>{Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className={`btn-sec cursor-pointer text-center ${enviando ? "opacity-50" : ""}`}>📎 {enviando ? "Enviando…" : "Enviar arquivo"}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={enviando} onChange={(x) => enviar(x.target.files?.[0])} />
        </label>
      </div>
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      <ul className="divide-y divide-linha">
        {docs.map((d: any) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1"><b>{TIPOS_DOC[d.tipo] || d.tipo}</b>
              {d.validade && <span className={`ml-2 rounded-full px-2 text-xs font-semibold ${d.validade < new Date().toISOString().slice(0, 10) ? "bg-erro text-white" : "bg-painel2"}`}>{d.validade < new Date().toISOString().slice(0, 10) ? "⛔ venceu" : "vale até"} {dataBR(d.validade)}</span>}<span className="block truncate text-xs text-suave">{d.nome} · {dataBR(d.criado_em)}</span></span>
            <button className="underline" onClick={() => abrirAnexo(sb, d.arquivo)}>abrir</button>
            {ctx.equipe && <button className="text-suave underline" onClick={() => apagar(d)}>apagar</button>}
          </li>
        ))}
        {!docs.length && <p className="py-2 text-sm text-suave">Nenhum documento enviado.</p>}
      </ul>
    </Etapa>
  );
}

// ---------------------------------------------------------------- PDF da ficha completa
function PdfFicha({ dados, recarregar }: { dados: any; recarregar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [gerando, setGerando] = useState("");
  const salvos = dados.documentos.filter((d: any) => d.tipo === "ficha_pdf");

  async function gerar(salvar: boolean) {
    setGerando(salvar ? "Gerando e salvando…" : "Gerando…");
    try {
      const [{ data: saude }, { data: emerg }] = await Promise.all([
        sb.from("fichas_saude").select("*").eq("perfil_id", dados.perfil.id).maybeSingle(),
        sb.from("perfis").select("contato_emergencia_nome, contato_emergencia_tel").eq("id", dados.perfil.id).maybeSingle(),
      ]);
      const { gerarPdfFicha } = await import("@/lib/pdfFicha");
      const blob = await gerarPdfFicha(sb, { ...dados, academia: ctx.academia, saude, emergencia: emerg });
      const nome = `ficha-${(dados.perfil.nome || "aluno").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (salvar) {
        const caminho = `${ctx.academia.id}/documentos/${dados.perfil.id}/${Date.now()}-ficha.pdf`;
        const up = await sb.storage.from("privado").upload(caminho, blob, { contentType: "application/pdf" });
        if (up.error) throw new Error(up.error.message);
        await sb.from("documentos").insert({ academia_id: ctx.academia.id, perfil_id: dados.perfil.id, tipo: "ficha_pdf", nome, arquivo: "privado:" + caminho });
        recarregar();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = nome; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setGerando("");
    } catch (e: any) { setGerando("Não deu para gerar: " + (e?.message || "erro")); }
  }

  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4">
      <p className="text-lg font-bold">📄 Ficha completa em PDF</p>
      <p className="text-sm text-suave">Dados, responsável, saúde, termos com as assinaturas, documentos e ocorrências — para imprimir ou guardar.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="btn" disabled={!!gerando} onClick={() => gerar(true)}>💾 Gerar e guardar na ficha</button>
        <button className="btn-sec" disabled={!!gerando} onClick={() => gerar(false)}>⬇️ Só baixar</button>
      </div>
      {gerando && <p className="text-sm text-suave">{gerando}</p>}
      {salvos.length > 0 && <p className="text-xs text-suave">Última guardada em {dataHoraBR(salvos[0].criado_em)} (fica em Documentos).</p>}
    </section>
  );
}

// ---------------------------------------------------------------- 6. Ocorrências
function Ocorrencias({ membroId, lista, recarregar, n }: any) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const TIPOS: Record<string, string> = { acidente: "🩹 Acidente", lesao: "🦴 Lesão", mal_estar: "🤒 Mal-estar", disciplinar: "⚠️ Disciplinar", outro: "📝 Outro" };

  async function salvar() {
    if (!f?.descricao?.trim()) return setMsg("Descreva o que aconteceu.");
    const { error } = await sb.from("ocorrencias").insert({ academia_id: ctx.academia.id, membro_id: membroId, data: f.data || new Date().toISOString().slice(0, 10),
      tipo: f.tipo || "acidente", descricao: f.descricao.trim(), providencias: f.providencias || null, responsavel_avisado: !!f.avisado, registrado_por: ctx.membroId });
    setMsg(error ? error.message : ""); if (!error) { setF(null); recarregar(); }
  }

  return (
    <Etapa n={n} titulo="Ocorrências e acidentes">
      <ul className="space-y-2">
        {lista.map((o: any) => (
          <li key={o.id} className="rounded-xl bg-painel2 p-3 text-sm">
            <p className="font-semibold">{TIPOS[o.tipo] || o.tipo} · {dataBR(o.data)}{o.responsavel_avisado ? " · responsável avisado" : ""}</p>
            <p>{o.descricao}</p>
            {o.providencias && <p className="text-suave">Providências: {o.providencias}</p>}
          </li>
        ))}
        {!lista.length && <p className="text-sm text-suave">Nenhuma ocorrência registrada.</p>}
      </ul>
      {ctx.equipe && (f ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="campo" value={f.tipo || "acidente"} onChange={(x) => setF({ ...f, tipo: x.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="campo" type="date" value={f.data || new Date().toISOString().slice(0, 10)} onChange={(x) => setF({ ...f, data: x.target.value })} />
          <textarea className="campo min-h-16 sm:col-span-2" placeholder="O que aconteceu" value={f.descricao || ""} onChange={(x) => setF({ ...f, descricao: x.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Providências tomadas (gelo, atendimento, liberado…)" value={f.providencias || ""} onChange={(x) => setF({ ...f, providencias: x.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!f.avisado} onChange={(x) => setF({ ...f, avisado: x.target.checked })} /> Responsável/família avisada</label>
          {msg && <p className="text-sm text-alerta sm:col-span-2">{msg}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Registrar</button><button className="btn-sec" onClick={() => setF(null)}>Cancelar</button></div>
        </div>
      ) : <button className="btn-sec text-sm" onClick={() => setF({})}>+ Registrar ocorrência</button>)}
    </Etapa>
  );
}
