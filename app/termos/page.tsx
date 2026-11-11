import type { Metadata } from "next";
import { Documento } from "@/components/Documento";
import { RESPONSAVEL, VERSAO_TERMOS } from "@/lib/termos";

export const metadata: Metadata = { title: "Termos de Uso — MA Academias" };

// TEXTO-BASE: revise antes de publicar oficialmente.
export default function Termos() {
  const r = RESPONSAVEL;
  return (
    <Documento titulo="Termos de Uso" versao={VERSAO_TERMOS}>
      <p>Estes Termos regulam o uso da plataforma <b>{r.marca}</b> (site e aplicativo), mantida por {r.nome}, com sede em {r.cidade} (“nós”). Ao criar uma conta ou usar a plataforma, você declara que leu e concorda com estes Termos e com a <a className="underline" href="/privacidade">Política de Privacidade</a>.</p>

      <h2>1. O que é a plataforma</h2>
      <p>O {r.marca} é um sistema on-line para academias de artes marciais e projetos esportivos organizarem alunos, turmas, horários, presença, graduações, comunicação, conteúdos e, conforme o plano contratado, mensalidades e outras funções.</p>

      <h2>2. Quem usa</h2>
      <ul>
        <li><b>Academia (cliente):</b> a pessoa física ou jurídica que contrata a plataforma, representada pelo seu administrador.</li>
        <li><b>Administrador:</b> quem gerencia a academia no sistema e responde pelas informações cadastradas.</li>
        <li><b>Professor:</b> usuário autorizado pela academia, com acesso às turmas sob sua responsabilidade.</li>
        <li><b>Aluno e responsável:</b> usuários que acessam seus próprios dados e os dos dependentes menores de idade.</li>
      </ul>

      <h2>3. Cadastro e conta</h2>
      <ul>
        <li>As informações fornecidas devem ser verdadeiras e mantidas atualizadas.</li>
        <li>O login e a senha são pessoais e intransferíveis. Você é responsável pelo que for feito com a sua conta.</li>
        <li>Menores de 18 anos usam a plataforma por meio de seu responsável legal, que autoriza o cadastro e acompanha o uso.</li>
        <li>Avise a academia ou o suporte imediatamente se suspeitar de uso indevido da sua conta.</li>
      </ul>

      <h2>4. Responsabilidades da academia</h2>
      <ul>
        <li>Cadastrar alunos e professores com base legal adequada e informá-los sobre o uso de seus dados.</li>
        <li>Obter as autorizações necessárias (por exemplo, uso de imagem e dados biométricos), especialmente de responsáveis por menores.</li>
        <li>Definir valores, vencimentos, multas e juros de suas mensalidades conforme a lei, inclusive o Código de Defesa do Consumidor.</li>
        <li>Emitir seus próprios documentos fiscais. Os recibos gerados pela plataforma não substituem nota fiscal.</li>
        <li>Zelar pelo conteúdo publicado por seus usuários no feed, nos avisos e nos materiais.</li>
      </ul>

      <h2>5. Pagamentos dentro da plataforma</h2>
      <p>O Pix exibido no aplicativo é da própria academia: o valor vai diretamente do aluno para a conta da academia. A plataforma apenas gera o código e organiza as cobranças, sem receber, intermediar ou guardar valores. Dúvidas, estornos e acordos sobre mensalidades devem ser tratados com a academia.</p>

      <h2>6. Uso adequado</h2>
      <p>É proibido usar a plataforma para:</p>
      <ul>
        <li>publicar conteúdo ofensivo, discriminatório, violento, sexual ou que exponha terceiros sem autorização;</li>
        <li>publicar imagens de menores sem autorização do responsável;</li>
        <li>tentar acessar dados de outras academias ou usuários, burlar regras de acesso ou prejudicar o funcionamento do sistema;</li>
        <li>copiar, revender ou explorar a plataforma ou seus conteúdos sem autorização.</li>
      </ul>
      <p>Conteúdos que violem estes Termos podem ser removidos e contas podem ser suspensas.</p>

      <h2>7. Conteúdos e propriedade intelectual</h2>
      <ul>
        <li>O software, a marca e o layout da plataforma pertencem ao {r.marca}.</li>
        <li>Fotos, textos e materiais enviados pelos usuários continuam sendo de seus autores; ao publicá-los, o usuário autoriza a exibição dentro da academia correspondente.</li>
        <li>Conteúdos exclusivos de uma academia (como programas de técnicas) são visíveis apenas para os participantes daquela academia.</li>
      </ul>

      <h2>8. Fotos do feed</h2>
      <p>Para preservar espaço, fotos e vídeos do feed podem ser apagados automaticamente após o prazo informado pela academia (padrão de 30 dias). Baixe o que quiser guardar.</p>

      <h2>9. Planos, valores e cancelamento</h2>
      <ul>
        <li>As funções disponíveis dependem do plano contratado pela academia.</li>
        <li>Períodos de teste gratuito podem ser oferecidos e encerrados a qualquer tempo, com aviso prévio.</li>
        <li>A academia pode cancelar quando quiser, sem multa. Recomendamos baixar o backup antes do cancelamento.</li>
        <li>Valores e condições podem mudar com aviso prévio de pelo menos 30 dias.</li>
      </ul>

      <h2>10. Disponibilidade e limitação de responsabilidade</h2>
      <ul>
        <li>Trabalhamos para manter a plataforma estável, mas podem ocorrer interrupções para manutenção ou por falhas de serviços de terceiros (hospedagem, internet, provedores).</li>
        <li>A plataforma é uma ferramenta de apoio: decisões sobre alunos, graduações, cobranças e segurança nos treinos são da academia.</li>
        <li>Não nos responsabilizamos por dados cadastrados de forma incorreta pelos usuários nem por prejuízos indiretos decorrentes do uso.</li>
      </ul>

      <h2>11. Suporte</h2>
      <p>O suporte é prestado pelo WhatsApp e pelo e-mail {r.email}, em dias úteis. Para ajudar no atendimento e na correção de erros, a plataforma registra o histórico de ações e as falhas técnicas, conforme a Política de Privacidade.</p>

      <h2>12. Alterações destes Termos</h2>
      <p>Podemos atualizar estes Termos. Quando isso acontecer, a nova versão será apresentada no próximo acesso para um novo aceite.</p>

      <h2>13. Lei e foro</h2>
      <p>Estes Termos seguem a legislação brasileira. Fica eleito o foro da comarca de {r.cidade} para resolver eventuais conflitos, ressalvados os direitos do consumidor de demandar em seu domicílio.</p>
    </Documento>
  );
}
