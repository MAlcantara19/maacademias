"use client";
import { forwardRef } from "react";
import { Faixa } from "@/components/Faixa";
import { QR } from "@/components/QR";
import { dataBR } from "@/lib/util";

// Configuração da carteirinha (fica em academias.carteirinha)
export type ConfigCartao = {
  modelo?: "classico" | "faixa" | "claro" | "cracha";
  cor?: string;            // cor de destaque (padrão: cor da academia)
  logo?: boolean;          // mostrar a logo
  nascimento?: boolean; desde?: boolean; modalidade?: boolean; qr?: boolean;
  fundo_foto?: boolean;    // (antigo) usa a foto de capa de fundo
  fundo?: "logo" | "capa" | "imagem" | "nenhum"; // fundo do cartão (padrão: logo da academia)
  fundo_url?: string;      // imagem própria escolhida para o fundo
  fundo_forca?: number;    // 5 a 40 (% de destaque da imagem de fundo)
  frase?: string;          // frase curta no rodapé
  verso?: boolean;         // gera o verso com contatos e regras (Completo)
  verso_texto?: string;
};

export const MODELOS_CARTAO = [
  { id: "classico", nome: "Clássico", texto: "Escuro com a cor da academia" },
  { id: "faixa", nome: "Faixa", texto: "Faixa grande na cor da graduação" },
  { id: "claro", nome: "Claro", texto: "Fundo branco, estilo documento" },
  { id: "cracha", nome: "Crachá", texto: "Em pé, com foto grande" },
] as const;

type Props = { academia: any; p: any; cfg: ConfigCartao; ano: number; codigo: string };
const COND = "'Barlow Condensed', sans-serif";

export const CartaoAluno = forwardRef<HTMLDivElement, Props>(function CartaoAluno({ academia, p, cfg, ano, codigo }, ref) {
  const cor = cfg.cor || academia.cores?.primaria || "#7c3aed";
  const modelo = cfg.modelo || "classico";
  const mostra = (k: keyof ConfigCartao) => cfg[k] !== false;
  const claro = modelo === "claro";
  const tipoFundo = cfg.fundo || (cfg.fundo_foto ? "capa" : "logo");
  const imgFundo = tipoFundo === "capa" ? academia.capa_url : tipoFundo === "imagem" ? cfg.fundo_url : null;
  const forca = Math.max(5, Math.min(40, cfg.fundo_forca ?? 12)) / 100;
  const fundo = claro ? "#ffffff"
    : modelo === "faixa" ? `linear-gradient(180deg, #0f1428 0%, #0f1428 62%, ${p.cor_faixa || cor} 62%)`
    : `linear-gradient(135deg, #121a36 0%, #121a36 55%, ${cor} 140%)`;
  const corTexto = claro ? "#151a23" : "#ffffff";

  const Logo = ({ t = 30 }: { t?: number }) => mostra("logo") && academia.logo_url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={academia.logo_url} alt="" crossOrigin="anonymous" style={{ width: t, height: t }} className="shrink-0 rounded-md object-contain" />
    : null;
  const Foto = ({ w, h }: { w: number; h: number }) => (
    <div className="shrink-0 overflow-hidden rounded-lg" style={{ width: w, height: h, background: claro ? "#eef0f4" : "rgba(255,255,255,.1)", boxShadow: `0 0 0 3px ${p.cor_faixa || (claro ? "#d0d5df" : "#ffffff55")}` }}>
      {p.foto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.foto} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
        : <div className="flex h-full items-center justify-center text-3xl opacity-60">🥋</div>}
    </div>
  );
  const Dados = () => (
    <div className="min-w-0 flex-1 text-[11px] leading-tight">
      <p style={{ fontFamily: COND }} className="truncate text-xl font-bold leading-none">{p.nome}</p>
      <p className="mt-1 opacity-80">{p.faixa ? `Faixa ${p.faixa.toLowerCase()}${p.grau ? ` · ${p.grau}º grau` : ""}` : "—"}</p>
      {mostra("modalidade") && <p className="opacity-80">{p.faixa_modalidade || (p.modalidades || []).join(", ")}</p>}
      {mostra("nascimento") && <p className="opacity-80">Nasc. {dataBR(p.nascimento)}</p>}
      {mostra("desde") && <p className="opacity-80">Aluno desde {dataBR(p.aluno_desde)}</p>}
    </div>
  );
  // fundo: logo grande e clarinha no centro, ou a capa/uma imagem escolhida bem suave
  const camadaFoto = imgFundo ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgFundo} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: claro ? `rgba(255,255,255,${1 - forca * 1.4})` : `rgba(10,14,30,${1 - forca * 1.6})` }} />
    </>
  ) : tipoFundo === "logo" && academia.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={academia.logo_url} alt="" crossOrigin="anonymous" className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 object-contain" style={{ opacity: forca }} />
  ) : null;

  if (modelo === "cracha") {
    return (
      <div ref={ref} className="relative w-[230px] overflow-hidden rounded-2xl" style={{ aspectRatio: "54 / 85.6", background: fundo, color: corTexto, fontFamily: "Barlow, sans-serif" }}>
        {camadaFoto}
        <div className="relative flex h-full flex-col items-center p-4 text-center">
          <div className="flex w-full items-center justify-center gap-2">
            <Logo t={26} />
            <span style={{ fontFamily: COND }} className="truncate text-base font-extrabold leading-none">{academia.nome}</span>
          </div>
          <div className="mt-3"><Foto w={104} h={128} /></div>
          <p style={{ fontFamily: COND }} className="mt-3 text-2xl font-bold leading-none">{p.apelido || p.nome?.split(" ")[0]}</p>
          <p className="text-[11px] opacity-80">{p.nome}</p>
          <p className="mt-1 text-[11px] opacity-80">{p.faixa ? `Faixa ${p.faixa.toLowerCase()}` : ""}{mostra("modalidade") && p.faixa_modalidade ? ` · ${p.faixa_modalidade}` : ""}</p>
          <div className="mt-auto flex w-full items-end justify-between">
            <span className="numero text-sm font-bold opacity-80">{ano}</span>
            {mostra("qr") && <QR texto={codigo} tamanho={56} />}
          </div>
          <Faixa cor={p.cor_faixa || cor} graus={p.grau || 0} altura={8} className="mt-2 w-full" />
          {cfg.frase && <p className="mt-1 text-[9px] opacity-70">{cfg.frase}</p>}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-[340px] overflow-hidden rounded-2xl sm:w-[428px]" style={{ aspectRatio: "85.6 / 54", background: fundo, color: corTexto, fontFamily: "Barlow, sans-serif", border: claro ? "1px solid #dfe3ea" : undefined }}>
      {camadaFoto}
      {claro && <div className="absolute inset-x-0 top-0 h-2" style={{ background: cor }} />}
      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Logo />
            <span style={{ fontFamily: COND }} className="truncate text-lg font-extrabold leading-none">{academia.nome}</span>
          </span>
          <span className="numero text-sm font-bold opacity-80">{ano}</span>
        </div>
        <div className="mt-3 flex flex-1 gap-3">
          <Foto w={70} h={86} />
          <Dados />
          {mostra("qr") && <div className="shrink-0 self-end"><QR texto={codigo} tamanho={64} /></div>}
        </div>
        {modelo !== "faixa" && <Faixa cor={p.cor_faixa || cor} graus={p.grau || 0} altura={9} className="mt-2" />}
        {cfg.frase && <p className="mt-1 truncate text-[9px] opacity-70">{cfg.frase}</p>}
      </div>
    </div>
  );
});

