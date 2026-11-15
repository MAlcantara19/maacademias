import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_CHAVE } from "@/lib/supabase/chaves";

// Agenda das AULAS de uma ou mais turmas: /SLUG/aulas.ics?t=ID1,ID2
// Cada horário vira um evento semanal na agenda do celular (atualiza sozinho).
export const dynamic = "force-dynamic";

const DIA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const esc = (t?: string | null) => (t || "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
const so = (d: string) => d.replace(/-/g, "");
const hhmm = (t: string) => t.slice(0, 5).replace(":", "") + "00";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ids = (new URL(req.url).searchParams.get("t") || "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 10);
  const sb = createClient(SUPABASE_URL, SUPABASE_CHAVE, { auth: { persistSession: false } });
  const { data: a } = await sb.from("academias").select("id, nome, endereco, cidade").eq("slug", slug).maybeSingle();
  if (!a || !ids.length) return new Response("Turma não encontrada", { status: 404 });
  const { data: turmas } = await sb.from("turmas").select("id, nome, academia_id, horarios(id, dia_semana, hora_inicio, hora_fim, vale_de, vale_ate, tipo_treino)")
    .in("id", ids).eq("academia_id", a.id).eq("ativa", true);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const local = [a.endereco, a.cidade].filter(Boolean).join(" — ");
  const l = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MA Academias//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`Aulas · ${(turmas || []).map((t: any) => t.nome).join(", ") || a.nome}`)}`, "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "BEGIN:VTIMEZONE", "TZID:America/Sao_Paulo", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:-0300", "TZOFFSETTO:-0300", "TZNAME:-03", "END:STANDARD", "END:VTIMEZONE",
  ];
  for (const t of turmas || []) {
    for (const h of (t as any).horarios || []) {
      if (h.vale_ate && h.vale_ate < hoje) continue;
      // primeira aula: o próximo dia da semana certo a partir de hoje (ou do início do horário)
      const ini = new Date(((h.vale_de && h.vale_de > hoje) ? h.vale_de : hoje) + "T12:00:00");
      while (ini.getDay() !== h.dia_semana) ini.setDate(ini.getDate() + 1);
      const d = ini.toISOString().slice(0, 10);
      l.push("BEGIN:VEVENT", `UID:${h.id}@maacademias`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART;TZID=America/Sao_Paulo:${so(d)}T${hhmm(h.hora_inicio)}`, `DTEND;TZID=America/Sao_Paulo:${so(d)}T${hhmm(h.hora_fim || h.hora_inicio)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${DIA[h.dia_semana]}${h.vale_ate ? `;UNTIL=${so(h.vale_ate)}T235959Z` : ""}`,
        `SUMMARY:${esc(`🥋 ${t.nome}${h.tipo_treino ? ` · ${h.tipo_treino}` : ""}`)}`,
        ...(local ? [`LOCATION:${esc(local)}`] : []), `DESCRIPTION:${esc(a.nome)}`,
        "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.nome)}`, "END:VALARM", "END:VEVENT");
    }
  }
  l.push("END:VCALENDAR");
  return new Response(l.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
