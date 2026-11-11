"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { QR } from "@/components/QR";
import { Backup } from "@/components/Backup";
import { ROTULO_PLANO, liberado, planoMinimoNome } from "@/lib/planos";

const MODULOS: [string, string][] = [
  ["sobre", "Sobre nós"], ["propaganda", "Propagandas"], ["calendario", "Calendário"], ["avisos", "Avisos"],
  ["ranking", "Ranking"], ["feed", "Feed"], ["materiais", "Material de apoio"], ["mensalidades", "Mensalidades"],
  ["carteirinha", "Carteirinha"], ["campeonatos", "Campeonatos"], ["aula_experimental", "Aula experimental"], ["feedback", "Sugestões"],
  ["galeria", "Galeria (Google Drive)"],
];

export default function Config() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const router = useRouter();
  const [a, setA] = useState<any>(ctx.academia);
  const [link, setLink] = useState("");
  const [linkCadastro, setLinkCadastro] = useState("");
  const [msg, setMsg] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [capa, setCapa] = useState<File | null>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [aceites, setAceites] = useState<number | null>(null);
  useEffect(() => {
    if (!a.contrato_versao) return;
    sb.from("consentimentos").select("id", { count: "exact", head: true }).eq("academia_id", a.id).eq("tipo", "contrato").eq("versao_termo", a.contrato_versao)
      .then(({ count }) => setAceites(count || 0));
  }, []); // eslint-disable-line
  const [novoBanner, setNovoBanner] = useState<any>(null);

  async function carregarBanners() {
    const { data } = await sb.from("propagandas").select("*").eq("academia_id", a.id).order("ordem");
    setBanners(data || []);
  }
  useEffect(() => { carregarBanners(); }, []); // eslint-disable-line

  async function enviar(arq: File, nome: string) {
    const caminho = `${a.id}/${nome}-${Date.now()}.${arq.name.split(".").pop()}`;
    const up = await sb.storage.from("publico").upload(caminho, arq);
    if (up.error) { setMsg("Não foi possível enviar a imagem: " + up.error.message); return null; }
    return sb.storage.from("publico").getPublicUrl(caminho).data.publicUrl;
  }
  async function salvarBanner() {
    if (!novoBanner?.arquivo) return setMsg("Escolha a imagem do banner.");
    const url = await enviar(novoBanner.arquivo, "banner");
    if (!url) return;
    await sb.from("propagandas").insert({ academia_id: a.id, titulo: novoBanner.titulo || null, texto: novoBanner.texto || null, link: novoBanner.link || null, imagem_url: url, ordem: banners.length + 1 });
    setNovoBanner(null); carregarBanners();
  }
  async function alternarBanner(b: any) { await sb.from("propagandas").update({ ativa: !b.ativa }).eq("id", b.id); carregarBanners(); }
  async function apagarBanner(b: any) { if (confirm("Apagar este banner?")) { await sb.from("propagandas").delete().eq("id", b.id); carregarBanners(); } }

  useEffect(() => {
    setLink(`${window.location.origin}/${a.slug}/checkin?t=${a.qr_fixo_token}`);
    setLinkCadastro(`${window.location.origin}/${a.slug}/cadastro`);
  }, [a.qr_fixo_token, a.slug]);

  const muda = (k: string, v: any) => setA((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    setMsg("");
    let logo_url = a.logo_url, capa_url = a.capa_url;
    if (logo) { logo_url = await enviar(logo, "logo"); if (!logo_url) return; }
    if (capa) { capa_url = await enviar(capa, "capa"); if (!capa_url) return; }
    const { error } = await sb.from("academias").update({
      nome: a.nome, slogan: a.slogan, sobre: a.sobre, endereco: a.endereco, cidade: a.cidade,
      latitude: a.latitude ? Number(a.latitude) : null, longitude: a.longitude ? Number(a.longitude) : null,
      maps_url: a.maps_url, whatsapp: a.whatsapp, instagram: a.instagram, logo_url, capa_url, cnpj: a.cnpj || null,
      pix_chave: a.pix_chave || null, pix_nome: a.pix_nome || null, pix_cidade: a.pix_cidade || null,
      cores: { ...(a.cores || {}), primaria: a.cores?.primaria || "#7c3aed" },
      modulos: a.modulos, no_diretorio: a.no_diretorio,
      checkin_raio_m: Number(a.checkin_raio_m), tolerancia_atraso_min: Number(a.tolerancia_atraso_min),
      gerar_mensalidades_auto: !!a.gerar_mensalidades_auto, multa_pct: Number(a.multa_pct || 0), juros_mes_pct: Number(a.juros_mes_pct || 0),
      juros_dias_uteis: !!a.juros_dias_uteis, aviso_vencimento_dias: Number(a.aviso_vencimento_dias), cobrar_apos_dias: Number(a.cobrar_apos_dias),
      pendencia_apos_dias: Number(a.pendencia_apos_dias), alerta_mensalidades_atrasadas: Number(a.alerta_mensalidades_atrasadas),
      reengajar_dias: Number(a.reengajar_dias), lembrete_peso_semanal: !!a.lembrete_peso_semanal,
      tema: a.tema || {}, modos_chamada: a.modos_chamada || ["manual"], tipo: a.tipo || "academia", tecnicas_progressivas: !!a.tecnicas_progressivas, meta_estudo_semanal: Number(a.meta_estudo_semanal || 3),
      contrato_texto: a.contrato_texto || null, recompensa_indicacao: a.recompensa_indicacao || null,
      contrato_versao: (a.contrato_texto || "") !== (ctx.academia.contrato_texto || "") ? (a.contrato_texto ? new Date().toISOString().slice(0, 16) : null) : a.contrato_versao,
      alerta_dias_sem_vir: Number(a.alerta_dias_sem_vir), aviso_aniversario_dias: Number(a.aviso_aniversario_dias),
    }).eq("id", a.id);
    setMsg(error ? error.message : "Alterações salvas.");
    router.refresh();
  }

  async function novoQR() {
    if (!confirm("Gerar um QR novo? O QR impresso na parede para de funcionar.")) return;
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb.from("academias").update({ qr_fixo_token: token }).eq("id", a.id);
    if (!error) muda("qr_fixo_token", token);
  }

  return (
    <div className="space-y-6">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-4xl font-extrabold">Personalizar academia</h1>
        <a href={`/${a.slug}`} target="_blank" className="btn-sec">👁️ Ver página pública</a>
      </div>
      <p className="nao-imprimir text-sm text-suave">
        Aqui você muda o que aparece na página da academia: logo, capa, cores, textos, contatos e banners.
        Horários, turmas e professores ficam em <b>Turmas e equipe</b>.
      </p>

      <section className="imprimir-claro flex flex-col items-center gap-4 rounded-3xl bg-painel p-6 text-center">
        <h2 className="text-3xl font-bold">Check-in da {a.nome}</h2>
        <QR texto={link} tamanho={260} />
        <p className="max-w-sm text-suave">Aponte a câmera do celular, entre com seu login e sua presença é marcada.</p>
        <div className="nao-imprimir flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={() => window.print()}>Imprimir para a parede</button>
          <button className="btn-sec" onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Link copiado."))}>Copiar link</button>
          {ctx.admin && <button className="btn-sec" onClick={novoQR}>Gerar QR novo</button>}
        </div>
        <p className="nao-imprimir text-xs text-suave">O check-in só vale para quem está a até {a.checkin_raio_m} m da academia e no horário da aula.</p>
      </section>

      <section className="nao-imprimir flex flex-col items-center gap-3 rounded-3xl bg-painel p-6 text-center">
        <h2 className="text-3xl font-bold">Link de cadastro de alunos</h2>
        <p className="max-w-sm text-suave">Mande no grupo da turma ou cole na recepção. O aluno preenche e você aprova em “Alunos”.</p>
        <QR texto={linkCadastro} tamanho={180} />
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-sec" onClick={() => navigator.clipboard.writeText(linkCadastro).then(() => setMsg("Link de cadastro copiado."))}>Copiar link</button>
          <a className="btn-sec" target="_blank" href={`https://wa.me/?text=${encodeURIComponent(`Faça seu cadastro na ${a.nome}: ${linkCadastro}`)}`}>Mandar no WhatsApp</a>
        </div>
      </section>

      {ctx.admin ? (
        <section className="nao-imprimir space-y-4 rounded-2xl bg-painel p-4">
          <h2 className="text-2xl font-bold">Dados da academia</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="rotulo">Nome</label><input className="campo" value={a.nome || ""} onChange={(e) => muda("nome", e.target.value)} /></div>
            <div><label className="rotulo">Frase de apresentação</label><input className="campo" value={a.slogan || ""} onChange={(e) => muda("slogan", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="rotulo">Sobre nós</label><textarea className="campo min-h-28" value={a.sobre || ""} onChange={(e) => muda("sobre", e.target.value)} /></div>
            <div>
              <label className="rotulo">Logo</label>
              <div className="flex items-center gap-2">
                {a.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <input type="file" accept="image/*" className="campo" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div>
              <label className="rotulo">Foto de capa (topo da página)</label>
              <div className="flex items-center gap-2">
                {a.capa_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.capa_url} alt="" className="h-12 w-20 rounded-lg object-cover" />
                )}
                <input type="file" accept="image/*" className="campo" onChange={(e) => setCapa(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div>
              <label className="rotulo">Cor da academia</label>
              <input type="color" className="h-12 w-full rounded-xl" value={a.cores?.primaria || "#7c3aed"} onChange={(e) => muda("cores", { ...(a.cores || {}), primaria: e.target.value })} />
            </div>
            <div><label className="rotulo">WhatsApp (com DDI e DDD)</label><input className="campo" placeholder="5524999999999" value={a.whatsapp || ""} onChange={(e) => muda("whatsapp", e.target.value)} /></div>
            <div><label className="rotulo">Instagram</label><input className="campo" placeholder="@academia" value={a.instagram || ""} onChange={(e) => muda("instagram", e.target.value)} /></div>
            <div><label className="rotulo">Endereço</label><input className="campo" value={a.endereco || ""} onChange={(e) => muda("endereco", e.target.value)} /></div>
            <div><label className="rotulo">Cidade</label><input className="campo" value={a.cidade || ""} onChange={(e) => muda("cidade", e.target.value)} /></div>
            <div><label className="rotulo">Latitude</label><input className="campo" value={a.latitude ?? ""} onChange={(e) => muda("latitude", e.target.value)} /></div>
            <div><label className="rotulo">Longitude</label><input className="campo" value={a.longitude ?? ""} onChange={(e) => muda("longitude", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="rotulo">Link do Google Maps</label><input className="campo" value={a.maps_url || ""} onChange={(e) => muda("maps_url", e.target.value)} /></div>
            <p className="text-xs text-suave sm:col-span-2">Dica: no Google Maps, segure o dedo em cima da academia para ver a latitude e a longitude.</p>
          </div>

          <h3 className="pt-2 text-xl font-bold">Pix das mensalidades</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="rotulo">Chave Pix</label><input className="campo" placeholder="CPF, CNPJ, e-mail ou +5524999999999" value={a.pix_chave || ""} onChange={(e) => muda("pix_chave", e.target.value)} /></div>
            <div><label className="rotulo">Nome do recebedor</label><input className="campo" maxLength={25} value={a.pix_nome || ""} onChange={(e) => muda("pix_nome", e.target.value)} /></div>
            <div><label className="rotulo">Cidade</label><input className="campo" maxLength={15} value={a.pix_cidade || ""} onChange={(e) => muda("pix_cidade", e.target.value)} /></div>
            <div><label className="rotulo">CNPJ (aparece no recibo)</label><input className="campo" value={a.cnpj || ""} onChange={(e) => muda("cnpj", e.target.value)} /></div>
            <p className="text-xs text-suave sm:col-span-2">Com a chave preenchida, o aluno vê o botão “Pagar com Pix” com QR e copia e cola já com o valor, e envia o comprovante pelo app.</p>
          </div>

          <h3 className="pt-2 text-xl font-bold">Regras</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="rotulo">Raio do check-in (m)</label><input type="number" className="campo" value={a.checkin_raio_m} onChange={(e) => muda("checkin_raio_m", e.target.value)} /></div>
            <div><label className="rotulo">Tolerância de atraso (min)</label><input type="number" className="campo" value={a.tolerancia_atraso_min} onChange={(e) => muda("tolerancia_atraso_min", e.target.value)} /></div>
            <div><label className="rotulo">Alerta de sumido (dias)</label><input type="number" className="campo" value={a.alerta_dias_sem_vir} onChange={(e) => muda("alerta_dias_sem_vir", e.target.value)} /></div>
            <div><label className="rotulo">Aviso de aniversário (dias antes)</label><input type="number" className="campo" value={a.aviso_aniversario_dias} onChange={(e) => muda("aviso_aniversario_dias", e.target.value)} /></div>
          </div>

          <h3 className="pt-2 text-xl font-bold">Mensalidades e cobrança</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="rotulo">Multa por atraso (%)</label><input type="number" step="0.1" className="campo" value={a.multa_pct ?? 0} onChange={(e) => muda("multa_pct", e.target.value)} /></div>
            <div><label className="rotulo">Juros ao mês (%)</label><input type="number" step="0.1" className="campo" value={a.juros_mes_pct ?? 0} onChange={(e) => muda("juros_mes_pct", e.target.value)} /></div>
            <div><label className="rotulo">Lembrar antes (dias)</label><input type="number" className="campo" value={a.aviso_vencimento_dias} onChange={(e) => muda("aviso_vencimento_dias", e.target.value)} /></div>
            <div><label className="rotulo">Cobrar depois (dias)</label><input type="number" className="campo" value={a.cobrar_apos_dias} onChange={(e) => muda("cobrar_apos_dias", e.target.value)} /></div>
            <div><label className="rotulo">Virar pendência após (dias)</label><input type="number" className="campo" value={a.pendencia_apos_dias} onChange={(e) => muda("pendencia_apos_dias", e.target.value)} /></div>
            <div><label className="rotulo">Aviso no check-in com (atrasadas)</label><input type="number" className="campo" value={a.alerta_mensalidades_atrasadas} onChange={(e) => muda("alerta_mensalidades_atrasadas", e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!a.juros_dias_uteis} onChange={(e) => muda("juros_dias_uteis", e.target.checked)} /> Contar só dias úteis no atraso (seg a sex)</label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!a.gerar_mensalidades_auto} onChange={(e) => muda("gerar_mensalidades_auto", e.target.checked)} /> Gerar as mensalidades do mês sozinho (dia 1º)</label>
            <p className="text-xs text-suave sm:col-span-4">Juros pro rata: {a.juros_mes_pct || 0}% ao mês ÷ 30 por dia de atraso{a.juros_dias_uteis ? " (só dias úteis)" : ""}. A multa entra uma vez, no primeiro dia de atraso. Coloque 0 para não cobrar.</p>
          </div>

          <h3 className="pt-2 text-xl font-bold">Automações</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="rotulo">“Sentimos sua falta” após (dias)</label><input type="number" className="campo" value={a.reengajar_dias} onChange={(e) => muda("reengajar_dias", e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={!!a.lembrete_peso_semanal} onChange={(e) => muda("lembrete_peso_semanal", e.target.checked)} /> Toda segunda, lembrar quem vai competir de registrar o peso</label>
          </div>

          <p className="rounded-xl bg-painel2 p-3 text-sm">Plano atual: <b>{ROTULO_PLANO[a.plano] || "Essencial"}</b>. Para mudar de plano, fale com o suporte do MA Academias.</p>

          {liberado(a.plano, "backup") && (<>
          <h3 className="pt-2 text-xl font-bold">Backup</h3>
          <Backup academia={a} />
          </>)}

          {liberado(a.plano, "contrato") && (<>
          <h3 className="pt-2 text-xl font-bold">Contrato e termos</h3>
          <p className="text-xs text-suave">Os alunos (ou responsáveis) aceitam no app. Se você mudar o texto, todos aceitam de novo. {aceites !== null && `Versão atual: ${aceites} aceite(s).`}</p>
          <textarea className="campo min-h-40 text-sm" placeholder={"Ex.: 1. A mensalidade vence todo dia 10...\n2. O aluno declara estar apto à prática de atividade física...\n3. Autorizo o uso de imagem..."} value={a.contrato_texto || ""} onChange={(e) => muda("contrato_texto", e.target.value)} />

          </>)}

          {liberado(a.plano, "indicacoes") && (<>
          <h3 className="pt-2 text-xl font-bold">Indique um amigo</h3>
          <input className="campo" placeholder="Recompensa (ex.: 10% de desconto na próxima mensalidade, kimono, selo…)" value={a.recompensa_indicacao || ""} onChange={(e) => muda("recompensa_indicacao", e.target.value)} />
          <p className="text-xs text-suave">O aluno compartilha o link dele. Quando o amigo se cadastra e você aprova, a indicação aparece em Alunos e ele ganha o título 🤝 Embaixador.</p>
          </>)}

          <h3 className="pt-2 text-xl font-bold">Visual</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "claro-simples", t: "Minimalista claro", d: "Fundo branco, limpo e simples", modo: "claro", fonte: "simples" },
              { id: "escuro-simples", t: "Minimalista escuro", d: "Fundo escuro, letras simples", modo: "escuro", fonte: "simples" },
              { id: "escuro-esportiva", t: "Esportivo", d: "Escuro, títulos grandes e fortes", modo: "escuro", fonte: "esportiva" },
            ].map((v) => {
              const on = (a.tema?.modo || "escuro") === v.modo && (a.tema?.fonte || "esportiva") === v.fonte;
              return (
                <button key={v.id} onClick={() => muda("tema", { ...(a.tema || {}), modo: v.modo, fonte: v.fonte })}
                  className="rounded-xl border-2 p-3 text-left" style={{ borderColor: on ? "var(--cor)" : "var(--color-linha)", background: v.modo === "claro" ? "#f5f6f8" : "#121a36", color: v.modo === "claro" ? "#151a23" : "#eef1fa" }}>
                  <span className="block font-bold">{on ? "✓ " : ""}{v.t}</span>
                  <span className="text-xs opacity-75">{v.d}</span>
                  <span className="mt-2 block h-2 rounded-full" style={{ background: "var(--cor)" }} />
                </button>
              );
            })}
          </div>
          <p className="text-xs text-suave">Vale para o app e para a página pública. A cor da academia continua a mesma.</p>

          <h3 className="pt-2 text-xl font-bold">Banners da página pública</h3>
          <p className="text-xs text-suave">Aparecem no topo da página quando a função “Propagandas” está ligada (lá embaixo).</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {banners.map((b) => (
              <div key={b.id} className={`overflow-hidden rounded-xl bg-painel2 ${b.ativa ? "" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imagem_url} alt="" className="aspect-[12/5] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-2 text-xs">
                  <span className="truncate">{b.titulo || "Sem título"}</span>
                  <span className="flex gap-2"><button className="underline" onClick={() => alternarBanner(b)}>{b.ativa ? "ocultar" : "mostrar"}</button><button className="underline" onClick={() => apagarBanner(b)}>apagar</button></span>
                </div>
              </div>
            ))}
          </div>
          {novoBanner ? (
            <div className="grid gap-2 rounded-xl border border-linha p-3 sm:grid-cols-2">
              <input type="file" accept="image/*" className="campo sm:col-span-2" onChange={(e) => setNovoBanner({ ...novoBanner, arquivo: e.target.files?.[0] })} />
              <input className="campo" placeholder="Título (ex.: Matrículas abertas)" onChange={(e) => setNovoBanner({ ...novoBanner, titulo: e.target.value })} />
              <input className="campo" placeholder="Texto curto" onChange={(e) => setNovoBanner({ ...novoBanner, texto: e.target.value })} />
              <input className="campo sm:col-span-2" placeholder="Link ao tocar (opcional)" onChange={(e) => setNovoBanner({ ...novoBanner, link: e.target.value })} />
              <div className="flex gap-2"><button className="btn" onClick={salvarBanner}>Adicionar</button><button className="btn-sec" onClick={() => setNovoBanner(null)}>Cancelar</button></div>
            </div>
          ) : <button className="btn-sec w-fit" onClick={() => setNovoBanner({})}>+ Banner</button>}
          <p className="text-xs text-suave">Tamanho ideal: 1200 × 500 pixels.</p>

          <h3 className="pt-2 text-xl font-bold">Tipo</h3>
          <div className="flex flex-wrap gap-2">
            {[["academia", "🥋 Academia"], ["projeto_social", "🤝 Projeto social"]].map(([k, v]) => (
              <button key={k} className="chip py-2" style={(a.tipo || "academia") === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                onClick={() => setA((x: any) => ({ ...x, tipo: k, modulos: k === "projeto_social" ? { ...(x.modulos || {}), mensalidades: false } : x.modulos }))}>{v}</button>
            ))}
          </div>
          <p className="text-xs text-suave">Projeto social: sem mensalidades e com relatório e lista de presença para prestação de contas.</p>
          <div className="flex items-center gap-2 text-sm">
            <span>Meta de estudo por semana (quizzes/roletas):</span>
            <input type="number" min={1} max={20} className="campo w-20" value={a.meta_estudo_semanal ?? 3} onChange={(e) => muda("meta_estudo_semanal", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!a.tecnicas_progressivas} onChange={(e) => muda("tecnicas_progressivas", e.target.checked)} /> Técnicas progressivas: o aluno vê a matéria até a próxima faixa dele</label>

          {liberado(a.plano, "chamada_facial") && (<>
          <h3 className="pt-2 text-xl font-bold">Chamada</h3>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={(a.modos_chamada || []).includes("facial")}
              onChange={(e) => muda("modos_chamada", e.target.checked ? Array.from(new Set([...(a.modos_chamada || ["manual"]), "facial"])) : (a.modos_chamada || []).filter((x: string) => x !== "facial"))} />
            <span>Chamada por reconhecimento facial (foto da turma). Cada aluno cadastra o rosto na própria ficha, com autorização. A foto é analisada no celular; só um código numérico fica guardado.</span>
          </label>
          </>)}

          <h3 className="pt-2 text-xl font-bold">Funções ligadas</h3>
          <div className="flex flex-wrap gap-2">
            {MODULOS.map(([k, v]) => {
              const pode = liberado(a.plano, k);
              const on = pode && a.modulos?.[k] !== false;
              return (
                <button key={k} className="chip py-2" disabled={!pode} title={pode ? "" : `Disponível no plano ${planoMinimoNome(k)}`}
                  style={on ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : !pode ? { opacity: 0.5 } : {}}
                  onClick={() => muda("modulos", { ...(a.modulos || {}), [k]: !on })}>{!pode ? "🔒 " : on ? "✓ " : ""}{v}{!pode ? ` · ${planoMinimoNome(k)}` : ""}</button>
              );
            })}
            {ctx.master && (
              <button className="chip py-2" style={a.modulos?.tecnicas ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}
                onClick={() => muda("modulos", { ...(a.modulos || {}), tecnicas: !a.modulos?.tecnicas })}>{a.modulos?.tecnicas ? "✓ " : ""}Técnicas e estudo (só master)</button>
            )}
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!a.no_diretorio} onChange={(e) => muda("no_diretorio", e.target.checked)} /> Aparecer na página geral de academias</label>

          {msg && <p className="text-sm text-suave">{msg}</p>}
          <button className="btn" onClick={salvar}>Salvar alterações</button>
        </section>
      ) : msg && <p className="text-sm text-suave">{msg}</p>}
    </div>
  );
}