// Verso da carteirinha (plano Completo)
export const VersoCartao = forwardRef<HTMLDivElement, { academia: any; cfg: ConfigCartao; ano: number }>(function VersoCartao({ academia, cfg, ano }, ref) {
  const cor = cfg.cor || academia.cores?.primaria || "#7c3aed";
  const cracha = cfg.modelo === "cracha";
  return (
    <div ref={ref} className={`relative overflow-hidden rounded-2xl text-white ${cracha ? "w-[230px]" : "w-[340px] sm:w-[428px]"}`}
      style={{ aspectRatio: cracha ? "54 / 85.6" : "85.6 / 54", background: `linear-gradient(135deg, ${cor} -40%, #121a36 60%)`, fontFamily: "Barlow, sans-serif" }}>
      <div className="flex h-full flex-col justify-between p-4 text-[11px] leading-snug">
        <div>
          <p style={{ fontFamily: COND }} className="text-lg font-extrabold leading-none">{academia.nome}</p>
          <p className="mt-2 whitespace-pre-line opacity-90">{cfg.verso_texto || "Esta carteirinha é pessoal e intransferível. Apresente na recepção e nos eventos da academia."}</p>
        </div>
        <div className="space-y-0.5 opacity-90">
          {academia.endereco && <p>📍 {academia.endereco}{academia.cidade ? ` — ${academia.cidade}` : ""}</p>}
          {academia.whatsapp && <p>📱 {academia.whatsapp}</p>}
          {academia.instagram && <p>📸 @{String(academia.instagram).replace(/^@/, "")}</p>}
          <p className="numero font-bold">Válida até 31/12/{ano}</p>
        </div>
      </div>
    </div>
  );
});
