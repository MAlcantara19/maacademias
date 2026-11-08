"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { Avatar } from "@/components/Avatar";

// Aluno vai direto para a própria ficha; responsável escolhe o filho
export default function Meu() {
  const ctx = useCtx();
  const router = useRouter();
  const base = `/${ctx.academia.slug}/app`;
  useEffect(() => {
    if (ctx.meusAlunos.length === 1) router.replace(`${base}/alunos/${ctx.meusAlunos[0].id}`);
  }, []); // eslint-disable-line

  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-extrabold">Meus atletas</h1>
      {ctx.meusAlunos.map((a) => (
        <Link key={a.id} href={`${base}/alunos/${a.id}`} className="flex items-center gap-4 rounded-2xl bg-painel p-4">
          <Avatar foto={a.foto_url} nome={a.nome} tamanho={56} mostrarFaixa={false} />
          <span className="text-xl font-semibold">{a.apelido || a.nome}{a.eu ? " (você)" : ""}</span>
        </Link>
      ))}
      {!ctx.meusAlunos.length && <p className="text-suave">Nenhum aluno ligado à sua conta nesta academia.</p>}
    </div>
  );
}
