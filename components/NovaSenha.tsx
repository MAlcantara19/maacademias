"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataHoraBR, primeiroNome, whatsapp } from "@/lib/util";
import { gerarNovaSenha, textoNovaSenha } from "@/lib/novaSenha";

// Botão "🔑 Nova senha": gera uma senha provisória e já deixa pronto para mandar
export function BotaoNovaSenha({ perfilId, nome, telefone, className = "btn-sec", rotulo = "🔑 Nova senha", onFeito }: {
  perfilId: string; nome?: string | null; telefone?: string | null; className?: string; rotulo?: string; onFeito?: () => void;
}) {
  const ctx = useCtx();
  const [r, setR] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  async function gerar() {
    if (!confirm(`Gerar uma senha provisória nova para ${nome || "esta pessoa"}? A senha antiga deixa de funcionar.`)) return;
    setOcupado(true);
    const x = await gerarNovaSenha(supabaseNavegador(), perfilId, { telefone, academia: ctx.academia.nome });
    setOcupado(false); setR(x);
    if (!x.erro) onFeito?.();
  }
  const texto = r?.senha ? textoNovaSenha(ctx.academia.nome, primeiroNome(nome || ""), r.email, r.senha, `${window.location.origin}/login`) : "";
  const w = r?.senha ? whatsapp(telefone, texto) : null;
  return (
    <span className="inline-flex flex-col gap-2">
      <button className={className} disabled={ocupado} onClick={gerar}>{ocupado ? "Gerando…" : rotulo}</button>
      {r?.erro && <span className="text-sm text-alerta">{r.erro}</span>}
      {r?.senha && (
        <span className="block space-y-2 rounded-xl border-2 border-ok p-3 text-sm">
          <span className="block font-semibold">Senha nova pronta ✓</span>
          {r.enviado && <span className="block font-semibold text-ok">📲 Já foi mandada sozinha no WhatsApp da pessoa.</span>}
          <span className="block">E-mail: <b>{r.email}</b> · Senha provisória: <b className="numero text-lg">{r.senha}</b></span>
          <span className="flex flex-wrap gap-2">
            {w && <a className={r.enviado ? "btn-sec text-sm" : "btn text-sm"} target="_blank" href={w}>📲 {r.enviado ? "Mandar de novo" : "Mandar no WhatsApp"}</a>}
            {r.email && <a className="btn-sec text-sm" href={`mailto:${r.email}?subject=${encodeURIComponent(`Sua nova senha — ${ctx.academia.nome}`)}&body=${encodeURIComponent(texto)}`}>📧 Mandar por e-mail</a>}
            <button className="btn-sec text-sm" onClick={() => navigator.clipboard?.writeText(texto)}>📋 Copiar</button>
          </span>
          <span className="block text-xs text-suave">Vale por 48 horas. Ao entrar, o app pede para a pessoa criar a senha dela.</span>
        </span>
      )}
    </span>
  );
}

