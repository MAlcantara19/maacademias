"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { primeiroNome } from "@/lib/util";

function posicao(): Promise<GeolocationPosition> {
  return new Promise((ok, erro) => {
    if (!navigator.geolocation) return erro(new Error("sem gps"));
    navigator.geolocation.getCurrentPosition(ok, erro, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

// O aluno chega perto da academia e toca em "Cheguei": a presença fica
// esperando o professor aceitar na chamada (ou já entra, se a academia quiser).
// Com o "automático" ligado, o app tenta sozinho ao ser aberto perto da academia.
export function CheckinGPS({ academia, membroId, nome, claro = false }: { academia: any; membroId: string; nome?: string | null; claro?: boolean }) {
  const sb = supabaseNavegador();
  const [estado, setEstado] = useState<"" | "buscando" | "pendente" | "presente" | "erro">("");
  const [texto, setTexto] = useState("");
  const [auto, setAuto] = useState(false);
  const chave = `ma_gps_auto_${academia.slug}`;
  const tentou = useRef(false);

  async function fazer(silencioso = false) {
    setEstado("buscando"); setTexto("");
    try {
      const p = await posicao();
      const { data, error } = await sb.rpc("checkin_gps", { p_membro: membroId, p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_precisao: p.coords.accuracy });
      if (error || !data?.ok) {
        if (silencioso) { setEstado(""); return; }
        setEstado("erro"); setTexto(data?.erro || "Não deu para fazer o check-in agora."); return;
      }
      setEstado(data.status === "presente" ? "presente" : "pendente");
      setTexto(data.status === "presente" ? `Presença marcada: ${data.turma} ✅` : `Check-in feito: ${data.turma}. O professor confirma na chamada.`);
    } catch {
      if (silencioso) { setEstado(""); return; }
      setEstado("erro"); setTexto("Não consegui pegar sua localização. Libere a localização para este site nas configurações do celular.");
    }
  }

  useEffect(() => {
    let ligado = false;
    try { ligado = localStorage.getItem(chave) === "1"; } catch { /* */ }
    setAuto(ligado);
    if (!ligado || tentou.current) return;
    tentou.current = true;
    // só tenta sozinho se a localização já estiver liberada (não fica pedindo permissão)
    (navigator as any).permissions?.query({ name: "geolocation" }).then((r: any) => { if (r.state === "granted") fazer(true); }).catch(() => {});
  }, []); // eslint-disable-line

  function alternarAuto() {
    const v = !auto; setAuto(v);
    try { localStorage.setItem(chave, v ? "1" : "0"); } catch { /* */ }
    if (v && !estado) fazer(true);
  }

  if (academia.checkin_gps === false || academia.latitude == null) return null;
  const quem = nome ? primeiroNome(nome) : null;
  const corBotao = claro ? "bg-white text-black" : "btn";

  return (
    <div className="mt-3 space-y-1.5">
      {estado === "pendente" || estado === "presente" ? (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${claro ? "bg-white/20" : "bg-painel2"}`}>{estado === "presente" ? "✅" : "📍"} {texto}</p>
      ) : (
        <button onClick={() => fazer(false)} disabled={estado === "buscando"} className={`rounded-xl px-4 py-2 font-semibold ${corBotao}`}>
          {estado === "buscando" ? "📍 Procurando você…" : quem ? `📍 ${quem} chegou (check-in)` : "📍 Cheguei na academia"}
        </button>
      )}
      {estado === "erro" && <p className="text-sm opacity-90">⚠️ {texto}</p>}
      <label className="flex items-center gap-2 text-xs opacity-90">
        <input type="checkbox" checked={auto} onChange={alternarAuto} /> Fazer o check-in sozinho quando eu abrir o app perto da academia
      </label>
    </div>
  );
}

// Para a chamada: quem fez check-in pelo GPS e está esperando o professor
export function CheckinsGPSPendentes({ turmaId, data, horaInicio, presentes, onMudou }: {
  turmaId: string; data: string; horaInicio?: string | null; presentes: Set<string>; onMudou: () => void;
}) {
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    if (!turmaId || !horaInicio) { setLista([]); return; }
    const { data: l } = await sb.from("checkins_gps")
      .select("id, membro_id, distancia_m, atraso_min, criado_em, aulas!inner(turma_id, data, hora_inicio), membros(perfis(nome, apelido, foto_url))")
      .eq("status", "pendente").eq("aulas.turma_id", turmaId).eq("aulas.data", data).eq("aulas.hora_inicio", horaInicio).order("criado_em");
    setLista(l || []);
  }
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 20000); // chega gente durante a aula
    return () => clearInterval(t);
  }, [turmaId, data, horaInicio]); // eslint-disable-line

  async function decidir(ids: string[], aceitar: boolean) {
    setOcupado(true);
    await sb.rpc("decidir_checkins_gps", { p_ids: ids, p_aceitar: aceitar });
    setOcupado(false);
    await carregar(); onMudou();
  }

  // quem o professor já marcou na mão não precisa aparecer aqui
  const esperando = lista.filter((c) => !presentes.has(c.membro_id));
  if (!esperando.length) return null;
  return (
    <section className="space-y-2 rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-bold">📍 Chegaram pelo GPS ({esperando.length})</p>
        <button className="btn text-sm" disabled={ocupado} onClick={() => decidir(esperando.map((c) => c.id), true)}>✅ Aceitar todos</button>
      </div>
      <ul className="space-y-1.5">
        {esperando.map((c) => {
          const p = c.membros?.perfis || {};
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2 text-sm">
              <span><b>{p.apelido || p.nome || "Aluno"}</b> <span className="text-suave">· {new Date(c.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{c.distancia_m != null ? ` · a ${c.distancia_m} m` : ""}{c.atraso_min > 0 ? ` · ${c.atraso_min} min depois do início` : ""}</span></span>
              <span className="flex gap-2">
                <button className="btn px-3 py-1 text-xs" disabled={ocupado} onClick={() => decidir([c.id], true)}>✅ Aceitar</button>
                <button className="btn-sec px-3 py-1 text-xs" disabled={ocupado} onClick={() => decidir([c.id], false)}>Não veio</button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-suave">O aluno tocou em “Cheguei” no celular perto da academia. Confira se ele está no tatame e aceite.</p>
    </section>
  );
}

// Para a tela inicial da equipe: check-ins esperando (últimos 7 dias), com "aceitar todos"
export function CheckinsGPSHoje({ academiaId, base }: { academiaId: string; base: string }) {
  const sb = supabaseNavegador();
  const [lista, setLista] = useState<any[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");
  async function carregar() {
    const desde = new Date(Date.now() - 7 * 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const { data } = await sb.from("checkins_gps").select("id, aulas!inner(data, hora_inicio, turma_id, horario_id, turmas(nome))")
      .eq("academia_id", academiaId).eq("status", "pendente").gte("aulas.data", desde);
    setLista(data || []);
  }
  useEffect(() => { carregar().catch(() => {}); }, [academiaId]); // eslint-disable-line
  if (!lista.length) return msg ? <p className="rounded-2xl bg-painel p-3 text-sm text-ok">{msg}</p> : null;

  const grupos = Array.from(lista.reduce((m: Map<string, any>, c: any) => {
    const k = c.aulas.data + c.aulas.turma_id + c.aulas.hora_inicio;
    const g = m.get(k) || { ...c.aulas, ids: [] as string[] }; g.ids.push(c.id); m.set(k, g); return m;
  }, new Map()).values()) as any[];
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  async function aceitarTodos() {
    if (!confirm(`Aceitar os ${lista.length} check-ins pelo GPS? Eles viram presença.`)) return;
    setOcupado(true);
    const { data } = await sb.rpc("decidir_checkins_gps", { p_ids: lista.map((c) => c.id), p_aceitar: true });
    setOcupado(false); setMsg(`✅ ${data || lista.length} presença(s) confirmada(s).`); carregar();
  }
  return (
    <section id="gps" className="space-y-2 rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">📍 {lista.length} check-in{lista.length > 1 ? "s" : ""} pelo GPS esperando você</p>
        <button className="btn text-sm" disabled={ocupado} onClick={aceitarTodos}>✅ Aceitar todos</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {grupos.map((g) => (
          <Link key={g.data + g.turma_id + g.hora_inicio} className="btn-sec text-sm" href={`${base}/chamada?turma=${g.turma_id}${g.horario_id ? `&horario=${g.horario_id}` : ""}${g.data !== hoje ? `&data=${g.data}` : ""}`}>
            {g.data !== hoje ? `${g.data.slice(8)}/${g.data.slice(5, 7)} · ` : ""}{g.turmas?.nome} · {String(g.hora_inicio).slice(0, 5)} · {g.ids.length}
          </Link>
        ))}
      </div>
      <p className="text-xs text-suave">Toque numa turma para conferir um por um na chamada.</p>
    </section>
  );
}

// Telão: "Bem-vindo, João! 🥋" para quem acabou de fazer check-in (GPS, QR ou totem)
export function BoasVindasTelao({ academiaId }: { academiaId: string }) {
  const sb = supabaseNavegador();
  const [fila, setFila] = useState<{ chave: string; nome: string; foto?: string | null; turma?: string }[]>([]);
  const vistos = useRef<Set<string>>(new Set());
  const desde = useRef<string>(new Date(Date.now() - 60000).toISOString());

  useEffect(() => {
    async function olhar() {
      const agora = new Date().toISOString();
      const [g, q] = await Promise.all([
        sb.from("checkins_gps").select("id, membro_id, criado_em, membros(perfis(nome, apelido, foto_url)), aulas(turmas(nome))")
          .eq("academia_id", academiaId).gte("criado_em", desde.current).neq("status", "recusado"),
        sb.from("presencas").select("aula_id, membro_id, chegou_em, metodo, membros(perfis(nome, apelido, foto_url)), aulas!inner(turmas!inner(nome, academia_id))")
          .in("metodo", ["qr_fixo", "totem", "carteirinha"]).eq("aulas.turmas.academia_id", academiaId).gte("chegou_em", desde.current),
      ]);
      desde.current = new Date(Date.parse(agora) - 5000).toISOString();
      const novos = [...(g.data || []), ...(q.data || [])].map((x: any) => {
        const p = x.membros?.perfis || {};
        return { chave: `${x.membro_id}-${(x.criado_em || x.chegou_em || "").slice(0, 13)}`, nome: (p.apelido || p.nome || "").split(" ")[0], foto: p.foto_url, turma: x.aulas?.turmas?.nome };
      }).filter((x) => x.nome && !vistos.current.has(x.chave));
      novos.forEach((x) => vistos.current.add(x.chave));
      if (novos.length) setFila((f) => [...f, ...novos]);
    }
    olhar().catch(() => {});
    const t = setInterval(() => olhar().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [academiaId]); // eslint-disable-line

  // cada boas-vindas fica 6 segundos na tela
  useEffect(() => {
    if (!fila.length) return;
    const t = setTimeout(() => setFila((f) => f.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [fila]);

  const atual = fila[0];
  if (!atual) return null;
  return (
    <div key={atual.chave} className="pointer-events-none absolute inset-x-0 bottom-[8%] z-20 flex justify-center px-6">
      <div className="flex items-center gap-5 rounded-3xl px-8 py-5 text-white shadow-2xl" style={{ background: "var(--cor)", animation: "entrar-boas-vindas .5s ease-out" }}>
        {atual.foto ? <img src={atual.foto} alt="" className="h-20 w-20 rounded-full border-4 border-white object-cover" /> : <span className="text-6xl">🥋</span>}
        <div>
          <p className="text-4xl font-extrabold">Bem-vindo, {atual.nome}! 🥋</p>
          {atual.turma && <p className="text-xl opacity-90">{atual.turma}{fila.length > 1 ? ` · +${fila.length - 1} chegando` : ""}</p>}
        </div>
      </div>
      <style>{`@keyframes entrar-boas-vindas { from { transform: translateY(40px) scale(.9); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
