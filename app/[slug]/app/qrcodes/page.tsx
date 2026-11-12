"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { QR } from "@/components/QR";
import { liberado } from "@/lib/planos";
import { gerarPix } from "@/lib/pix";
import QRCode from "qrcode";

type Cartao = { id: string; titulo: string; texto: string; link: string; imprimir?: boolean; pix?: boolean };

// Baixa o QR em SVG (vetor): serve para gráfica, adesivo e para modelar a placa 3D
async function baixarSvg(texto: string, nome: string) {
  const svg = await QRCode.toString(texto, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  a.download = `qr-${nome}.svg`;
  a.click();
}

// Todos os QR Codes da academia num lugar só: check-in da parede, cadastro e página
export default function QrCodes() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const a = ctx.academia;
  const [token, setToken] = useState(a.qr_fixo_token);
  const [origem, setOrigem] = useState("");
  const [msg, setMsg] = useState("");
  const [imprimindo, setImprimindo] = useState<string | null>(null);
  useEffect(() => setOrigem(window.location.origin), []);

  async function novoQR() {
    if (!confirm("Gerar um QR novo? O QR impresso na parede para de funcionar.")) return;
    const t = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb.from("academias").update({ qr_fixo_token: t }).eq("id", a.id);
    if (!error) { setToken(t); setMsg("QR novo gerado. Imprima de novo para a parede."); }
  }
  function imprimir(id: string) {
    setImprimindo(id);
    setTimeout(() => { window.print(); setImprimindo(null); }, 100);
  }

  const cartoes: Cartao[] = [
    ...(liberado(a.plano, "chamada_qr") && (a.modos_chamada || []).includes("qr_fixo") ? [{
      id: "checkin", titulo: `Check-in da ${a.nome}`, imprimir: true,
      texto: "Aponte a câmera do celular, entre com seu login e sua presença é marcada.",
      link: `${origem}/${a.slug}/checkin?t=${token}`,
    }] : []),
    ...(a.modulos?.cadastro_online !== false ? [{
      id: "cadastro", titulo: "Cadastro de alunos", imprimir: true,
      texto: "O aluno preenche o cadastro pelo celular e você aprova em “Alunos”.",
      link: `${origem}/${a.slug}/cadastro`,
    }] : []),
    { id: "pagina", titulo: "Página da academia", imprimir: true, texto: "Horários, endereço, professores e WhatsApp da academia.", link: `${origem}/${a.slug}` },
    ...(liberado(a.plano, "qr_pix") && a.pix_chave ? [{
      id: "pix", titulo: "Pague sua mensalidade aqui", imprimir: true, pix: true,
      texto: `Abra o app do seu banco, escolha Pix → Ler QR Code e digite o valor. Recebedor: ${a.pix_nome || a.nome}.`,
      link: gerarPix({ chave: a.pix_chave, nome: a.pix_nome || a.nome, cidade: a.pix_cidade || a.cidade || "BRASIL" }),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="nao-imprimir">
        <h1 className="text-4xl font-extrabold">QR Codes</h1>
        <p className="text-sm text-suave">Imprima e cole na parede, ou mande o link no grupo da turma.</p>
      </div>
      {msg && <p className="nao-imprimir text-sm text-alerta">{msg}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {cartoes.map((c) => (
          <section key={c.id} className={`imprimir-claro flex flex-col items-center gap-3 rounded-3xl bg-painel p-6 text-center ${imprimindo && imprimindo !== c.id ? "nao-imprimir" : ""}`}>
            <h2 className="text-2xl font-bold">{c.titulo}</h2>
            {origem && <QR texto={c.link} tamanho={c.id === "checkin" ? 240 : 190} />}
            <p className="max-w-xs text-sm text-suave">{c.texto}</p>
            <div className="nao-imprimir flex flex-wrap justify-center gap-2">
              {c.imprimir && <button className="btn text-sm" onClick={() => imprimir(c.id)}>🖨️ Imprimir</button>}
              <button className="btn-sec text-sm" onClick={() => navigator.clipboard.writeText(c.link).then(() => setMsg(c.pix ? "Pix copia e cola copiado." : "Link copiado."))}>{c.pix ? "Copiar Pix" : "Copiar link"}</button>
              {!c.pix && <a className="btn-sec text-sm" target="_blank" href={`https://wa.me/?text=${encodeURIComponent(`${c.titulo}: ${c.link}`)}`}>WhatsApp</a>}
              <button className="btn-sec text-sm" onClick={() => baixarSvg(c.link, c.id)}>⬇️ SVG (gráfica/3D)</button>
              {c.id === "checkin" && ctx.admin && <button className="btn-sec text-sm" onClick={novoQR}>Gerar QR novo</button>}
            </div>
            {c.id === "checkin" && <p className="nao-imprimir text-xs text-suave">Vale para quem está a até {a.checkin_raio_m} m da academia e no horário da aula.</p>}
          </section>
        ))}
      </div>

      <details className="nao-imprimir rounded-2xl bg-painel p-4 text-sm">
        <summary className="cursor-pointer font-semibold">🧱 Placa de parede (impressão 3D, acrílico ou adesivo)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-suave">
          <li><b className="text-texto">Arquivo:</b> use o botão “SVG”. Ele é vetor: aumenta sem perder qualidade e pode ser importado no Tinkercad, Fusion, Bambu Studio ou mandado para a gráfica.</li>
          <li><b className="text-texto">Tamanho do QR:</b> no mínimo 6 × 6 cm (ideal 8 × 8 cm) para ler de 1 metro. Na impressão 3D, cada quadradinho deve ter pelo menos 2 mm.</li>
          <li><b className="text-texto">Placa sugerida:</b> 12 × 16 cm, com 3 mm de base, QR e logo em relevo de 1 mm, em duas cores (ex.: base branca e QR preto, trocando o filamento na altura do relevo).</li>
          <li><b className="text-texto">Contraste:</b> QR sempre escuro sobre fundo claro, sem brilho. Deixe uma margem branca de pelo menos 1 cm em volta.</li>
          <li><b className="text-texto">Logo na placa:</b> SVG ou PNG de 1000 × 1000 px com fundo transparente.</li>
          <li><b className="text-texto">Gerou QR novo?</b> O QR do check-in antigo para de funcionar: imprima a placa de novo.</li>
        </ul>
      </details>
    </div>
  );
}