// Lista de quem tocou em "Esqueci a senha" (tela inicial da equipe)
export function PedidosSenha() {
  const sb = supabaseNavegador();
  const [l, setL] = useState<any[]>([]);
  async function carregar() {
    const { data } = await sb.from("pedidos_senha").select("id, perfil_id, contato, criado_em, perfis(nome, apelido, telefone, email)").is("atendido_em", null).order("criado_em", { ascending: false }).limit(20);
    setL(Array.from(new Map((data || []).map((p: any) => [p.perfil_id, p])).values()));
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  if (!l.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border-2 p-4" style={{ borderColor: "var(--color-alerta)" }}>
      <h2 className="text-xl font-bold">🔑 Pediram nova senha ({l.length})</h2>
      {l.map((p) => (
        <div key={p.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-painel p-3 text-sm">
          <span className="min-w-0 flex-1"><b>{p.perfis?.apelido || p.perfis?.nome}</b><span className="block text-xs text-suave">{p.perfis?.email || ""}{p.perfis?.telefone ? ` · ${p.perfis.telefone}` : ""} · pediu {dataHoraBR(p.criado_em)}</span></span>
          <span className="flex flex-wrap items-start gap-2">
            <BotaoNovaSenha perfilId={p.perfil_id} nome={p.perfis?.apelido || p.perfis?.nome} telefone={p.perfis?.telefone} className="btn text-sm" rotulo="🔑 Gerar nova senha" />
            <button className="text-xs text-suave underline" onClick={async () => { await sb.from("pedidos_senha").update({ atendido_em: new Date().toISOString() }).eq("perfil_id", p.perfil_id).is("atendido_em", null); carregar(); }}>dispensar</button>
          </span>
        </div>
      ))}
    </section>
  );
}

// Histórico: quem gerou senha nova para esta pessoa e quando
export function HistoricoSenhas({ perfilId }: { perfilId: string }) {
  const [l, setL] = useState<any[]>([]);
  useEffect(() => {
    supabaseNavegador().from("senhas_geradas").select("id, quem, via, criada_em").eq("perfil_id", perfilId).order("criada_em", { ascending: false }).limit(10)
      .then(({ data }: any) => setL(data || []), () => {});
  }, [perfilId]);
  if (!l.length) return null;
  const VIA: Record<string, string> = { equipe: "senha provisória", codigo_whats: "código no WhatsApp", codigo_email: "código no e-mail" };
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-suave">🔑 Histórico de senhas ({l.length})</summary>
      <ul className="mt-1 space-y-0.5 text-xs text-suave">
        {l.map((x) => <li key={x.id}>{dataHoraBR(x.criada_em)} · {VIA[x.via] || x.via}{x.quem ? ` · por ${x.quem}` : ""}</li>)}
      </ul>
    </details>
  );
}

// Alunos com login que nunca entraram no app: reenviar o acesso com um toque
export function NuncaEntraram({ academiaId }: { academiaId: string }) {
  const [l, setL] = useState<any[]>([]);
  useEffect(() => {
    supabaseNavegador().from("painel_alunos").select("membro_id, perfil_id, nome, apelido, whatsapp, ultimo_acesso")
      .eq("academia_id", academiaId).eq("ativo", true).eq("tem_login", true).eq("nunca_entrou", true).order("nome")
      .then(({ data }: any) => setL(data || []), () => {});
  }, [academiaId]);
  if (!l.length) return null;
  return (
    <details className="rounded-2xl bg-painel p-4">
      <summary className="cursor-pointer font-semibold">🚪 Têm login mas nunca entraram ({l.length})</summary>
      <p className="mt-1 text-xs text-suave">Gere uma senha nova e mande de novo — às vezes a mensagem se perdeu.</p>
      <ul className="mt-2 space-y-2">
        {l.map((a) => (
          <li key={a.membro_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2 text-sm">
            <span><b>{a.apelido || a.nome}</b>{a.whatsapp ? <span className="text-suave"> · {a.whatsapp}</span> : null}</span>
            <BotaoNovaSenha perfilId={a.perfil_id} nome={a.apelido || a.nome} telefone={a.whatsapp} className="btn-sec px-3 py-1 text-xs" rotulo="📨 Reenviar acesso" />
          </li>
        ))}
      </ul>
    </details>
  );
}

// Contatos faltando ou estranhos (a maior causa de "não consigo entrar")
export function ContatosComProblema({ academiaId, base }: { academiaId: string; base: string }) {
  const [l, setL] = useState<any[]>([]);
  useEffect(() => {
    supabaseNavegador().rpc("contatos_com_problema", { p_acad: academiaId }).then(({ data }: any) => setL(data || []), () => {});
  }, [academiaId]);
  if (!l.length) return null;
  return (
    <details className="rounded-2xl bg-painel p-4">
      <summary className="cursor-pointer font-semibold">📵 Contatos para arrumar ({l.length})</summary>
      <p className="mt-1 text-xs text-suave">Sem WhatsApp ou e-mail certo, a pessoa não recebe avisos nem a senha nova.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {l.map((a) => (
          <li key={a.membro_id}>
            <a href={`${base}/alunos/${a.membro_id}/cadastro`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2 text-sm">
              <b>{a.nome}</b><span className="text-xs text-alerta">{(a.problemas || []).join(" · ")}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
