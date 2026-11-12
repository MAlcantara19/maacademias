"use client";
import { comprimir } from "@/lib/imagem";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { MESES, NENHUM, abrirAnexo, dataBR, dinheiro, hojeISO, primeiroNome, whatsapp } from "@/lib/util";
import { gerarPix } from "@/lib/pix";
import { QR } from "@/components/QR";
import { Despesas } from "./Despesas";

const FORMAS: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", outro: "Outro" };

export default function Mensalidades() {
  const ctx = useCtx();
  // professor pode dar baixa se o admin liberou (só nos alunos dele: o banco garante)
  const podeMexer = ctx.admin || (!!ctx.academia.professor_ve_mensalidades && !!ctx.academia.professor_mexe_mensalidades);
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const hoje = hojeISO();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [semPlano, setSemPlano] = useState<any[]>([]);
  const [baixa, setBaixa] = useState<any>(null);
  const [novoPlano, setNovoPlano] = useState<any>(null);
  const [filtro, setFiltro] = useState("todas");
  const [msg, setMsg] = useState("");
  const [pix, setPix] = useState<any>(null);
  const [devedores, setDevedores] = useState<any[]>([]);

  // Junta nome e telefone do aluno (as visões de cobrança não trazem isso)
  async function comNomes(linhas: any[]) {
    const ids = Array.from(new Set(linhas.map((c) => c.membro_id)));
    if (!ids.length) return linhas;
    const { data } = await sb.from("membros").select("id, perfis(nome, apelido, telefone)").in("id", ids);
    const m = new Map((data || []).map((x: any) => [x.id, x]));
    return linhas.map((c) => ({ ...c, membros: m.get(c.membro_id) }));
  }

  async function carregar() {
    if (ctx.equipe) {
      const [c, p, membros, ass] = await Promise.all([
        sb.from("cobrancas_atualizadas").select("*").eq("academia_id", ctx.academia.id).eq("competencia", mes + "-01").order("vencimento"),
        sb.from("planos").select("*").eq("academia_id", ctx.academia.id).eq("ativo", true).order("valor"),
        sb.from("membros").select("id, perfis(nome)").eq("academia_id", ctx.academia.id).eq("papel", "aluno").eq("ativo", true),
        sb.from("assinaturas").select("membro_id, membros!inner(academia_id)").eq("membros.academia_id", ctx.academia.id).eq("ativa", true),
      ]);
      setCobrancas(await comNomes(c.data || [])); setPlanos(p.data || []);
      const com = new Set((ass.data || []).map((a: any) => a.membro_id));
      setSemPlano((membros.data || []).filter((m: any) => !com.has(m.id)));
      // todos os atrasados (de qualquer mês) para a lista de devedores
      const { data: atr0 } = await sb.from("cobrancas_atualizadas").select("*")
        .eq("academia_id", ctx.academia.id).eq("status", "aberta").lt("vencimento", hoje).order("vencimento");
      const atr = await comNomes(atr0 || []);
      const mapa = new Map<string, any>();
      (atr || []).forEach((c: any) => {
        const d = mapa.get(c.membro_id) || { membro: c.membros, membro_id: c.membro_id, meses: [] as any[], total: 0, original: 0 };
        d.meses.push(c); d.total += Number(c.total_atualizado); d.original += Number(c.valor);
        mapa.set(c.membro_id, d);
      });
      setDevedores(Array.from(mapa.values()).sort((a, b) => b.total - a.total));
    } else {
      const ids = ctx.meusAlunos.map((a) => a.id);
      const { data } = await sb.from("cobrancas_atualizadas").select("*").in("membro_id", ids.length ? ids : [NENHUM]).order("competencia", { ascending: false });
      setCobrancas(await comNomes(data || []));
    }
  }
  useEffect(() => { carregar(); }, [mes]); // eslint-disable-line

  const situacao = (c: any) => c.status === "paga" ? "paga" : c.status === "aberta" && c.vencimento < hoje ? "atrasada" : c.status;
  const totais = useMemo(() => ({
    recebido: cobrancas.filter((c) => c.status === "paga").reduce((s, c) => s + Number(c.valor_pago || c.valor), 0),
    aberto: cobrancas.filter((c) => situacao(c) === "aberta").reduce((s, c) => s + Number(c.valor), 0),
    atrasado: cobrancas.filter((c) => situacao(c) === "atrasada").reduce((s, c) => s + Number(c.valor), 0),
  }), [cobrancas]); // eslint-disable-line

  // Cria as cobranças do mês a partir dos planos dos alunos (não duplica)
  async function gerarMes() {
    const { data: ass } = await sb.from("assinaturas").select("*, membros!inner(academia_id, ativo)").eq("membros.academia_id", ctx.academia.id).eq("membros.ativo", true).eq("ativa", true);
    const [a, m] = mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const linhas = (ass || []).map((s: any) => ({
      academia_id: ctx.academia.id, membro_id: s.membro_id, competencia: mes + "-01",
      vencimento: `${mes}-${String(Math.min(s.dia_vencimento, ultimo)).padStart(2, "0")}`, valor: s.valor,
    }));
    if (!linhas.length) return setMsg("Nenhum aluno com plano. Defina os planos dos alunos abaixo.");
    const { error } = await sb.from("cobrancas").upsert(linhas, { onConflict: "membro_id,competencia", ignoreDuplicates: true });
    setMsg(error ? error.message : `Mensalidades de ${MESES[m - 1]} geradas.`);
    carregar();
  }

  async function darBaixa() {
    const { error } = await sb.from("cobrancas").update({
      status: "paga", pago_em: baixa.pago_em || hoje, valor_pago: Number(baixa.valor_pago || baixa.valor), forma: baixa.forma || "pix", registrado_por: ctx.membroId,
    }).eq("id", baixa.id);
    setMsg(error ? error.message : "Pagamento registrado. O recibo já está disponível.");
    setBaixa(null); carregar();
  }
  async function desfazer(c: any) {
    if (!confirm("Desfazer este pagamento?")) return;
    await sb.from("cobrancas").update({ status: "aberta", pago_em: null, valor_pago: null, forma: null }).eq("id", c.id); carregar();
  }
  async function isentar(c: any) {
    await sb.from("cobrancas").update({ status: c.status === "isenta" ? "aberta" : "isenta" }).eq("id", c.id); carregar();
  }
  async function salvarPlano() {
    if (!novoPlano?.nome || !novoPlano?.valor) return;
    await sb.from("planos").insert({ academia_id: ctx.academia.id, nome: novoPlano.nome, valor: Number(novoPlano.valor), descricao: novoPlano.descricao || null });
    setNovoPlano(null); carregar();
  }
  async function definirPlano(membroId: string, planoId: string, dia: number) {
    const p = planos.find((x) => x.id === planoId);
    if (!p) return;
    await sb.from("assinaturas").insert({ membro_id: membroId, plano_id: p.id, valor: p.valor, dia_vencimento: dia || 10 });
    carregar();
  }

  function abrirPix(c: any) {
    const a = ctx.academia;
    setPix({
      c, codigo: gerarPix({ chave: a.pix_chave, nome: a.pix_nome || a.nome, cidade: a.pix_cidade || a.cidade || "BRASIL", valor: Number(c.total_atualizado || c.valor), txid: "MENS" + c.recibo_numero }),
    });
  }
  async function enviarComprovante(c: any, arquivo?: File) {
    if (!arquivo) return;
    const caminho = `${ctx.academia.id}/comprovantes/${c.id}-${Date.now()}.${arquivo.name.split(".").pop()}`;
    const up = await sb.storage.from("privado").upload(caminho, await comprimir(arquivo));
    if (up.error) return setMsg("Não foi possível enviar: " + up.error.message);
    const { data } = await sb.rpc("enviar_comprovante", { p_cobranca: c.id, p_url: "privado:" + caminho });
    setMsg(data ? "Comprovante enviado! A academia vai conferir e dar baixa." : "Não foi possível registrar o comprovante.");
    setPix(null); carregar();
  }

  // ---------- Visão do aluno ----------
  if (!ctx.equipe) {
    return (
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold">Mensalidades</h1>
        {msg && <p className="text-sm text-suave">{msg}</p>}
        {pix && (
          <section className="flex flex-col items-center gap-3 rounded-2xl bg-painel p-5 text-center">
            <h2 className="text-2xl font-bold">Pagar {dinheiro(pix.c.total_atualizado || pix.c.valor)} com Pix</h2>
            <QR texto={pix.codigo} tamanho={220} />
            <p className="text-sm text-suave">Abra o app do banco e escaneie, ou copie o código:</p>
            <button className="btn-sec w-full break-all text-xs" onClick={() => navigator.clipboard.writeText(pix.codigo).then(() => setMsg("Código Pix copiado!"))}>📋 Copiar Pix copia e cola</button>
            <label className="btn w-full cursor-pointer">🧾 Já paguei — enviar comprovante
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => enviarComprovante(pix.c, e.target.files?.[0])} />
            </label>
            <button className="text-sm text-suave underline" onClick={() => setPix(null)}>Fechar</button>
          </section>
        )}
        <ul className="space-y-2">
          {cobrancas.map((c) => {
            const s = situacao(c);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-painel p-4">
                <div>
                  <p className="font-semibold">{MESES[Number(c.competencia.slice(5, 7)) - 1]} {c.competencia.slice(0, 4)}{ctx.meusAlunos.length > 1 ? ` · ${c.membros?.perfis?.nome}` : ""}</p>
                  <p className="text-sm text-suave">
                    {dinheiro(c.valor)} · vence {dataBR(c.vencimento)}
                    {c.atrasada && Number(c.multa) + Number(c.juros) > 0 && <> · <b className="text-erro">hoje {dinheiro(c.total_atualizado)}</b> (multa {dinheiro(c.multa)} + juros {dinheiro(c.juros)})</>}
                  </p>
                </div>
                {s === "paga"
                  ? <Link href={`${base}/recibo/${c.id}`} className="btn-sec text-sm">✓ Pago · recibo</Link>
                  : (
                    <div className="flex flex-col items-end gap-1">
                      <span className={`chip ${s === "atrasada" ? "border-erro text-erro" : ""}`}>{s === "atrasada" ? "Atrasada" : s === "isenta" ? "Isenta" : "Em aberto"}</span>
                      {s !== "isenta" && (c.comprovante_url
                        ? <span className="text-xs text-suave">🧾 comprovante enviado</span>
                        : ctx.academia.pix_chave && <button className="btn text-sm" onClick={() => abrirPix(c)}>Pagar com Pix</button>)}
                    </div>
                  )}
              </li>
            );
          })}
          {!cobrancas.length && <p className="text-suave">Nenhuma mensalidade registrada.</p>}
        </ul>
      </div>
    );
  }

  // ---------- Visão da equipe ----------
  const lista = cobrancas.filter((c) => filtro === "todas" || situacao(c) === filtro);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Mensalidades</h1>
        <div className="flex gap-2">
          <input type="month" className="campo w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
          {ctx.admin && <button className="btn" onClick={gerarMes}>Gerar do mês</button>}
        </div>
      </div>
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {/* Resumo do mês: quanto entrou, quanto falta e o que vence logo */}
      {(() => {
        const previsto = totais.recebido + totais.aberto + totais.atrasado;
        const pct = previsto ? Math.round((100 * totais.recebido) / previsto) : 0;
        const proximos = cobrancas.filter((c) => c.status === "aberta" && c.vencimento >= hoje && c.vencimento <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
        return (
          <section className="space-y-4 rounded-2xl bg-painel p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-suave">Recebido em {MESES[Number(mes.slice(5, 7)) - 1]}</p>
                <p className="numero text-4xl font-bold">{dinheiro(totais.recebido)} <span className="text-lg font-normal text-suave">de {dinheiro(previsto)}</span></p>
              </div>
              <p className="numero text-3xl font-bold" style={{ color: "var(--color-ok)" }}>{pct}%</p>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-fundo">
              <div style={{ width: `${previsto ? (100 * totais.recebido) / previsto : 0}%`, background: "var(--color-ok)" }} />
              <div style={{ width: `${previsto ? (100 * totais.aberto) / previsto : 0}%`, background: "var(--color-alerta)" }} />
              <div style={{ width: `${previsto ? (100 * totais.atrasado) / previsto : 0}%`, background: "var(--color-erro)" }} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-ok)" }} />Pago {dinheiro(totais.recebido)}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-alerta)" }} />A vencer {dinheiro(totais.aberto)}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-erro)" }} />Atrasado {dinheiro(totais.atrasado)}</span>
            </div>
            {proximos.length > 0 && (
              <p className="text-sm text-suave">📅 Vencem nos próximos 7 dias: {proximos.slice(0, 6).map((c) => `${c.membros?.perfis?.apelido || c.membros?.perfis?.nome?.split(" ")[0]} (${dataBR(c.vencimento).slice(0, 5)})`).join(", ")}{proximos.length > 6 ? ` e mais ${proximos.length - 6}` : ""}</p>
            )}
          </section>
        );
      })()}

      <div className="flex flex-wrap gap-2">
        {[["todas", "Todas"], ["atrasada", "Atrasadas"], ["aberta", "A vencer"], ["paga", "Pagas"], ["isenta", "Isentas"]].map(([k, v]) => (
          <button key={k} className="chip" onClick={() => setFiltro(k)} style={filtro === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{v}</button>
        ))}
      </div>

      {baixa && (
        <div className="grid gap-2 rounded-2xl border border-linha bg-painel p-4 sm:grid-cols-4">
          <p className="font-semibold sm:col-span-4">Dar baixa: {baixa.membros?.perfis?.nome}</p>
          <select className="campo" value={baixa.forma || "pix"} onChange={(e) => setBaixa({ ...baixa, forma: e.target.value })}>
            {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="campo" defaultValue={hoje} onChange={(e) => setBaixa({ ...baixa, pago_em: e.target.value })} />
          <input type="number" step="0.01" className="campo" defaultValue={baixa.valor} onChange={(e) => setBaixa({ ...baixa, valor_pago: e.target.value })} />
          <div className="flex gap-2"><button className="btn" onClick={darBaixa}>Confirmar</button><button className="btn-sec" onClick={() => setBaixa(null)}>✕</button></div>
        </div>
      )}

      <ul className="space-y-2">
        {lista.map((c) => {
          const s = situacao(c);
          const nome = c.membros?.perfis?.apelido || c.membros?.perfis?.nome;
          const z = whatsapp(c.membros?.perfis?.telefone, `Oi, ${primeiroNome(nome)}! Passando para lembrar da mensalidade de ${MESES[Number(mes.slice(5, 7)) - 1]} (${dinheiro(c.valor)}), com vencimento em ${dataBR(c.vencimento)}. Obrigado! 🥋`);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-painel p-3" style={{ borderLeft: `4px solid ${s === "paga" ? "var(--color-ok)" : s === "atrasada" ? "var(--color-erro)" : "var(--color-linha)"}` }}>
              <div className="min-w-0 flex-1">
                <Link href={`${base}/alunos/${c.membro_id}`} className="font-semibold">{nome}</Link>
                <p className="text-sm text-suave">
                  {dinheiro(c.valor)} · vence {dataBR(c.vencimento)}
                  {s === "paga" ? ` · pago ${dataBR(c.pago_em)} (${FORMAS[c.forma] || c.forma}) · recibo nº ${c.recibo_numero}` : s === "atrasada" ? ` · ATRASADA há ${c.dias_atraso} dia(s)` : s === "isenta" ? " · isenta" : ""}
                </p>
                {s === "atrasada" && Number(c.multa) + Number(c.juros) > 0 && (
                  <p className="text-sm">Hoje: <b className="text-erro">{dinheiro(c.total_atualizado)}</b> <span className="text-suave">(multa {dinheiro(c.multa)} + juros {dinheiro(c.juros)})</span></p>
                )}
                {c.comprovante_url && s !== "paga" && (
                  <button className="text-sm font-semibold underline" style={{ color: "var(--color-alerta)" }} onClick={() => abrirAnexo(sb, c.comprovante_url)}>🧾 Ver comprovante enviado</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {s === "paga" ? (
                  <>
                    <Link href={`${base}/recibo/${c.id}`} className="btn-sec text-sm">Recibo</Link>
                    {podeMexer && <button className="text-sm text-suave underline" onClick={() => desfazer(c)}>desfazer</button>}
                  </>
                ) : (
                  <>
                    {podeMexer && <button className="btn text-sm" onClick={() => setBaixa({ ...c, valor: c.atrasada ? c.total_atualizado : c.valor })}>Dar baixa</button>}
                    {z && s !== "isenta" && <a href={z} target="_blank" className="btn-sec text-sm">Lembrar</a>}
                    {podeMexer && <button className="text-sm text-suave underline" onClick={() => isentar(c)}>{s === "isenta" ? "cobrar" : "isentar"}</button>}
                  </>
                )}
              </div>
            </li>
          );
        })}
        {!lista.length && <p className="text-suave">Nenhuma mensalidade neste mês. Toque em “Gerar do mês”.</p>}
      </ul>

      {ctx.admin && <Despesas mes={mes} recebido={totais.recebido} />}

      {/* Devedores (todos os meses) */}
      {devedores.length > 0 && (
        <section className="rounded-2xl bg-painel p-4">
          <h2 className="mb-1 text-2xl font-bold">Em atraso ({devedores.length})</h2>
          <p className="mb-3 text-sm text-suave">
            Total com multa e juros: <b className="text-erro">{dinheiro(devedores.reduce((s, d) => s + d.total, 0))}</b>
            {" "}(sem acréscimos: {dinheiro(devedores.reduce((s, d) => s + d.original, 0))})
          </p>
          <ul className="space-y-2">
            {devedores.map((d) => {
              const nome = d.membro?.perfis?.apelido || d.membro?.perfis?.nome;
              const z = whatsapp(d.membro?.perfis?.telefone, `Oi, ${primeiroNome(nome)}! Tudo bem? Consta em aberto: ${d.meses.map((c: any) => `${MESES[Number(c.competencia.slice(5, 7)) - 1]} (venc. ${dataBR(c.vencimento)})`).join(", ")}. Total atualizado: ${dinheiro(d.total)}. Dá para pagar pelo app com Pix. Qualquer coisa, me chama! 🥋`);
              return (
                <li key={d.membro_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-painel2 p-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/alunos/${d.membro_id}`} className="font-semibold">{nome}</Link>
                    <p className="text-sm text-suave">{d.meses.map((c: any) => `${dataBR(c.vencimento).slice(0, 5)} (${c.dias_atraso}d)`).join(" · ")}</p>
                  </div>
                  <span className="numero text-lg font-bold text-erro">{dinheiro(d.total)}</span>
                  {z && <a href={z} target="_blank" className="btn-sec text-sm">Cobrar</a>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Planos */}
      {ctx.admin && <section className="rounded-2xl bg-painel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Planos</h2>
          {ctx.admin && <button className="btn-sec text-sm" onClick={() => setNovoPlano({})}>Novo plano</button>}
        </div>
        {novoPlano && (
          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            <input className="campo" placeholder="Nome (ex.: 2x por semana)" onChange={(e) => setNovoPlano({ ...novoPlano, nome: e.target.value })} />
            <input className="campo" type="number" step="0.01" placeholder="Valor" onChange={(e) => setNovoPlano({ ...novoPlano, valor: e.target.value })} />
            <input className="campo" placeholder="Descrição" onChange={(e) => setNovoPlano({ ...novoPlano, descricao: e.target.value })} />
            <button className="btn" onClick={salvarPlano}>Salvar</button>
          </div>
        )}
        <ul className="space-y-1">
          {planos.map((p) => <li key={p.id} className="flex justify-between"><span>{p.nome}</span><span className="numero">{dinheiro(p.valor)}</span></li>)}
        </ul>
      </section>}

      {ctx.admin && semPlano.length > 0 && planos.length > 0 && (
        <section className="rounded-2xl bg-painel p-4">
          <h2 className="mb-1 text-2xl font-bold">Alunos sem plano ({semPlano.length})</h2>
          <p className="mb-3 text-sm text-suave">Defina o plano e o dia do vencimento para entrarem no “Gerar do mês”.</p>
          <ul className="space-y-2">
            {semPlano.map((m) => <LinhaPlano key={m.id} m={m} planos={planos} onSalvar={definirPlano} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinhaPlano({ m, planos, onSalvar }: { m: any; planos: any[]; onSalvar: (id: string, plano: string, dia: number) => void }) {
  const [plano, setPlano] = useState(planos[0]?.id || "");
  const [dia, setDia] = useState(10);
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
      <span className="truncate">{m.perfis?.nome}</span>
      <select className="campo w-auto" value={plano} onChange={(e) => setPlano(e.target.value)}>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
      <input className="campo w-20" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label="Dia do vencimento" />
      <button className="btn-sec text-sm" onClick={() => onSalvar(m.id, plano, dia)}>Salvar</button>
    </li>
  );
}
