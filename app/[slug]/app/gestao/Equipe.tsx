"use client";
import { useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SeletorGraduacao } from "@/components/SeletorGraduacao";

// Equipe agrupada por pessoa: uma pessoa pode ser admin, professor ou os dois.
// O admin edita dados, papéis (permissões) e modalidades.
export function Equipe({ linhas, mods, acad, recarregar }: { linhas: any[]; mods: any[]; acad: string; recarregar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState("");

  // agrupa as linhas de "membros" por pessoa
  const pessoas = Object.values(linhas.reduce((acc: any, l: any) => {
    const k = l.perfil_id;
    acc[k] ||= { perfil_id: k, perfil: l.perfis, papeis: {} as Record<string, any> };
    acc[k].papeis[l.papel] = l;
    return acc;
  }, {})) as any[];
  const adminsAtivos = linhas.filter((l) => l.papel === "admin" && l.ativo).length;

  function abrir(p: any) {
    const prof = p.papeis.professor;
    const pm = prof?.professores_modalidades || [];
    setMsg("");
    setEdit({
      perfil_id: p.perfil_id, nome: p.perfil?.nome || "", apelido: p.perfil?.apelido || "", email: p.perfil?.email || "", telefone: p.perfil?.telefone || "",
      admin: !!p.papeis.admin?.ativo, professor: !!prof?.ativo,
      modalidades: pm.map((x: any) => x.modalidade_id),
      graduacao: pm[0]?.graduacao || "", whatsapp_publico: pm[0]?.whatsapp_publico || "", bio: pm[0]?.bio || "",
      _p: p,
    });
  }

  async function salvar() {
    const e = edit, p = e._p;
    if (!e.nome.trim()) return setMsg("O nome é obrigatório.");
    if (!e.admin && !e.professor) return setMsg("Marque pelo menos um papel (admin ou professor). Para tirar a pessoa da equipe, use “Desativar”.");
    if (p.papeis.admin?.ativo && !e.admin && adminsAtivos <= 1) return setMsg("A academia precisa ter pelo menos um admin.");
    if (p.papeis.admin?.ativo && !e.admin && p.perfil_id === ctx.perfil?.id && !confirm("Você vai tirar o SEU acesso de admin. Continuar?")) return;

    const r = await sb.from("perfis").update({ nome: e.nome.trim(), apelido: e.apelido || null, email: e.email || null, telefone: e.telefone || null }).eq("id", e.perfil_id);
    if (r.error) return setMsg("Erro ao salvar os dados: " + r.error.message);

    // papéis (permissões): liga, religa ou desativa — nunca apaga o histórico
    let profId: string | null = p.papeis.professor?.id || null;
    for (const papel of ["admin", "professor"] as const) {
      const quer = e[papel], linha = p.papeis[papel];
      if (quer && !linha) {
        const { data } = await sb.from("membros").insert({ academia_id: acad, perfil_id: e.perfil_id, papel }).select("id").single();
        if (papel === "professor") profId = data?.id || null;
      } else if (quer && !linha.ativo) await sb.from("membros").update({ ativo: true, saiu_em: null }).eq("id", linha.id);
      else if (!quer && linha?.ativo) await sb.from("membros").update({ ativo: false }).eq("id", linha.id);
    }

    // modalidades do professor
    if (e.professor && profId) {
      const atuais: string[] = (p.papeis.professor?.professores_modalidades || []).map((x: any) => x.modalidade_id);
      const tirar = atuais.filter((m) => !e.modalidades.includes(m));
      if (tirar.length) await sb.from("professores_modalidades").delete().eq("membro_id", profId).in("modalidade_id", tirar);
      const dados = { graduacao: e.graduacao || null, whatsapp_publico: e.whatsapp_publico || null, bio: e.bio || null };
      for (const m of e.modalidades) {
        if (atuais.includes(m)) await sb.from("professores_modalidades").update(dados).eq("membro_id", profId).eq("modalidade_id", m);
        else await sb.from("professores_modalidades").insert({ membro_id: profId, modalidade_id: m, ...dados });
      }
    }
    setEdit(null); setMsg("Salvo.");
    recarregar();
  }

  async function desativar(p: any) {
    const ativas = Object.values(p.papeis).filter((l: any) => l.ativo) as any[];
    const ehAdmin = !!p.papeis.admin?.ativo;
    if (ativas.length) {
      if (ehAdmin && adminsAtivos <= 1) return setMsg("Não dá para desativar o único admin da academia.");
      if (!confirm(`Desativar ${p.perfil?.nome} da equipe? O histórico fica guardado e dá para reativar depois.`)) return;
      await sb.from("membros").update({ ativo: false }).in("id", ativas.map((l) => l.id));
    } else {
      const ultimo = p.papeis.professor || p.papeis.admin;
      await sb.from("membros").update({ ativo: true, saiu_em: null }).eq("id", ultimo.id);
    }
    recarregar();
  }

  const muda = (k: string, v: any) => setEdit((x: any) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-2">
      {msg && <p className="text-sm text-alerta">{msg}</p>}
      {pessoas.map((p) => {
        const ativo = Object.values(p.papeis).some((l: any) => l.ativo);
        const prof = p.papeis.professor;
        const editando = edit?.perfil_id === p.perfil_id;
        return (
          <div key={p.perfil_id} className={`rounded-2xl bg-painel p-3 ${ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar foto={p.perfil?.foto_url} nome={p.perfil?.nome} tamanho={44} mostrarFaixa={false} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 font-semibold">
                  {p.perfil?.nome}
                  {p.papeis.admin?.ativo && <span className="chip text-xs">🛡️ admin</span>}
                  {prof?.ativo && <span className="chip text-xs">🥋 professor</span>}
                  {!ativo && <span className="chip text-xs">desativado</span>}
                </p>
                <p className="truncate text-sm text-suave">{p.perfil?.email || "sem e-mail"}{p.perfil?.telefone ? ` · ${p.perfil.telefone}` : ""}</p>
                {prof?.ativo && (prof.professores_modalidades || []).length > 0 && (
                  <p className="mt-1 text-xs text-suave">
                    {(prof.professores_modalidades || []).map((x: any) => mods.find((m) => m.id === x.modalidade_id)?.nome).filter(Boolean).join(" · ")}
                    {prof.professores_modalidades[0]?.graduacao ? ` · ${prof.professores_modalidades[0].graduacao}` : ""}
                  </p>
                )}
              </div>
              {ctx.admin && (
                <div className="flex gap-2">
                  <button className="btn-sec text-sm" onClick={() => (editando ? setEdit(null) : abrir(p))}>{editando ? "Fechar" : "✏️ Editar"}</button>
                  <button className="btn-sec text-sm" onClick={() => desativar(p)}>{ativo ? "Desativar" : "Reativar"}</button>
                </div>
              )}
            </div>

            {editando && (
              <div className="mt-3 grid gap-2 border-t border-linha pt-3 sm:grid-cols-2">
                <div><label className="rotulo">Nome *</label><input className="campo" value={edit.nome} onChange={(x) => muda("nome", x.target.value)} /></div>
                <div><label className="rotulo">Apelido</label><input className="campo" value={edit.apelido} onChange={(x) => muda("apelido", x.target.value)} /></div>
                <div><label className="rotulo">E-mail (login)</label><input className="campo" type="email" value={edit.email} onChange={(x) => muda("email", x.target.value)} /></div>
                <div><label className="rotulo">WhatsApp</label><input className="campo" value={edit.telefone} onChange={(x) => muda("telefone", x.target.value)} /></div>

                <div className="sm:col-span-2">
                  <p className="rotulo">Permissões</p>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={edit.admin} onChange={(x) => muda("admin", x.target.checked)} />
                      <span><b>Admin</b>: vê e configura tudo da academia (alunos, turmas, equipe, mensalidades, personalização).</span></label>
                    <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={edit.professor} onChange={(x) => muda("professor", x.target.checked)} />
                      <span><b>Professor</b>: dá aula; vê e cuida só dos alunos das turmas dele.</span></label>
                  </div>
                </div>

                {edit.professor && (
                  <>
                    <div className="sm:col-span-2">
                      <p className="rotulo">Modalidades que ensina</p>
                      <div className="flex flex-wrap gap-1">
                        {mods.map((m) => {
                          const on = edit.modalidades.includes(m.id);
                          return <button key={m.id} type="button" className="chip text-xs" onClick={() => muda("modalidades", on ? edit.modalidades.filter((x: string) => x !== m.id) : [...edit.modalidades, m.id])}
                            style={on ? { borderColor: m.cor || "var(--cor)", background: (m.cor || "#7c3aed") + "33" } : { opacity: 0.6 }}>{on ? "✓ " : ""}{m.nome}</button>;
                        })}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="rotulo">Graduação {edit.graduacao ? `(${edit.graduacao})` : ""}</label>
                      {(() => { const m = mods.find((x) => x.id === edit.modalidades[0]) || mods[0]; return m?.graduacoes?.length
                        ? <SeletorGraduacao key={m.id} faixas={m.graduacoes} grausMax={m.graus_max ?? 4} valor={edit.graduacao} onChange={(t) => muda("graduacao", t)} />
                        : <input className="campo" placeholder="Ex.: Faixa preta 2º dan" value={edit.graduacao} onChange={(x) => muda("graduacao", x.target.value)} />; })()}
                    </div>
                    <div><label className="rotulo">WhatsApp na página pública</label><input className="campo" placeholder="Opcional" value={edit.whatsapp_publico} onChange={(x) => muda("whatsapp_publico", x.target.value)} /></div>
                    <div className="sm:col-span-2"><label className="rotulo">Mini currículo (aparece na página)</label><textarea className="campo min-h-20" value={edit.bio} onChange={(x) => muda("bio", x.target.value)} /></div>
                  </>
                )}
                <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={salvar}>Salvar</button><button className="btn-sec" onClick={() => setEdit(null)}>Cancelar</button></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
