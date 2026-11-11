// Botão flutuante de WhatsApp (canto inferior direito)
export function BotaoWhats({ numero, texto, acima = false, rotulo = "Falar no WhatsApp" }: { numero?: string | null; texto?: string; acima?: boolean; rotulo?: string }) {
  if (!numero) return null;
  const link = `https://wa.me/${numero.replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
  return (
    <a href={link} target="_blank" rel="noopener" aria-label={rotulo} title={rotulo}
      className={`nao-imprimir fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition hover:scale-105 ${acima ? "bottom-24 lg:bottom-6" : "bottom-6"}`}
      style={{ background: "#25D366", marginBottom: "env(safe-area-inset-bottom)" }}>
      <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden>
        <path d="M16 3C9 3 3.4 8.6 3.4 15.6c0 2.2.6 4.4 1.7 6.3L3.3 28.7l7-1.8c1.8 1 3.8 1.5 5.8 1.5 7 0 12.6-5.6 12.6-12.6S23 3 16 3zm0 23c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-4.2 1.1 1.1-4.1-.3-.4a10.4 10.4 0 1 1 9.1 5zm5.7-7.8c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.5 8.5 0 0 1-4.2-3.7c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3c.2.2 2.2 3.4 5.4 4.7 2 .9 2.8.9 3.8.8.6-.1 1.8-.7 2.1-1.5s.3-1.3.2-1.5-.3-.2-.6-.4z" />
      </svg>
    </a>
  );
}
