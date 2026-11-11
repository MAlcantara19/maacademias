import Link from "next/link";
import type { Metadata } from "next";
import { EXTRAS, PLANOS } from "@/lib/planos";
import { Faixa } from "@/components/Faixa";
import { BotaoWhats } from "@/components/BotaoWhats";

export const metadata: Metadata = {
  title: "Planos e preços — MA Academias",
  description: "Sistema para academias de luta: alunos, chamada, carteirinha, mensalidades com Pix e página da academia. A partir de R$ 29/mês.",
};

// Linha da comparação: [recurso, base, intermediário, completo]
const COMPARA: [string, ...(boolean | string)[]][] = [
  ["Alunos, turmas, horários e calendário", true, true, true],
  ["Chamada por lista (toque no nome)", true, true, true],
  ["Carteirinha digital", true, true, true],
  ["Ficha do aluno", "básica", "completa", "completa"],
  ["Faixa e graduação", "faixa atual", "histórico + certificado", "histórico + certificado"],
  ["Pendências, ausências e avisos", true, true, true],
  ["Feed de fotos do treino", true, true, true],
  ["Pré-check-in (“vou na aula”)", true, true, true],
  ["Notificações no celular", true, true, true],
  ["Página da academia com WhatsApp", true, true, true],
  ["Chamada por voz", false, true, true],
  ["Check-in por QR Code", false, true, true],
  ["Mensalidades com Pix (multa e juros)", false, true, true],
  ["Comprovante pelo app, recibo e despesas", false, true, true],
  ["Peso e altura com gráfico", false, true, true],
  ["Aluno avisa falta pelo app", false, true, true],
  ["Ranking de presença e relatório do mês", false, true, true],
  ["Campeonatos", false, "inscritos e categorias", "completo, com pesagem e PDF"],
  ["Chamada por reconhecimento facial", false, false, true],
  ["Modo totem na recepção", false, false, true],
  ["Títulos e temporadas", false, false, true],
  ["Indique um amigo", false, false, true],
];

const celula = (v: boolean | string) => (v === true ? "✓" : v === false ? <span className="text-suave">—</span> : <span className="text-sm">{v}</span>);

export default function Planos() {
  const zap = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS;
  const link = (plano: string) => zap
    ? `https://wa.me/${zap.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Quero saber mais do plano ${plano} do MA Academias para a minha academia.`)}`
    : "/conheca";
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="titulo text-xl font-bold">MA Academias</Link>
        <div className="flex gap-2"><Link href="/demo" className="btn-sec text-sm">Demonstração</Link><Link href="/login" className="btn-sec text-sm">Entrar</Link></div>
      </header>

      <section className="py-10 text-center">
        <p className="chip mb-4">Sem fidelidade · sem cobrança por aluno · suporte direto no WhatsApp</p>
        <h1 className="text-4xl font-extrabold sm:text-6xl">Do caderno ao app, no seu ritmo</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-suave">Comece pelo Base e suba quando quiser. Veja cada plano funcionando por dentro antes de decidir.</p>
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
            <div className="mt-6 grid gap-2">
              <Link href={`/demo?plano=${p.id}`} className="btn-sec w-full">👀 Ver o Piloto {p.nome} por dentro</Link>
              <a href={link(p.nome)} target="_blank" className={`${p.destaque ? "btn" : "btn-sec"} w-full`}>Quero o {p.nome}</a>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl p-6 text-center text-white sm:p-10" style={{ background: "var(--cor)" }}>
        <h2 className="text-3xl font-extrabold">Seja uma das 6 academias fundadoras</h2>
        <p className="mx-auto mt-2 max-w-xl opacity-90">Tudo liberado e grátis até fevereiro de 2027. Depois, R$ 29 por mês com tudo por 12 meses. Em troca, a gente conversa sobre o que melhorar.</p>
        <a href={link("Fundador")} target="_blank" className="mt-5 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-black">Quero ser fundador</a>
      </section>

      <section className="mt-10 overflow-x-auto rounded-2xl bg-painel p-4">
        <h2 className="mb-3 text-2xl font-bold">Compare os planos</h2>
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left text-suave"><th className="py-2">Recurso</th>{PLANOS.map((p) => <th key={p.id} className="text-center">{p.nome}<br /><span className="font-normal">R$ {p.preco}</span></th>)}</tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {COMPARA.map(([r, ...v]) => (
              <tr key={r}><td className="py-2 pr-2">{r}</td>{v.map((x, i) => <td key={i} className="px-1 text-center">{celula(x)}</td>)}</tr>
            ))}
            <tr><td className="py-3" />{PLANOS.map((p) => <td key={p.id} className="px-1 text-center"><Link href={`/demo?plano=${p.id}`} className="text-xs underline">ver por dentro</Link></td>)}</tr>
          </tbody>
        </table>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          ["Tem fidelidade?", "Não. Você paga mês a mês e pode cancelar quando quiser, levando seus dados numa planilha."],
          ["Cobra por aluno?", "Não. O preço é por academia (uso justo de até 150 alunos ativos)."],
          ["Preciso instalar algo?", "Não. Funciona no navegador e pode ser instalado na tela do celular como aplicativo."],
          ["O dinheiro das mensalidades passa por vocês?", "Não. O Pix é da sua academia: o aluno paga direto para você. O app só organiza."],
          ["E se eu precisar de ajuda?", "O suporte é direto pelo WhatsApp, com quem fez o sistema."],
          ["Meus dados ficam seguros?", "Cada pessoa só vê o que é dela; o professor vê só as turmas dele. Leia nossa Política de Privacidade."],
        ].map(([p, r]) => (
          <details key={p} className="rounded-2xl bg-painel p-4"><summary className="cursor-pointer font-semibold">{p}</summary><p className="mt-2 text-suave">{r}</p></details>
        ))}
      </section>

      <footer className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-suave">
        <Link href="/termos" className="underline">Termos de Uso</Link>
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>
      </footer>
      <BotaoWhats numero={zap} texto="Olá! Quero saber mais do MA Academias." rotulo="Falar com o MA Academias" />
    </main>
  );
}
