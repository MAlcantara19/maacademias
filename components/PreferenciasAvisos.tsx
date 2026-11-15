"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

// "O que avisar no celular": cada pessoa liga e desliga os tipos de aviso
const TIPOS: { tipo: string; rotulo: string; equipe?: boolean; aluno?: boolean }[] = [
  { tipo: "aviso", rotulo: "📣 Avisos da academia e da turma" },
  { tipo: "evento", rotulo: "📅 Eventos chegando (1 semana e 1 dia antes)" },
  { tipo: "campeonato", rotulo: "🥇 Campeonato: pesagem, documentos e inscrições" },
  { tipo: "pendencia", rotulo: "📌 Pendências marcadas pelo professor" },
  { tipo: "ranking", rotulo: "🏆 Ranking: quando te passam ou você está perto", aluno: true },
  { tipo: "vencimento", rotulo: "💳 Mensalidade vencendo" },
  { tipo: "aniversario", rotulo: "🎂 Aniversários" },
  { tipo: "conquista", rotulo: "🏅 Títulos e conquistas", aluno: true },
  { tipo: "desafio", rotulo: "⚡ Desafio do dia", aluno: true },
  { tipo: "gps", rotulo: "📍 Check-ins pelo GPS sem aceitar (fim do dia)", equipe: true },
  { tipo: "falta", rotulo: "📉 Aluno sumido", equipe: true },
  { tipo: "senha", rotulo: "🔑 Pedidos de nova senha", equipe: true },
];

export function PreferenciasAvisos({ perfilId, equipe }: { perfilId?: string; equipe: boolean }) {
  const sb = supabaseNavegador();
  const [desligados, setDesligados] = useState<string[] | null>(null);
  const [salvo, setSalvo] = useState(false);
  useEffect(() => {
    if (!perfilId) return;
    sb.from("preferencias_notificacao").select("tipos_desligados").eq("perfil_id", perfilId).maybeSingle()
      .then(({ data }: any) => setDesligados(data?.tipos_desligados || []), () => setDesligados([]));
  }, [perfilId]); // eslint-disable-line
  if (!perfilId || desligados === null) return null;

  async function alternar(tipo: string) {
    const nova = desligados!.includes(tipo) ? desligados!.filter((t) => t !== tipo) : [...desligados!, tipo];
    setDesligados(nova); setSalvo(false);
    const { error } = await sb.from("preferencias_notificacao").upsert({ perfil_id: perfilId, tipos_desligados: nova }, { onConflict: "perfil_id" });
    if (!error) setSalvo(true);
  }
  const lista = TIPOS.filter((t) => (equipe ? !t.aluno : !t.equipe));
  return (
    <details className="rounded-2xl bg-painel p-4">
      <summary className="cursor-pointer font-semibold">⚙️ O que avisar no celular</summary>
      <ul className="mt-3 space-y-2">
        {lista.map((t) => (
          <li key={t.tipo}>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t.rotulo}</span>
              <input type="checkbox" className="h-5 w-5" checked={!desligados.includes(t.tipo)} onChange={() => alternar(t.tipo)} />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-suave">{salvo ? "✓ Salvo. " : ""}Vale para todos os seus aparelhos. O que você desligar continua aparecendo aqui na lista, só não toca no celular.</p>
    </details>
  );
}
