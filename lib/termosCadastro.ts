// Termos do cadastro do aluno. TEXTO-BASE: revise antes de usar oficialmente.
// A academia pode trocar qualquer texto em Personalizar academia (academias.termos_cadastro).
export type Termo = { id: string; titulo: string; obrigatorio: boolean; soMenor?: boolean; texto: (a: string) => string };

export const TERMOS: Termo[] = [
  {
    id: "matricula", titulo: "Termo de matrícula e prestação de serviços", obrigatorio: true,
    texto: (a) => `Declaro que solicito a matrícula do aluno na ${a} e que estou ciente das regras internas, dos horários das turmas e, quando houver, dos valores, datas de vencimento e condições de pagamento informados pela academia. A matrícula pode ser cancelada a qualquer momento mediante aviso à academia.`,
  },
  {
    id: "riscos", titulo: "Termo de ciência dos riscos das atividades", obrigatorio: true,
    texto: (a) => `Estou ciente de que as artes marciais são atividades de contato físico e que, mesmo com orientação e cuidado dos professores da ${a}, existe risco de lesões como torções, luxações, contusões e fraturas. Comprometo-me a seguir as orientações de segurança e a avisar o professor sobre qualquer dor, mal-estar ou limitação.`,
  },
  {
    id: "saude", titulo: "Declaração de saúde", obrigatorio: true,
    texto: () => `Declaro que as informações da ficha de saúde são verdadeiras, que o aluno está apto à prática de atividade física (ou que apresentarei atestado quando solicitado) e que comunicarei qualquer alteração no estado de saúde, uso de medicamentos ou lesões.`,
  },
  {
    id: "treinos", titulo: "Autorização para participação nos treinos", obrigatorio: true,
    texto: (a) => `Autorizo a participação do aluno nos treinos regulares da ${a}, incluindo atividades de preparação física, técnica e treinos de luta (randori), sob supervisão dos professores.`,
  },
  {
    id: "competicoes", titulo: "Autorização para competições e eventos", obrigatorio: false,
    texto: (a) => `Autorizo a participação do aluno em competições, exames de faixa, seminários e eventos dos quais a ${a} participe, ciente de que cada evento pode ter regras e taxas próprias, que serão informadas com antecedência.`,
  },
  {
    id: "imagem", titulo: "Autorização de uso de imagem e voz (opcional)", obrigatorio: false,
    texto: (a) => `Autorizo, de forma gratuita, o uso da imagem e da voz do aluno em fotos e vídeos de treinos e eventos, para divulgação nas redes sociais, no site e nos materiais da ${a}. Esta autorização é opcional, não interfere na matrícula e pode ser revogada a qualquer momento.`,
  },
  {
    id: "lgpd", titulo: "Termo de privacidade e proteção de dados (LGPD)", obrigatorio: true,
    texto: (a) => `Autorizo a ${a} a tratar os dados pessoais deste cadastro para a prestação do serviço (matrícula, frequência, graduação, comunicação e, quando houver, cobranças), conforme a Lei 13.709/2018 (LGPD). Os dados de saúde são usados apenas para a segurança do aluno e ficam visíveis só para o aluno, o responsável e os professores dele. Posso pedir acesso, correção ou exclusão dos dados a qualquer momento.`,
  },
  {
    id: "retirada", titulo: "Autorização de retirada do menor", obrigatorio: true, soMenor: true,
    texto: () => `Autorizo que o menor seja retirado da academia somente por mim ou pelas pessoas listadas como autorizadas neste cadastro. Comunicarei com antecedência qualquer mudança. Caso ninguém autorizado compareça, a academia entrará em contato pelos telefones informados.`,
  },
  {
    id: "ciencia_menor", titulo: "Ciência do aluno menor de idade", obrigatorio: false, soMenor: true,
    texto: () => `Eu, aluno(a), li (ou ouvi a leitura) destes termos e entendo as regras de segurança e de convivência da academia.`,
  },
];

// Identifica a versão do texto aceito (muda se o texto mudar)
export function hashTexto(t: string) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export function textoDoTermo(termo: Termo, academia: any) {
  return (academia?.termos_cadastro?.[termo.id] as string) || termo.texto(academia?.nome || "academia");
}

// Validação simples de CPF (dígitos verificadores)
export function cpfValido(c?: string | null) {
  const d = (c || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export const mascaraCpf = (c?: string | null) => (c || "").replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export function idade(nasc?: string | null) {
  if (!nasc) return null;
  const n = new Date(nasc + "T12:00:00"), h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--;
  return i;
}
