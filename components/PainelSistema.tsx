"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { VERSOES_BANCO } from "@/lib/novidades";
import { dataHoraBR } from "@/lib/util";

const GITHUB = "https://github.com/MAlcantara19/maacademias/blob/main/supabase";

// 🗄️ Versão do banco: quais ATUALIZAR-xx.sql faltam rodar (com lembrete de backup)
export function VersaoBanco() {
  const sb = supabaseNavegador();
  const [faltam, setFaltam] = useState<typeof VERSOES_BANCO | null>(null);
  const [semFuncao, setSemFuncao] = useState(false);
  const [acads, setAcads] = useState<any[]>([]);
  const [backupOk, setBackupOk] = useState(false);
  useEffect(() => {
    sb.rpc("status_versoes").then(({ data, error }: any) => {
      if (error) { setSemFuncao(true); setFaltam(VERSOES_BANCO.filter((v) => v.versao >= 22)); return; }
      const ok = new Set((data || []).filter((x: any) => x.aplicada).map((x: any) => x.versao));
      setFaltam(VERSOES_BANCO.filter((v) => !ok.has(v.versao)).sort((a, b) => a.versao - b.versao));
    });
    sb.from("academias").select("id, nome, slug, demonstracao").order("nome").then(({ data }: any) => setAcads((data || []).filter((a: any) => !a.demonstracao)));
  }, []); // eslint-disable-line
  if (!faltam) return null;
  if (!faltam.length) {
    return <p className="rounded-2xl bg-painel p-3 text-sm">🗄️ Banco de dados em dia: <b>versão {VERSOES_BANCO[0].versao}</b> ✓</p>;
  }
  const grande = faltam.some((v) => v.grande);
  return (
    <section className="space-y-3 rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--color-alerta)" }}>
      <h2 className="text-xl font-bold">🗄️ Falta atualizar o banco ({faltam.length})</h2>
      {semFuncao && <p className="text-sm text-suave">Não deu para conferir tudo porque o <b>ATUALIZAR-26.sql</b> ainda não foi rodado. Abaixo estão as mais recentes; se alguma já foi rodada, não tem problema rodar de novo.</p>}
      <div className={`space-y-2 rounded-xl p-3 text-sm ${grande ? "bg-alerta/15" : "bg-painel2"}`}>
        <p className="font-semibold">📦 1º passo: baixe o backup{grande ? " (tem atualização grande na lista)" : ""}</p>
        <p className="text-suave">Por segurança, baixe a planilha de cada academia real antes de rodar. As atualizações não apagam dados, mas é melhor prevenir.</p>
        <div className="flex flex-wrap gap-2">
          {acads.map((a) => <a key={a.id} href={`/${a.slug}/app/exportar#backup`} target="_blank" rel="noreferrer" className="btn-sec px-3 py-1 text-xs">📦 {a.nome}</a>)}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={backupOk} onChange={(e) => setBackupOk(e.target.checked)} /> Já baixei o backup</label>
      </div>
      <div className={backupOk ? "" : "pointer-events-none opacity-50"}>
        <p className="mb-1 text-sm font-semibold">2º passo: no Supabase → SQL Editor, rode nesta ordem:</p>
        <ol className="space-y-1.5">
          {faltam.map((v) => {
            const nome = `ATUALIZAR-${String(v.versao).padStart(2, "0")}.sql`;
            return (
              <li key={v.versao} className="flex flex-wrap items-center gap-2 rounded-xl bg-painel2 p-2 text-sm">
                <b className="numero">{nome}</b>{v.grande && <span className="rounded-full bg-alerta px-2 text-xs text-black">grande</span>}
                <span className="min-w-0 flex-1 text-suave">{v.titulo}</span>
                <a className="underline" href={`${GITHUB}/${nome}`} target="_blank" rel="noreferrer">abrir</a>
                <button className="underline" onClick={() => navigator.clipboard?.writeText(nome)}>copiar nome</button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-suave">Abra o arquivo no VS Code (pasta supabase), Ctrl+A, Ctrl+C, cole no SQL Editor e clique em Run. “Success” = deu certo. Depois recarregue esta página.</p>
      </div>
    </section>
  );
}

// 🩺 Status das integrações + teste de notificação
export function StatusIntegracoes() {
  const sb = supabaseNavegador();
  const [st, setSt] = useState<any>(null);
  const [erro, setErro] = useState("");
  const [teste, setTeste] = useState<string>("");
  const [aparelho, setAparelho] = useState<boolean | null>(null);

  async function token() { const { data: { session } } = await sb.auth.getSession(); return session?.access_token || ""; }
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/master/status", { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErro(j.erro || "Não deu para ler o status.");
      setSt(j);
    })();
    navigator.serviceWorker?.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => setAparelho(!!s)).catch(() => setAparelho(false));
  }, []); // eslint-disable-line

  async function testar() {
    setTeste("⏳ Criando a notificação de teste…");
    const r = await fetch("/api/master/teste-push", { method: "POST", headers: { Authorization: `Bearer ${await token()}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setTeste("❌ " + (j.erro || "Não deu para testar."));
    if (!j.aparelhos) return setTeste("⚠️ Notificação criada, mas você não ativou o push em nenhum aparelho. Abra o app no celular → Notificações → Ativar, e teste de novo.");
    setTeste(`⏳ Enviando para ${j.aparelhos} aparelho(s)… aguarde até 15 segundos.`);
    for (let i = 0; i < 8; i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const { data } = await sb.from("notificacoes").select("push_enviados").eq("id", j.id).maybeSingle();
      if (data?.push_enviados != null) {
        return setTeste(data.push_enviados > 0
          ? `✅ Chegou em ${data.push_enviados} aparelho(s)! Olhe o celular.`
          : "⚠️ O site recebeu, mas nenhum aparelho aceitou. Desative e ative de novo as notificações no celular.");
      }
    }
    setTeste("❌ O Supabase não avisou o site. Confira o Webhook (Database → Webhooks → tabela notificacoes, evento Insert, URL …/api/push, cabeçalho x-segredo) e a PUSH_WEBHOOK_SECRET na Vercel.");
  }

  if (erro) return <p className="rounded-2xl bg-painel p-3 text-sm text-alerta">{erro}</p>;
  if (!st) return null;
  const faltaObrig = st.itens.filter((i: any) => !i.ok && !i.opcional).length;
  return (
    <details className="rounded-2xl bg-painel p-4" open={faltaObrig > 0}>
      <summary className="cursor-pointer text-xl font-bold">🩺 Status das integrações {faltaObrig ? `· ⚠️ ${faltaObrig} pendente(s)` : "· tudo certo"}</summary>
      <ul className="mt-3 space-y-1.5">
        {st.itens.map((i: any) => (
          <li key={i.nome} className="flex items-start gap-2 rounded-xl bg-painel2 p-2 text-sm">
            <span className="text-lg">{i.ok ? "✅" : i.opcional ? "⚪" : "❌"}</span>
            <span className="min-w-0">
              <b>{i.grupo}: {i.nome}</b>{i.opcional && !i.ok ? <span className="text-suave"> (opcional)</span> : null}
              <span className="block text-xs text-suave">Para {i.para}. {!i.ok && <>Na Vercel: <code>{i.vars.join(", ")}</code></>}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-2 rounded-xl bg-painel2 p-3 text-sm">
        <p className="font-semibold">🔔 Testar a notificação no celular</p>
        <p className="text-xs text-suave">Neste aparelho: {aparelho === null ? "…" : aparelho ? "push ativado ✓" : "push não ativado (ative em Notificações dentro de uma academia)"}</p>
        <button className="btn text-sm" onClick={testar}>Mandar notificação de teste</button>
        {teste && <p>{teste}</p>}
      </div>
      {st.versao && <p className="mt-2 text-xs text-suave">Versão no ar: {st.versao}{st.commit ? ` — ${st.commit}` : ""}</p>}
      <p className="mt-1 text-xs text-suave">Depois de mudar uma variável na Vercel, faça <b>Redeploy</b> para valer. <Link className="underline" href="/status">Diagnóstico da conexão</Link></p>
    </details>
  );
}

// Quando os pilotos foram recriados
export function DataPilotos({ atualizar }: { atualizar?: number }) {
  const [d, setD] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabaseNavegador().from("plataforma").select("pilotos_recriados_em").eq("id", 1).maybeSingle()
      .then(({ data, error }: any) => setD(error ? undefined : data?.pilotos_recriados_em || null));
  }, [atualizar]);
  if (d === undefined) return null;
  return <span className="text-xs text-suave">{d ? `Pilotos recriados em ${dataHoraBR(d)}` : "Pilotos: data da última recriação ainda não registrada"}</span>;
}
