"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { comprimir } from "@/lib/imagem";
import { AssinaturaPad } from "@/components/AssinaturaPad";
import { CamposSaude } from "@/components/FichaSaude";
import { TERMOS, cpfValido, hashTexto, idade as calcIdade, mascaraCpf, textoDoTermo } from "@/lib/termosCadastro";

// PRÉ-MATRÍCULA: a própria pessoa (ou o responsável) preenche a ficha completa
// pelo link da academia. A equipe só confere e aprova.
const PARENTESCOS = ["Mãe", "Pai", "Avó", "Avô", "Tia", "Tio", "Irmã", "Irmão", "Tutor(a) legal", "Guardião(ã)", "Outro"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const TIPOS_DOC: Record<string, string> = {
  doc_responsavel: "Documento do responsável (RG/CNH)", doc_aluno: "Certidão de nascimento ou documento do aluno",
  guarda: "Termo de guarda ou tutela", atestado: "Atestado médico", outro: "Outro documento",
};

function Etapa({ n, titulo, ok, aberta, children }: { n: number; titulo: string; ok: boolean; aberta?: boolean; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-painel" open={aberta}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="numero flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: ok ? "var(--color-ok)" : "var(--cor)" }}>{ok ? "✓" : n}</span>
        <span className="flex-1 text-lg font-bold leading-tight">{titulo}</span>
        <span className="text-suave transition group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="grid gap-3 border-t border-linha p-4">{children}</div>
    </details>
  );
}

