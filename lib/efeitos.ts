// Sem "use client": roda no servidor (página da academia) e no navegador.
// Temporada automática pela data
export function efeitoDaTemporada(d = new Date()) {
  const m = d.getMonth() + 1, dia = d.getDate();
  if (m === 12 && dia <= 25) return "natal";
  if ((m === 12 && dia > 25) || (m === 1 && dia <= 6)) return "ano_novo";
  if (m === 2) return "carnaval";
  if (m === 6) return "junina";
  if (m === 10 && dia <= 12) return "criancas";
  return null;
}
