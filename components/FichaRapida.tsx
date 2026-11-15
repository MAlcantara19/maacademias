"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { LeitorQR } from "@/components/LeitorQR";

const COND: [string, string][] = [["cardiaco", "cardíaco"], ["respiratorio", "respiratório"], ["convulsao", "convulsão/epilepsia"], ["ortopedico", "ortopédico"]];
const tel = (t?: string | null) => (t || "").replace(/\D/g, "");

// 🩺 Ficha rápida: saúde e contato de emergência de um aluno, em tela cheia
export function FichaRapida({ membroId, base, onFechar }: { membroId: string; base: string; onFechar: () => void }) {
  const [f, setF] = useState<any>(undefined);
  useEffect(() => { supabaseNavegador().rpc("ficha_rapida", { p_membro: membroId }).then(({ data }: any) => setF(data || null), () => setF(null)); }, [membroId]);
  const d = f?.saude || {};
  const alertas = COND.filter(([k]) => d[k] === "sim").map(([, n]) => n);
  const emerg = f && (f.emergencia_tel ? { nome: f.emergencia_nome, tel: f.emergencia_tel } : f.responsavel?.telefone ? { nome: `${f.responsavel.nome}${f.responsavel.parentesco ? ` (${f.responsavel.parentesco})` : ""}`, tel: f.responsavel.telefone } : null);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={onFechar}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-painel p-5 text-texto" onClick={(e) => e.stopPropagation()}>
        {f === undefined ? <p>Carregando…</p> : f === null ? <p>Não foi possível abrir a ficha (só a equipe da academia vê).</p> : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {f.foto_url ? <img src={f.foto_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="text-5xl">🥋</span>}
              <div>
                <p className="text-2xl font-extrabold">{f.apelido || f.nome}</p>
                <p className="text-sm text-suave">{f.idade != null ? `${f.idade} anos` : ""}{f.turmas?.length ? ` · ${f.turmas.join(", ")}` : ""}</p>
              </div>
            </div>
            {emerg ? (
              <a href={`tel:${tel(emerg.tel)}`} className="block rounded-2xl p-4 text-white" style={{ background: "var(--color-erro, #dc2626)" }}>
                <span className="block text-sm opacity-90">📞 Emergência — toque para ligar</span>
                <span className="block text-xl font-bold">{emerg.nome || "Contato"}: {emerg.tel}</span>
              </a>
            ) : <p className="rounded-2xl bg-alerta/15 p-3 text-alerta">⚠️ Sem contato de emergência no cadastro.</p>}
            <div className="space-y-1 rounded-2xl bg-painel2 p-4 text-sm">
              <p className="font-bold">⚕️ Saúde</p>
              {d.alergias ? <p className="text-base font-bold text-alerta">⚠️ Alergia: {d.alergias}</p> : <p>Alergias: nenhuma informada</p>}
              {alertas.length > 0 && <p className="font-semibold text-alerta">Atenção: {alertas.join(", ")}{d.detalhe_condicoes ? ` — ${d.detalhe_condicoes}` : ""}</p>}
              {d.medicamentos && <p>💊 Remédios: {d.medicamentos}</p>}
              {d.restricoes && <p>🚫 Restrição: {d.restricoes}</p>}
              {d.condicoes && <p>Condições: {d.condicoes}</p>}
              {d.tipo_sanguineo && <p>🩸 Sangue: <b>{d.tipo_sanguineo}</b></p>}
              {d.plano && <p>🏥 Plano: {d.plano}</p>}
              {!Object.keys(d).length && <p className="text-alerta">Ficha de saúde não preenchida.</p>}
              {f.saude_validade && new Date(f.saude_validade) < new Date() && <p className="text-xs text-alerta">Ficha vencida — peça para atualizar.</p>}
            </div>
            {f.telefone && <a className="btn-sec w-full" href={`https://wa.me/${tel(f.telefone).length <= 11 ? "55" + tel(f.telefone) : tel(f.telefone)}`} target="_blank" rel="noreferrer">💬 WhatsApp do aluno</a>}
            <div className="flex gap-2">
              <Link href={`${base}/alunos/${f.membro_id}`} className="btn-sec flex-1">Ficha completa</Link>
              <button className="btn flex-1" onClick={onFechar}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Botão "🩺 Ler carteirinha": aponta a câmera para o QR e abre a ficha rápida
export function LerFichaQR({ base, className = "btn-sec" }: { base: string; className?: string }) {
  const [lendo, setLendo] = useState(false);
  const [membro, setMembro] = useState<string | null>(null);
  async function ler(texto: string) {
    const { data: v } = await supabaseNavegador().rpc("validar_qr", { p_texto: texto });
    const id = v?.membro_id || (/^[0-9a-f-]{36}$/i.test(texto) ? texto : null);
    if (!id) return `⛔ ${v?.motivo || "Carteirinha não reconhecida"}`;
    setLendo(false); setMembro(id);
    return "🩺 Abrindo a ficha…";
  }
  return (
    <>
      <button className={className} onClick={() => setLendo(true)}>🩺 Ficha pelo QR</button>
      {lendo && <LeitorQR onLer={ler} onFechar={() => setLendo(false)} titulo="Aponte para o QR da carteirinha (ficha rápida)" />}
      {membro && <FichaRapida membroId={membro} base={base} onFechar={() => setMembro(null)} />}
    </>
  );
}
