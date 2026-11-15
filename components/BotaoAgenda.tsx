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

// "Assinar a agenda da academia": todos os eventos públicos entram e se atualizam sozinhos
export function AssinarAgenda({ slug, nome }: { slug: string; nome: string }) {
  const host = typeof window !== "undefined" ? window.location.host : "";
  if (!host) return null;
  const webcal = `webcal://${host}/${slug}/agenda.ics`;
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <details className="rounded-2xl bg-painel p-3 text-sm">
      <summary className="cursor-pointer font-semibold">📲 Colocar os eventos da {nome} na agenda do celular</summary>
      <p className="mt-2 text-suave">Uma vez só: os campeonatos, provas e feriados entram na sua agenda e se atualizam sozinhos.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="btn text-sm" href={google} target="_blank" rel="noreferrer">📆 Google Agenda (Android)</a>
        <a className="btn-sec text-sm" href={webcal}>🍎 iPhone / Outlook</a>
        <button className="btn-sec text-sm" onClick={() => navigator.clipboard?.writeText(`https://${host}/${slug}/agenda.ics`)}>📋 Copiar link</button>
      </div>
      <p className="mt-1 text-xs text-suave">Só entram os eventos marcados como “aparece na página pública”.</p>
    </details>
  );
}

// "Minhas aulas na agenda": os horários das turmas do aluno viram eventos semanais
export function AgendaAulas({ slug, turmas }: { slug: string; turmas: string[] }) {
  const host = typeof window !== "undefined" ? window.location.host : "";
  if (!host || !turmas.length) return null;
  const caminho = `${host}/${slug}/aulas.ics?t=${turmas.join(",")}`;
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-painel p-3 text-sm">
      <span className="font-semibold">📲 Minhas aulas na agenda do celular</span>
      <a className="btn px-3 py-1.5 text-sm" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent("webcal://" + caminho)}`} target="_blank" rel="noreferrer">📆 Google Agenda</a>
      <a className="btn-sec px-3 py-1.5 text-sm" href={`webcal://${caminho}`}>🍎 iPhone</a>
      <span className="w-full text-xs text-suave">Cada aula entra toda semana, com lembrete 1 hora antes. Se o horário mudar, a agenda atualiza sozinha.</span>
    </section>
  );
}
