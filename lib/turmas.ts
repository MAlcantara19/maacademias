import type { Ctx } from "./contexto";

// Admin vê todas as turmas; o professor vê só as dele
export function minhasTurmas(ctx: Ctx, turmas: any[]): any[] {
  if (ctx.admin || ctx.master) return turmas;
  return turmas.filter((t) => t.professor_id && t.professor_id === ctx.professorId);
}
