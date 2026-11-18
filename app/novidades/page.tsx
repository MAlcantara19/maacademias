import Link from "next/link";
import { NOVIDADES } from "@/lib/novidades";

export const metadata = { title: "Novidades — MA Academias", description: "O que mudou no app das academias, versão por versão." };

const dataBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

// Histórico de atualizações para mostrar às academias
export default function Novidades() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href="/" className="text-sm text-suave">← MA Academias</Link>
      <h1 className="mt-4 text-5xl font-extrabold">🆕 Novidades</h1>
      <p className="mt-2 text-suave">Tudo o que chegou no app, da mais nova para a mais antiga. As academias recebem as melhorias sozinhas, sem precisar instalar nada.</p>
      <ol className="mt-8 space-y-6 border-l-2 border-linha pl-5">
        {NOVIDADES.map((n, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[29px] top-1.5 h-4 w-4 rounded-full border-2 border-fundo" style={{ background: i === 0 ? "var(--cor, #7c3aed)" : "var(--color-linha)" }} />
            <p className="text-sm text-suave">{dataBR(n.data)}{i === 0 ? " · mais recente" : ""}</p>
            <h2 className="text-2xl font-bold">{n.titulo}</h2>
            <ul className="mt-2 space-y-1">
              {n.itens.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>✓</span><span>{x}</span></li>)}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
