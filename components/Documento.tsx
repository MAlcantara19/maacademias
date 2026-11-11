import Link from "next/link";

// Layout simples para textos longos (termos e privacidade)
export function Documento({ titulo, versao, children }: { titulo: string; versao: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm text-suave">← MA Academias</Link>
      <h1 className="mt-6 text-4xl font-extrabold">{titulo}</h1>
      <p className="mt-1 text-sm text-suave">Versão {versao}</p>
      <article className="prose-doc mt-8 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-texto">
        {children}
      </article>
    </main>
  );
}
