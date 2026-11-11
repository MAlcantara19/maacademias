"use client";
import { comprimir } from "@/lib/imagem";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MOTIVOS_AUSENCIA, NENHUM, abrirAnexo, dataBR } from "@/lib/util";

export default function Pendencias() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [lista, setLista] = useState<any[]>([]);
  const [ausencias, setAusencias] = useState<any[]>([]);
  const [aba, setAba] = useState(ctx.equipe ? "respondida" : "minhas");
  const [massa, setMassa] = useState<any>(null);
  const [alvos, setAlvos] = useState<{ turmas: any[]; mods: any[] }>({ turmas: [], mods: [] });
  const [resp, setResp] = useState<any>({});
  const [msg, setMsg] = useState("");

  async function carregar() {
    let q = sb.from("pendencias").select("*, membros!membro_id(perfis(nome, apelido))").neq("status", "resolvida").order("criada_em", { ascending: false });
    q = ctx.equipe ? q.eq("academia_id", ctx.academia.id) : q.in("membro_id", ctx.meusAlunos.length ? ctx.meusAlunos.map((a) => a.id) : [NENHUM]).eq("visivel_aluno", true);
    const { data } = await q;
    setLista(data || []);
    if (ctx.equipe) {
      const { data: au } = await sb.from("ausencias").select("*, membros!membro_id!inner(academia_id, perfis(nome, apelido))").eq("membros.academia_id", ctx.academia.id).eq("status", "pendente").order("de");
      setAusencias(au || []);
    }
  }
  useEffect(() => {
    carregar();
    if (ctx.equipe) {
      sb.from("turmas").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome").then(({ data }) => setAlvos((a) => ({ ...a, turmas: data || [] })));
      sb.from("modalidades").select("id, nome").eq("academia_id", ctx.academia.id).eq("ativa", true).then(({ data }) => setAlvos((a) => ({ ...a, mods: data || [] })));
    }
  }, []); // eslint-disable-line

  async function criarEmMassa() {
    if (!massa?.titulo) return;
    const alvoId = massa.alvo === "academia" ? ctx.academia.id : massa.alvo_id;
    if (!alvoId) return setMsg("Escolha para quem vai o recado.");
    const { data, error } = await sb.rpc("criar_pendencias_em_massa", {
      p_alvo: massa.alvo, p_alvo_id: alvoId, p_titulo: massa.titulo, p_descricao: massa.descricao || null,
      p_tipo: massa.tipo || "outro", p_prazo: massa.prazo || null, p_visivel_aluno: massa.so_equipe ? false : true,
    });
    setMsg(error ? error.message : `Recado criado para ${data} aluno(s).`);
    setMassa(null); carregar();
  }

  async function avaliar(p: any, aceitar: boolean) {
    const recado = aceitar ? null : prompt("O que falta? (o aluno vai ver)") || null;
    await sb.rpc("avaliar_pendencia", { p_id: p.id, p_aceitar: aceitar, p_recado: recado });
    carregar();
  }

  async function avaliarAusencia(id: string, status: string) {
    await sb.from("ausencias").update({ status, avaliada_por: ctx.membroId, avaliada_em: new Date().toISOString() }).eq("id", id);
    carregar();
  }

  async function responder(p: any) {
    const r = resp[p.id] || {};
    let anexo: string | null = null;
    if (r.arquivo) {
      const caminho = `${ctx.academia.id}/pendencias/${p.id}-${Date.now()}.${r.arquivo.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, await comprimir(r.arquivo));
      if (up.error) return setMsg("Não foi possível enviar o arquivo: " + up.error.message);
      anexo = "privado:" + caminho;
    }
    const { data } = await sb.rpc("responder_pendencia", { p_id: p.id, p_resposta: r.texto || "Já enviei", p_anexo_url: anexo });
    setMsg(data ? "Resposta enviada. O professor vai confirmar." : "Não foi possível responder esta pendência.");
    setResp({ ...resp, [p.id]: {} }); carregar();
  }

  const nome = (p: any) => p.membros?.perfis?.apelido || p.membros?.perfis?.nome;
  const filtrada = ctx.equipe ? lista.filter((p) => (aba === "respondida" ? p.status === "respondida" : p.status === "aberta")) : lista;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Pendências</h1>
        {ctx.equipe && <button className="btn" onClick={() => setMassa({ alvo: "turma", tipo: "outro" })}>Recado para vários</button>}
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {massa && (
        <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-2">
          <select className="campo" value={massa.alvo} onChange={(e) => setMassa({ ...massa, alvo: e.target.value, alvo_id: "" })}>
            <option value="turma">Uma turma</option><option value="modalidade">Uma modalidade</option><option value="academia">A academia inteira</option>
          </select>
          {massa.alvo !== "academia" ? (
            <select className="campo" value={massa.alvo_id || ""} onChange={(e) => setMassa({ ...massa, alvo_id: e.target.value })}>
              <option value="" disabled>Escolha…</option>
              {(massa.alvo === "turma" ? alvos.turmas : alvos.mods).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          ) : <span />}
          <input className="campo sm:col-span-2" placeholder="Ex.: Trazer kimono branco no sábado" onChange={(e) => setMassa({ ...massa, titulo: e.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Detalhes (opcional)" onChange={(e) => setMassa({ ...massa, descricao: e.target.value })} />
          <select className="campo" defaultValue="outro" onChange={(e) => setMassa({ ...massa, tipo: e.target.value })}>
            {["documento", "carteirinha", "pagamento", "conversa", "peso", "outro"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select>
          <input type="date" className="campo" onChange={(e) => setMassa({ ...massa, prazo: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" onChange={(e) => setMassa({ ...massa, so_equipe: e.target.checked })} /> Só a equipe vê</label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn" onClick={criarEmMassa}>Criar para todos</button><button className="btn-sec" onClick={() => setMassa(null)}>Cancelar</button></div>
        </div>
      )}

      {ctx.equipe && (
        <div className="flex gap-1 rounded-2xl bg-painel p-1">
          {[["respondida", `Para confirmar (${lista.filter((p) => p.status === "respondida").length})`], ["aberta", `Abertas (${lista.filter((p) => p.status === "aberta").length})`], ["ausencias", `Ausências (${ausencias.length})`]].map(([k, v]) => (
            <button key={k} onClick={() => setAba(k)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${aba === k ? "bg-painel2" : "text-suave"}`}>{v}</button>
          ))}
        </div>
      )}

      {aba === "ausencias" ? (
        <ul className="space-y-2">
          {ausencias.map((u) => (
            <li key={u.id} className="rounded-2xl bg-painel p-4">
              <p className="font-semibold">🙋 {u.membros?.perfis?.apelido || u.membros?.perfis?.nome}: {MOTIVOS_AUSENCIA[u.motivo]}</p>
              <p className="text-sm text-suave">{dataBR(u.de)}{u.ate !== u.de ? ` a ${dataBR(u.ate)}` : ""}{u.observacao ? ` · ${u.observacao}` : ""}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-sec text-sm" onClick={() => avaliarAusencia(u.id, "justificada")}>Justificar</button>
                <button className="btn-sec text-sm" onClick={() => avaliarAusencia(u.id, "nao_justificada")}>Conta como falta</button>
              </div>
            </li>
          ))}
          {!ausencias.length && <p className="text-suave">Nenhuma ausência esperando avaliação.</p>}
        </ul>
      ) : (
        <ul className="space-y-2">
          {filtrada.map((p) => (
            <li key={p.id} className="rounded-2xl bg-painel p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{p.status === "respondida" ? "📨" : "📌"} {p.titulo}{!p.visivel_aluno ? " 🔒" : ""}</p>
                {p.prazo && <span className="text-sm text-suave">até {dataBR(p.prazo)}</span>}
              </div>
              {ctx.equipe && <Link href={`${base}/alunos/${p.membro_id}`} className="text-sm underline">{nome(p)}</Link>}
              {!ctx.equipe && ctx.meusAlunos.length > 1 && <p className="text-sm text-suave">{nome(p)}</p>}
              {p.descricao && <p className="whitespace-pre-line text-sm text-suave">{p.descricao}</p>}
              {p.resposta && <p className="mt-1 text-sm">💬 {p.resposta}</p>}
              {p.anexo_url && <button onClick={() => abrirAnexo(sb, p.anexo_url)} className="text-sm underline">Ver anexo</button>}

              {ctx.equipe ? (
                <div className="mt-2 flex gap-2">
                  <button className="btn-sec text-sm" onClick={() => avaliar(p, true)}>Confirmar resolvida</button>
                  {p.status === "respondida" && <button className="btn-sec text-sm" onClick={() => avaliar(p, false)}>Devolver</button>}
                </div>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input className="campo" placeholder="Ex.: já enviei / levo amanhã" value={resp[p.id]?.texto || ""} onChange={(e) => setResp({ ...resp, [p.id]: { ...resp[p.id], texto: e.target.value } })} />
                  <label className="btn-sec cursor-pointer text-sm">📎 {resp[p.id]?.arquivo ? "Arquivo ok" : "Anexar foto"}
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setResp({ ...resp, [p.id]: { ...resp[p.id], arquivo: e.target.files?.[0] } })} />
                  </label>
                  <button className="btn text-sm" onClick={() => responder(p)}>{p.status === "respondida" ? "Responder de novo" : "Responder"}</button>
                </div>
              )}
            </li>
          ))}
          {!filtrada.length && <p className="text-suave">Nada por aqui. ✅</p>}
        </ul>
      )}
    </div>
  );
}
