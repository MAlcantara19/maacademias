"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCtx } from "@/lib/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Tatame } from "@/components/Tatame";
import { liberado } from "@/lib/planos";
import { hojeISO, hora, primeiroNome } from "@/lib/util";
import { reconhecer, rostosDaFoto } from "@/lib/rosto";

// Modo totem: um tablet/celular na recepção onde o aluno marca a própria presença.
// Fica logado com a conta do professor/admin. Aulas de 30 min antes até 1h depois do início.
export default function Totem() {
  const ctx = useCtx();
  const sb = supabaseNavegador();
  const [ativo, setAtivo] = useState(false);
  const [agora, setAgora] = useState(new Date());
  const [aulas, setAulas] = useState<any[]>([]);
  const [confirmar, setConfirmar] = useState<any>(null);
  const [feito, setFeito] = useState<any>(null);
  const [camera, setCamera] = useState(false);
  const [msg, setMsg] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const facial = liberado(ctx.academia.plano, "chamada_facial") && (ctx.academia.modos_chamada || []).includes("facial");

  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 30000); return () => clearInterval(t); }, []);

  async function carregar() {
    const hoje = hojeISO();
    const dow = new Date(hoje + "T12:00:00").getDay();
    const { data: hs } = await sb.from("horarios").select("*, turmas!inner(id, nome, academia_id)").eq("turmas.academia_id", ctx.academia.id).eq("dia_semana", dow);
    const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const ag = agora.getHours() * 60 + agora.getMinutes();
    const janela = (hs || []).filter((h: any) => ag >= min(h.hora_inicio) - 30 && ag <= min(h.hora_inicio) + 60);
    const out: any[] = [];
    for (const h of janela) {
      const { data: lista } = await sb.rpc("alertas_chamada", { p_turma: h.turma_id, p_data: hoje });
      const { data: a } = await sb.from("aulas").select("id").eq("turma_id", h.turma_id).eq("data", hoje).eq("hora_inicio", h.hora_inicio).maybeSingle();
      const { data: pres } = a ? await sb.from("presencas").select("membro_id").eq("aula_id", a.id) : { data: [] as any[] };
      out.push({ h, alunos: lista || [], presentes: new Set((pres || []).map((p: any) => p.membro_id)) });
    }
    setAulas(out);
  }
  useEffect(() => { if (ativo) carregar(); }, [ativo, agora.getMinutes() < 30]); // eslint-disable-line

  async function marcar(aula: any, aluno: any) {
    const hoje = hojeISO();
    let { data: a } = await sb.from("aulas").select("id").eq("turma_id", aula.h.turma_id).eq("data", hoje).eq("hora_inicio", aula.h.hora_inicio).maybeSingle();
    if (!a) {
      const r = await sb.from("aulas").insert({ turma_id: aula.h.turma_id, horario_id: aula.h.id, data: hoje, hora_inicio: aula.h.hora_inicio, hora_fim: aula.h.hora_fim }).select("id").single();
      a = r.data;
    }
    if (!a) return setMsg("Não consegui abrir a aula. Chame o professor.");
    await sb.from("presencas").upsert({ aula_id: a.id, membro_id: aluno.membro_id, metodo: "totem", confirmado_por: ctx.membroId }, { onConflict: "aula_id,membro_id", ignoreDuplicates: true });
    setConfirmar(null);
    setFeito({ nome: aluno.nome, turma: aula.h.turmas.nome, hora: aula.h.hora_inicio, foto: aluno.foto_url });
    setTimeout(() => setFeito(null), 3500);
    carregar();
  }

  // ---------- Reconhecimento pelo rosto ----------
  async function abrirCamera() {
    setMsg(""); setCamera(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
    } catch { setMsg("Não consegui abrir a câmera."); setCamera(false); }
  }
  function fecharCamera() {
    (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    setCamera(false);
  }
  async function reconhecerAgora() {
    const v = video.current; if (!v) return;
    setMsg("Reconhecendo…");
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) return;
    const rostos = await rostosDaFoto(new File([blob], "totem.jpg", { type: "image/jpeg" }), false);
    const todos = aulas.flatMap((a) => a.alunos.map((x: any) => ({ aula: a, aluno: x })));
    const ids: string[] = Array.from(new Set(todos.map((t) => t.aluno.membro_id as string)));
    const { data: pn } = ids.length ? await sb.from("painel_alunos").select("membro_id, perfil_id").in("membro_id", ids) : { data: [] as any[] };
    const perfil = new Map<string, string>((pn || []).map((p: any) => [p.membro_id, p.perfil_id]));
    const { data: cad } = await sb.from("rostos").select("perfil_id, descritor").in("perfil_id", Array.from(perfil.values()));
    const porPerfil = new Map<string, number[]>((cad || []).map((r: any) => [r.perfil_id, r.descritor]));
    const cadastrados = ids.filter((id) => porPerfil.has(perfil.get(id) || "")).map((id) => ({ id, descritor: porPerfil.get(perfil.get(id) || "")! }));
    const { achados } = reconhecer(rostos, cadastrados);
    if (!achados.length) return setMsg("Não reconheci. Tente de novo de frente para a câmera, ou toque no seu nome.");
    const alvo = todos.find((t) => t.aluno.membro_id === achados[0].id)!;
    fecharCamera(); setMsg("");
    setConfirmar(alvo);
  }

  if (!liberado(ctx.academia.plano, "totem")) {
    return (
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold">Modo totem</h1>
        <p className="text-suave">O modo totem faz parte do plano Completo: um tablet ou celular na recepção onde o próprio aluno marca a presença, tocando no nome ou pelo rosto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!ativo && (
        <>
          <h1 className="text-4xl font-extrabold">Modo totem</h1>
          <p className="text-suave">Deixe um tablet ou celular na recepção, ligado na tomada e conectado ao Wi-Fi. O aluno toca no próprio nome{facial ? " ou mostra o rosto" : ""} para marcar presença nas aulas que estão começando.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-suave">
            <li>Entre com a conta do professor ou do admin neste aparelho.</li>
            <li>Para travar o aparelho só no app, use um app de quiosque (ex.: Fully Kiosk Browser) apontando para este endereço.</li>
            <li>A tela mostra as aulas de 30 minutos antes até 1 hora depois do início.</li>
          </ul>
          <button className="btn w-full py-5 text-2xl" onClick={() => setAtivo(true)}>📟 Abrir o totem</button>
        </>
      )}
      <Tatame ativo={ativo} onSair={() => { fecharCamera(); setAtivo(false); }}>
        {ativo && (
          <div className="flex w-full max-w-5xl flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-xl text-suave">{ctx.academia.nome}</p>
              <p className="numero text-7xl font-extrabold">{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-2xl">Toque no seu nome para marcar presença</p>
            </div>
            {facial && !camera && <button className="btn px-8 py-4 text-2xl" onClick={abrirCamera}>📷 Entrar pelo rosto</button>}
            {camera && (
              <div className="flex flex-col items-center gap-3">
                <video ref={video} className="h-64 w-64 rounded-full object-cover" playsInline muted style={{ transform: "scaleX(-1)" }} />
                <div className="flex gap-2"><button className="btn px-6 py-3 text-xl" onClick={reconhecerAgora}>Sou eu</button><button className="btn-sec px-6 py-3" onClick={fecharCamera}>Cancelar</button></div>
              </div>
            )}
            {msg && <p className="text-lg text-alerta">{msg}</p>}
            {!aulas.length && <p className="text-2xl text-suave">Nenhuma aula começando agora.</p>}
            {aulas.map((a) => (
              <section key={a.h.id} className="w-full">
                <h2 className="mb-2 text-2xl font-bold">{a.h.turmas.nome} · {hora(a.h.hora_inicio)}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {a.alunos.map((x: any) => {
                    const ok = a.presentes.has(x.membro_id);
                    return (
                      <button key={x.membro_id} disabled={ok} onClick={() => setConfirmar({ aula: a, aluno: x })}
                        className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center ${ok ? "bg-ok/20" : "bg-painel"}`}>
                        <Avatar foto={x.foto_url} nome={x.nome} cor={x.cor_faixa} grau={x.grau} tamanho={64} />
                        <span className="text-lg font-semibold leading-tight">{x.apelido || primeiroNome(x.nome)}{ok ? " ✅" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {confirmar && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-6">
            <div className="w-full max-w-md space-y-4 rounded-3xl bg-painel p-6 text-center">
              <Avatar foto={confirmar.aluno.foto_url} nome={confirmar.aluno.nome} cor={confirmar.aluno.cor_faixa} tamanho={96} />
              <p className="text-3xl font-bold">É você, {primeiroNome(confirmar.aluno.nome)}?</p>
              <p className="text-xl text-suave">{confirmar.aula.h.turmas.nome} · {hora(confirmar.aula.h.hora_inicio)}</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-sec py-4 text-xl" onClick={() => setConfirmar(null)}>Não</button>
                <button className="btn py-4 text-xl" onClick={() => marcar(confirmar.aula, confirmar.aluno)}>Sou eu ✅</button>
              </div>
            </div>
          </div>
        )}
        {feito && (
          <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 p-6 text-center text-white" style={{ background: "var(--color-ok)" }}>
            <p className="text-8xl">✅</p>
            <p className="text-5xl font-extrabold">Bom treino, {primeiroNome(feito.nome)}!</p>
            <p className="text-2xl">{feito.turma} · {hora(feito.hora)}</p>
          </div>
        )}
      </Tatame>
      {!ativo && <Link href={`/${ctx.academia.slug}/app/config`} className="text-sm text-suave underline">Configurar reconhecimento facial</Link>}
    </div>
  );
}
