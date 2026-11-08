import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-6xl font-extrabold">Página não encontrada</h1>
      <p className="text-suave">Confira o endereço ou volte para a lista de academias.</p>
      <Link href="/" className="btn">Ver academias</Link>
    </main>
  );
}
