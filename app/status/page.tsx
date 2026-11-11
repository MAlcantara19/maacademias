import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

export const dynamic = "force-dynamic";

type Item = { ok: boolean | null; titulo: string; detalhe: string };

// Página de diagnóstico: abra /status para saber se o Supabase está conectado
export default async function Status() {
  const itens: Item[] = [];
  const cabecalho = { apikey: SUPABASE_CHAVE, Authorization: `Bearer ${SUPABASE_CHAVE}` };

  // 1) Variáveis
  itens.push({
    ok: !!SUPABASE_URL && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(SUPABASE_URL),
    titulo: "Endereço do Supabase (NEXT_PUBLIC_SUPABASE_URL)",
    detalhe: SUPABASE_URL
      ? /\/rest\/v1|\/$/.test(SUPABASE_URL) ? `${SUPABASE_URL} — tire o que vem depois de .supabase.co` : SUPABASE_URL
      : "Não encontrado. Cadastre na Vercel (Settings → Environment Variables) e faça Redeploy.",
  });
  const tipoChave = SUPABASE_CHAVE.startsWith("sb_publishable_") ? "publishable"
    : SUPABASE_CHAVE.startsWith("sb_secret_") ? "secret" : SUPABASE_CHAVE.startsWith("eyJ") ? "anon" : SUPABASE_CHAVE ? "desconhecida" : "";
  itens.push({
    ok: tipoChave === "publishable" || tipoChave === "anon",
    titulo: "Chave do Supabase (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    detalhe: !tipoChave ? "Não encontrada. Cadastre na Vercel e faça Redeploy."
      : tipoChave === "secret" ? "⚠️ Você usou a chave SECRETA. Troque pela publishable (sb_publishable_...) e gere uma secret nova no Supabase."
      : `Encontrada (${SUPABASE_CHAVE.slice(0, 18)}…)`,
  });

  // 2) Conexão e tabelas
  if (SUPABASE_URL && SUPABASE_CHAVE) {
    try {
      const saude = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`, { headers: cabecalho, cache: "no-store" });
      itens.push({ ok: saude.ok, titulo: "Conexão com o Supabase", detalhe: saude.ok ? "Conectado ✓" : `O Supabase respondeu ${saude.status}. Confira se a chave é deste projeto.` });

      const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/academias?select=slug,nome&limit=10`, { headers: cabecalho, cache: "no-store" });
      const corpo = await r.json().catch(() => null);
      if (r.ok && Array.isArray(corpo)) {
        itens.push({ ok: true, titulo: "Banco de dados (banco-academias.sql)", detalhe: "Tabelas encontradas ✓" });
        const piloto = corpo.find((a: any) => a.slug === "piloto-completo");
        itens.push({
          ok: !!piloto,
          titulo: "Academia Piloto (piloto-academias.sql)",
          detalhe: piloto ? `Encontrada ✓ — abra /piloto-completo` : corpo.length ? `Academias: ${corpo.map((a: any) => a.slug).join(", ")}` : "Nenhuma academia ainda. Rode o piloto-academias.sql no SQL Editor.",
        });
      } else if (corpo?.code === "PGRST205" || corpo?.code === "42P01" || r.status === 404) {
        itens.push({ ok: false, titulo: "Banco de dados (banco-academias.sql)", detalhe: "A tabela academias não existe. Rode o banco-academias.sql no SQL Editor do Supabase." });
      } else {
        itens.push({ ok: false, titulo: "Banco de dados", detalhe: `Erro ${r.status}: ${corpo?.message || "resposta inesperada"}` });
      }
    } catch (e: any) {
      itens.push({ ok: false, titulo: "Conexão com o Supabase", detalhe: `Não foi possível conectar: ${e?.message || e}` });
    }
  }

  const tudoOk = itens.every((i) => i.ok);

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-5xl font-extrabold">{tudoOk ? "Tudo conectado ✓" : "Diagnóstico"}</h1>
      <p className="mt-2 text-suave">Esta página confere se o site está falando com o Supabase.</p>
      <ul className="mt-6 space-y-3">
        {itens.map((i) => (
          <li key={i.titulo} className="rounded-2xl bg-painel p-4" style={{ borderLeft: `5px solid ${i.ok ? "var(--color-ok)" : "var(--color-erro)"}` }}>
            <p className="font-semibold">{i.ok ? "✅" : "❌"} {i.titulo}</p>
            <p className="mt-1 break-all text-sm text-suave">{i.detalhe}</p>
          </li>
        ))}
      </ul>
      {tudoOk && <a href="/piloto-completo" className="btn mt-6">Abrir o Piloto Completo</a>}
    </main>
  );
}
