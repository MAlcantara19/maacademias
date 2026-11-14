"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import Link from "next/link";
import { abrirAnexo, dataBR, whatsapp, primeiroNome } from "@/lib/util";

// Cadastros feitos pelo próprio aluno no link da academia, esperando aprovação
export function Solicitacoes({ onAprovar }: { onAprovar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [novo, setNovo] = useState<string | null>(null);

  async function carregar() {
    const { data } = await sb.from("solicitacoes_cadastro").select("*, modalidades(nome)").eq("academia_id", ctx.academia.id).eq("status", "nova").order("criada_em");
    setLista(data || []);
  }
  useEffect(() => {
    carregar();
    sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setTurmas(data || []));
  }, []); // eslint-disable-line

  async function aprovar(s: any) {
    setMsg("");
    const turma = escolha[s.id] ?? s.turma_id ?? null;
    const { data: membroId, error } = await sb.rpc("aprovar_solicitacao", { p_id: s.id, p_turma: turma || null });
    if (error) return setMsg(error.message);
    if (s.indicado_por) await sb.rpc("avaliar_conquistas", { p_membro: s.indicado_por });
    const menor = !!s.responsavel_nome;
    setMsg(`${s.nome} aprovado(a)! Avise para entrar em “Primeiro acesso” com o e-mail ${menor ? "do responsável" : "cadastrado"}.`);
    setNovo(membroId as string);
    carregar(); onAprovar();
  }

  async function recusar(s: any) {
    if (!confirm(`Recusar o cadastro de ${s.nome}?`)) return;
    await sb.from("solicitacoes_cadastro").update({ status: "recusada", avaliada_por: ctx.membroId }).eq("id", s.id);
    carregar();
  }

  if (!lista.length && !msg) return null;

  return (
    <section className="space-y-2 rounded-2xl border-2 border-dashed p-4" style={{ borderColor: "var(--cor)" }}>
      <h2 className="text-2xl font-bold">🆕 Cadastros para aprovar ({lista.length})</h2>
      {msg && <p className="text-sm text-ok">{msg} {novo && <Link className="underline" href={`/${ctx.academia.slug}/app/alunos/${novo}/cadastro`}>Ver cadastro completo →</Link>}</p>}
      {lista.map((s) => {
        const tel = s.telefone || s.responsavel_tel;
        const z = whatsapp(tel, `Oi, ${primeiroNome(s.responsavel_nome || s.nome)}! Recebemos o cadastro na ${ctx.academia.nome}.`);
        return (
          <article key={s.id} className="rounded-xl bg-painel p-3">
            <p className="font-semibold">{s.nome} <span className="text-sm text-suave">· nasc. {dataBR(s.nascimento)}</span></p>
            <p className="text-sm text-suave">
              {s.email || (s.responsavel_nome ? `Responsável: ${s.responsavel_nome}${s.responsavel_email ? ` (${s.responsavel_email})` : ""}` : "sem e-mail")}
              {s.modalidades?.nome ? ` · ${s.modalidades.nome}` : ""}{s.aceite_imagem ? " · ✅ autoriza imagem" : " · ❌ não autoriza imagem"}
            </p>
            {s.mensagem && <p className="text-sm">💬 {s.mensagem}</p>}
            {s.dados?.termos && (
              <p className="text-sm">
                📋 Ficha completa: {s.dados.cpf ? "CPF ✓ · " : ""}{s.dados.saude ? "saúde ✓ · " : ""}{s.dados.termos.filter((t: any) => t.aceito).length} termo(s) assinado(s)
                {s.dados.responsavel?.parentesco ? ` · responsável: ${s.dados.responsavel.parentesco}` : ""}
              </p>
            )}
            {(s.dados?.documentos || []).length > 0 && (
              <p className="flex flex-wrap gap-2 text-sm">📎 {s.dados.documentos.map((d: any, i: number) => (
                <button key={i} className="underline" onClick={() => abrirAnexo(sb, d.arquivo)}>{d.tipo.replace("doc_", "doc. ")}</button>
              ))}</p>
            )}
            {s.indicado_por && <p className="text-sm">🤝 Veio por indicação{ctx.academia.recompensa_indicacao ? ` (recompensa: ${ctx.academia.recompensa_indicacao})` : ""}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="campo w-auto text-sm" value={escolha[s.id] ?? s.turma_id ?? ""} onChange={(e) => setEscolha({ ...escolha, [s.id]: e.target.value })}>
                <option value="">Sem turma por enquanto</option>
                {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button className="btn text-sm" onClick={() => aprovar(s)}>Aprovar</button>
              {z && <a href={z} target="_blank" className="btn-sec text-sm">WhatsApp</a>}
              <button className="text-sm text-suave underline" onClick={() => recusar(s)}>Recusar</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
