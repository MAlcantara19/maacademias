"use client";
import { useEffect, useState } from "react";

// Escolha de faixa + graus (ou dan na faixa preta). Devolve o texto pronto,
// ex.: "Faixa preta 3º dan" ou "Faixa roxa 2 graus".
export function SeletorGraduacao({ faixas, grausMax = 4, valor, onChange }: { faixas: string[]; grausMax?: number; valor?: string; onChange: (t: string) => void }) {
  const [faixa, setFaixa] = useState("");
  const [grau, setGrau] = useState(0);

  // tenta reconhecer o texto já salvo
  useEffect(() => {
    if (!valor) return;
    const f = faixas.find((x) => valor.toLowerCase().includes(x.toLowerCase()));
    if (f) setFaixa(f);
    const n = valor.match(/(\d+)/);
    if (n) setGrau(Number(n[1]));
  }, []); // eslint-disable-line

  const preta = faixa && faixa === faixas[faixas.length - 1];
  const opcoes = preta ? Array.from({ length: 10 }, (_, i) => i + 1) : Array.from({ length: grausMax + 1 }, (_, i) => i);
  function avisar(f: string, g: number) {
    if (!f) return onChange("");
    const ehPreta = f === faixas[faixas.length - 1];
    onChange(ehPreta ? `Faixa ${f.toLowerCase()} ${Math.max(1, g)}º dan` : `Faixa ${f.toLowerCase()}${g ? ` ${g} grau${g > 1 ? "s" : ""}` : ""}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <select className="campo" value={faixa} onChange={(e) => { const f = e.target.value; const g = f === faixas[faixas.length - 1] ? 1 : 0; setFaixa(f); setGrau(g); avisar(f, g); }} aria-label="Faixa">
        <option value="">Faixa…</option>
        {faixas.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <select className="campo" value={grau} disabled={!faixa} onChange={(e) => { const g = Number(e.target.value); setGrau(g); avisar(faixa, g); }} aria-label={preta ? "Dan" : "Graus"}>
        {opcoes.map((g) => <option key={g} value={g}>{preta ? `${g}º dan` : g === 0 ? "Sem grau" : `${g} grau${g > 1 ? "s" : ""}`}</option>)}
      </select>
    </div>
  );
}
