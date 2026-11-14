// "O que significa cada selo?": explica os títulos, medalhas e ícones do app
const TITULOS: [string, string, string][] = [
  ["💪", "50 treinos", "Chegar a 50 presenças na academia."],
  ["🏅", "100 treinos", "Chegar a 100 presenças."],
  ["🏆", "250 treinos", "Chegar a 250 presenças."],
  ["🎓", "Primeiros passos", "Fazer o primeiro quiz em Estudar."],
  ["💯", "Gabaritou", "Acertar todas as perguntas de um quiz com 10 ou mais."],
  ["📚", "Estudioso", "Fazer 30 quizzes."],
  ["🈴", "Mestre das palavras", "5 quizzes de vocabulário com 90% ou mais de acerto."],
  ["🔥", "Disciplina", "Bater a meta semanal de estudos em 4 semanas."],
  ["⚡", "Desafiante", "Acertar 7 desafios do dia."],
  ["🥋", "Pronto pro exame", "Tirar 9 ou mais (de 10+) no simulado do exame de faixa."],
  ["🤝", "Embaixador", "Indicar alguém que fez a matrícula pelo seu link."],
  ["🥇", "Medalhista", "Ganhar medalha num campeonato registrado no app."],
];
const RANKING: [string, string][] = [
  ["🥇 🥈 🥉", "1º, 2º e 3º lugar no período (empate divide a posição)."],
  ["✨ 100%", "Não faltou nenhuma aula da turma no mês (com pelo menos 4 aulas)."],
  ["%", "Presenças ÷ aulas que a pessoa poderia ter feito (falta justificada não conta contra)."],
];
const ICONES: [string, string][] = [
  ["✋", "Avisou que vem na aula (\"Vou nessa aula\")."], ["🙋", "Avisou que vai faltar."], ["🎂", "Aniversário chegando."],
  ["📌", "Tem pendência com a academia."], ["💳", "Mensalidade em aberto/atrasada."], ["⚖️", "Peso para campeonato."],
  ["🧒", "Menor de idade."], ["🚨", "Cadastro pendente (urgente se for menor)."], ["⚕️", "Atenção de saúde (alergia, restrição…)."],
  ["📉", "Faltou as últimas aulas seguidas."], ["👋", "Visitante / aula experimental."], ["📲", "Chegou pelo QR (check-in)."],
  ["📋", "Itens do cadastro: 👤 dados · 👨‍👧 responsável · ⚕️ saúde · ✍️ termos · 📎 documentos."],
];

export function LegendaSelos({ titulos = true, ranking = true, icones = true, className = "" }: { titulos?: boolean; ranking?: boolean; icones?: boolean; className?: string }) {
  return (
    <details className={`rounded-2xl bg-painel p-3 text-sm ${className}`}>
      <summary className="cursor-pointer font-semibold">ℹ️ O que significa cada selo e como ganhar?</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {titulos && (
          <div>
            <p className="mb-1 font-bold">Títulos (aparecem no perfil)</p>
            <ul className="space-y-1">{TITULOS.map(([i, t, c]) => <li key={t}><span className="text-lg">{i}</span> <b>{t}</b> — <span className="text-suave">{c}</span></li>)}</ul>
            <p className="mt-1 text-xs text-suave">O aluno escolhe qual título mostrar no perfil (Meu perfil).</p>
          </div>
        )}
        <div className="space-y-4">
          {ranking && (
            <div>
              <p className="mb-1 font-bold">Ranking</p>
              <ul className="space-y-1">{RANKING.map(([i, c]) => <li key={i}><b>{i}</b> — <span className="text-suave">{c}</span></li>)}</ul>
            </div>
          )}
          {icones && (
            <div>
              <p className="mb-1 font-bold">Ícones da chamada e das listas</p>
              <ul className="space-y-1">{ICONES.map(([i, c]) => <li key={i}><span className="text-lg">{i}</span> <span className="text-suave">{c}</span></li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
