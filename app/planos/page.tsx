import Link from "next/link";
import type { Metadata } from "next";
import { EXTRAS, PLANOS } from "@/lib/planos";
import { Faixa } from "@/components/Faixa";

export const metadata: Metadata = {
  title: "Planos e preços — MA Academias",
  description: "Sistema para academias de luta: chamada, alunos, mensalidades com Pix e página da academia. Planos a partir de R$ 59/mês.",
};

const COMPARA: [string, boolean, boolean, boolean][] = [
  ["Alunos, turmas e chamada", true, true, true],
  ["Página da academia e cadastro online", true, true, true],
  ["Carteirinha digital e app do aluno", true, true, true],
  ["Mensalidades com Pix e recibo", false, true, true],
  ["Cobrança automática, multa e juros", false, true, true],
  ["Despesas, lucro e relatório do mês", false, true, true],
  ["Contrato digital e backup", false, true, true],
  ["Ranking, títulos e temporadas", false, false, true],
  ["Feed, galeria e notificações", false, false, true],
  ["Campeonatos e pesagem", false, false, true],
  ["Check-in por QR e chamada por foto", false, false, true],
];

export default function Planos() {
  const zap = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS;
  const link = (plano: string) => zap
    ? `https://wa.me/${zap.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Quero o plano ${plano} do MA Academias para a minha academia.`)}`
    : "/conheca";
  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="titulo text-xl font-bold">MA Academias</Link>
        <div className="flex gap-2"><Link href="/demo" className="btn-sec text-sm">Ver demonstração</Link><Link href="/login" className="btn-sec text-sm">Entrar</Link></div>
      </header>

      <section className="py-10 text-center">
        <p className="chip mb-4">Sem fidelidade · sem taxa por aluno · suporte direto no WhatsApp</p>
        <h1 className="text-4xl font-extrabold sm:text-6xl">Planos para cada fase da academia</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-suave">Comece pelo essencial e suba quando quiser. Cancelou, seus dados saem com você numa planilha.</p>
        <Faixa graus={3} altura={10} className="mx-auto mt-8 max-w-md" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PLANOS.map((p) => (
          <article key={p.id} className={`relative flex flex-col rounded-3xl bg-painel p-6 ${p.destaque ? "ring-2 ring-[var(--cor)]" : ""}`}>
            {p.destaque && <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "var(--cor)" }}>Mais escolhido</span>}
            <h2 className="text-3xl font-bold">{p.nome}</h2>
            <p className="text-sm text-suave">{p.frase}</p>
            <p className="mt-4"><span className="numero text-5xl font-extrabold">R$ {p.preco}</span><span className="text-suave">/mês</span></p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{p.itens.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            <a href={link(p.nome)} target="_blank" className={`${p.destaque ? "btn" : "btn-sec"} mt-6 w-full`}>Quero o {p.nome}</a>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl p-6 text-center text-white sm:p-10" style={{ background: "var(--cor)" }}>
        <h2 className="text-3xl font-extrabold">Plano Fundador: R$ 69/mês com tudo do Completo</h2>
        <p className="mx-auto mt-2 max-w-xl opacity-90">Só para as 5 primeiras academias, com o preço travado por 12 meses. Em troca, a gente conversa sobre o que melhorar.</p>
        <a href={link("Fundador")} target="_blank" className="mt-5 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-black">Quero ser fundador</a>
      </section>

      <section className="mt-10 overflow-x-auto rounded-2xl bg-painel p-4">
        <h2 className="mb-3 text-2xl font-bold">Compare</h2>
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-suave"><th className="py-2">Recurso</th><th className="text-center">Essencial</th><th className="text-center">Profissional</th><th className="text-center">Completo</th></tr></thead>
          <tbody className="divide-y divide-linha">
            {COMPARA.map(([r, a, b, c]) => (
              <tr key={r}><td className="py-2">{r}</td>{[a, b, c].map((v, i) => <td key={i} className="text-center">{v ? "✓" : <span className="text-suave">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {EXTRAS.map((e) => (
          <div key={e.nome} className="rounded-2xl bg-painel p-4">
            <p className="font-semibold">{e.nome}</p>
            <p className="numero text-xl font-bold">{e.preco}</p>
            <p className="text-sm text-suave">{e.obs}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-2xl font-bold">Perguntas comuns</h2>
        {[
          ["Tem fidelidade?", "Não. Você paga mês a mês e pode cancelar quando quiser."],
          ["Cobra por aluno?", "Não. O preço é por academia, com uso justo de até 300 alunos ativos."],
          ["Preciso instalar algo?", "Não. Funciona no navegador e pode ser instalado na tela do celular como aplicativo."],
          ["E se eu precisar de ajuda?", "O suporte é direto pelo WhatsApp, com quem fez o sistema."],
          ["Meus dados ficam seguros?", "Cada pessoa só vê o que é dela; o professor vê só as turmas dele. Você baixa um backup em Excel quando quiser."],
        ].map(([p, r]) => (
          <details key={p} className="rounded-2xl bg-painel p-4"><summary className="cursor-pointer font-semibold">{p}</summary><p className="mt-2 text-suave">{r}</p></details>
        ))}
      </section>
    </main>
  );
}
