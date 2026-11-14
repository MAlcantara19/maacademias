"use client";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { minhasTurmas } from "@/lib/turmas";
import { hojeISO } from "@/lib/util";
import { lerFicha, modeloFicha } from "@/lib/fichaWhats";

// Cadastro de aluno: só o nome é obrigatório. O que faltar vira aviso na ficha.
// Dá para colar a ficha que a pessoa respondeu no WhatsApp e já criar o login com senha provisória.
export function NovoAluno({ onFechar }: { onFechar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mods, setMods] = useState<any[]>([]);
  const [f, setF] = useState<any>({ sexo: "M", turmas: [] as string[], grau: 0 });
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [colar, setColar] = useState<string | null>(null);
  const [pronto, setPronto] = useState<any>(null);

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, modalidade_id").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome")
      .then(({ data }) => setTurmas(minhasTurmas(ctx, data || [])));
    sb.from("modalidades").select("id, nome, graduacoes, graus_max").eq("academia_id", ctx.academia.id).order("ordem").then(({ data }) => setMods(data || []));
  }, []); // eslint-disable-line

  const muda = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  // modalidade da graduação: a da primeira turma escolhida (ou a primeira da academia)
  const mod = useMemo(() => {
    const t = turmas.find((x) => f.turmas.includes(x.id));
    return mods.find((m) => m.id === (t?.modalidade_id || f.modalidade_id)) || mods[0];
  }, [turmas, mods, f.turmas, f.modalidade_id]);
  const faixas: string[] = mod?.graduacoes || [];
  const ehPreta = f.faixa && faixas.length && f.faixa === faixas[faixas.length - 1];
  const opcoesGrau = ehPreta ? Array.from({ length: 10 }, (_, i) => i + 1) : Array.from({ length: (mod?.graus_max ?? 4) + 1 }, (_, i) => i);

  function preencher() {
    const d = lerFicha(colar || "");
    if (!Object.keys(d).length) return setMsg("Não achei os campos. A mensagem precisa ter linhas como “Nome completo: Fulano”.");
    const faixa = d.faixa_texto ? faixas.find((x) => d.faixa_texto.toLowerCase().includes(x.toLowerCase())) : undefined;
    setF((x: any) => ({ ...x, ...d, faixa: faixa || x.faixa }));
    setColar(null);
    setMsg("Ficha preenchida. Confira os dados e toque em Cadastrar.");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome?.trim()) return setMsg("O nome é obrigatório.");
    if (!ctx.admin && !f.turmas.length) return setMsg("Escolha pelo menos uma turma sua.");
    if (f.senha && f.senha.length < 6) return setMsg("A senha provisória precisa ter pelo menos 6 caracteres.");
    if (f.senha && !f.email) return setMsg("Para criar o login com senha, preencha o e-mail.");
    setSalvando(true); setMsg("");
    const perfilId = crypto.randomUUID();
    const membroId = crypto.randomUUID();
    const r1 = await sb.from("perfis").insert({
      id: perfilId, nome: f.nome.trim(), apelido: f.apelido || null, email: f.email || null, telefone: f.telefone || null,
      nascimento: f.nascimento || null, sexo: f.sexo, endereco: f.endereco || null,
      contato_emergencia_nome: f.responsavel || null, contato_emergencia_tel: f.responsavel_tel || null,
    });
    if (r1.error) { setSalvando(false); return setMsg("Erro ao salvar: " + r1.error.message); }
    const r2 = await sb.from("membros").insert({
      id: membroId, academia_id: ctx.academia.id, perfil_id: perfilId, papel: "aluno",
      observacoes: f.saude ? `Saúde (informado no cadastro): ${f.saude}` : null,
    });
    if (r2.error) { setSalvando(false); return setMsg("Erro ao vincular: " + r2.error.message); }
    if (f.turmas.length) await sb.from("matriculas").insert(f.turmas.map((t: string) => ({ turma_id: t, membro_id: membroId })));
    // graduação atual (quem já chega graduado)
    if (f.faixa && mod) {
      await sb.from("graduacoes").insert({ membro_id: membroId, modalidade_id: mod.id, faixa: f.faixa, grau: Number(f.grau || 0), data: hojeISO(), observacao: "Graduação informada no cadastro", registrado_por: ctx.membroId });
    }
    // login com senha provisória (a pessoa troca no primeiro acesso)
    let login: any = null;
    if (f.email && f.senha) {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch("/api/criar-login", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ perfil_id: perfilId, senha: f.senha }) });
      login = await r.json().catch(() => ({ erro: "Não foi possível criar o login." }));
    }
    setSalvando(false);
    const faltam = [!f.nascimento && "nascimento", !f.telefone && "WhatsApp", !f.email && "e-mail"].filter(Boolean);
    setPronto({ nome: f.nome, email: f.email, senha: login?.senha, erroLogin: login?.erro, telefone: f.telefone, faltam });
  }

  // tela final com a mensagem pronta para mandar o acesso
  if (pronto) {
    const link = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
    const texto = pronto.senha
      ? `Olá, ${pronto.nome.split(" ")[0]}! Seu acesso ao app da ${ctx.academia.nome}:\n\n🔗 ${link}\n📧 ${pronto.email}\n🔑 Senha provisória: ${pronto.senha}\n\nNo primeiro acesso o app pede para você trocar a senha e conferir seus dados.`
      : "";
    return (
      <div className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
        <h2 className="text-2xl font-bold">✅ {pronto.nome} cadastrado(a)</h2>
        {pronto.faltam.length > 0 && <p className="text-sm text-alerta">Ficou faltando: {pronto.faltam.join(", ")}. Aparece como “cadastro incompleto” na ficha.</p>}
        {pronto.erroLogin && <p className="text-sm text-alerta">Login não criado: {pronto.erroLogin}</p>}
        {pronto.senha && (
          <>
            <pre className="whitespace-pre-wrap rounded-xl bg-fundo p-3 text-sm">{texto}</pre>
            <div className="flex flex-wrap gap-2">
              <a className="btn" target="_blank" href={`https://wa.me/${(pronto.telefone || "").replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`}>Mandar no WhatsApp</a>
              <button className="btn-sec" onClick={() => navigator.clipboard.writeText(texto)}>Copiar</button>
            </div>
          </>
        )}
        <div className="flex gap-2"><button className="btn-sec" onClick={() => { setPronto(null); setF({ sexo: "M", turmas: [], grau: 0 }); }}>Cadastrar outro</button><button className="btn-sec" onClick={onFechar}>Fechar</button></div>
      </div>
    );
  }

  const modelo = modeloFicha(ctx.academia.nome);
  return (
    <form onSubmit={salvar} className="grid gap-3 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        <h2 className="text-2xl font-bold">Novo aluno</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn-sec text-sm" target="_blank" href={`https://wa.me/${(f.telefone || "").replace(/\D/g, "")}?text=${encodeURIComponent(modelo)}`}>📤 Mandar ficha</a>
          <button type="button" className="btn-sec text-sm" onClick={() => setColar(colar === null ? "" : null)}>📋 Colar ficha preenchida</button>
        </div>
      </div>
      {colar !== null && (
        <div className="space-y-2 rounded-xl bg-painel2 p-3 sm:col-span-2">
          <p className="text-sm text-suave">Cole aqui a mensagem que a pessoa devolveu no WhatsApp (o modelo que você mandou, preenchido).</p>
          <textarea className="campo min-h-36 text-sm" placeholder={"Nome completo: João da Silva\nData de nascimento: 12/03/2012\nWhatsApp: (24) 99999-9999"} value={colar} onChange={(e) => setColar(e.target.value)} />
          <button type="button" className="btn" onClick={preencher}>Preencher o cadastro</button>
        </div>
      )}
      <div><label className="rotulo">Nome completo *</label><input className="campo" value={f.nome || ""} onChange={(e) => muda("nome", e.target.value)} /></div>
      <div><label className="rotulo">Apelido</label><input className="campo" value={f.apelido || ""} onChange={(e) => muda("apelido", e.target.value)} /></div>
      <div><label className="rotulo">E-mail (login)</label><input type="email" className="campo" value={f.email || ""} onChange={(e) => muda("email", e.target.value)} /></div>
      <div><label className="rotulo">WhatsApp</label><input type="tel" className="campo" placeholder="5524999999999" value={f.telefone || ""} onChange={(e) => muda("telefone", e.target.value)} /></div>
      <div><label className="rotulo">Nascimento</label><input type="date" className="campo" value={f.nascimento || ""} onChange={(e) => muda("nascimento", e.target.value)} /></div>
      <div>
        <label className="rotulo">Sexo (para as categorias)</label>
        <select className="campo" value={f.sexo} onChange={(e) => muda("sexo", e.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></select>
      </div>
      <div className="sm:col-span-2"><label className="rotulo">Endereço</label><input className="campo" value={f.endereco || ""} onChange={(e) => muda("endereco", e.target.value)} /></div>
      {(f.responsavel || f.responsavel_tel) && (
        <p className="text-sm text-suave sm:col-span-2">Responsável: {f.responsavel} {f.responsavel_tel} (fica como contato de emergência)</p>
      )}
      <div className="sm:col-span-2">
        <span className="rotulo">Turmas</span>
        <div className="flex flex-wrap gap-2">
          {turmas.map((t) => {
            const on = f.turmas.includes(t.id);
            return (
              <button type="button" key={t.id} className="chip" style={on ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                onClick={() => muda("turmas", on ? f.turmas.filter((x: string) => x !== t.id) : [...f.turmas, t.id])}>
                {on ? "✓ " : ""}{t.nome}
              </button>
            );
          })}
        </div>
      </div>
      {mod && faixas.length > 0 && (
        <>
          <div>
            <label className="rotulo">Faixa atual ({mod.nome})</label>
            <select className="campo" value={f.faixa || ""} onChange={(e) => { muda("faixa", e.target.value); muda("grau", 0); }}>
              <option value="">Iniciante / não informar</option>
              {faixas.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          {f.faixa && (
            <div>
              <label className="rotulo">{ehPreta ? "Dan" : "Graus"}</label>
              <select className="campo" value={f.grau} onChange={(e) => muda("grau", Number(e.target.value))}>
                {opcoesGrau.map((g) => <option key={g} value={g}>{ehPreta ? `${g}º dan` : g === 0 ? "Sem grau" : `${g} grau${g > 1 ? "s" : ""}`}</option>)}
              </select>
            </div>
          )}
        </>
      )}
      <details className="rounded-xl bg-painel2 p-3 sm:col-span-2">
        <summary className="cursor-pointer text-sm font-semibold">🔑 Criar o login agora (opcional)</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><label className="rotulo">Senha provisória</label><input className="campo" placeholder="Ex.: joao123 (mín. 6)" value={f.senha || ""} onChange={(e) => muda("senha", e.target.value)} /></div>
          <p className="text-xs text-suave sm:self-end">Precisa do e-mail. No primeiro acesso o app pede para trocar a senha e conferir os dados. Você recebe a mensagem pronta para mandar no WhatsApp.</p>
        </div>
      </details>
      <p className="text-xs text-suave sm:col-span-2">* Só o nome é obrigatório. O que faltar (nascimento, WhatsApp, e-mail) fica como “cadastro incompleto” na ficha para completar depois.</p>
      {msg && <p className="text-sm text-alerta sm:col-span-2">{msg}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn" disabled={salvando}>{salvando ? "Salvando..." : "Cadastrar"}</button>
        <button type="button" className="btn-sec" onClick={onFechar}>Cancelar</button>
      </div>
    </form>
  );
}
