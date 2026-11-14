"use client";
import { useEffect, useRef, useState } from "react";

// Câmera que lê QR Code sem parar (ex.: carteirinhas na chamada).
// Usa o leitor do próprio navegador quando existe; senão, o jsQR.
export function LeitorQR({ onLer, onFechar, titulo = "Aponte para o QR da carteirinha" }: {
  onLer: (texto: string) => Promise<string> | string; onFechar: () => void; titulo?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState("Abrindo a câmera…");
  const [ultimos, setUltimos] = useState<string[]>([]);
  const lidos = useRef(new Map<string, number>());

  useEffect(() => {
    let parar = false, stream: MediaStream | null = null, timer: any;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        setAviso("");
      } catch { setAviso("Não consegui abrir a câmera. Libere o acesso à câmera para este site."); return; }
      const Detector = (window as any).BarcodeDetector;
      const det = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const jsQR = det ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas"); const g = canvas.getContext("2d", { willReadFrequently: true })!;
      const ler = async () => {
        if (parar || !video.current) return;
        let texto: string | null = null;
        try {
          if (det) texto = (await det.detect(video.current))?.[0]?.rawValue || null;
          else if (video.current.videoWidth) {
            const w = 480, h = Math.round((video.current.videoHeight / video.current.videoWidth) * w);
            canvas.width = w; canvas.height = h; g.drawImage(video.current, 0, 0, w, h);
            texto = jsQR!(g.getImageData(0, 0, w, h).data, w, h)?.data || null;
          }
        } catch { /* quadro ruim: tenta de novo */ }
        // o mesmo QR só conta de novo depois de 5 s
        if (texto && Date.now() - (lidos.current.get(texto) || 0) > 5000) {
          lidos.current.set(texto, Date.now());
          try { navigator.vibrate?.(80); } catch { /* */ }
          const r = await onLer(texto);
          setUltimos((u) => [r, ...u].slice(0, 5));
        }
        timer = setTimeout(ler, 250);
      };
      ler();
    })();
    return () => { parar = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <p className="font-semibold">📷 {titulo}</p>
        <button className="rounded-xl bg-white/15 px-4 py-2" onClick={onFechar}>✕ Fechar</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-white/80" />
        {aviso && <p className="absolute inset-x-4 top-4 rounded-xl bg-black/70 p-3 text-center text-sm">{aviso}</p>}
      </div>
      <ul className="space-y-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm">
        {ultimos.length ? ultimos.map((u, i) => <li key={i} className={i ? "opacity-60" : "font-semibold"}>{u}</li>) : <li className="opacity-70">Pode ler uma carteirinha atrás da outra.</li>}
      </ul>
    </div>
  );
}
