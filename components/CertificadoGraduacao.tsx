"use client";
import { MESES } from "@/lib/util";

// Certificado de graduação (A4 deitado). Usado no certificado avulso e no lote.
export function CertificadoGraduacao({ g, academia }: { g: any; academia: any }) {
  const cor = g.modalidades?.cores_graduacoes?.[g.modalidades.graduacoes.indexOf(g.faixa)] || "#111";
  const [a, m, d] = g.data.split("-");
  const nomeProf = g.professor?.perfis?.nome;
  const grauProf = g.professor?.professores_modalidades?.[0]?.graduacao;

  return (
      <article className="certificado imprimir-claro relative mx-auto aspect-[297/210] w-full max-w-4xl overflow-hidden bg-white text-black shadow-2xl print:max-w-none print:shadow-none"
        style={{ fontFamily: "Barlow, sans-serif" }}>
        {/* moldura e faixa */}
        <div className="absolute inset-3 border-[3px]" style={{ borderColor: cor === "#f5f5f5" ? "#999" : cor }} />
        <div className="absolute inset-x-0 bottom-0 flex h-6">
          <div className="flex-1" style={{ background: cor === "#f5f5f5" ? "#e5e5e5" : cor }} />
          <div className="w-1/5" style={{ background: cor === "#111111" ? "#c81e1e" : "#0a0a0a" }} />
          <div className="w-[6%]" style={{ background: cor === "#f5f5f5" ? "#e5e5e5" : cor }} />
        </div>

        <div className="relative flex h-full flex-col items-center justify-center px-[8%] text-center">
          {academia.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={academia.logo_url} alt="" className="mb-2 h-[12%] object-contain" />
          )}
          <p className="text-[1.6vw] font-semibold uppercase tracking-[0.3em] text-gray-500 print:text-[14pt]">{academia.nome}</p>
          <h1 className="mt-[2%] text-[5vw] font-extrabold leading-none print:text-[44pt]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Certificado de Graduação
          </h1>
          <p className="mt-[4%] text-[1.8vw] print:text-[16pt]">Certificamos que</p>
          <p className="mt-[1%] text-[3.6vw] font-bold print:text-[32pt]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{g.membros?.perfis?.nome}</p>
          <p className="mt-[2%] max-w-[80%] text-[1.8vw] leading-snug print:text-[16pt]">
            foi aprovado(a) e promovido(a) à <b>faixa {g.faixa.toLowerCase()}</b>{g.grau ? ` (${g.grau}º grau)` : ""} de <b>{g.modalidades?.nome}</b>,
            demonstrando dedicação, técnica e respeito aos princípios da arte.
          </p>
          <p className="mt-[3%] text-[1.5vw] text-gray-600 print:text-[13pt]">{academia.cidade ? `${academia.cidade}, ` : ""}{Number(d)} de {MESES[Number(m) - 1].toLowerCase()} de {a}</p>

          <div className="mt-[6%] flex w-full justify-center gap-[12%]">
            <div className="w-[34%] border-t border-gray-500 pt-1 text-[1.3vw] print:text-[11pt]">
              <b>{nomeProf || "Professor(a)"}</b><br /><span className="text-gray-500">{grauProf || "Professor responsável"}</span>
            </div>
            <div className="w-[34%] border-t border-gray-500 pt-1 text-[1.3vw] print:text-[11pt]">
              <b>{academia.nome}</b><br /><span className="text-gray-500">Direção</span>
            </div>
          </div>
        </div>
      </article>
  );
}
