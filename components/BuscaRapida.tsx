"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { whatsapp } from "@/lib/util";

// 🔎 Busca rápida (equipe): acha aluno ou tela pelo nome. No computador: Ctrl+K.
export function BuscaRapida({ academiaId, base, telas, className = "", atalho = false }: { academiaId: string; base: string; telas: { href: string; rotulo: string; icone: string }[]; className?: string; atalho?: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [alunos, setAlunos] = useState<any[]>([]);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!atalho) return;
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberta(true); }
      if (e.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [atalho]);
  useEffect(() => { if (aberta) setTimeout(() => campo.current?.focus(), 50); else { setQ(""); setAlunos([]); } }, [aberta]);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setAlunos([]); return; }
    const id = setTimeout(async () => {
      const termo = t.replace(/[%,()]/g, " ");
      const { data } = await supabaseNavegador().from("painel_alunos")
        .select("membro_id, nome, apelido, foto_url, faixa, turmas, whatsapp, ativo, responsavel")
        .eq("academia_id", academiaId).or(`nome.ilike.%${termo}%,apelido.ilike.%${termo}%,responsavel.ilike.%${termo}%`)
        .order("ativo", { ascending: false }).order("nome").limit(8);
      setAlunos(data || []);
    }, 200);
    return () => clearTimeout(id);
  }, [q, academiaId]);

  const sem = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const achadas = q.trim().length >= 2 ? telas.filter((t) => sem(t.rotulo).includes(sem(q.trim()))).slice(0, 5) : [];

  return (
    <>
      <button onClick={() => setAberta(true)} className={className} aria-label="Buscar aluno ou tela">🔎<span className="hidden lg:inline"> Buscar <kbd className="ml-1 rounded border border-linha px-1 text-[10px]">Ctrl K</kbd></span></button>
      {aberta && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-20" onClick={() => setAberta(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-painel text-texto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-linha p-3">
              <span aria-hidden>🔎</span>
              <input ref={campo} className="flex-1 bg-transparent py-2 text-lg outline-none" placeholder="Nome do aluno, responsável ou tela…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="rounded-full bg-painel2 px-3 py-1 text-sm" onClick={() => setAberta(false)}>Fechar</button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto p-2">
              {alunos.map((a) => {
                const w = whatsapp(a.whatsapp, "");
                return (
                  <div key={a.membro_id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-painel2">
                    {a.foto_url ? <img src={a.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-painel2">🥋</span>}
                    <Link href={`${base}/alunos/${a.membro_id}`} onClick={() => setAberta(false)} className="min-w-0 flex-1">
                      <b className="block truncate">{a.apelido || a.nome}{!a.ativo ? " (saiu)" : ""}</b>
                      <span className="block truncate text-xs text-suave">{[a.faixa && `faixa ${String(a.faixa).toLowerCase()}`, (a.turmas || []).join?.(", "), a.responsavel && `resp. ${a.responsavel}`].filter(Boolean).join(" · ")}</span>
                    </Link>
                    <Link href={`${base}/alunos/${a.membro_id}/cadastro`} onClick={() => setAberta(false)} className="rounded-xl bg-painel2 px-2 py-1 text-xs">📋</Link>
                    {w && <a href={w} target="_blank" rel="noreferrer" className="rounded-xl bg-painel2 px-2 py-1 text-xs">💬</a>}
                  </div>
                );
              })}
              {achadas.map((t) => (
                <Link key={t.href} href={t.href} onClick={() => setAberta(false)} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-painel2">
                  <span className="text-xl" aria-hidden>{t.icone}</span><span>{t.rotulo}</span><span className="ml-auto text-xs text-suave">tela</span>
                </Link>
              ))}
              {q.trim().length >= 2 && !alunos.length && !achadas.length && <p className="p-3 text-sm text-suave">Nada encontrado.</p>}
              {q.trim().length < 2 && <p className="p-3 text-sm text-suave">Digite pelo menos 2 letras. Dica: no computador, Ctrl+K abre esta busca de qualquer tela.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
