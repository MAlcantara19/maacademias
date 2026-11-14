"use client";
import { use, useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { CertificadoGraduacao } from "@/components/CertificadoGraduacao";

// Certificado de graduação para imprimir ou salvar em PDF (A4 deitado)
export default function Certificado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [g, setG] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("graduacoes").select("*, modalidades(nome, graduacoes, cores_graduacoes), membros!membro_id(perfis(nome))").eq("id", id).maybeSingle();
      if (!data) return setG(false);
      let professor = null;
      if (data.registrado_por) {
        const { data: p } = await sb.from("membros").select("perfis(nome), professores_modalidades(graduacao)").eq("id", data.registrado_por).maybeSingle();
        professor = p;
      }
      setG({ ...data, professor });
    })();
  }, [id]); // eslint-disable-line

  if (g === false) return <p className="text-suave">Graduação não encontrada.</p>;
  if (!g) return <p className="text-suave">Carregando…</p>;

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } }`}</style>
      <div className="nao-imprimir flex gap-2">
        <button className="btn" onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button className="btn-sec" onClick={() => history.back()}>Voltar</button>
      </div>
      <p className="nao-imprimir text-sm text-suave">Dica: na janela de impressão, escolha “Salvar como PDF” e orientação “Paisagem”.</p>
      <CertificadoGraduacao g={g} academia={ctx.academia} />
    </div>
  );
}
