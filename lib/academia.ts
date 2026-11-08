import { cache } from "react";
import { supabaseServidor } from "./supabase/server";

export const buscarAcademia = cache(async (slug: string) => {
  // Ignora endereços que não são de academia (ex.: favicon.ico, robots.txt)
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("academias").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export function corDa(academia: any) {
  return academia?.cores?.primaria || "#7c3aed";
}

export function modulo(academia: any, nome: string) {
  return academia?.modulos?.[nome] !== false;
}
