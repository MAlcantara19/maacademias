"use client";
import { useEffect, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { minhasTurmas } from "@/lib/turmas";
import { hojeISO } from "@/lib/util";

// Importar alunos de uma planilha (Excel, Google Planilhas ou CSV).
// A 1ª linha tem os títulos; só "Nome" é obrigatório.
const COLUNAS = ["Nome", "Apelido", "Nascimento", "Sexo", "WhatsApp", "E-mail", "Endereço", "Turma", "Faixa", "Grau", "Responsável", "WhatsApp do responsável"];

const sem = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
function campo(titulo: string) {
  const k = sem(titulo);
  if (k.includes("respons") && (k.includes("whats") || k.includes("tel"))) return "responsavel_tel";
  if (k.includes("respons")) return "responsavel";
  if (k.startsWith("nome")) return "nome";
  if (k.startsWith("apelido")) return "apelido";
  if (k.includes("nasc")) return "nascimento";
  if (k.startsWith("sexo")) return "sexo";
  if (k.includes("whats") || k.includes("telefone") || k.includes("celular")) return "telefone";
  if (k.includes("mail")) return "email";
  if (k.includes("ender")) return "endereco";
  if (k.startsWith("turma")) return "turma";
  if (k.startsWith("faixa")) return "faixa";
  if (k.startsWith("grau") || k.startsWith("dan")) return "grau";
  return "";
}
function dataISO(v: any) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return "";
  let a = Number(m[3]); if (a < 100) a += a > 30 ? 1900 : 2000;
  return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
const fone = (v: any) => { const d = String(v || "").replace(/\D/g, ""); return !d ? "" : d.length <= 11 ? "55" + d : d; };

export function ImportarAlunos({ onFechar }: { onFechar: () => void }) {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [linhas, setLinhas] = useState<any[]>([]);
  const [colado, setColado] = useState("");
  const [turmas, setTurmas] = useState<any[]>([]);
  const [mods, setMods] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [progresso, setProgresso] = useState<string>("");

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, modalidade_id").eq("academia_id", ctx.academia.id).eq("ativa", true).then(({ data }) => setTurmas(minhasTurmas(ctx, data || [])));
    sb.from("modalidades").select("id, graduacoes").eq("academia_id", ctx.academia.id).then(({ data }) => setMods(data || []));
  }, []); // eslint-disable-line

  function montar(tabela: any[][]) {
    if (tabela.length < 2) return setMsg("A planilha precisa da linha de títulos e pelo menos um aluno.");
    const titulos = tabela[0].map((t) => campo(String(t)));
    if (!titulos.includes("nome")) return setMsg("Não achei a coluna “Nome” na primeira linha.");
    const out = tabela.slice(1).map((l) => {
      const o: any = {};
      titulos.forEach((k, i) => { if (k && l[i] !== undefined && l[i] !== null && String(l[i]).trim() !== "") o[k] = l[i]; });
      return o;
    }).filter((o) => o.nome);
    setLinhas(out); setMsg(`${out.length} aluno(s) prontos para importar. Confira abaixo.`);
  }
  function lerColado() {
    const sep = colado.includes("\t") ? "\t" : colado.includes(";") ? ";" : ",";
    montar(colado.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(sep)));
  }
  async function lerArquivo(arq?: File) {
    if (!arq) return;
    if (/\.csv$/i.test(arq.name)) {
      const t = await arq.text();
      const sep = t.split("\n")[0].includes(";") ? ";" : ",";
      return montar(t.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, ""))));
    }
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await arq.arrayBuffer());
    const ws = wb.worksheets[0];
    const tabela: any[][] = [];
    ws.eachRow((row) => { tabela.push((row.values as any[]).slice(1).map((v: any) => (v && typeof v === "object" && "text" in v ? v.text : v))); });
    montar(tabela);
  }
  function baixarModelo() {
    const csv = COLUNAS.join(";") + "\nJoão da Silva;Joãozinho;12/03/2012;M;24999999999;;Rua A, 10;" + (turmas[0]?.nome || "Judô Infantil") + ";Azul;1;Maria da Silva;24988888888\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "modelo-alunos.csv"; a.click();
  }

  async function importar() {
    let ok = 0, erros = 0;
    for (const [n, l] of linhas.entries()) {
      setProgresso(`Importando ${n + 1} de ${linhas.length}…`);
      const perfilId = crypto.randomUUID(), membroId = crypto.randomUUID();
      const r1 = await sb.from("perfis").insert({
        id: perfilId, nome: String(l.nome).trim(), apelido: l.apelido || null, email: l.email ? String(l.email).toLowerCase().trim() : null,
        telefone: fone(l.telefone) || null, nascimento: dataISO(l.nascimento) || null, sexo: /^f/i.test(String(l.sexo || "")) ? "F" : "M",
        endereco: l.endereco || null, contato_emergencia_nome: l.responsavel || null, contato_emergencia_tel: fone(l.responsavel_tel) || null,
      });
      if (r1.error) { erros++; continue; }
      const r2 = await sb.from("membros").insert({ id: membroId, academia_id: ctx.academia.id, perfil_id: perfilId, papel: "aluno" });
      if (r2.error) { erros++; continue; }
      const t = l.turma ? turmas.find((x) => sem(x.nome) === sem(l.turma)) : null;
      if (t) await sb.from("matriculas").insert({ turma_id: t.id, membro_id: membroId });
      const mod = mods.find((m) => m.id === t?.modalidade_id) || mods[0];
      const faixa = l.faixa && mod ? (mod.graduacoes || []).find((f: string) => sem(f) === sem(l.faixa)) : null;
      if (faixa) await sb.from("graduacoes").insert({ membro_id: membroId, modalidade_id: mod.id, faixa, grau: Number(String(l.grau || "0").replace(/\D/g, "")) || 0, data: hojeISO(), observacao: "Importado da planilha", registrado_por: ctx.membroId });
      ok++;
    }
    setProgresso(""); setLinhas([]);
    setMsg(`✅ ${ok} aluno(s) importado(s)${erros ? ` · ${erros} com erro` : ""}.`);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-linha bg-painel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Importar alunos de planilha</h2>
        <button className="btn-sec text-sm" onClick={baixarModelo}>⬇️ Baixar modelo</button>
      </div>
      <p className="text-sm text-suave">Colunas aceitas (a 1ª linha é o título): {COLUNAS.join(", ")}. Só <b>Nome</b> é obrigatório. A turma e a faixa precisam ter o mesmo nome que no app.</p>
      <label className="btn-sec cursor-pointer text-sm">📂 Escolher arquivo (.xlsx ou .csv)<input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} /></label>
      <textarea className="campo min-h-24 text-xs" placeholder="…ou copie as linhas do Excel/Google Planilhas (com a linha de títulos) e cole aqui" value={colado} onChange={(e) => setColado(e.target.value)} />
      {colado && <button className="btn-sec text-sm" onClick={lerColado}>Ler o que colei</button>}
      {msg && <p className="text-sm">{msg}</p>}
      {linhas.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto rounded-xl bg-painel2">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-suave">{["Nome", "Nascimento", "WhatsApp", "Turma", "Faixa"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-t border-linha">
                    <td className="p-2">{l.nome}</td><td className="p-2">{dataISO(l.nascimento) || "—"}</td><td className="p-2">{fone(l.telefone) || "—"}</td>
                    <td className="p-2">{l.turma ? (turmas.some((x) => sem(x.nome) === sem(l.turma)) ? l.turma : `⚠️ ${l.turma}`) : "—"}</td><td className="p-2">{l.faixa || "—"}{l.grau ? ` ${l.grau}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-suave">⚠️ = turma não encontrada (o aluno entra sem turma).</p>
          <button className="btn" disabled={!!progresso} onClick={importar}>{progresso || `Importar ${linhas.length} aluno(s)`}</button>
        </>
      )}
      <button className="btn-sec text-sm" onClick={onFechar}>Fechar</button>
    </section>
  );
}
