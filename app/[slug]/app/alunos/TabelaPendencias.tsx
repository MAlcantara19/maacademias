"use client";
import Link from "next/link";
import { AREAS, porArea } from "@/lib/pendencias";

// Tabela: cada aluno × cada área do cadastro (✅ ok, ❌ falta), e planilha para baixar
export function TabelaPendencias({ alunos, pend, base, academia }: { alunos: any[]; pend: Record<string, string[]>; base: string; academia: string }) {
  const linhas = alunos.map((a) => ({ a, g: porArea(pend[a.membro_id] || []), total: (pend[a.membro_id] || []).length }))
    .sort((x, y) => y.total - x.total || x.a.nome.localeCompare(y.a.nome));
  const ok = linhas.filter((l) => !l.total).length;

  async function baixar() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pendências");
    ws.columns = [
      { header: "Aluno", key: "nome", width: 32 }, { header: "Idade", key: "idade", width: 7 }, { header: "Turmas", key: "turmas", width: 28 },
      { header: "WhatsApp", key: "zap", width: 16 }, { header: "Situação", key: "sit", width: 14 }, { header: "Qtd.", key: "qtd", width: 6 },
      ...AREAS.map((r) => ({ header: `${r.icone} ${r.nome}`, key: r.id, width: 34 })),
    ];
    for (const l of linhas) {
      const row = ws.addRow({
        nome: l.a.nome, idade: l.a.idade ?? "", turmas: (l.a.turmas || []).join(", "), zap: l.a.whatsapp || "",
        sit: l.total ? "Pendente" : "Completo", qtd: l.total,
        ...Object.fromEntries(AREAS.map((r) => [r.id, r.id === "resp" && (l.a.idade ?? 99) >= 18 ? "—" : l.g[r.id].length ? "❌ " + l.g[r.id].join("; ") : "✅"])),
      });
      row.getCell("sit").fill = { type: "pattern", pattern: "solid", fgColor: { argb: l.total ? "FFFDE68A" : "FFBBF7D0" } };
      AREAS.forEach((r) => { if (l.g[r.id].length) row.getCell(r.id).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } }; row.getCell(r.id).alignment = { wrapText: true, vertical: "top" }; });
    }
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: 6 + AREAS.length } };
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const el = document.createElement("a"); el.href = url; el.download = `pendencias-cadastro-${academia.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <section className="space-y-2 rounded-2xl bg-painel p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">📊 Pendências do cadastro · {ok} de {linhas.length} completos</p>
        <button className="btn-sec text-sm" onClick={baixar}>📥 Baixar planilha (Excel)</button>
      </div>
      <p className="text-xs text-suave">{AREAS.map((r) => `${r.icone} ${r.nome}`).join(" · ")} — toque no aluno para resolver. Passe o dedo/mouse no ❌ para ver o que falta.</p>
      <div className="-mx-3 overflow-x-auto px-3">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs text-suave">
              <th className="sticky left-0 bg-painel px-2 py-1">Aluno</th>
              {AREAS.map((r) => <th key={r.id} className="px-1 py-1 text-center" title={r.nome}>{r.icone}<span className="block text-[10px]">{r.nome}</span></th>)}
              <th className="px-2 py-1 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ a, g, total }) => (
              <tr key={a.membro_id} className="bg-painel2">
                <td className="sticky left-0 max-w-[11rem] rounded-l-xl bg-painel2 px-2 py-1.5">
                  <Link href={`${base}/alunos/${a.membro_id}/cadastro`} className="block truncate font-semibold underline-offset-2 hover:underline">{a.nome}</Link>
                  <span className="text-xs text-suave">{a.idade != null ? `${a.idade} anos` : ""}{a.idade != null && a.idade < 18 ? " 🧒" : ""}</span>
                </td>
                {AREAS.map((r) => {
                  const na = r.id === "resp" && (a.idade ?? 99) >= 18;
                  const itens = g[r.id];
                  return (
                    <td key={r.id} className="px-1 py-1.5 text-center" title={itens.join("\n") || (na ? "Não se aplica (adulto)" : "Tudo certo")}>
                      {na ? <span className="text-suave">—</span> : itens.length ? <span className="font-bold text-erro">❌{itens.length > 1 ? ` ${itens.length}` : ""}</span> : "✅"}
                    </td>
                  );
                })}
                <td className="rounded-r-xl px-2 py-1.5 text-center numero font-bold">{total || "✓"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
