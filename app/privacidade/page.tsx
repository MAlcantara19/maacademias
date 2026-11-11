import type { Metadata } from "next";
import { Documento } from "@/components/Documento";
import { RESPONSAVEL, VERSAO_TERMOS } from "@/lib/termos";

export const metadata: Metadata = { title: "Política de Privacidade — MA Academias" };

// TEXTO-BASE conforme a LGPD (Lei 13.709/2018): revise antes de publicar oficialmente.
export default function Privacidade() {
  const r = RESPONSAVEL;
  return (
    <Documento titulo="Política de Privacidade" versao={VERSAO_TERMOS}>
      <p>Esta Política explica como os dados pessoais são tratados na plataforma <b>{r.marca}</b>, conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>

      <h2>1. Quem é responsável pelos dados</h2>
      <ul>
        <li><b>A academia é a controladora</b> dos dados de seus alunos, responsáveis e professores: é ela quem decide quais dados cadastrar e para quê.</li>
        <li><b>O {r.marca} ({r.nome}) atua como operador</b>, tratando os dados em nome da academia para prestar o serviço, e como controlador apenas dos dados de contas, segurança, suporte e faturamento da própria plataforma.</li>
      </ul>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li><b>Cadastro:</b> nome, apelido, e-mail, telefone/WhatsApp, data de nascimento, sexo, foto de perfil, contato de emergência e responsável legal.</li>
        <li><b>Atividade na academia:</b> turmas, horários, presenças, faltas e justificativas, graduações, exames, campeonatos, peso e altura (quando registrados).</li>
        <li><b>Financeiro (quando a academia usa):</b> mensalidades, vencimentos, pagamentos, comprovantes e recibos. Não armazenamos dados de cartão ou senhas bancárias.</li>
        <li><b>Conteúdos:</b> fotos e vídeos do feed, comentários, materiais e respostas a quizzes.</li>
        <li><b>Dados biométricos (opcional):</b> um código numérico gerado a partir do rosto, usado só para marcar presença. A foto usada no cadastro não é guardada.</li>
        <li><b>Dados técnicos:</b> data e hora de acesso, navegador, registros de ações (quem criou, editou ou apagou algo) e registros de erros.</li>
        <li><b>Localização (opcional):</b> usada apenas no momento do check-in por QR Code, para confirmar que a pessoa está na academia, ou para mostrar academias próximas. Não guardamos seu histórico de localização.</li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li><b>Prestar o serviço contratado pela academia</b> (execução de contrato e legítimo interesse): cadastro, chamada, comunicação, cobranças e relatórios.</li>
        <li><b>Segurança e suporte</b> (legítimo interesse): histórico de ações e de erros para corrigir falhas e atender pedidos de ajuda.</li>
        <li><b>Uso de imagem e biometria</b> (consentimento): somente com autorização do titular ou do responsável, que pode ser revogada a qualquer momento no próprio app.</li>
        <li><b>Obrigações legais</b>: quando a lei exigir a guarda ou o compartilhamento de informações.</li>
      </ul>

      <h2>4. Crianças e adolescentes</h2>
      <p>Dados de menores de idade são tratados no seu melhor interesse, com o consentimento específico de um dos pais ou do responsável legal para uso de imagem e biometria. O responsável acessa e gerencia os dados do dependente pela própria conta.</p>

      <h2>5. Quem pode ver os dados</h2>
      <ul>
        <li>Cada aluno vê os próprios dados; o responsável vê os de seus dependentes.</li>
        <li>O professor vê apenas os alunos das turmas dele.</li>
        <li>O administrador vê os dados da sua academia.</li>
        <li>Rankings, feed e avisos mostram nome, apelido, foto e faixa para os participantes da mesma academia.</li>
        <li>Não vendemos dados pessoais.</li>
      </ul>

      <h2>6. Com quem compartilhamos</h2>
      <p>Usamos fornecedores para hospedar e operar a plataforma (por exemplo, serviços de hospedagem, banco de dados, armazenamento de arquivos e notificações), que podem estar localizados fora do Brasil e tratam os dados apenas para esse fim, com medidas de segurança adequadas. Também podemos compartilhar dados por ordem judicial ou exigência legal.</p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li>Enquanto a academia mantiver o contrato, ou até o titular pedir a exclusão, respeitadas as obrigações legais.</li>
        <li>Fotos do feed: pelo prazo definido pela academia (padrão de 30 dias).</li>
        <li>Código biométrico: até a revogação do consentimento ou a saída do aluno.</li>
        <li>Após o encerramento do contrato, a academia pode baixar seus dados; depois disso, eles são apagados em prazo razoável.</li>
      </ul>

      <h2>8. Segurança</h2>
      <p>Usamos conexão criptografada, controle de acesso por perfil (cada pessoa vê só o que pode), senhas protegidas e cópias de segurança. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente relevante, os envolvidos e a autoridade competente serão informados conforme a lei.</p>

      <h2>9. Seus direitos</h2>
      <p>Você pode pedir a confirmação do tratamento, acesso, correção, anonimização, portabilidade, exclusão, informação sobre compartilhamentos e a revogação de consentimentos. Pedidos sobre os dados da academia devem ser feitos a ela; nós ajudamos a atendê-los. Contato: {r.email}.</p>

      <h2>10. Cookies e armazenamento no aparelho</h2>
      <p>Usamos apenas o necessário para manter você conectado e lembrar preferências (como a voz da pronúncia). Não usamos cookies de publicidade.</p>

      <h2>11. Alterações</h2>
      <p>Esta Política pode ser atualizada. Mudanças relevantes serão apresentadas no próximo acesso para um novo aceite.</p>
    </Documento>
  );
}
