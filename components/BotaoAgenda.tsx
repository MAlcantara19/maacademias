"use client";
// "Adicionar à agenda": Google Agenda (abre o site/app) e arquivo .ics (iPhone, Outlook)
function fmt(d: Date) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }

export function linkGoogleAgenda(ev: { titulo: string; inicio: string; fim?: string | null; local?: string | null; descricao?: string | null }, academia?: string) {
  const ini = new Date(ev.inicio);
  const fim = ev.fim ? new Date(ev.fim) : new Date(ini.getTime() + 2 * 3600 * 1000);
  const p = new URLSearchParams({
    action: "TEMPLATE", text: ev.titulo, dates: `${fmt(ini)}/${fmt(fim)}`,
    details: [ev.descricao, academia ? `— ${academia}` : ""].filter(Boolean).join("\n"), location: ev.local || "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function baixarIcs(ev: any, academia?: string) {
  const ini = new Date(ev.inicio);
  const fim = ev.fim ? new Date(ev.fim) : new Date(ini.getTime() + 2 * 3600 * 1000);
  const esc = (t: string) => (t || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const linhas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MA Academias//PT-BR", "BEGIN:VEVENT",
    `UID:${ev.id || fmt(ini)}@maacademias`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(ini)}`, `DTEND:${fmt(fim)}`,
    `SUMMARY:${esc(ev.titulo)}`, ev.local ? `LOCATION:${esc(ev.local)}` : "", `DESCRIPTION:${esc([ev.descricao, academia].filter(Boolean).join(" — "))}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.titulo)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([linhas.join("\r\n")], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${(ev.titulo || "evento").replace(/[^\w\- ]+/g, "").slice(0, 40) || "evento"}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function BotaoAgenda({ evento, academia, className = "underline" }: { evento: any; academia?: string; className?: string }) {
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  return (
    <span className="inline-flex flex-wrap gap-3">
      <a className={className} href={linkGoogleAgenda(evento, academia)} target="_blank" rel="noreferrer">📆 Google Agenda</a>
      <button type="button" className={className} onClick={() => baixarIcs(evento, academia)}>{ios ? "📆 Agenda do iPhone" : "📥 Outra agenda (.ics)"}</button>
    </span>
  );
}
