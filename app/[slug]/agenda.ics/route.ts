import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

// Agenda da academia para "assinar" no celular (Google Agenda, iPhone, Outlook):
// /SLUG/agenda.ics — atualiza sozinha. Só eventos marcados como públicos.
export const revalidate = 1800;

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (t?: string | null) => (t || "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
// linhas do .ics têm no máximo 75 caracteres
const dobra = (l: string) => l.match(/.{1,73}/g)?.join("\r\n ") || l;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  const { data: a } = await sb.from("academias").select("id, nome, endereco").eq("slug", slug).maybeSingle();
  if (!a) return new Response("Academia não encontrada", { status: 404 });
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: evs } = await sb.from("eventos").select("id, tipo, titulo, descricao, inicio, fim, local, link")
    .eq("academia_id", a.id).eq("publico", true).gte("inicio", desde).order("inicio").limit(500);
  const ICONE: Record<string, string> = { campeonato: "🥇 ", prova: "🎓 ", feriado: "🏖️ ", evento: "", outro: "" };
  const linhas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MA Academias//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(a.nome)}`, "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of evs || []) {
    const ini = new Date(e.inicio);
    const fim = e.fim ? new Date(e.fim) : new Date(ini.getTime() + 2 * 3600000);
    linhas.push("BEGIN:VEVENT", `UID:${e.id}@maacademias`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(ini)}`, `DTEND:${fmt(fim)}`,
      dobra(`SUMMARY:${esc((ICONE[e.tipo] || "") + e.titulo)}`),
      ...(e.local ? [dobra(`LOCATION:${esc(e.local)}`)] : []),
      dobra(`DESCRIPTION:${esc([e.descricao, e.link, a.nome].filter(Boolean).join("\n"))}`),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", dobra(`DESCRIPTION:${esc(e.titulo)}`), "END:VALARM",
      "END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  return new Response(linhas.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="${slug}.ics"`, "Cache-Control": "public, max-age=1800" },
  });
}
