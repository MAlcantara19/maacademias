"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { NOVIDADES, VERSOES_BANCO } from "@/lib/novidades";
import { dataHoraBR } from "@/lib/util";

const GITHUB = "https://github.com/MAlcantara19/maacademias/blob/main/supabase";

async function token() {
  const { data: { session } } = await supabaseNavegador().auth.getSession();
  return session?.access_token || "";
}
async function chamar(url: string, corpo?: any) {
  return fetch(url, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

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
        <BackupGeral compacto />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-suave">ou uma por uma:</span>
          {acads.map((a) => <a key={a.id} href={`/${a.slug}/app/exportar#backup`} target="_blank" rel="noreferrer" className="btn-sec px-3 py-1 text-xs">📦 {a.nome}</a>)}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={backupOk} onChange={(e) => setBackupOk(e.target.checked)} /> Já baixei o backup</label>
      </div>
      <div className={backupOk ? "" : "pointer-events-none opacity-50"}>
        {grande && <p className="mb-2 text-sm">🚧 Dica: ligue o <b>modo manutenção</b> (aba Sistema) antes de rodar e desligue no fim.</p>}
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
      <TesteWhats configurado={!!st.itens.find((i: any) => i.grupo === "WhatsApp")?.ok} />
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

// 💬 Teste do WhatsApp (Z-API): manda uma mensagem para o seu número
function TesteWhats({ configurado }: { configurado: boolean }) {
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  const [indo, setIndo] = useState(false);
  useEffect(() => {
    if (!configurado) return;
    chamar("/api/master/teste-whats").then((r) => r.json()).then((j) => setTel((t) => t || j.telefone || "")).catch(() => {});
  }, [configurado]);
  async function testar() {
    setIndo(true); setMsg("⏳ Mandando…");
    const r = await chamar("/api/master/teste-whats", { telefone: tel });
    const j = await r.json().catch(() => ({}));
    setIndo(false);
    setMsg(r.ok ? `✅ A Z-API aceitou. Confira o WhatsApp ${j.para}.` : "❌ " + (j.erro || "Não deu para testar."));
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-painel2 p-3 text-sm">
      <p className="font-semibold">💬 Testar o WhatsApp automático (Z-API)</p>
      {!configurado ? <p className="text-xs text-suave">Configure a Z-API na Vercel para testar.</p> : (
        <div className="flex flex-wrap gap-2">
          <input className="campo w-48 py-1.5 text-sm" inputMode="tel" placeholder="Seu WhatsApp com DDD" value={tel} onChange={(e) => setTel(e.target.value)} />
          <button className="btn text-sm" disabled={indo} onClick={testar}>Mandar mensagem de teste</button>
        </div>
      )}
      {msg && <p>{msg}</p>}
    </div>
  );
}

// 📦 Backup de todas as academias numa planilha só
export function BackupGeral({ compacto }: { compacto?: boolean }) {
  const [estado, setEstado] = useState("");
  async function baixar() {
    setEstado("⏳ Gerando a planilha (pode levar até 1 minuto)…");
    const r = await chamar("/api/master/backup-geral", {});
    if (!r.ok) { const j = await r.json().catch(() => ({})); return setEstado("❌ " + (j.erro || "Não deu para gerar.")); }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-todas-academias-${new Date().toLocaleDateString("sv-SE")}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setEstado("✅ Backup baixado.");
  }
  return (
    <div className="space-y-1">
      <button className="btn text-sm" onClick={baixar} disabled={estado.startsWith("⏳")}>📦 Baixar backup de todas as academias</button>
      {!compacto && <p className="text-xs text-suave">Uma planilha com abas de alunos, responsáveis, turmas, presenças, mensalidades e graduações, com a coluna “Academia”.</p>}
      {estado && <p className="text-sm">{estado}</p>}
    </div>
  );
}

// 💾 Espaço usado no Supabase (plano grátis: 500 MB de banco e 1 GB de arquivos)
export function UsoSupabase() {
  const [u, setU] = useState<any>(undefined);
  useEffect(() => { supabaseNavegador().rpc("uso_supabase").then(({ data, error }: any) => setU(error ? null : data?.[0] || null)); }, []);
  if (u === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-painel" />;
  if (!u) return null;
  const barra = (usado: number, limite: number, rotulo: string) => {
    const pct = Math.min(100, Math.round((usado / limite) * 100));
    const cor = pct >= 90 ? "var(--color-erro)" : pct >= 75 ? "var(--color-alerta)" : "var(--color-ok)";
    return (
      <div>
        <div className="flex justify-between gap-2 text-sm"><span>{rotulo}</span><span className="numero"><b>{Math.round(usado)}</b> de {limite} MB · {pct}%</span></div>
        <div className="mt-1 h-2.5 rounded-full bg-painel2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
          <div className="h-2.5 rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: cor }} />
        </div>
      </div>
    );
  };
  const perto = Math.max(u.banco_mb / u.limite_banco_mb, u.arquivos_mb / u.limite_arquivos_mb) >= 0.75;
  return (
    <section className="space-y-3 rounded-2xl bg-painel p-4" style={perto ? { outline: "2px solid var(--color-alerta)" } : undefined}>
      <h2 className="text-xl font-bold">💾 Uso do Supabase {perto ? "· ⚠️ chegando no limite" : "· tranquilo"}</h2>
      {barra(Number(u.banco_mb), u.limite_banco_mb, "🗄️ Banco de dados")}
      {barra(Number(u.arquivos_mb), u.limite_arquivos_mb, `🖼️ Fotos e arquivos (${u.arquivos})`)}
      {perto && <p className="text-sm">Para liberar espaço: diminua os dias das fotos do feed em cada academia (aba Academias) ou passe para o plano Pro do Supabase.</p>}
      <p className="text-xs text-suave">Você recebe um alerta no celular quando passar de 80% do plano grátis.</p>
      {u.maiores?.length > 0 && (
        <details className="text-xs text-suave">
          <summary className="cursor-pointer">Maiores tabelas</summary>
          <p className="mt-1">{u.maiores.map((m: any) => `${m.tabela} ${m.mb} MB`).join(" · ")}</p>
        </details>
      )}
    </section>
  );
}

// 🩺 Saúde das academias: quem está sem aula registrada há mais de 7 dias
export function SaudeAcademias() {
  const [l, setL] = useState<any[] | null | undefined>(undefined);
  const [todas, setTodas] = useState(false);
  useEffect(() => { supabaseNavegador().rpc("saude_academias").then(({ data, error }: any) => setL(error ? null : data || [])); }, []);
  if (l === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-painel" />;
  if (l === null) return <p className="rounded-2xl bg-painel p-3 text-sm text-suave">🩺 Saúde das academias: rode o <b>ATUALIZAR-27.sql</b>.</p>;
  const paradas = l.filter((a) => a.dias_sem_aula == null || a.dias_sem_aula > 7);
  const mostrar = todas ? l : paradas;
  const zap = (a: any) => {
    const n = String(a.admin_telefone || "").replace(/\D/g, "");
    if (!n) return null;
    const txt = `Oi, ${(a.admin_nome || "").split(" ")[0]}! Aqui é do MA Academias. Vi que faz um tempo que não tem chamada no app da ${a.nome}. Posso te ajudar em alguma coisa?`;
    return `https://wa.me/${n.length <= 11 ? "55" + n : n}?text=${encodeURIComponent(txt)}`;
  };
  return (
    <section className="rounded-2xl bg-painel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">🩺 Saúde das academias {paradas.length ? `· ${paradas.length} precisa(m) de você` : "· todas usando ✓"}</h2>
        {l.length > paradas.length && <button className="text-sm underline" onClick={() => setTodas(!todas)}>{todas ? "só as paradas" : `ver todas (${l.length})`}</button>}
      </div>
      {!mostrar.length ? <p className="mt-2 text-sm text-suave">Todas as academias reais registraram aula nos últimos 7 dias. 💪</p> : (
        <ul className="mt-3 space-y-2">
          {mostrar.map((a) => {
            const parada = a.dias_sem_aula == null || a.dias_sem_aula > 7;
            const z = zap(a);
            return (
              <li key={a.academia_id} className="flex flex-wrap items-center gap-2 rounded-xl bg-painel2 p-2 text-sm">
                <span className="text-lg" aria-hidden>{!parada ? "🟢" : a.dias_sem_aula == null || a.dias_sem_aula > 30 ? "🔴" : "🟡"}</span>
                <span className="min-w-0 flex-1">
                  <b>{a.nome}</b>
                  <span className="block text-xs text-suave">
                    {a.ultima_aula == null ? "nunca fez chamada" : a.dias_sem_aula === 0 ? "aula hoje" : `última aula há ${a.dias_sem_aula} dia(s)`}
                    {` · ${a.aulas_30d} aula(s) em 30 dias · ${a.alunos_ativos} alunos`}
                    {a.ultimo_acesso_equipe ? ` · equipe entrou ${dataHoraBR(a.ultimo_acesso_equipe)}` : " · equipe nunca entrou"}
                  </span>
                </span>
                {z ? <a href={z} target="_blank" rel="noreferrer" className="btn-sec px-2 py-1 text-xs">💬 {a.admin_nome?.split(" ")[0] || "Admin"}</a> : <span className="text-xs text-suave">admin sem telefone</span>}
                <Link href={`/${a.slug}/app`} className="btn-sec px-2 py-1 text-xs">Abrir</Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// 🐞 Os erros mais frequentes em aberto (resumo; a lista completa fica em Atividade e erros)
export function ErrosAbertos() {
  const [l, setL] = useState<any[] | null | undefined>(undefined);
  useEffect(() => {
    supabaseNavegador().rpc("erros_agrupados", { p_dias: 7 })
      .then(({ data, error }: any) => setL(error ? null : (data || []).filter((g: any) => !g.resolvido_em || g.voltou)));
  }, []);
  if (!l) return null;
  if (!l.length) return <p className="rounded-2xl bg-painel p-3 text-sm">🐞 Nenhum erro em aberto nos últimos 7 dias. 🎉</p>;
  return (
    <section className="rounded-2xl bg-painel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">🐞 Erros em aberto · {l.length}</h2>
        <Link href="/master/atividade?aba=erros" className="text-sm underline">ver e corrigir</Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {l.slice(0, 3).map((g) => (
          <li key={g.chave} className="flex gap-2">
            <b className="numero w-10 shrink-0 text-right">{g.vezes}x</b>
            <span className="min-w-0 truncate"><code className="text-xs text-suave">{g.tela}</code> {g.voltou ? "🔁 " : ""}{g.mensagem}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 🆕 Avisar os admins de todas as academias reais que chegou novidade
export function AvisarNovidade() {
  const sb = supabaseNavegador();
  const ultima = NOVIDADES[0];
  const [p, setP] = useState<any>(null);
  const [texto, setTexto] = useState(`${ultima.titulo}: ${ultima.itens.slice(0, 2).join("; ")}. Toque para ver tudo.`);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    sb.from("plataforma").select("novidade_avisada, novidade_avisada_em").eq("id", 1).maybeSingle().then(({ data }: any) => setP(data || {}));
  }, []); // eslint-disable-line
  const jaAvisou = p?.novidade_avisada === ultima.data;
  async function avisar() {
    if (!confirm(`Mandar “🆕 Chegou novidade no app” para os admins de todas as academias reais?\n\n${texto}`)) return;
    setMsg("⏳ Mandando…");
    const { data, error } = await sb.rpc("avisar_novidade", { p_titulo: "🆕 Chegou novidade no app", p_texto: texto, p_versao: ultima.data });
    if (error) return setMsg("❌ " + (error.message.includes("avisar_novidade") ? "Rode o ATUALIZAR-27.sql primeiro." : error.message));
    setMsg(`✅ ${data} admin(s) avisado(s). Chega no sino e no celular de quem ativou as notificações.`);
    setP({ novidade_avisada: ultima.data, novidade_avisada_em: new Date().toISOString() });
  }
  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4">
      <h2 className="text-xl font-bold">🆕 Avisar as academias da novidade</h2>
      <p className="text-sm text-suave">
        Última novidade: <b>{ultima.titulo}</b> ({new Date(ultima.data + "T12:00:00").toLocaleDateString("pt-BR")}).{" "}
        {jaAvisou ? `✅ Já avisada em ${dataHoraBR(p.novidade_avisada_em)}.` : "Ainda não avisada."} A equipe também vê o aviso na tela inicial.
      </p>
      <textarea className="campo min-h-20 text-sm" value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} aria-label="Texto da notificação" />
      <div className="flex flex-wrap gap-2">
        <button className={jaAvisou ? "btn-sec text-sm" : "btn text-sm"} onClick={avisar}>{jaAvisou ? "Mandar de novo" : "📣 Mandar para os admins"}</button>
        <Link href="/novidades" className="btn-sec text-sm" target="_blank">Ver a página de novidades</Link>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}

// 🚧 Modo manutenção: as academias veem “voltamos em X minutos” (o master continua entrando)
export function ModoManutencao() {
  const sb = supabaseNavegador();
  const [p, setP] = useState<any>(undefined);
  const [minutos, setMinutos] = useState(10);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState("");
  async function ler() {
    const { data, error } = await sb.from("plataforma").select("manutencao, manutencao_texto, manutencao_ate").eq("id", 1).maybeSingle();
    setP(error ? null : data || {});
  }
  useEffect(() => { ler(); }, []); // eslint-disable-line
  if (p === undefined) return null;
  if (p === null) return <p className="rounded-2xl bg-painel p-3 text-sm text-suave">🚧 Modo manutenção: rode o <b>ATUALIZAR-27.sql</b>.</p>;
  async function mudar(ligar: boolean) {
    if (ligar && !confirm(`Ligar o modo manutenção?\n\nTodo mundo (menos você) vai ver “voltamos em ${minutos} minutos” ao abrir o app das academias. As páginas públicas continuam no ar.`)) return;
    const { error } = await sb.from("plataforma").update(ligar
      ? { manutencao: true, manutencao_texto: texto.trim() || null, manutencao_ate: new Date(Date.now() + minutos * 60000).toISOString() }
      : { manutencao: false, manutencao_ate: null }).eq("id", 1);
    setMsg(error ? "❌ " + error.message : ligar ? "🚧 Manutenção ligada. Não esqueça de desligar quando terminar!" : "✅ Manutenção desligada. Todo mundo já pode entrar.");
    ler();
  }
  return (
    <section className="space-y-2 rounded-2xl bg-painel p-4" style={p.manutencao ? { outline: "3px solid var(--color-alerta)" } : undefined}>
      <h2 className="text-xl font-bold">🚧 Modo manutenção · {p.manutencao ? <span className="text-alerta">LIGADO</span> : "desligado"}</h2>
      {p.manutencao ? (
        <>
          <p className="text-sm">As academias estão vendo a tela de manutenção{p.manutencao_ate ? ` (previsão: ${dataHoraBR(p.manutencao_ate)})` : ""}. Você continua entrando normalmente.</p>
          <button className="btn text-sm" onClick={() => mudar(false)}>✅ Terminei, desligar</button>
        </>
      ) : (
        <>
          <p className="text-sm text-suave">Ligue antes de rodar uma atualização grande do banco. Se passar do horário previsto, a tela avisa que está quase acabando.</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Voltamos em</span>
            <select className="campo w-auto py-1.5 text-sm" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
              {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
            </select>
          </div>
          <input className="campo text-sm" placeholder="Recado opcional (ex.: estamos deixando o app mais rápido)" value={texto} maxLength={160} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn-sec text-sm" onClick={() => mudar(true)}>🚧 Ligar manutenção</button>
        </>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
