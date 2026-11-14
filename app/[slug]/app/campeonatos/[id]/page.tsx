"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { dataBR, dataHoraBR, whatsapp, primeiroNome } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { Barra } from "@/components/Grafico";
import { liberado } from "@/lib/planos";

const RESULTADOS: Record<string, string> = { ouro: "🥇 Ouro", prata: "🥈 Prata", bronze: "🥉 Bronze", participou: "Participou", nao_compareceu: "Não compareceu" };

export default function Campeonato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const base = `/${ctx.academia.slug}/app`;
  const [ev, setEv] = useState<any>(null);
  const [ficha, setFicha] = useState<any[]>([]);
  const [ck, setCk] = useState<any>(null);
  const [crono, setCrono] = useState<any[]>([]);
  const [atletas, setAtletas] = useState<any[]>([]);
  const [novoCrono, setNovoCrono] = useState<any>(null);
  const [inscrever, setInscrever] = useState("");
  const [msg, setMsg] = useState("");
  const [extra, setExtra] = useState<Record<string, any>>({});

  async function carregar() {
    const { data: e } = await sb.from("eventos").select("*").eq("id", id).maybeSingle();
    setEv(e);
    const [f, c, cr] = await Promise.all([
      sb.from("ficha_campeonato").select("*").eq("evento_id", id).order("classe").order("categoria_peso").order("nome"),
      sb.from("checklist_campeonato").select("*").eq("evento_id", id).maybeSingle(),
      sb.from("cronograma_evento").select("*").eq("evento_id", id).order("inicio"),
    ]);
    setFicha(f.data || []); setCk(c.data); setCrono(cr.data || []);
    // ficha de anamnese de cada inscrito: cadastro, saúde e documentos (só a equipe vê)
    const ids = (f.data || []).map((x: any) => x.membro_id);
    if (ctx.equipe && ids.length) {
      const { data: pa } = await sb.from("painel_alunos").select("membro_id, perfil_id").in("membro_id", ids);
      const perfis = (pa || []).map((x: any) => x.perfil_id);
      const [{ data: fs }, { data: docs }, st] = await Promise.all([
        sb.from("fichas_saude").select("perfil_id, dados, validade").in("perfil_id", perfis),
        sb.from("documentos").select("perfil_id, tipo, validade, criado_em").in("perfil_id", perfis),
        Promise.all(ids.map((mid: string) => sb.rpc("status_cadastro", { p_membro: mid }).then((r: any) => [mid, r.data]))),
      ]);
      const hoje = new Date().toISOString().slice(0, 10);
      const ROT: Record<string, string> = { cardiaco: "cardíaco", respiratorio: "respiratório", convulsao: "convulsão", ortopedico: "ortopédico" };
      setExtra(Object.fromEntries((pa || []).map((x: any) => {
        const fic = (fs || []).find((y: any) => y.perfil_id === x.perfil_id);
        const d = fic?.dados || {};
        const atestado = (docs || []).filter((y: any) => y.perfil_id === x.perfil_id && y.tipo === "atestado").sort((a: any, b: any) => (b.criado_em || "").localeCompare(a.criado_em || ""))[0];
        return [x.membro_id, {
          saude: fic ? (fic.validade < hoje ? "vencida" : "ok") : "falta",
          alertas: [...Object.keys(ROT).filter((k) => d[k] === "sim").map((k) => ROT[k]), d.alergias && `alergia: ${d.alergias}`, d.medicamentos && `remédios: ${d.medicamentos}`, d.restricoes && `restrição: ${d.restricoes}`].filter(Boolean),
          sangue: d.tipo_sanguineo,
          atestado: atestado ? (atestado.validade && atestado.validade < hoje ? "vencido" : "ok") : "falta",
          cadastro: (st as any[]).find((z) => z[0] === x.membro_id)?.[1],
        }];
      })));
    }
    if (ctx.equipe && e) {
      let q = sb.from("atletas_categoria").select("*").eq("academia_id", ctx.academia.id);
      if (e.modalidade_id) q = q.eq("modalidade_id", e.modalidade_id);
      const { data } = await q.order("nome");
      setAtletas(Array.from(new Map((data || []).map((a: any) => [a.membro_id, a])).values()));
    }
  }
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line

  if (!ev) return <p className="text-suave">Carregando…</p>;

  async function inscreverAtleta() {
    const a = atletas.find((x) => x.membro_id === inscrever);
    if (!a) return;
    const { data: g } = await sb.from("graduacoes").select("faixa").eq("membro_id", a.membro_id).order("data", { ascending: false }).limit(1);
    const { error } = await sb.from("inscricoes_evento").insert({
      evento_id: id, membro_id: a.membro_id, classe: a.classe, categoria_peso: a.categoria_peso, faixa: g?.[0]?.faixa || null, peso_inscricao: a.peso_kg,
    });
    setMsg(error ? "Não foi possível inscrever: " + error.message : `${a.nome} inscrito(a). Se faltar carteirinha, a pendência foi criada.`);
    setInscrever(""); carregar();
  }
  async function atualizar(inscricaoId: string, campos: any) {
    await sb.from("inscricoes_evento").update(campos).eq("id", inscricaoId);
    carregar();
  }
  async function remover(inscricaoId: string) {
    if (!confirm("Tirar este atleta do campeonato?")) return;
    await sb.from("inscricoes_evento").delete().eq("id", inscricaoId);
    carregar();
  }
  async function salvarCrono() {
    if (!novoCrono?.data || !novoCrono?.hora) return;
    await sb.from("cronograma_evento").insert({
      evento_id: id, tipo: novoCrono.tipo || "pesagem", titulo: novoCrono.titulo || null,
      classe: novoCrono.classe || null, sexo: novoCrono.sexo || null,
      categorias: novoCrono.categorias ? novoCrono.categorias.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
      inicio: new Date(`${novoCrono.data}T${novoCrono.hora}:00-03:00`).toISOString(), local: novoCrono.local || null,
    });
    setNovoCrono(null); carregar();
  }
  async function cobrarPendencias() {
    const titulo = prompt("Recado para todos os inscritos:", "Trazer documento com foto e carteirinha para a pesagem");
    if (!titulo) return;
    const { data, error } = await sb.rpc("criar_pendencias_em_massa", { p_alvo: "evento", p_alvo_id: id, p_titulo: titulo, p_tipo: "documento" });
    setMsg(error ? error.message : `Recado enviado para ${data} atleta(s).`);
    carregar();
  }

  const futuro = new Date(ev.inicio) > new Date();
  const completo = liberado(ctx.academia.plano, "campeonatos_completo");

  return (
    <div className="space-y-5">
      <Link href={`${base}/campeonatos`} className="nao-imprimir text-sm text-suave">← Campeonatos</Link>
      <header className="imprimir-claro">
        <h1 className="text-4xl font-extrabold">{ev.titulo}</h1>
        <p className="text-suave">{dataHoraBR(ev.inicio)}{ev.local ? ` · ${ev.local}` : ""} · {ctx.academia.nome}</p>
      </header>

      {ck && futuro && completo && (
        <section className="nao-imprimir rounded-2xl bg-painel p-4">
          <p className="numero text-3xl font-bold">{ck.prontos} de {ck.atletas} atletas prontos</p>
          <div className="mt-2"><Barra pct={ck.pct_prontos} cor="var(--color-ok)" /></div>
          <p className="mt-2 text-sm text-suave">
            {ck.sem_carteirinha > 0 && `💳 ${ck.sem_carteirinha} sem carteirinha · `}
            {ck.peso_desatualizado > 0 && `⚖️ ${ck.peso_desatualizado} com peso desatualizado · `}
            {ck.acima_do_peso > 0 && `🔺 ${ck.acima_do_peso} acima do peso · `}
            {ck.com_documento_pendente > 0 && `📄 ${ck.com_documento_pendente} com documento pendente`}
          </p>
        </section>
      )}

      {ctx.equipe && (
        <div className="nao-imprimir flex flex-wrap gap-2">
          <button className="btn" onClick={() => window.print()}>Imprimir / salvar PDF</button>
          <button className="btn-sec" onClick={cobrarPendencias}>Mandar recado aos inscritos</button>
          {completo && <button className="btn-sec" onClick={() => setNovoCrono({ tipo: "pesagem", data: ev.inicio.slice(0, 10) })}>Adicionar ao cronograma</button>}
        </div>
      )}
      {msg && <p className="nao-imprimir text-sm text-suave">{msg}</p>}

      {/* Cronograma */}
      {completo && <section className="imprimir-claro rounded-2xl bg-painel p-4">
        <h2 className="text-2xl font-bold">Cronograma</h2>
        {novoCrono && (
          <div className="nao-imprimir my-3 grid gap-2 sm:grid-cols-3">
            <select className="campo" value={novoCrono.tipo} onChange={(e) => setNovoCrono({ ...novoCrono, tipo: e.target.value })}>
              <option value="pesagem">Pesagem</option><option value="luta">Lutas</option><option value="apresentacao">Apresentação</option><option value="premiacao">Premiação</option><option value="outro">Outro</option>
            </select>
            <input className="campo" type="date" value={novoCrono.data} onChange={(e) => setNovoCrono({ ...novoCrono, data: e.target.value })} />
            <input className="campo" type="time" onChange={(e) => setNovoCrono({ ...novoCrono, hora: e.target.value })} />
            <input className="campo" placeholder="Classe (ex.: Sênior) — vazio = todas" onChange={(e) => setNovoCrono({ ...novoCrono, classe: e.target.value })} />
            <input className="campo" placeholder="Categorias (ex.: -81 kg, -90 kg)" onChange={(e) => setNovoCrono({ ...novoCrono, categorias: e.target.value })} />
            <select className="campo" onChange={(e) => setNovoCrono({ ...novoCrono, sexo: e.target.value })} defaultValue="">
              <option value="">Masculino e feminino</option><option value="M">Masculino</option><option value="F">Feminino</option>
            </select>
            <input className="campo sm:col-span-2" placeholder="Local (ex.: sala 2)" onChange={(e) => setNovoCrono({ ...novoCrono, local: e.target.value })} />
            <button className="btn" onClick={salvarCrono}>Salvar</button>
            <p className="text-xs text-suave sm:col-span-3">Os atletas dessa categoria, os responsáveis e a equipe recebem aviso 60 e 15 minutos antes.</p>
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {crono.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="numero w-28 shrink-0 font-bold">{dataHoraBR(c.inicio)}</span>
              <span>
                {c.tipo === "pesagem" ? "⚖️" : "🥋"} {c.titulo || c.tipo}
                {c.classe ? ` · ${c.classe}` : ""}{c.sexo === "M" ? " masc." : c.sexo === "F" ? " fem." : ""}
                {c.categorias?.length ? ` · ${c.categorias.join(", ")}` : ""}
                {c.local ? <span className="text-suave"> · {c.local}</span> : null}
              </span>
            </li>
          ))}
          {!crono.length && <p className="text-suave">Sem horários cadastrados.</p>}
        </ul>
      </section>}

      {/* Inscrever */}
      {ctx.equipe && futuro && (
        <div className="nao-imprimir flex gap-2">
          <select className="campo" value={inscrever} onChange={(e) => setInscrever(e.target.value)}>
            <option value="">Inscrever atleta…</option>
            {atletas.filter((a) => !ficha.some((f) => f.membro_id === a.membro_id)).map((a) => (
              <option key={a.membro_id} value={a.membro_id}>{a.nome} — {a.classe || "sem classe"} {a.categoria_peso || ""} {a.peso_kg ? `(${a.peso_kg} kg)` : ""}</option>
            ))}
          </select>
          <button className="btn" onClick={inscreverAtleta} disabled={!inscrever}>Inscrever</button>
        </div>
      )}

      {/* Ficha dos atletas */}
      <section className="space-y-2">
        <h2 className="text-2xl font-bold">Atletas ({ficha.length})</h2>
        {ficha.map((a) => {
          const z = whatsapp(a.whatsapp, `Oi, ${primeiroNome(a.nome)}! Sobre o ${ev.titulo}:`);
          return (
            <article key={a.inscricao_id} className="imprimir-claro break-inside-avoid rounded-2xl border border-linha bg-painel p-3">
              <div className="flex gap-3">
                <Avatar foto={a.foto_url} nome={a.nome} tamanho={56} mostrarFaixa={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{a.nome}</p>
                    {futuro && (a.faltando?.length
                      ? a.faltando.map((x: string) => <span key={x} className="chip nao-imprimir border-alerta text-xs">falta: {x}</span>)
                      : <span className="chip nao-imprimir border-ok text-xs">✓ pronto</span>)}
                    {a.resultado && <span className="chip text-xs">{RESULTADOS[a.resultado]}</span>}
                  </div>
                  <p className="text-sm">
                    <b>{a.classe || "—"} · {a.categoria_peso || "—"}</b>{a.limite_categoria_kg ? ` (até ${Number(a.limite_categoria_kg)} kg)` : ""} · faixa {a.faixa?.toLowerCase() || "—"}
                  </p>
                  <p className="text-sm text-suave">
                    Nasc. {dataBR(a.nascimento)} (idade de campeonato {a.idade_campeonato}) · último peso {a.ultimo_peso ? `${Number(a.ultimo_peso)} kg em ${dataBR(a.pesado_em)}` : "—"}
                  </p>
                  <p className="text-sm text-suave">
                    {completo && <>Federação: {a.numero_federacao ? `${a.federacao} nº ${a.numero_federacao}${a.federacao_valida_ate ? `, válida até ${dataBR(a.federacao_valida_ate)}` : ""}` : "sem carteirinha"}
                    {a.area || a.horario_luta ? ` · ${a.area || ""} ${a.horario_luta ? dataHoraBR(a.horario_luta) : ""}` : ""}</>}
                  </p>
                </div>
                {completo && a.carteirinha_federacao_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.carteirinha_federacao_url} alt="Carteirinha" className="hidden h-20 rounded-lg sm:block" />
                )}
              </div>
              {ctx.equipe && extra[a.membro_id] && (() => {
                const x = extra[a.membro_id];
                const cor = (ok: boolean) => (ok ? "border-ok" : "border-alerta text-alerta");
                return (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className={`chip ${cor(x.saude === "ok")}`}>⚕️ Saúde: {x.saude === "ok" ? "em dia" : x.saude === "vencida" ? "vencida" : "não preenchida"}</span>
                    <span className={`chip ${cor(x.atestado === "ok")}`}>📄 Atestado: {x.atestado === "ok" ? "ok" : x.atestado === "vencido" ? "vencido" : "não enviado"}</span>
                    {x.cadastro && <span className={`chip ${cor(x.cadastro.completo)}`}>📋 Cadastro: {x.cadastro.completo ? "completo" : `${x.cadastro.pendencias.length} pendência(s)`}</span>}
                    {x.sangue && <span className="chip">🩸 {x.sangue}</span>}
                    {x.alertas.map((t: string) => <span key={t} className="chip border-erro">⚠️ {t}</span>)}
                    <Link className="chip nao-imprimir underline" href={`${base}/alunos/${a.membro_id}/cadastro`}>abrir ficha completa</Link>
                  </div>
                );
              })()}
              {ctx.equipe && (
                <div className="nao-imprimir mt-3 flex flex-wrap items-center gap-2">
                  <input className="campo w-32" type="number" step="0.1" placeholder="Peso pesagem" defaultValue={a.peso_pesagem ?? ""}
                    onBlur={(e) => e.target.value && atualizar(a.inscricao_id, { peso_pesagem: Number(e.target.value), pesagem_ok: a.limite_categoria_kg ? Number(e.target.value) <= Number(a.limite_categoria_kg) : true })} />
                  {a.pesagem_ok != null && <span className={`chip ${a.pesagem_ok ? "border-ok" : "border-erro"}`}>{a.pesagem_ok ? "Pesagem ok" : "Fora do peso"}</span>}
                  <select className="campo w-auto" defaultValue={a.resultado || ""} onChange={(e) => atualizar(a.inscricao_id, { resultado: e.target.value || null })}>
                    <option value="">Resultado…</option>
                    {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {z && <a href={z} target="_blank" className="btn-sec text-sm">WhatsApp</a>}
                  <Link href={`${base}/alunos/${a.membro_id}`} className="btn-sec text-sm">Ficha</Link>
                  <button className="text-sm text-suave underline" onClick={() => remover(a.inscricao_id)}>Tirar</button>
                </div>
              )}
            </article>
          );
        })}
        {!ficha.length && <p className="text-suave">Nenhum atleta inscrito ainda.</p>}
      </section>
    </div>
  );
}
