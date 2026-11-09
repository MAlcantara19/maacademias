"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Faixa } from "./Faixa";

// Primeiro acesso: boas-vindas e troca da senha provisória
export function BoasVindas({ perfil, academia, equipe }: { perfil: any; academia: any; equipe: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(!!perfil && !perfil.boas_vindas_em);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [msg, setMsg] = useState("");
  const precisaSenha = !!perfil?.trocar_senha;

  async function concluir() {
    const sb = supabaseNavegador();
    if (precisaSenha) {
      if (senha.length < 6) return setMsg("A nova senha precisa ter pelo menos 6 caracteres.");
      if (senha !== senha2) return setMsg("As duas senhas não são iguais.");
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) return setMsg("Não foi possível trocar a senha: " + error.message);
    }
    await sb.rpc("marcar_boas_vindas");
    setAberto(false);
    router.refresh();
  }

  if (!aberto) return null;
  const nome = (perfil.apelido || perfil.nome || "").split(" ")[0];
  const dicas = equipe
    ? ["Faça a chamada em segundos (tem até chamada por voz).", "Veja quem sumiu e chame no WhatsApp com um toque.", "Campeonatos, mensalidades e exames de faixa ficam no menu “Mais”."]
    : ["Veja seus horários e a próxima aula.", "Acompanhe sua frequência, seu peso e sua faixa.", "Ative as notificações para não perder pesagem e avisos."];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-painel shadow-2xl">
        <Faixa graus={3} altura={12} className="rounded-none" />
        <div className="space-y-4 p-6">
          <h2 className="text-4xl font-extrabold">Bem-vindo, {nome}! 🥋</h2>
          <p className="text-suave">Este é o app da <b className="text-texto">{academia.nome}</b>. Por aqui você:</p>
          <ul className="space-y-1.5">{dicas.map((d) => <li key={d}>✓ {d}</li>)}</ul>
          {precisaSenha && (
            <div className="space-y-2 rounded-2xl bg-painel2 p-4">
              <p className="font-semibold">Crie sua senha</p>
              <p className="text-sm text-suave">Você entrou com uma senha provisória. Escolha uma só sua.</p>
              <input type="password" autoComplete="new-password" className="campo" placeholder="Nova senha (mín. 6)" value={senha} onChange={(e) => setSenha(e.target.value)} />
              <input type="password" autoComplete="new-password" className="campo" placeholder="Repita a senha" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
            </div>
          )}
          {msg && <p className="text-sm text-alerta">{msg}</p>}
          <button className="btn w-full" onClick={concluir}>{precisaSenha ? "Salvar senha e começar" : "Começar"}</button>
        </div>
      </div>
    </div>
  );
}
