"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { QR } from "@/components/QR";
import { liberado } from "@/lib/planos";

type Cartao = { id: string; titulo: string; texto: string; link: string; imprimir?: boolean };

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
              <button className="btn-sec text-sm" onClick={() => navigator.clipboard.writeText(c.link).then(() => setMsg("Link copiado."))}>Copiar link</button>
              <a className="btn-sec text-sm" target="_blank" href={`https://wa.me/?text=${encodeURIComponent(`${c.titulo}: ${c.link}`)}`}>WhatsApp</a>
              {c.id === "checkin" && ctx.admin && <button className="btn-sec text-sm" onClick={novoQR}>Gerar QR novo</button>}
            </div>
            {c.id === "checkin" && <p className="nao-imprimir text-xs text-suave">Vale para quem está a até {a.checkin_raio_m} m da academia e no horário da aula.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
