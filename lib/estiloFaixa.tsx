"use client";
import { createContext, useContext } from "react";

// Como os graus aparecem na faixa (definido por academia):
// barra    = ponteira preta com graus brancos (jiu-jitsu)
// branco   = graus brancos direto na faixa, sem ponteira (judô)
// colorido = graus na cor da PRÓXIMA faixa, sem ponteira (judô)
export type Estilo = "barra" | "branco" | "colorido";
export type EstiloFaixa = { estilo: Estilo; cores: string[][] };

export const EstiloFaixaCtx = createContext<EstiloFaixa>({ estilo: "barra", cores: [] });
export const useEstiloFaixa = () => useContext(EstiloFaixaCtx);

// cor da próxima faixa, procurando nas listas de cores das modalidades
export function corProxima(cor: string | null | undefined, cores: string[][]) {
  const c = (cor || "").toLowerCase();
  for (const lista of cores) {
    const i = (lista || []).findIndex((x) => (x || "").toLowerCase() === c);
    if (i >= 0 && i < lista.length - 1) return lista[i + 1];
  }
  return "#ffffff";
}