export function FormCadastro({ academia, slug, modalidades, turmas, indicadoPor }: {
  academia: { id: string; nome: string; termos_cadastro?: any }; slug: string; modalidades: any[]; turmas: any[]; indicadoPor?: string | null;
}) {
  const sb = supabaseNavegador();
  const [f, setF] = useState<any>({ sexo: "M" });
  const [end, setEnd] = useState<any>({});
  const [r, setR] = useState<any>({ endereco_igual: true });
  const [aut, setAut] = useState<any[]>([]);
  const [saude, setSaude] = useState<any>({});
  const [emerg, setEmerg] = useState<any>({});
  const [aceites, setAceites] = useState<Record<string, boolean>>({});
  const [imagem, setImagem] = useState<"sim" | "nao" | "">("");
  const [png, setPng] = useState<Blob | null>(null);
  const [pngMenor, setPngMenor] = useState<Blob | null>(null);
  const [docs, setDocs] = useState<{ tipo: string; arq: File }[]>([]);
  const [tipoDoc, setTipoDoc] = useState("doc_aluno");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<boolean | string>(false);
  const [erro, setErro] = useState<string[]>([]);
  const muda = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const mudaR = (k: string, v: any) => setR((x: any) => ({ ...x, [k]: v }));
  const anos = calcIdade(f.nascimento);
  const menor = anos !== null && anos < 18;
  const termos = TERMOS.filter((t) => !t.soMenor || menor);
  const obrig = termos.filter((t) => t.obrigatorio && t.id !== "ciencia_menor" && t.id !== "imagem");

  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const x = await fetch(`https://brasilapi.com.br/api/cep/v1/${d}`);
      if (!x.ok) return;
      const j = await x.json();
      setEnd((e: any) => ({ ...e, cep: d, rua: j.street || e.rua, bairro: j.neighborhood || e.bairro, cidade: j.city || e.cidade, uf: j.state || e.uf }));
    } catch { /* preenche à mão */ }
  }

  // o que falta, por etapa (as mesmas regras do cadastro completo)
  const faltaAluno = [
    !f.nome?.trim() && "nome", !f.nascimento && "nascimento", !cpfValido(f.cpf) && "CPF válido do aluno",
    !menor && !f.email?.trim() && "e-mail", !menor && !f.telefone && "WhatsApp",
    !end.rua && "rua", !end.cidade && "cidade",
  ].filter(Boolean) as string[];
  const faltaResp = menor ? [
    !r.nome?.trim() && "nome do responsável", !cpfValido(r.cpf) && "CPF válido do responsável", !r.parentesco && "parentesco",
    !r.telefone && "WhatsApp do responsável", !r.email?.trim() && "e-mail do responsável",
  ].filter(Boolean) as string[] : [];
  const faltaSaude = [!emerg.contato_emergencia_tel && "telefone de emergência"].filter(Boolean) as string[];
  const assinanteNome = menor ? r.nome : f.nome;
  const assinanteCpf = menor ? r.cpf : f.cpf;
  const faltaTermos = [
    ...obrig.filter((t) => !aceites[t.id]).map((t) => `aceitar “${t.titulo}”`),
    !imagem && "responder sobre o uso de imagem (sim ou não)",
    !png && "assinatura",
  ].filter(Boolean) as string[];
  const tutor = menor && r.parentesco && !["Mãe", "Pai"].includes(r.parentesco);
  const docsSugeridos = menor ? ["doc_responsavel", "doc_aluno", ...(tutor ? ["guarda"] : [])] : [];

  async function subir(sid: string, blob: Blob, nome: string) {
    const caminho = `${academia.id}/pre/${sid}/${nome}`;
    const up = await sb.storage.from("privado").upload(caminho, blob, { contentType: blob.type || undefined });
    if (up.error) throw new Error(up.error.message);
    return "privado:" + caminho;
  }

  async function enviar() {
    const falta = [...faltaAluno, ...faltaResp, ...faltaSaude, ...faltaTermos];
    setErro(falta);
    if (falta.length) { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); return; }
    setEnviando(true);
    const sid = crypto.randomUUID();
    try {
      const assinatura = await subir(sid, png!, `assinatura-${Date.now()}.png`);
      const assinaturaMenor = menor && pngMenor ? await subir(sid, pngMenor, `assinatura-menor-${Date.now()}.png`) : null;
      const documentos = [];
      for (const [i, d] of docs.entries()) {
        const pdf = d.arq.type === "application/pdf";
        const arquivo = await subir(sid, pdf ? d.arq : await comprimir(d.arq, 1800, 0.8), `${i}-${d.tipo}.${pdf ? "pdf" : "jpg"}`);
        documentos.push({ tipo: d.tipo, nome: d.arq.name, arquivo });
      }
      const base = { assinante_nome: assinanteNome.trim(), assinante_cpf: assinanteCpf.replace(/\D/g, ""), papel: menor ? "responsavel" : "aluno", assinatura };
      const lista = termos.filter((t) => t.id !== "ciencia_menor" && t.id !== "imagem" && aceites[t.id])
        .map((t) => ({ ...base, termo: t.id, aceito: true, texto_hash: hashTexto(textoDoTermo(t, academia)) }));
      lista.push({ ...base, termo: "imagem", aceito: imagem === "sim", texto_hash: hashTexto(textoDoTermo(TERMOS.find((t) => t.id === "imagem")!, academia)) });
      if (assinaturaMenor) lista.push({ assinante_nome: f.nome.trim(), assinante_cpf: (f.cpf || "").replace(/\D/g, ""), papel: "menor", assinatura: assinaturaMenor,
        termo: "ciencia_menor", aceito: true, texto_hash: hashTexto(textoDoTermo(TERMOS.find((t) => t.id === "ciencia_menor")!, academia)) });
      const endereco = [end.rua && `${end.rua}${end.numero ? `, ${end.numero}` : ""}`, end.complemento, end.bairro, end.cidade && `${end.cidade}${end.uf ? `/${end.uf}` : ""}`, end.cep && `CEP ${end.cep}`].filter(Boolean).join(" - ");
      const dados = {
        cpf: f.cpf.replace(/\D/g, ""), rg: f.rg || null, telefone: f.telefone || null, endereco, endereco_detalhe: end, experiencia: f.experiencia || null,
        responsavel: menor ? { nome: r.nome, cpf: r.cpf.replace(/\D/g, ""), rg: r.rg || null, nascimento: r.nascimento || null, parentesco: r.parentesco, endereco: r.endereco_igual ? endereco : r.endereco || null } : null,
        autorizados: menor ? aut.filter((a) => a.nome?.trim()) : [],
        saude, emergencia_nome: emerg.contato_emergencia_nome || null, emergencia_tel: emerg.contato_emergencia_tel,
        termos: lista, documentos, navegador: navigator.userAgent.slice(0, 150),
      };
      const { error } = await sb.from("solicitacoes_cadastro").insert({
        id: sid, academia_id: academia.id, nome: f.nome.trim(), email: menor ? null : f.email.trim().toLowerCase(), telefone: menor ? null : f.telefone,
        nascimento: f.nascimento, sexo: f.sexo, modalidade_id: f.modalidade_id || null, turma_id: f.turma_id || null,
        responsavel_nome: menor ? r.nome.trim() : null, responsavel_email: menor ? r.email.trim().toLowerCase() : null,
        responsavel_tel: menor ? r.telefone : null, aceite_imagem: imagem === "sim", mensagem: f.mensagem || null,
        indicado_por: indicadoPor || null, dados,
      });
      if (error) throw new Error(error.message);
      const turma = turmas.find((t) => t.id === f.turma_id);
      if (turma?.lotada) {
        await sb.from("lista_espera").insert({
          academia_id: academia.id, turma_id: turma.id, nome: f.nome,
          telefone: (menor ? r.telefone : f.telefone) || null, email: (menor ? r.email : f.email) || null,
        });
      }
      setEnviado(turma?.lotada ? "fila" : true);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setErro([`Não foi possível enviar (${e?.message || "erro"}). Confira a internet e tente de novo.`]);
    }
    setEnviando(false);
  }

  if (enviado) {
    return (
      <div className="space-y-3 rounded-2xl bg-painel p-6">
        <p className="text-3xl font-bold">Pré-matrícula enviada! 🥋</p>
        {enviado === "fila" && <p className="text-alerta">A turma escolhida está lotada: você entrou na lista de espera e será chamado quando abrir vaga.</p>}
        <p className="text-suave">A academia vai conferir e aprovar. Depois, entre em <b>Primeiro acesso</b> com {menor ? "o e-mail do responsável" : "o seu e-mail"} para criar a senha e acompanhar tudo pelo app.</p>
        <Link href="/login" className="btn">Ir para o login</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-suave">Preencha cada parte (toque para abrir). Os itens com * são obrigatórios. Seus dados de saúde e documentos ficam protegidos: só a equipe da academia vê.</p>

      <Etapa n={1} titulo="Dados do aluno" ok={!faltaAluno.length} aberta>
        <div><label className="rotulo">Nome completo do aluno *</label><input className="campo" value={f.nome || ""} onChange={(e) => muda("nome", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="rotulo">Nascimento *</label><input type="date" className="campo" value={f.nascimento || ""} onChange={(e) => muda("nascimento", e.target.value)} /></div>
          <div><label className="rotulo">Sexo</label>
            <select className="campo" value={f.sexo} onChange={(e) => muda("sexo", e.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></select>
          </div>
          <div><label className="rotulo">CPF do aluno *</label><input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={mascaraCpf(f.cpf)} onChange={(e) => muda("cpf", e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className="rotulo">RG (opcional)</label><input className="campo" value={f.rg || ""} onChange={(e) => muda("rg", e.target.value)} /></div>
        </div>
        {f.cpf?.length === 11 && !cpfValido(f.cpf) && <p className="text-xs text-erro">CPF inválido</p>}
        {menor && <p className="rounded-xl bg-painel2 p-2 text-sm">👨‍👧 Menor de 18 anos: o responsável preenche a etapa 2 e assina os termos.</p>}
        {!menor && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo">E-mail (será seu login) *</label><input type="email" className="campo" value={f.email || ""} onChange={(e) => muda("email", e.target.value)} /></div>
            <div><label className="rotulo">WhatsApp *</label><input type="tel" className="campo" placeholder="(24) 99999-9999" value={f.telefone || ""} onChange={(e) => muda("telefone", e.target.value)} /></div>
          </div>
        )}
        <p className="rotulo mb-0">Endereço *</p>
        <div className="grid grid-cols-6 gap-2">
          <input className="campo col-span-3 sm:col-span-2" inputMode="numeric" placeholder="CEP" value={end.cep || ""} onChange={(e) => { setEnd({ ...end, cep: e.target.value }); buscarCep(e.target.value); }} />
          <input className="campo col-span-6 sm:col-span-4" placeholder="Rua" value={end.rua || ""} onChange={(e) => setEnd({ ...end, rua: e.target.value })} />
          <input className="campo col-span-2" placeholder="Número" value={end.numero || ""} onChange={(e) => setEnd({ ...end, numero: e.target.value })} />
          <input className="campo col-span-4" placeholder="Complemento" value={end.complemento || ""} onChange={(e) => setEnd({ ...end, complemento: e.target.value })} />
          <input className="campo col-span-6 sm:col-span-2" placeholder="Bairro" value={end.bairro || ""} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} />
          <input className="campo col-span-4 sm:col-span-3" placeholder="Cidade" value={end.cidade || ""} onChange={(e) => setEnd({ ...end, cidade: e.target.value })} />
          <select className="campo col-span-2 sm:col-span-1" aria-label="UF" value={end.uf || ""} onChange={(e) => setEnd({ ...end, uf: e.target.value })}><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="rotulo">Modalidade</label>
            <select className="campo" value={f.modalidade_id || ""} onChange={(e) => { muda("modalidade_id", e.target.value); muda("turma_id", ""); }}>
              <option value="">Escolha…</option>
              {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          {f.modalidade_id && (
            <div><label className="rotulo">Turma</label>
              <select className="campo" value={f.turma_id || ""} onChange={(e) => muda("turma_id", e.target.value)}>
                <option value="">Ainda não sei</option>
                {turmas.filter((t) => t.modalidade_id === f.modalidade_id).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.lotada ? " — lotada (lista de espera)" : ""}</option>)}
              </select>
            </div>
          )}
        </div>
        <div><label className="rotulo">Experiência anterior em lutas (opcional)</label><input className="campo" placeholder="Ex.: treinei judô 2 anos, faixa amarela" value={f.experiencia || ""} onChange={(e) => muda("experiencia", e.target.value)} /></div>
        <div><label className="rotulo">Observação para a academia (opcional)</label><input className="campo" value={f.mensagem || ""} onChange={(e) => muda("mensagem", e.target.value)} /></div>
      </Etapa>

      {menor && (
        <Etapa n={2} titulo="Responsável legal" ok={!faltaResp.length}>
          <div><label className="rotulo">Nome completo *</label><input className="campo" value={r.nome || ""} onChange={(e) => mudaR("nome", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo">CPF *</label><input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={mascaraCpf(r.cpf)} onChange={(e) => mudaR("cpf", e.target.value.replace(/\D/g, ""))} /></div>
            <div><label className="rotulo">RG ou documento oficial</label><input className="campo" value={r.rg || ""} onChange={(e) => mudaR("rg", e.target.value)} /></div>
            <div><label className="rotulo">Nascimento</label><input type="date" className="campo" value={r.nascimento || ""} onChange={(e) => mudaR("nascimento", e.target.value)} /></div>
            <div><label className="rotulo">Parentesco *</label>
              <select className="campo" value={r.parentesco || ""} onChange={(e) => mudaR("parentesco", e.target.value)}><option value="">Escolha…</option>{PARENTESCOS.map((x) => <option key={x}>{x}</option>)}</select>
            </div>
            <div><label className="rotulo">WhatsApp *</label><input type="tel" className="campo" value={r.telefone || ""} onChange={(e) => mudaR("telefone", e.target.value)} /></div>
            <div><label className="rotulo">E-mail (será o login) *</label><input type="email" className="campo" value={r.email || ""} onChange={(e) => mudaR("email", e.target.value)} /></div>
          </div>
          {r.cpf?.length === 11 && !cpfValido(r.cpf) && <p className="text-xs text-erro">CPF inválido</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!r.endereco_igual} onChange={(e) => mudaR("endereco_igual", e.target.checked)} /> Mesmo endereço do aluno</label>
          {!r.endereco_igual && <input className="campo" placeholder="Endereço do responsável" value={r.endereco || ""} onChange={(e) => mudaR("endereco", e.target.value)} />}
          {tutor && <p className="text-sm text-alerta">Como não é mãe nem pai, envie também o termo de guarda ou tutela (etapa 5).</p>}
          <div className="space-y-2 rounded-xl bg-painel2 p-3">
            <p className="text-sm font-semibold">Quem mais pode buscar o aluno (opcional)</p>
            {aut.map((a, i) => (
              <div key={i} className="grid grid-cols-6 gap-2">
                <input className="campo col-span-6 sm:col-span-3" placeholder="Nome" value={a.nome || ""} onChange={(e) => setAut(aut.map((y, k) => (k === i ? { ...y, nome: e.target.value } : y)))} />
                <input className="campo col-span-3 sm:col-span-1" placeholder="Parentesco" value={a.parentesco || ""} onChange={(e) => setAut(aut.map((y, k) => (k === i ? { ...y, parentesco: e.target.value } : y)))} />
                <input className="campo col-span-3 sm:col-span-2" type="tel" placeholder="Telefone" value={a.telefone || ""} onChange={(e) => setAut(aut.map((y, k) => (k === i ? { ...y, telefone: e.target.value } : y)))} />
              </div>
            ))}
            <button type="button" className="btn-sec text-sm" onClick={() => setAut([...aut, {}])}>+ Pessoa autorizada</button>
          </div>
        </Etapa>
      )}

      <Etapa n={menor ? 3 : 2} titulo="Ficha de saúde" ok={!faltaSaude.length}>
        <p className="text-xs text-suave">🔒 Só a equipe da academia vê. Vale por 1 ano.</p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <CamposSaude s={saude} muda={(k, v) => setSaude((x: any) => ({ ...x, [k]: v }))} emerg={emerg} setEmerg={setEmerg} />
        </div>
      </Etapa>

      <Etapa n={menor ? 4 : 3} titulo="Termos e assinatura" ok={!faltaTermos.length}>
        <p className="text-sm text-suave">{menor ? "O responsável lê, marca e assina." : "Leia, marque e assine."} Fica registrado com data e hora.</p>
        <ul className="space-y-2">
          {termos.map((t) => (
            <li key={t.id} className="rounded-xl bg-painel2 p-3">
              {t.id === "imagem" ? (
                <>
                  <p className="font-semibold">{t.titulo}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {(["sim", "nao"] as const).map((v) => (
                      <button key={v} type="button" className="chip" onClick={() => setImagem(v)}
                        style={imagem === v ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{v === "sim" ? "Autorizo" : "Não autorizo"}</button>
                    ))}
                  </div>
                </>
              ) : t.id === "ciencia_menor" ? (
                <>
                  <p className="font-semibold">{t.titulo}</p>
                  <p className="mb-1 text-xs text-suave">Assinatura do aluno (opcional):</p>
                  <AssinaturaPad onChange={setPngMenor} />
                </>
              ) : (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={!!aceites[t.id]} onChange={(e) => setAceites({ ...aceites, [t.id]: e.target.checked })} />
                  <span className="font-semibold">{t.titulo}{t.obrigatorio ? " *" : ""}</span>
                </label>
              )}
              <details className="mt-1"><summary className="cursor-pointer text-xs text-suave">ler o texto</summary><p className="mt-1 whitespace-pre-line text-sm">{textoDoTermo(t, academia)}</p></details>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-sec text-sm" onClick={() => setAceites(Object.fromEntries(termos.filter((t) => t.id !== "imagem" && t.id !== "ciencia_menor").map((t) => [t.id, true])))}>Li e aceito todos</button>
        <p className="text-sm">Assinando: <b>{assinanteNome || "—"}</b>{assinanteCpf ? ` · CPF ${mascaraCpf(assinanteCpf)}` : ""}</p>
        <AssinaturaPad onChange={setPng} />
      </Etapa>

      <Etapa n={menor ? 5 : 4} titulo="Documentos (pode enviar depois)" ok={docsSugeridos.every((t) => docs.some((d) => d.tipo === t))}>
        {docsSugeridos.length > 0 && (
          <ul className="space-y-1 text-sm">{docsSugeridos.map((t) => <li key={t}>{docs.some((d) => d.tipo === t) ? "✅" : "⬜"} {TIPOS_DOC[t]}</li>)}</ul>
        )}
        <p className="text-xs text-suave">Foto ou PDF, até 8 MB cada. Se não tiver agora, a academia pede depois.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="campo sm:w-auto" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>{Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="btn-sec cursor-pointer text-center">📎 Escolher arquivo
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
              const a = e.target.files?.[0]; e.target.value = "";
              if (!a) return; if (a.size > 8 * 1024 * 1024) return setErro(["Arquivo muito grande (máximo 8 MB)."]);
              setDocs([...docs, { tipo: tipoDoc, arq: a }]);
            }} />
          </label>
        </div>
        {docs.map((d, i) => (
          <p key={i} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">📄 {TIPOS_DOC[d.tipo]} · {d.arq.name}</span>
            <button type="button" className="text-suave underline" onClick={() => setDocs(docs.filter((_, k) => k !== i))}>tirar</button></p>
        ))}
      </Etapa>

      {erro.length > 0 && (
        <div className="rounded-2xl p-3 text-sm" style={{ background: "color-mix(in srgb, var(--color-alerta) 18%, transparent)" }}>
          <p className="font-semibold">Falta preencher:</p>
          <ul>{erro.map((x) => <li key={x}>• {x}</li>)}</ul>
        </div>
      )}
      <button className="btn py-4 text-lg" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar pré-matrícula"}</button>
      <p className="text-center text-sm text-suave">Já tem conta? <Link className="underline" href="/login">Entrar</Link> · <Link className="underline" href={`/${slug}`}>Voltar</Link></p>
    </div>
  );
}
