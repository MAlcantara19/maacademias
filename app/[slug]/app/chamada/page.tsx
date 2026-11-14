"use client";
import { comprimir } from "@/lib/imagem";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { DIAS, hora, hojeISO, primeiroNome, whatsapp } from "@/lib/util";
import { Avatar } from "@/components/Avatar";
import { LeitorQR } from "@/components/LeitorQR";
import { LegendaSelos } from "@/components/LegendaSelos";
import { Tour } from "@/components/Tour";
import { minhasTurmas } from "@/lib/turmas";
import { liberado } from "@/lib/planos";
import { reconhecer, rostosDaFoto } from "@/lib/rosto";
import { enfileirar, enviarFila, lerFila } from "@/lib/filaChamada";

function Chamada() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const params = useSearchParams();
  const base = `/${ctx.academia.slug}/app`;

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState(params.get("turma") || "");
  const [data, setData] = useState(hojeISO());
  const [horarioId, setHorarioId] = useState(params.get("horario") || "");
  const [aula, setAula] = useState<any>(null);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [presentes, setPresentes] = useState<Map<string, any>>(new Map());
  const presentesRef = useRef<Map<string, any>>(new Map());
  useEffect(() => { presentesRef.current = presentes; }, [presentes]);
  const [naFila, setNaFila] = useState(0);
  const [online, setOnline] = useState(true);

  // Sem internet: guarda no aparelho e manda quando voltar
  useEffect(() => {
    const enviar = async () => { setOnline(navigator.onLine); setNaFila(await enviarFila()); };
    setNaFila(lerFila().length); setOnline(navigator.onLine); enviar();
    const off = () => setOnline(false);
    window.addEventListener("online", enviar); window.addEventListener("offline", off);
    const t = setInterval(enviar, 30000);
    return () => { window.removeEventListener("online", enviar); window.removeEventListener("offline", off); clearInterval(t); };
  }, []);
  function chaveAula() {
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    return h ? { turma_id: turmaId, horario_id: h.id, data, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, tipo_treino: h.tipo_treino } : null;
  }
  function guardar(tipo: "marcar" | "desmarcar", membroId: string) {
    const k = chaveAula();
    if (!k) return;
    setNaFila(enfileirar({ tipo, aula: k, membro_id: membroId, confirmado_por: ctx.membroId }));
  }
  const [obs, setObs] = useState("");
  const [nomes, setNomes] = useState<Record<string, string[]>>({});
  const [perfisDe, setPerfisDe] = useState<Record<string, string>>({});
  const [facial, setFacial] = useState<any>(null);
  const [vao, setVao] = useState<Set<string>>(new Set());
  const [plano, setPlano] = useState<any>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [ouvido, setOuvido] = useState("");
  const [porVoz, setPorVoz] = useState<string[]>([]);
  const rec = useRef<any>(null);
  const ouvindoRef = useRef(false);
  const [msg, setMsg] = useState("");
  // informações extras de cada aluno: idade/menor, cadastro pendente e alerta de saúde
  const [idades, setIdades] = useState<Record<string, number | null>>({});
  const [pend, setPend] = useState<Record<string, string[]>>({});
  const [saude, setSaude] = useState<Record<string, string[]>>({});
  const [busca, setBusca] = useState("");
  const [ver, setVer] = useState<"todos" | "faltam" | "presentes">("todos");
  const [gerando, setGerando] = useState(false);
  const [seguidas, setSeguidas] = useState<Record<string, number>>({});
  const [zap, setZap] = useState<Record<string, string>>({});
  const [rapida, setRapida] = useState<{ ids: string[]; i: number; marcados: number } | null>(null);
  const [lendoQR, setLendoQR] = useState(false);
  const [aniversarios, setAniversarios] = useState<{ id: string; nome: string; idade: number; hoje: boolean }[]>([]);
  const [visitantes, setVisitantes] = useState<any[]>([]);
  const [novoVis, setNovoVis] = useState<any>(null);

  useEffect(() => {
    sb.from("turmas").select("id, nome, professor_id, modalidade_id, modalidades(nome, cor), horarios(*)")
      .eq("academia_id", ctx.academia.id).eq("ativa", true).order("nome")
      .then(({ data }) => {
        const l = minhasTurmas(ctx, data || []).sort((a: any, b: any) => Number(b.professor_id === ctx.professorId) - Number(a.professor_id === ctx.professorId));
        setTurmas(l);
        if (!turmaId && l[0]) setTurmaId(l[0].id);
      });
  }, []); // eslint-disable-line

  const turma = turmas.find((t) => t.id === turmaId);
  const dow = new Date(data + "T12:00:00").getDay();
  const horariosDoDia = useMemo(
    () => (turma?.horarios || []).filter((h: any) => h.dia_semana === dow).sort((a: any, b: any) => a.hora_inicio.localeCompare(b.hora_inicio)),
    [turma, dow]
  );

  useEffect(() => {
    if (horariosDoDia.length && !horariosDoDia.find((h: any) => h.id === horarioId)) setHorarioId(horariosDoDia[0].id);
    if (!horariosDoDia.length) setHorarioId("");
  }, [horariosDoDia]); // eslint-disable-line

  // Carrega (sem criar) a aula e a lista de alunos com alertas
  useEffect(() => {
    if (!turmaId) return;
    setAula(null); setPresentes(new Map()); setMsg("");
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    (async () => {
      const [{ data: lista }, pcRes, plRes, aRes] = await Promise.all([
        sb.rpc("alertas_chamada", { p_turma: turmaId, p_data: data }),
        h ? sb.from("pre_checkins").select("membro_id").eq("horario_id", h.id).eq("data", data) : Promise.resolve({ data: [] as any[] }),
        sb.from("planos_aula").select("*").eq("turma_id", turmaId).eq("data", data).limit(1),
        h ? sb.from("aulas").select("*").eq("turma_id", turmaId).eq("data", data).eq("hora_inicio", h.hora_inicio).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setAlunos(lista || []);
      // nomes e apelidos para a chamada por voz
      const ids = (lista || []).map((x: any) => x.membro_id);
      if (ids.length) {
        const { data: pn } = await sb.from("painel_alunos").select("membro_id, perfil_id, nome, apelido, idade, whatsapp, nascimento").in("membro_id", ids);
        setNomes(Object.fromEntries((pn || []).map((x: any) => [x.membro_id, [x.nome, x.apelido].filter(Boolean)])));
        setPerfisDe(Object.fromEntries((pn || []).map((x: any) => [x.membro_id, x.perfil_id])));
        setIdades(Object.fromEntries((pn || []).map((x: any) => [x.membro_id, x.idade ?? null])));
        setZap(Object.fromEntries((pn || []).filter((x: any) => x.whatsapp).map((x: any) => [x.membro_id, x.whatsapp])));
        // aniversariantes: hoje e nos próximos/últimos 3 dias
        const ref = new Date(data + "T12:00:00");
        setAniversarios((pn || []).filter((x: any) => x.nascimento).map((x: any) => {
          const n = new Date(x.nascimento + "T12:00:00");
          const este = new Date(ref.getFullYear(), n.getMonth(), n.getDate(), 12);
          const dif = Math.round((este.getTime() - ref.getTime()) / 86400000);
          return { id: x.membro_id, nome: x.apelido || x.nome, idade: ref.getFullYear() - n.getFullYear(), dif };
        }).filter((x: any) => Math.abs(x.dif) <= 3).sort((a: any, b: any) => Math.abs(a.dif) - Math.abs(b.dif)).map((x: any) => ({ ...x, hoje: x.dif === 0 })));
        // faltas seguidas: últimas aulas desta turma antes deste dia (desde que o aluno entrou)
        const [{ data: mats }, { data: ult }] = await Promise.all([
          sb.from("matriculas").select("membro_id, desde").eq("turma_id", turmaId),
          sb.from("aulas").select("id, data").eq("turma_id", turmaId).lt("data", data).neq("status", "cancelada")
            .order("data", { ascending: false }).order("hora_inicio", { ascending: false }).limit(8),
        ]);
        const { data: pr } = ult?.length ? await sb.from("presencas").select("aula_id, membro_id").in("aula_id", ult.map((u: any) => u.id)) : { data: [] as any[] };
        const veio = new Set((pr || []).map((x: any) => x.aula_id + "|" + x.membro_id));
        const desde = Object.fromEntries((mats || []).map((m: any) => [m.membro_id, m.desde]));
        const seg: Record<string, number> = {};
        for (const id of ids) {
          let n = 0;
          for (const u of ult || []) {
            if (desde[id] && u.data < desde[id]) break;
            if (veio.has(u.id + "|" + id)) break;
            n++;
          }
          if (n >= 2) seg[id] = n;
        }
        setSeguidas(seg);
        const perfis = (pn || []).map((x: any) => x.perfil_id);
        const [{ data: cp }, { data: fs }] = await Promise.all([
          sb.rpc("cadastros_pendentes", { p_acad: ctx.academia.id }),
          ctx.equipe && perfis.length ? sb.from("fichas_saude").select("perfil_id, dados, validade").in("perfil_id", perfis) : Promise.resolve({ data: [] as any[] }),
        ]);
        setPend(Object.fromEntries((cp || []).filter((x: any) => ids.includes(x.membro_id)).map((x: any) => [x.membro_id, x.itens || []])));
        const ROT: Record<string, string> = { cardiaco: "cardíaco", respiratorio: "respiratório", convulsao: "convulsão", ortopedico: "ortopédico" };
        setSaude(Object.fromEntries((fs || []).map((f: any) => {
          const d = f.dados || {};
          const l = [...Object.keys(ROT).filter((k) => d[k] === "sim").map((k) => ROT[k]), d.alergias && `alergia: ${d.alergias}`, d.restricoes && `restrição: ${d.restricoes}`].filter(Boolean);
          return [f.perfil_id, l];
        }).filter(([, l]: any) => l.length)));
      }
      setVao(new Set(((pcRes as any).data || []).map((x: any) => x.membro_id)));
      setPlano((plRes as any).data?.[0] || null);
      if (h) {
        const { data: vis } = await sb.from("aulas_experimentais").select("*").eq("academia_id", ctx.academia.id)
          .or(`horario_id.eq.${h.id},and(horario_id.is.null,data_desejada.eq.${data})`).eq("data_desejada", data);
        setVisitantes(vis || []);
      } else setVisitantes([]);
      if (!h) return;
      const a: any = (aRes as any).data;
      if (a) {
        setAula(a); setObs(a.observacao || "");
        const { data: pres } = await sb.from("presencas").select("*").eq("aula_id", a.id);
        setPresentes(new Map((pres || []).map((p: any) => [p.membro_id, p])));
      }
    })();
  }, [turmaId, horarioId, data]); // eslint-disable-line

  async function garantirAula() {
    if (aula) return aula;
    if (!navigator.onLine) return null;
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    if (!h) { setMsg("Escolha um horário desta turma para o dia."); return null; }
    const { data: a, error } = await sb.from("aulas").upsert(
      { turma_id: turmaId, horario_id: h.id, data, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, tipo_treino: h.tipo_treino },
      { onConflict: "turma_id,data,hora_inicio" }
    ).select().single();
    if (error) { setMsg("Não foi possível abrir a chamada: " + error.message); return null; }
    setAula(a);
    return a;
  }

  async function alternar(membroId: string) {
    const novo = new Map(presentesRef.current);
    const tirar = novo.has(membroId);
    if (tirar) novo.delete(membroId); else novo.set(membroId, { membro_id: membroId, metodo: "manual" });
    presentesRef.current = novo;
    setPresentes(novo); // a tela muda na hora, com ou sem internet
    const a = await garantirAula();
    if (!a) return guardar(tirar ? "desmarcar" : "marcar", membroId);
    const r = tirar
      ? await sb.from("presencas").delete().eq("aula_id", a.id).eq("membro_id", membroId)
      : await sb.from("presencas").upsert({ aula_id: a.id, membro_id: membroId, metodo: "manual", confirmado_por: ctx.membroId }, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
    if (r.error) guardar(tirar ? "desmarcar" : "marcar", membroId);
  }

  // ---------- Chamada por voz ----------
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b0+(\d)/g, "$1").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const NUM: Record<string, string> = { um: "1", dois: "2", tres: "3", quatro: "4", cinco: "5", seis: "6", sete: "7", oito: "8", nove: "9", dez: "10", onze: "11", doze: "12", treze: "13", quatorze: "14", catorze: "14", quinze: "15", dezesseis: "16" };

  function quemFoiDito(texto: string) {
    const falado = " " + norm(texto).split(" ").map((w) => NUM[w] || w).join(" ") + " ";
    const achados = new Set<string>();
    // 1º nome completo e apelido; depois primeiro nome, só se for único na turma
    const primeiros: Record<string, string[]> = {};
    for (const a of alunos) {
      const ns = (nomes[a.membro_id] || [a.nome]).map(norm);
      if (ns.some((n) => n && falado.includes(" " + n + " "))) achados.add(a.membro_id);
      const p = ns[0]?.split(" ")[0];
      if (p) (primeiros[p] ||= []).push(a.membro_id);
    }
    for (const [p, ids] of Object.entries(primeiros)) {
      if (ids.length === 1 && falado.includes(" " + p + " ")) achados.add(ids[0]);
    }
    return Array.from(achados);
  }

  async function marcarVarios(ids: string[]) {
    // usa a lista ATUAL de presentes (a voz pode repetir nomes: marca uma vez só)
    const novos = ids.filter((id) => !presentesRef.current.has(id));
    if (!novos.length) return;
    const atual = new Map(presentesRef.current);
    novos.forEach((id) => atual.set(id, { membro_id: id, metodo: "manual" }));
    presentesRef.current = atual;
    setPresentes(atual);
    setPorVoz((v) => Array.from(new Set([...v, ...novos])));
    const a = await garantirAula();
    if (!a) { novos.forEach((id) => guardar("marcar", id)); return; }
    const linhas = novos.map((id) => ({ aula_id: a.id, membro_id: id, metodo: "manual", confirmado_por: ctx.membroId }));
    const r = await sb.from("presencas").upsert(linhas, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
    if (r.error) novos.forEach((id) => guardar("marcar", id));
  }

  function alternarVoz() {
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!R) return setMsg("Este navegador não tem reconhecimento de voz. Use o Chrome no Android.");
    if (ouvindoRef.current) { ouvindoRef.current = false; setOuvindo(false); rec.current?.stop(); return; }
    const r = new R();
    r.lang = "pt-BR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const texto = e.results[i][0].transcript;
        setOuvido(texto);
        const ids = quemFoiDito(texto);
        if (ids.length) marcarVarios(ids);
      }
    };
    r.onend = () => { if (ouvindoRef.current) r.start(); };
    r.onerror = (e: any) => { if (e.error === "not-allowed") { ouvindoRef.current = false; setOuvindo(false); setMsg("Libere o microfone para usar a chamada por voz."); } };
    rec.current = r; ouvindoRef.current = true; setOuvindo(true); setPorVoz([]); r.start();
  }
  useEffect(() => () => { ouvindoRef.current = false; rec.current?.stop(); }, []);

  async function todos() {
    const ids = alunos.filter((x) => !presentesRef.current.has(x.membro_id)).map((x) => x.membro_id);
    if (!ids.length) return;
    const atual = new Map(presentesRef.current);
    ids.forEach((id) => atual.set(id, { membro_id: id, metodo: "manual" }));
    presentesRef.current = atual;
    setPresentes(atual);
    const a = await garantirAula();
    if (!a) { ids.forEach((id) => guardar("marcar", id)); return; }
    const faltam = ids.map((id) => ({ aula_id: a.id, membro_id: id, metodo: "manual", confirmado_por: ctx.membroId }));
    const r = await sb.from("presencas").upsert(faltam, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
    if (r.error) ids.forEach((id) => guardar("marcar", id));
  }

  async function desmarcarTodos() {
    const ids = Array.from(presentesRef.current.keys());
    if (!ids.length || !confirm(`Desmarcar os ${ids.length} presentes desta aula?`)) return;
    presentesRef.current = new Map();
    setPresentes(new Map());
    const a = await garantirAula();
    if (!a) { ids.forEach((id) => guardar("desmarcar", id)); return; }
    const r = await sb.from("presencas").delete().eq("aula_id", a.id).in("membro_id", ids);
    if (r.error) ids.forEach((id) => guardar("desmarcar", id));
  }

  // ---------- QR da carteirinha: lê e marca presente ----------
  async function lerCarteirinha(texto: string) {
    // QR do dia (carteirinha digital) ou código impresso — quem confere é o banco
    const { data: v, error } = await sb.rpc("validar_qr", { p_texto: texto });
    let id: string | undefined = v?.ok ? v.membro_id : undefined;
    if (error) id = alunos.find((a) => a.membro_id === texto)?.membro_id; // banco sem a atualização 19
    if (!id) return `⛔ ${v?.motivo || "Carteirinha não reconhecida"}`;
    const al = alunos.find((a) => a.membro_id === id);
    if (!al) return "❓ Carteirinha não é desta turma";
    if (presentesRef.current.has(al.membro_id)) return `✓ ${al.nome} já estava presente`;
    await marcarVarios([al.membro_id]);
    return `✅ ${al.nome} marcado(a)`;
  }

  // ---------- Aniversário: toca a melodia do parabéns ----------
  function tocarParabens() {
    try {
      const ac = new AudioContext();
      const N: Record<string, number> = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784 };
      const notas: [string, number][] = [["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2], ["G4", .75], ["G4", .25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
        ["G4", .75], ["G4", .25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2], ["F5", .75], ["F5", .25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 2]];
      let t = ac.currentTime + 0.1; const b = 0.42;
      for (const [n, d] of notas) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "triangle"; o.frequency.value = N[n]; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d * b * 0.95);
        o.start(t); o.stop(t + d * b); t += d * b;
      }
    } catch { /* sem áudio */ }
    setFesta(true); setTimeout(() => setFesta(false), 9000);
  }
  const [festa, setFesta] = useState(false);

  // ---------- Visitante (aula experimental na hora) ----------
  async function salvarVisitante() {
    if (!novoVis?.nome?.trim() || !novoVis?.telefone?.trim()) return setMsg("Para o visitante, preencha pelo menos nome e WhatsApp.");
    const h = horariosDoDia.find((x: any) => x.id === horarioId);
    const { error } = await sb.from("aulas_experimentais").insert({
      academia_id: ctx.academia.id, modalidade_id: turma?.modalidade_id || null, horario_id: h?.id || null, data_desejada: data,
      nome: novoVis.nome.trim(), telefone: novoVis.telefone.trim(), nascimento: novoVis.nascimento || null, email: novoVis.email || null,
      mensagem: [novoVis.responsavel && `Responsável: ${novoVis.responsavel}`, novoVis.obs].filter(Boolean).join(" · ") || "Visitante registrado na chamada",
      status: "compareceu", encaminhada_para: ctx.membroId,
    });
    if (error) return setMsg("Não foi possível salvar o visitante: " + error.message);
    setNovoVis(null);
    const { data: vis } = await sb.from("aulas_experimentais").select("*").eq("academia_id", ctx.academia.id).eq("data_desejada", data)
      .or(`horario_id.eq.${h?.id},horario_id.is.null`);
    setVisitantes(vis || []);
    setMsg("👋 Visitante registrado. Ele aparece em Aulas experimentais para o pós-aula.");
  }
  // link da pré-matrícula já preenchido com os dados do visitante
  function linkMatricula(v: any) {
    const resp = String(v.mensagem || "").match(/Responsável: ([^·]+)/)?.[1]?.trim();
    const q = new URLSearchParams({ nome: v.nome || "", tel: v.telefone || "", ...(v.nascimento ? { nasc: v.nascimento } : {}), ...(resp ? { resp } : {}), ...(v.email ? { email: v.email } : {}) });
    return `${window.location.origin}/${ctx.academia.slug}/cadastro?${q}`;
  }
  async function visitanteVeio(v: any) {
    await sb.from("aulas_experimentais").update({ status: "compareceu" }).eq("id", v.id);
    setVisitantes((l) => l.map((x) => (x.id === v.id ? { ...x, status: "compareceu" } : x)));
  }

  // ---------- Chamada rápida: um aluno por vez, "veio / não veio" ----------
  function abrirRapida() {
    const ids = alunos.filter((a) => !presentesRef.current.has(a.membro_id)).map((a) => a.membro_id);
    if (!ids.length) return setMsg("Todos já estão marcados como presentes.");
    setRapida({ ids, i: 0, marcados: 0 });
  }
  function responder(veio: boolean) {
    if (!rapida) return;
    const id = rapida.ids[rapida.i];
    if (veio !== presentesRef.current.has(id)) alternar(id); // ao voltar, dá para corrigir
    setRapida({ ...rapida, i: rapida.i + 1, marcados: rapida.marcados + (veio ? 1 : 0) });
  }

  // ---------- Imprimir / PDF ----------
  const horarioTxt = () => { const h = horariosDoDia.find((x: any) => x.id === horarioId); return h ? `${hora(h.hora_inicio)}–${hora(h.hora_fim)}` : ""; };
  const obsDe = (a: any) => [
    idades[a.membro_id] != null && idades[a.membro_id]! < 18 ? "Menor de idade" : "",
    pend[a.membro_id] ? `Cadastro pendente (${pend[a.membro_id].length})` : "",
    seguidas[a.membro_id] ? `Faltou as últimas ${seguidas[a.membro_id]}` : "",
    saude[perfisDe[a.membro_id]] ? `Saúde: ${saude[perfisDe[a.membro_id]].join("; ")}` : "",
  ].filter(Boolean).join(" · ");
  async function baixarPdf() {
    setGerando(true);
    try {
      const { gerarPdfChamada } = await import("@/lib/pdfChamada");
      const h = horariosDoDia.find((x: any) => x.id === horarioId);
      const blob = await gerarPdfChamada({
        academia: ctx.academia, turma: turma?.nome || "", data, horario: horarioTxt(), tipo: h?.tipo_treino, professor: ctx.perfil?.nome,
        anotacao: obs, cancelada,
        linhas: alunos.map((a) => {
          const p = presentes.get(a.membro_id);
          return { nome: a.nome, idade: idades[a.membro_id] ?? null, presente: !!p,
            chegada: p?.chegou_em && p.metodo !== "manual" ? new Date(p.chegou_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : p ? "" : "",
            obs: obsDe(a) };
        }),
      });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a"); el.href = url; el.download = `chamada-${(turma?.nome || "turma").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${data}.pdf`; el.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) { setMsg("Não deu para gerar o PDF: " + (e?.message || e)); }
    setGerando(false);
  }

  // ---------- Chamada por reconhecimento facial ----------
  async function chamadaPorFoto(arquivo?: File) {
    if (!arquivo) return;
    setFacial({ carregando: true, arquivo });
    try {
      const perfis = Object.values(perfisDe);
      const { data: cad } = perfis.length ? await sb.from("rostos").select("perfil_id, descritor").in("perfil_id", perfis) : { data: [] as any[] };
      const porPerfil = new Map<string, number[]>((cad || []).map((c: any) => [c.perfil_id, c.descritor as number[]]));
      const cadastrados = alunos.filter((a) => porPerfil.has(perfisDe[a.membro_id])).map((a) => ({ id: a.membro_id, descritor: porPerfil.get(perfisDe[a.membro_id]) }));
      const rostos = await rostosDaFoto(arquivo, true);
      const { achados, semNome } = reconhecer(rostos, cadastrados);
      setFacial({
        arquivo, rostos: rostos.length, semNome, semCadastro: alunos.length - cadastrados.length,
        marcados: new Set(achados.map((x) => x.id)), achados,
      });
    } catch (e: any) {
      setFacial(null);
      setMsg("Não foi possível analisar a foto neste aparelho: " + (e?.message || e));
    }
  }
  async function confirmarFacial(postar: boolean) {
    const ids = Array.from(facial.marcados as Set<string>);
    const a = await garantirAula();
    if (!a) return;
    const novos = ids.filter((id) => !presentes.has(id));
    if (novos.length) {
      const linhas = novos.map((id) => ({ aula_id: a.id, membro_id: id, metodo: "facial", confirmado_por: ctx.membroId }));
      await sb.from("presencas").upsert(linhas, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
      setPresentes((atual) => new Map([...atual, ...linhas.map((l) => [l.membro_id, l] as [string, any])]));
    }
    if (postar) {
      const dt = new DataTransfer(); dt.items.add(facial.arquivo);
      await fotoDoTreino(dt.files);
    }
    setMsg(`🤳 ${novos.length} presença(s) marcada(s) pela foto.`);
    setFacial(null);
  }

  // Foto do treino → vai para o feed da academia, marcando quem estava presente
  async function fotoDoTreino(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const a = await garantirAula();
    if (!a) return;
    setMsg("Enviando a foto para o feed…");
    const postId = crypto.randomUUID();
    const { error } = await sb.from("posts").insert({
      id: postId, academia_id: ctx.academia.id, autor_id: ctx.membroId, aula_id: a.id,
      legenda: `Treino de hoje · ${turma?.nome}${obs ? ` — ${obs}` : ""} 🥋`,
    });
    if (error) return setMsg("Não foi possível postar: " + error.message);
    let ordem = 0;
    for (const arq of Array.from(arquivos)) {
      const caminho = `${ctx.academia.id}/feed/${postId}-${ordem}.${arq.name.split(".").pop()}`;
      const up = await sb.storage.from("privado").upload(caminho, await comprimir(arq));
      let miniatura: string | null = null;
      if (!up.error) {
        const cm = `${ctx.academia.id}/feed/${postId}-${ordem}-p.jpg`;
        const um = await sb.storage.from("privado").upload(cm, await comprimir(arq, 640, 0.7));
        if (!um.error) miniatura = "privado:" + cm;
      }
      if (!up.error) await sb.from("post_midias").insert({ post_id: postId, tipo: "foto", url: "privado:" + caminho, miniatura, ordem: ordem++ });
    }
    if (presentes.size) await sb.from("post_marcacoes").insert(Array.from(presentes.keys()).map((m) => ({ post_id: postId, membro_id: m })));
    setMsg(`📸 Foto postada no feed com ${presentes.size} aluno(s) marcados.`);
  }

  async function salvarObs() {
    const a = await garantirAula();
    if (!a) return;
    await sb.from("aulas").update({ observacao: obs }).eq("id", a.id);
    setMsg("Anotação salva.");
  }

  async function cancelarAula() {
    const a = await garantirAula();
    if (!a || !confirm("Cancelar esta aula? Ela não conta na frequência de ninguém.")) return;
    await sb.from("presencas").delete().eq("aula_id", a.id);
    const { data: n } = await sb.from("aulas").update({ status: a.status === "cancelada" ? "normal" : "cancelada" }).eq("id", a.id).select().single();
    setAula(n); setPresentes(new Map());
  }

  const cancelada = aula?.status === "cancelada";
  const menor = (id: string) => idades[id] != null && idades[id]! < 18;
  const urgentes = alunos.filter((a) => pend[a.membro_id]).sort((x, y) => Number(menor(y.membro_id)) - Number(menor(x.membro_id)));
  const nMenores = alunos.filter((a) => menor(a.membro_id)).length;
  const t = busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visiveis = alunos.filter((a) => {
    const p = presentes.has(a.membro_id);
    if (ver === "faltam" && p) return false;
    if (ver === "presentes" && !p) return false;
    return !t || (nomes[a.membro_id] || [a.nome]).some((n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(t));
  });

  return (
    <>
    <div className="nao-imprimir space-y-5">
      <Tour id="chamada" perfilId={ctx.perfil?.id} vistos={ctx.perfil?.tours_vistos} passos={[
        { titulo: "Chamada", texto: "Escolha a turma, o dia e o horário. A chamada abre sozinha no primeiro toque." },
        { titulo: "Toque no aluno", texto: "Um toque marca presente; outro desmarca. Quem fez check-in pelo QR já aparece marcado com o horário de chegada." },
        { titulo: "Fique de olho nos ícones", texto: "📌 pendência · 📨 aluno respondeu · 🙋 avisou ausência · 🎂 aniversário · 💳 mensalidade · ⚖️ peso para campeonato." },
      ]} />
      <h1 className="text-4xl font-extrabold">Chamada</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo">Turma</label>
          <select className="campo" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo">Dia</label>
          <input type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="rotulo">Horário ({DIAS[dow]})</label>
          <select className="campo" value={horarioId} onChange={(e) => setHorarioId(e.target.value)} disabled={!horariosDoDia.length}>
            {!horariosDoDia.length && <option>Sem aula nesse dia</option>}
            {horariosDoDia.map((h: any) => <option key={h.id} value={h.id}>{hora(h.hora_inicio)}–{hora(h.hora_fim)} {h.tipo_treino ? `· ${h.tipo_treino}` : ""}</option>)}
          </select>
        </div>
      </div>

      {(!online || naFila > 0) && (
        <p className="rounded-xl p-3 text-sm font-semibold" style={{ background: "color-mix(in srgb, var(--color-alerta) 20%, transparent)" }}>
          {!online ? "📴 Sem internet: pode continuar a chamada, " : "⏳ "}{naFila ? `${naFila} marcação(ões) guardada(s) no aparelho` : "as marcações ficam guardadas"} e vão para o sistema sozinhas quando a internet voltar.
        </p>
      )}
      {horariosDoDia.length > 0 && (
        <div className="sticky top-[60px] z-10 flex items-center justify-between gap-3 rounded-2xl bg-painel p-4 lg:top-2">
          <div>
            <p className="numero text-3xl font-bold">
              {presentes.size}<span className="text-lg text-suave"> de {alunos.length} presentes</span>
            </p>
            <p className="text-xs text-suave">
              {alunos.length - presentes.size} faltando{alunos.length ? ` · ${Math.round((presentes.size / alunos.length) * 100)}%` : ""}
              {vao.size ? ` · ✋ ${vao.size} avisaram que vinham` : ""}{nMenores ? ` · 🧒 ${nMenores} menor(es)` : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {(ctx.academia.modos_chamada || []).includes("facial") && liberado(ctx.academia.plano, "chamada_facial") && !cancelada && (
              <label className="btn-sec cursor-pointer text-sm">🤳 Pela foto
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => chamadaPorFoto(e.target.files?.[0])} />
              </label>
            )}
            {liberado(ctx.academia.plano, "chamada_voz") && <button className="btn-sec text-sm" onClick={alternarVoz} disabled={cancelada} style={ouvindo ? { background: "var(--color-erro)", borderColor: "var(--color-erro)" } : {}}>
              {ouvindo ? "⏹ Parar" : "🎤 Por voz"}
            </button>}
            <button className="btn text-sm" onClick={abrirRapida} disabled={cancelada || !alunos.length}>⚡ Chamada rápida</button>
            <button className="btn-sec text-sm" onClick={() => setLendoQR(true)} disabled={cancelada || !alunos.length}>📷 Ler carteirinha</button>
            <button className="btn-sec text-sm" onClick={() => setNovoVis(novoVis ? null : {})} disabled={cancelada}>👋 Visitante</button>
            <button className="btn-sec text-sm" onClick={todos} disabled={cancelada}>✅ Marcar todos</button>
            <button className="btn-sec text-sm" onClick={desmarcarTodos} disabled={cancelada || !presentes.size}>↩️ Desmarcar todos</button>
            <button className="btn-sec text-sm" onClick={cancelarAula}>{cancelada ? "Reabrir aula" : "Cancelar aula"}</button>
          </div>
        </div>
      )}
      {facial && (
        <div className="rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }}>
          {facial.carregando ? <p>🤳 Analisando a foto… (na primeira vez demora uns segundos)</p> : (
            <>
              <p className="font-semibold">Encontrei {facial.rostos} rosto(s): {facial.achados.length} reconhecido(s){facial.semNome ? `, ${facial.semNome} sem nome` : ""}.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {alunos.filter((a) => facial.achados.some((x: any) => x.id === a.membro_id)).map((a) => {
                  const on = facial.marcados.has(a.membro_id);
                  return (
                    <li key={a.membro_id}>
                      <button className="chip py-2" style={on ? { background: "var(--color-ok)", borderColor: "var(--color-ok)", color: "#fff" } : {}}
                        onClick={() => { const s = new Set(facial.marcados); on ? s.delete(a.membro_id) : s.add(a.membro_id); setFacial({ ...facial, marcados: s }); }}>
                        {on ? "✓ " : ""}{a.nome}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {facial.semCadastro > 0 && <p className="mt-2 text-xs text-suave">{facial.semCadastro} aluno(s) desta turma ainda não cadastraram o rosto (na ficha do aluno → Chamada por foto). Marque esses tocando no nome.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn" onClick={() => confirmarFacial(false)}>Confirmar presenças</button>
                {ctx.academia.modulos?.feed !== false && <button className="btn-sec" onClick={() => confirmarFacial(true)}>Confirmar e postar no feed</button>}
                <button className="btn-sec" onClick={() => setFacial(null)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
      {ouvindo && (
        <div className="rounded-2xl border-2 border-erro bg-painel p-4">
          <p className="font-semibold">🎤 Ouvindo… fale o nome ou apelido dos alunos</p>
          <p className="text-sm text-suave">Ouvi: “{ouvido || "…"}”</p>
          {porVoz.length > 0 && <p className="mt-1 text-sm text-ok">✓ Marcados por voz ({porVoz.length}): {porVoz.map((id) => { const a = alunos.find((x) => x.membro_id === id); return a?.apelido || a?.nome; }).join(", ")}</p>}
        </div>
      )}
      {plano && (
        <details className="rounded-2xl bg-painel p-4" open>
          <summary className="cursor-pointer font-semibold">📝 Plano de hoje: {plano.titulo}</summary>
          <ol className="mt-2 space-y-1 text-sm">
            {(plano.blocos || []).map((b: any, i: number) => <li key={i}><b className="numero">{b.minutos}′</b> {b.tipo}{b.texto ? <span className="text-suave"> — {b.texto}</span> : null}</li>)}
          </ol>
        </details>
      )}
      {cancelada && <p className="rounded-xl bg-alerta/15 p-3 text-alerta">Aula cancelada. Ela não conta na frequência.</p>}
      {aniversarios.length > 0 && !cancelada && (
        <section className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #db2777, #f59e0b)" }}>
          {festa && Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="confete" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s`, background: ["#facc15", "#ffffff", "#22c55e", "#3b82f6"][i % 4] }} />
          ))}
          <p className="text-xl font-extrabold">🎂 {aniversarios.some((a) => a.hoje) ? "Tem aniversariante hoje!" : "Aniversariantes da semana"}</p>
          <ul className="mt-1 space-y-0.5">
            {aniversarios.map((a) => (
              <li key={a.id}>{a.hoje ? "🎉" : "🎈"} <b>{a.nome}</b> · {a.hoje ? `faz ${a.idade} anos hoje` : `${a.idade} anos ${(a as any).dif > 0 ? `em ${(a as any).dif} dia(s)` : `há ${-(a as any).dif} dia(s)`}`}</li>
            ))}
          </ul>
          <button className="relative mt-2 rounded-xl bg-white/25 px-4 py-2 font-bold" onClick={tocarParabens}>🎶 Tocar o parabéns no fim da aula</button>
        </section>
      )}
      {novoVis && !cancelada && (
        <section className="space-y-2 rounded-2xl border-2 bg-painel p-4" style={{ borderColor: "var(--cor)" }}>
          <p className="text-lg font-bold">👋 Visitante (aula experimental)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="campo" placeholder="Nome *" value={novoVis.nome || ""} onChange={(e) => setNovoVis({ ...novoVis, nome: e.target.value })} />
            <input className="campo" type="tel" placeholder="WhatsApp *" value={novoVis.telefone || ""} onChange={(e) => setNovoVis({ ...novoVis, telefone: e.target.value })} />
            <div><label className="rotulo">Nascimento</label><input className="campo" type="date" value={novoVis.nascimento || ""} onChange={(e) => setNovoVis({ ...novoVis, nascimento: e.target.value })} /></div>
            <input className="campo self-end" placeholder="E-mail (opcional)" value={novoVis.email || ""} onChange={(e) => setNovoVis({ ...novoVis, email: e.target.value })} />
            {novoVis.nascimento && (Date.now() - new Date(novoVis.nascimento).getTime()) / 31557600000 < 18 && (
              <input className="campo sm:col-span-2" placeholder="Nome do responsável (menor de idade)" value={novoVis.responsavel || ""} onChange={(e) => setNovoVis({ ...novoVis, responsavel: e.target.value })} />
            )}
            <input className="campo sm:col-span-2" placeholder="Observação (ex.: já treinou, veio com amigo)" value={novoVis.obs || ""} onChange={(e) => setNovoVis({ ...novoVis, obs: e.target.value })} />
          </div>
          <div className="flex gap-2"><button className="btn" onClick={salvarVisitante}>Salvar visitante</button><button className="btn-sec" onClick={() => setNovoVis(null)}>Cancelar</button></div>
        </section>
      )}
      {visitantes.length > 0 && !cancelada && (
        <section className="rounded-2xl bg-painel p-3">
          <p className="font-bold">👋 Visitantes / aula experimental ({visitantes.length})</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {visitantes.map((v) => {
              const idade = v.nascimento ? Math.floor((Date.now() - new Date(v.nascimento + "T12:00:00").getTime()) / 31557600000) : null;
              const w = whatsapp(v.telefone, `Oi, ${primeiroNome(v.nome)}! Foi ótimo ter você no treino da ${ctx.academia.nome} 🥋 Para fazer a matrícula é só preencher a ficha por aqui (já deixei seus dados): ${linkMatricula(v)}`);
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2">
                  <span><b>{v.nome}</b>{idade != null ? ` · ${idade} anos` : ""}{idade != null && idade < 18 ? " 🧒" : ""} <span className="text-xs text-suave">· {v.status === "compareceu" ? "✓ veio" : "agendado"}</span></span>
                  <span className="flex gap-2">
                    {v.status !== "compareceu" && <button className="btn-sec px-3 py-1 text-xs" onClick={() => visitanteVeio(v)}>✅ Veio</button>}
                    {w && <a className="btn-sec px-3 py-1 text-xs" target="_blank" href={w}>📲 Mandar link</a>}
                    <a className="btn-sec px-3 py-1 text-xs" target="_blank" href={linkMatricula(v)}>📝 Converter em matrícula</a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {urgentes.length > 0 && !cancelada && (
        <details className="rounded-2xl border-2 p-3" style={{ borderColor: "var(--color-erro)", background: "color-mix(in srgb, var(--color-erro) 12%, transparent)" }} open={urgentes.some((a) => menor(a.membro_id))}>
          <summary className="cursor-pointer font-bold text-erro">🚨 URGENTE: {urgentes.length} aluno(s) com cadastro pendente{urgentes.some((a) => menor(a.membro_id)) ? ` (${urgentes.filter((a) => menor(a.membro_id)).length} menor(es) de idade)` : ""}</summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {urgentes.map((a) => (
              <li key={a.membro_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel p-2">
                <span className="min-w-0 flex-1">
                  <b>{a.nome}</b>{menor(a.membro_id) && <span className="ml-1 rounded-full bg-erro px-2 py-0.5 text-xs font-bold text-white">MENOR · {idades[a.membro_id]} anos</span>}
                  <span className="block truncate text-xs text-suave">{pend[a.membro_id].slice(0, 4).join(", ")}{pend[a.membro_id].length > 4 ? "…" : ""}</span>
                </span>
                <Link className="btn-sec px-3 py-1 text-xs" href={`${base}/alunos/${a.membro_id}/cadastro`}>Resolver</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {Object.keys(seguidas).length > 0 && !cancelada && (
        <details className="rounded-2xl bg-painel p-3">
          <summary className="cursor-pointer font-bold">📉 Faltando seguido: {Object.keys(seguidas).length} aluno(s)</summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {alunos.filter((a) => seguidas[a.membro_id]).sort((x, y) => seguidas[y.membro_id] - seguidas[x.membro_id]).map((a) => {
              const w = whatsapp(zap[a.membro_id], `Oi, ${primeiroNome(nomes[a.membro_id]?.[1] || a.nome)}! Aqui é da ${ctx.academia.nome}. Sentimos sua falta nos últimos treinos da turma ${turma?.nome}. Está tudo bem? Te esperamos no tatame! 🥋`);
              return (
                <li key={a.membro_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-painel2 p-2">
                  <span><b>{a.nome}</b> <span className={seguidas[a.membro_id] >= 3 ? "font-semibold text-erro" : "text-alerta"}>· faltou as últimas {seguidas[a.membro_id]}{seguidas[a.membro_id] >= 8 ? "+" : ""}</span></span>
                  {w && <a className="btn-sec px-3 py-1 text-xs" href={w} target="_blank">💬 Mandar mensagem</a>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {horariosDoDia.length > 0 && !cancelada && alunos.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="campo sm:flex-1" placeholder="🔎 Buscar aluno" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="flex gap-1">
            {([["todos", "Todos"], ["faltam", `Faltando (${alunos.length - presentes.size})`], ["presentes", `Presentes (${presentes.size})`]] as const).map(([k, r]) => (
              <button key={k} className="chip flex-1 whitespace-nowrap py-2 text-sm" onClick={() => setVer(k)} style={ver === k ? { background: "var(--cor)", borderColor: "var(--cor)", color: "#fff" } : {}}>{r}</button>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-suave">{msg}</p>}

      {horariosDoDia.length > 0 && !cancelada && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visiveis.map((a) => {
            const p = presentes.get(a.membro_id);
            const sd = saude[perfisDe[a.membro_id]];
            return (
              <li key={a.membro_id}>
                <button
                  onClick={() => alternar(a.membro_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${p ? "border-ok bg-ok/10" : "border-transparent bg-painel"}`}
                  aria-pressed={!!p}
                >
                  <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.nome}{vao.has(a.membro_id) && <span title="Avisou que vinha"> ✋</span>}</p>
                    <div className="flex flex-wrap gap-1">
                      {menor(a.membro_id) && <span className="rounded-full px-2 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--cor) 25%, transparent)" }}>🧒 Menor · {idades[a.membro_id]} anos</span>}
                      {pend[a.membro_id] && (
                        <span className={`rounded-full bg-erro px-2 text-xs font-bold text-white ${menor(a.membro_id) ? "animate-pulse" : ""}`} title={pend[a.membro_id].join(", ")}>
                          🚨 {menor(a.membro_id) ? "URGENTE: " : ""}cadastro pendente ({pend[a.membro_id].length})
                        </span>
                      )}
                      {seguidas[a.membro_id] && <span className={`rounded-full px-2 text-xs font-semibold ${seguidas[a.membro_id] >= 3 ? "bg-erro/20 text-erro" : "bg-alerta/20"}`}>📉 faltou as últimas {seguidas[a.membro_id]}</span>}
                      {sd && <span className="rounded-full px-2 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--color-alerta) 30%, transparent)" }} title={sd.join(" · ")}>⚕️ {sd[0].length > 34 ? sd[0].slice(0, 32) + "…" : sd[0]}{sd.length > 1 ? ` +${sd.length - 1}` : ""}</span>}
                      {(a.alertas || []).map((al: any, k: number) => (
                        <span key={k} className="text-xs text-suave" title={al.texto}>{al.icone} {al.texto}</span>
                      ))}
                      {p?.metodo && p.metodo !== "manual" && (
                        <span className="text-xs text-suave">📲 {p.metodo === "qr_fixo" ? "QR" : p.metodo}{p.atraso_min > 0 ? ` · ${p.atraso_min} min de atraso` : ""}</span>
                      )}
                    </div>
                  </div>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${p ? "bg-ok text-white" : "bg-painel2 text-suave"}`}>{p ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
          {alunos.length === 0 && <p className="text-suave">Nenhum aluno matriculado nesta turma.</p>}
          {alunos.length > 0 && visiveis.length === 0 && <p className="text-suave">Ninguém nesse filtro.</p>}
        </ul>
      )}

      {horariosDoDia.length > 0 && !cancelada && (
        <section className="rounded-2xl bg-painel p-4">
          <label className="rotulo" htmlFor="obs">Anotação da aula</label>
          <textarea id="obs" className="campo min-h-20" placeholder="Ex.: treino de passagem de guarda, 6 rounds" value={obs} onChange={(e) => setObs(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-sec text-sm" onClick={salvarObs}>Salvar anotação</button>
            <button className="btn-sec text-sm" onClick={baixarPdf} disabled={gerando}>{gerando ? "Gerando…" : "📄 Baixar PDF"}</button>
            <button className="btn-sec text-sm" onClick={() => window.print()}>🖨️ Imprimir</button>
            {ctx.academia.modulos?.feed !== false && (
              <label className="btn-sec cursor-pointer text-sm">📷 Foto do treino → feed
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => fotoDoTreino(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-suave">A foto vai para o feed já marcando quem está presente. Faça a chamada antes de postar.</p>
        </section>
      )}

      <LegendaSelos titulos={false} ranking={false} />
      <p className="text-sm text-suave">
        Check-in pelo QR da parede: veja o código em <Link className="underline" href={`${base}/config`}>Personalizar academia</Link>.
        {" "}Lista do mês inteiro: <Link className="underline" href={`${base}/lista-presenca`}>Lista de presença</Link>.
      </p>
    </div>

    {lendoQR && <LeitorQR onLer={lerCarteirinha} onFechar={() => setLendoQR(false)} />}
    {rapida && (() => {
      const fim = rapida.i >= rapida.ids.length;
      const a = fim ? null : alunos.find((x) => x.membro_id === rapida.ids[rapida.i]);
      return (
        <div className="nao-imprimir fixed inset-0 z-[90] flex flex-col bg-fundo p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-suave">⚡ Chamada rápida · {turma?.nome}</p>
            <button className="btn-sec text-sm" onClick={() => setRapida(null)}>✕ Fechar</button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-painel2"><div className="h-full" style={{ width: `${(Math.min(rapida.i, rapida.ids.length) / rapida.ids.length) * 100}%`, background: "var(--cor)" }} /></div>
          {fim ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="text-5xl">✅</p>
              <p className="text-2xl font-bold">Chamada feita!</p>
              <p className="text-suave">{rapida.marcados} marcado(s) agora · {presentes.size} de {alunos.length} presentes</p>
              <button className="btn px-8 py-4 text-lg" onClick={() => setRapida(null)}>Concluir</button>
            </div>
          ) : a && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="numero text-sm text-suave">{rapida.i + 1} de {rapida.ids.length}</p>
              <Avatar foto={a.foto_url} nome={a.nome} cor={a.cor_faixa} grau={a.grau} tamanho={140} />
              <p className="text-3xl font-extrabold leading-tight sm:text-4xl">{nomes[a.membro_id]?.[1] || a.nome}</p>
              {nomes[a.membro_id]?.[1] && <p className="text-suave">{a.nome}</p>}
              <div className="flex flex-wrap justify-center gap-1.5 text-sm">
                {menor(a.membro_id) && <span className="chip">🧒 {idades[a.membro_id]} anos</span>}
                {vao.has(a.membro_id) && <span className="chip">✋ avisou que vinha</span>}
                {seguidas[a.membro_id] && <span className="chip">📉 faltou as últimas {seguidas[a.membro_id]}</span>}
                {pend[a.membro_id] && <span className="chip border-erro text-erro">🚨 cadastro pendente</span>}
              </div>
              <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3">
                <button className="rounded-3xl py-8 text-2xl font-extrabold text-white" style={{ background: "var(--color-erro)" }} onClick={() => responder(false)}>❌ Não veio</button>
                <button className="rounded-3xl py-8 text-2xl font-extrabold text-white" style={{ background: "var(--color-ok)" }} onClick={() => responder(true)}>✅ Veio</button>
              </div>
              {rapida.i > 0 && <button className="text-sm text-suave underline" onClick={() => setRapida({ ...rapida, i: rapida.i - 1 })}>⬅️ Voltar ao anterior</button>}
            </div>
          )}
        </div>
      );
    })()}

    {/* Versão para imprimir (só aparece na impressão) */}
    <div className="hidden bg-white p-2 text-black print:block">
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
      <p className="text-xl font-bold">{ctx.academia.nome} · Chamada</p>
      <p className="text-sm">{turma?.nome} · {new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · {horarioTxt()}{ctx.perfil?.nome ? ` · Prof.: ${ctx.perfil.nome}` : ""}</p>
      <p className="mb-2 text-sm font-bold">{cancelada ? "AULA CANCELADA" : `Presentes: ${presentes.size} de ${alunos.length} · Faltas: ${alunos.length - presentes.size}`}</p>
      <table className="w-full border-collapse text-xs">
        <thead><tr>{["#", "Aluno", "Idade", "Presença", "Observação"].map((h) => <th key={h} className="border border-gray-400 p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>
          {alunos.map((a, i) => (
            <tr key={a.membro_id}>
              <td className="border border-gray-400 p-1">{i + 1}</td>
              <td className="border border-gray-400 p-1">{a.nome}</td>
              <td className="border border-gray-400 p-1">{idades[a.membro_id] ?? "-"}</td>
              <td className="border border-gray-400 p-1 font-bold">{presentes.has(a.membro_id) ? "PRESENTE" : "FALTOU"}</td>
              <td className="border border-gray-400 p-1">{obsDe(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {obs && <p className="mt-2 text-xs">Anotação: {obs}</p>}
      <p className="mt-10 text-xs">______________________________________<br />Assinatura do(a) professor(a)</p>
    </div>
    </>
  );
}

export default function Pagina() {
  return <Suspense><Chamada /></Suspense>;
}
