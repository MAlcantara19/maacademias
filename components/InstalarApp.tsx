"use client";
import { useEffect, useState } from "react";

// O navegador avisa uma vez que dá para instalar: guardamos o aviso para usar no botão
let aviso: any = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => { e.preventDefault(); aviso = e; window.dispatchEvent(new Event("ma-instalavel")); });
}

function tipoAparelho() {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "computador";
}

// Botão "Instalar aplicativo" (PWA): some quando o app já está instalado/aberto como app
export function InstalarApp({ className = "btn-sec", texto }: { className?: string; texto?: string }) {
  const [instalado, setInstalado] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const aparelho = tipoAparelho();

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalado(standalone);
    setPronto(!!aviso);
    const ok = () => setPronto(true);
    const fim = () => setInstalado(true);
    window.addEventListener("ma-instalavel", ok);
    window.addEventListener("appinstalled", fim);
    return () => { window.removeEventListener("ma-instalavel", ok); window.removeEventListener("appinstalled", fim); };
  }, []);

  async function instalar() {
    if (aviso) {
      aviso.prompt();
      const r = await aviso.userChoice.catch(() => null);
      if (r?.outcome === "accepted") setInstalado(true);
      aviso = null; setPronto(false);
    } else setAjuda(true);
  }

  if (instalado) return null;
  const rotulo = texto || (aparelho === "computador" ? "💻 Instalar no computador" : "📲 Instalar no celular");
  return (
    <>
      <button className={className} onClick={instalar}>{rotulo}{!pronto && aparelho !== "ios" ? "" : ""}</button>
      {ajuda && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setAjuda(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-painel p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold">Instalar o aplicativo</h2>
            {aparelho === "ios" ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Abra este site no <b>Safari</b>.</li>
                <li>Toque em <b>Compartilhar</b> (o quadrado com a seta ⬆️).</li>
                <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
              </ol>
            ) : aparelho === "android" ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>No Chrome, toque nos <b>três pontinhos ⋮</b> no canto de cima.</li>
                <li>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li>
                <li>Confirme. O ícone aparece junto dos outros aplicativos.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>No Chrome ou Edge, clique no ícone <b>de instalar</b> no fim da barra de endereço (um monitor com seta).</li>
                <li>Ou abra o menu <b>⋮</b> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app</b>.</li>
              </ol>
            )}
            <p className="text-xs text-suave">Depois de instalado, ele abre direto na sua academia, sem precisar do navegador.</p>
            <button className="btn w-full" onClick={() => setAjuda(false)}>Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
