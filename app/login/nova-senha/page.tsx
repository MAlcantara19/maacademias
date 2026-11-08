"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    const { error } = await supabaseNavegador().auth.updateUser({ password: senha });
    if (error) return setMsg("O link expirou. Peça um novo em “Esqueci a senha”.");
    router.replace("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <form onSubmit={salvar} className="space-y-4">
        <h1 className="text-4xl font-extrabold">Nova senha</h1>
        <input type="password" className="campo" placeholder="Mínimo 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
        {msg && <p className="text-sm text-alerta">{msg}</p>}
        <button className="btn w-full">Salvar senha</button>
      </form>
    </main>
  );
}
