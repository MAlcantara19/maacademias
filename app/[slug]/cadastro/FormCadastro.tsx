"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

export function FormCadastro({ academiaId, slug, modalidades, turmas }: { academiaId: string; slug: string; modalidades: any[]; turmas: any[] }) {
  const [f, setF] = useState<any>({ sexo: "M", aceite_imagem: false });
  const [enviado, setEnviado] = useState<boolean | string>(false);
  const [erro, setErro] = useState("");
  const muda = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const idade = f.nascimento ? Math.floor((Date.now() - new Date(f.nascimento + "T12:00:00").getTime()) / 31557600000) : null;
  const menor = idade !== null && idade < 18;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (menor && (!f.responsavel_nome || !f.responsavel_tel)) return setErro("Para menores de 18 anos, preencha os dados do responsável.");
    const { error } = await supabaseNavegador().from("solicitacoes_cadastro").insert({
      academia_id: academiaId, nome: f.nome, email: f.email?.trim().toLowerCase() || null, telefone: f.telefone || null,
      nascimento: f.nascimento || null, sexo: f.sexo, modalidade_id: f.modalidade_id || null, turma_id: f.turma_id || null,
      responsavel_nome: menor ? f.responsavel_nome : null, responsavel_email: menor ? f.responsavel_email?.trim().toLowerCase() || null : null,
      responsavel_tel: menor ? f.responsavel_tel : null, aceite_imagem: !!f.aceite_imagem, mensagem: f.mensagem || null,
    });
    if (error) return setErro("Não foi possível enviar. Confira os dados e tente de novo.");
    const turma = turmas.find((t) => t.id === f.turma_id);
    if (turma?.lotada) {
      await supabaseNavegador().from("lista_espera").insert({
        academia_id: academiaId, turma_id: turma.id, nome: f.nome,
        telefone: (menor ? f.responsavel_tel : f.telefone) || null, email: (menor ? f.responsavel_email : f.email) || null,
      });
    }
    setEnviado(turma?.lotada ? "fila" : true);
  }

  if (enviado) {
    return (
      <div className="space-y-3 rounded-2xl bg-painel p-6">
        <p className="text-3xl font-bold">Cadastro enviado! 🥋</p>
        {enviado === "fila" && <p className="text-alerta">A turma escolhida está lotada: você entrou na lista de espera e será chamado quando abrir vaga.</p>}
        <p className="text-suave">Assim que a academia aprovar, entre em <b>Primeiro acesso</b> com {menor ? "o e-mail do responsável" : "o seu e-mail"} para criar a senha.</p>
        <Link href="/login" className="btn">Ir para o login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-3">
      <div><label className="rotulo">Nome completo</label><input required className="campo" onChange={(e) => muda("nome", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="rotulo">Nascimento</label><input type="date" required className="campo" onChange={(e) => muda("nascimento", e.target.value)} /></div>
        <div><label className="rotulo">Sexo</label>
          <select className="campo" value={f.sexo} onChange={(e) => muda("sexo", e.target.value)}><option value="M">Masculino</option><option value="F">Feminino</option></select>
        </div>
      </div>
      {!menor && (
        <>
          <div><label className="rotulo">E-mail (será seu login)</label><input type="email" required className="campo" onChange={(e) => muda("email", e.target.value)} /></div>
          <div><label className="rotulo">WhatsApp</label><input type="tel" required className="campo" placeholder="(24) 99999-9999" onChange={(e) => muda("telefone", e.target.value)} /></div>
        </>
      )}
      {menor && (
        <fieldset className="grid gap-3 rounded-2xl border border-linha p-4">
          <legend className="px-2 text-sm text-suave">Responsável (menor de 18 anos)</legend>
          <input className="campo" placeholder="Nome do responsável" onChange={(e) => muda("responsavel_nome", e.target.value)} />
          <input type="email" className="campo" placeholder="E-mail do responsável (login)" onChange={(e) => muda("responsavel_email", e.target.value)} />
          <input type="tel" className="campo" placeholder="WhatsApp do responsável" onChange={(e) => muda("responsavel_tel", e.target.value)} />
        </fieldset>
      )}
      <div><label className="rotulo">Modalidade</label>
        <select className="campo" defaultValue="" onChange={(e) => { muda("modalidade_id", e.target.value); muda("turma_id", ""); }}>
          <option value="">Escolha…</option>
          {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>
      {f.modalidade_id && (
        <div><label className="rotulo">Turma</label>
          <select className="campo" value={f.turma_id || ""} onChange={(e) => muda("turma_id", e.target.value)}>
            <option value="">Ainda não sei</option>
            {turmas.filter((t) => t.modalidade_id === f.modalidade_id).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.lotada ? " — lotada (lista de espera)" : ""}</option>)}
          </select>
        </div>
      )}
      <div><label className="rotulo">Observação (opcional)</label><input className="campo" placeholder="Ex.: já treinei, sou faixa azul" onChange={(e) => muda("mensagem", e.target.value)} /></div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" onChange={(e) => muda("aceite_imagem", e.target.checked)} />
        <span>Autorizo o uso de fotos e vídeos dos treinos {menor ? "do(a) menor " : ""}nas redes da academia.</span>
      </label>
      {erro && <p className="text-sm text-alerta">{erro}</p>}
      <button className="btn">Enviar cadastro</button>
      <p className="text-center text-sm text-suave">Já tem conta? <Link className="underline" href={`/login`}>Entrar</Link> · <Link className="underline" href={`/${slug}`}>Voltar</Link></p>
    </form>
  );
}
