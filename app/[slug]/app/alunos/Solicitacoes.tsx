"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, whatsapp, primeiroNome } from "@/lib/util";

// Cadastros feitos pelo próprio aluno no link da academia, esperando aprovação
export function Solicitacoes({ onAprovar }: { onAprovar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

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
    const perfilId = crypto.randomUUID();
    const membroId = crypto.randomUUID();
    const menor = !!s.responsavel_nome;
    const r1 = await sb.from("perfis").insert({
      id: perfilId, nome: s.nome, email: menor ? null : s.email, telefone: menor ? null : s.telefone,
      nascimento: s.nascimento, sexo: s.sexo,
    });
    if (r1.error) return setMsg(r1.error.message);
    const r2 = await sb.from("membros").insert({ id: membroId, academia_id: ctx.academia.id, perfil_id: perfilId, papel: "aluno" });
    if (r2.error) return setMsg(r2.error.message);
    const turma = escolha[s.id] ?? s.turma_id;
    if (turma) await sb.from("matriculas").insert({ turma_id: turma, membro_id: membroId });

    if (menor) {
      let respId: string | null = null;
      if (s.responsavel_email) {
        const { data: ex } = await sb.from("perfis").select("id").ilike("email", s.responsavel_email).limit(1);
        respId = ex?.[0]?.id || null;
      }
      if (!respId) {
        respId = crypto.randomUUID();
        await sb.from("perfis").insert({ id: respId, nome: s.responsavel_nome, email: s.responsavel_email, telefone: s.responsavel_tel });
      }
      await sb.from("responsaveis").insert({ responsavel_id: respId, dependente_id: perfilId, parentesco: "responsável" });
    }
    if (s.aceite_imagem) {
      await sb.from("consentimentos").insert({
        perfil_id: perfilId, academia_id: ctx.academia.id, tipo: "imagem", versao_termo: "cadastro-online-v1",
        aceito_por: menor ? s.responsavel_nome : s.nome, e_responsavel: menor,
      });
    }
    if (s.indicado_por) {
      await sb.from("indicacoes").insert({ academia_id: ctx.academia.id, indicador_id: s.indicado_por, indicado_nome: s.nome, indicado_membro: membroId });
      await sb.rpc("avaliar_conquistas", { p_membro: s.indicado_por });
    }
    await sb.from("solicitacoes_cadastro").update({ status: "aprovada", avaliada_por: ctx.membroId }).eq("id", s.id);
    setMsg(`${s.nome} aprovado(a)! Avise para entrar em “Primeiro acesso” com o e-mail ${menor ? "do responsável" : "cadastrado"}.`);
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
      {msg && <p className="text-sm text-ok">{msg}</p>}
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
