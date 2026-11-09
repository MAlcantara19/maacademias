"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { QR } from "@/components/QR";

const MODULOS: [string, string][] = [
  ["sobre", "Sobre nós"], ["propaganda", "Propagandas"], ["calendario", "Calendário"], ["avisos", "Avisos"],
  ["ranking", "Ranking"], ["feed", "Feed"], ["materiais", "Material de apoio"], ["mensalidades", "Mensalidades"],
  ["carteirinha", "Carteirinha"], ["campeonatos", "Campeonatos"], ["aula_experimental", "Aula experimental"], ["feedback", "Sugestões"],
  ["tecnicas", "Técnicas, roleta e exames"], ["galeria", "Galeria (Google Drive)"],
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

  useEffect(() => {
    setLink(`${window.location.origin}/${a.slug}/checkin?t=${a.qr_fixo_token}`);
    setLinkCadastro(`${window.location.origin}/${a.slug}/cadastro`);
  }, [a.qr_fixo_token, a.slug]);

  const muda = (k: string, v: any) => setA((x: any) => ({ ...x, [k]: v }));

  async function salvar() {
    setMsg("");
    let logo_url = a.logo_url;
    if (logo) {
      const caminho = `${a.id}/logo-${Date.now()}.${logo.name.split(".").pop()}`;
      const up = await sb.storage.from("publico").upload(caminho, logo);
      if (up.error) return setMsg("Não foi possível enviar a logo: " + up.error.message);
      logo_url = sb.storage.from("publico").getPublicUrl(caminho).data.publicUrl;
    }
    const { error } = await sb.from("academias").update({
      nome: a.nome, slogan: a.slogan, sobre: a.sobre, endereco: a.endereco, cidade: a.cidade,
      latitude: a.latitude ? Number(a.latitude) : null, longitude: a.longitude ? Number(a.longitude) : null,
      maps_url: a.maps_url, whatsapp: a.whatsapp, instagram: a.instagram, logo_url, cnpj: a.cnpj || null,
      pix_chave: a.pix_chave || null, pix_nome: a.pix_nome || null, pix_cidade: a.pix_cidade || null,
      cores: { ...(a.cores || {}), primaria: a.cores?.primaria || "#7c3aed" },
      modulos: a.modulos, no_diretorio: a.no_diretorio,
      checkin_raio_m: Number(a.checkin_raio_m), tolerancia_atraso_min: Number(a.tolerancia_atraso_min),
      gerar_mensalidades_auto: !!a.gerar_mensalidades_auto, multa_pct: Number(a.multa_pct || 0), juros_mes_pct: Number(a.juros_mes_pct || 0),
      juros_dias_uteis: !!a.juros_dias_uteis, aviso_vencimento_dias: Number(a.aviso_vencimento_dias), cobrar_apos_dias: Number(a.cobrar_apos_dias),
      pendencia_apos_dias: Number(a.pendencia_apos_dias), alerta_mensalidades_atrasadas: Number(a.alerta_mensalidades_atrasadas),
      reengajar_dias: Number(a.reengajar_dias), lembrete_peso_semanal: !!a.lembrete_peso_semanal,
      tipo: a.tipo || "academia", tecnicas_progressivas: !!a.tecnicas_progressivas,
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
      <h1 className="text-4xl font-extrabold">QR e ajustes</h1>

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
            <div><label className="rotulo">Logo</label><input type="file" accept="image/*" className="campo" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></div>
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

          <h3 className="pt-2 text-xl font-bold">Tipo</h3>
          <div className="flex flex-wrap gap-2">
            {[["academia", "🥋 Academia"], ["projeto_social", "🤝 Projeto social"]].map(([k, v]) => (
              <button key={k} className="chip py-2" style={(a.tipo || "academia") === k ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}
                onClick={() => setA((x: any) => ({ ...x, tipo: k, modulos: k === "projeto_social" ? { ...(x.modulos || {}), mensalidades: false } : x.modulos }))}>{v}</button>
            ))}
          </div>
          <p className="text-xs text-suave">Projeto social: sem mensalidades e com relatório e lista de presença para prestação de contas.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!a.tecnicas_progressivas} onChange={(e) => muda("tecnicas_progressivas", e.target.checked)} /> Técnicas progressivas: o aluno vê a matéria até a próxima faixa dele</label>

          <h3 className="pt-2 text-xl font-bold">Funções ligadas</h3>
          <div className="flex flex-wrap gap-2">
            {MODULOS.map(([k, v]) => {
              const on = a.modulos?.[k] !== false;
              return (
                <button key={k} className="chip py-2" style={on ? { background: "var(--cor)", borderColor: "var(--cor)" } : {}}
                  onClick={() => muda("modulos", { ...(a.modulos || {}), [k]: !on })}>{on ? "✓ " : ""}{v}</button>
              );
            })}
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!a.no_diretorio} onChange={(e) => muda("no_diretorio", e.target.checked)} /> Aparecer na página geral de academias</label>

          {msg && <p className="text-sm text-suave">{msg}</p>}
          <button className="btn" onClick={salvar}>Salvar alterações</button>
        </section>
      ) : msg && <p className="text-sm text-suave">{msg}</p>}
    </div>
  );
}
