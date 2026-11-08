"use client";
import { createContext, useContext } from "react";

export type Ctx = {
  academia: any;
  perfil: any;
  papeis: string[];          // admin, professor, aluno, responsavel
  equipe: boolean;           // admin ou professor
  admin: boolean;
  membroId: string | null;   // meu vínculo (professor/admin ou aluno)
  meusAlunos: any[];         // eu (se aluno) + meus dependentes
};

const C = createContext<Ctx | null>(null);
export const ProvedorCtx = C.Provider;
export function useCtx() {
  const c = useContext(C);
  if (!c) throw new Error("Contexto fora da área logada");
  return c;
}
