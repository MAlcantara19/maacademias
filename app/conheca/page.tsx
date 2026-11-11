import Link from "next/link";
import type { Metadata } from "next";
import { Faixa } from "@/components/Faixa";

export const metadata: Metadata = {
  title: "MA Academias — o app da sua academia de luta",
  description: "Chamada em segundos, ranking, campeonatos, mensalidades com Pix e página da academia. Tudo no celular.",
};

const RECURSOS = [
  ["✅", "Chamada em segundos", "Toque no aluno ou use o QR Code na parede. Atrasos e faltas registrados sozinhos."],
  ["🏆", "Ranking que motiva", "Por quantidade, porcentagem e idade. Empates dividem o pódio, e o aluno acompanha pelo celular."],
  ["🥇", "Campeonatos sem correria", "Checklist dos atletas, pesagem por categoria, aviso antes da pesagem e ficha em PDF."],
  ["💳", "Mensalidades com Pix", "QR Code com o valor certo, comprovante pelo app e recibo numerado."],
  ["👀", "Ninguém some sem você saber", "Alerta de aluno sumido, aniversários da turma e pendências na hora da chamada."],
  ["📸", "Feed do treino", "Fotos e vídeos só para quem é da academia, com marcação e download para o Instagram."],
  ["🪪", "Carteirinha digital", "Com foto, faixa e QR. Histórico por ano e carteirinha da federação guardada no app."],
  ["🌐", "Página da academia", "Horários, professores, mapa, aula experimental e cadastro online. Pode ter domínio próprio."],
];

export default function Conheca() {
  const zap = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS;
  const link = zap ? `https://wa.me/${zap.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Quero conhecer o app para a minha academia.")}` : "/login";
  return (
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="titulo text-xl font-bold">MA Academias</Link>
        <Link href="/login" className="btn-sec text-sm">Entrar</Link>
      </header>

      <section className="py-14 sm:py-20">
        <p className="chip mb-5">Feito por quem é do tatame</p>
        <h1 className="max-w-3xl text-5xl font-extrabold sm:text-7xl">Sua academia inteira no celular do professor.</h1>
        <p className="mt-5 max-w-2xl text-lg text-suave">
          Chamada, ranking, campeonatos, mensalidades e a página da academia num app só. Sem planilha, sem caderninho, sem procurar carteirinha no Drive.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/demo" className="btn text-lg">Ver a demonstração</Link>
          <Link href="/planos" className="btn-sec text-lg">Ver planos e preços</Link>
        </div>
        <Faixa graus={4} altura={14} className="mt-12" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {RECURSOS.map(([i, t, d]) => (
          <article key={t} className="rounded-2xl bg-painel p-5">
            <p className="text-3xl" aria-hidden>{i}</p>
            <h2 className="mt-2 text-2xl font-bold">{t}</h2>
            <p className="mt-1 text-suave">{d}</p>
          </article>
        ))}
      </section>

      <section className="mt-16 rounded-3xl p-8 text-center sm:p-12" style={{ background: "var(--cor)" }}>
        <h2 className="text-4xl font-extrabold">Liga o que você quiser.</h2>
        <p className="mx-auto mt-3 max-w-xl opacity-90">
          Academia mais tradicional usa só chamada e horários. Quem quer tecnologia liga QR, feed, Pix e campeonatos. É o mesmo app, do seu jeito.
        </p>
        <a href={link} target="_blank" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-black">Falar no WhatsApp</a>
      </section>
    </main>
  );
}
