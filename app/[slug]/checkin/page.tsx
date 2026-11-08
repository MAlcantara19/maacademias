"use client";
import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

function Checkin({ slug }: { slug: string }) {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [estado, setEstado] = useState<"carregando" | "login" | "ok" | "erro">("carregando");
  const [texto, setTexto] = useState("");
  const [detalhe, setDetalhe] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabaseNavegador();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return setEstado("login");
      const marcar = async (lat: number | null, lng: number | null) => {
        const { data, error } = await sb.rpc("fazer_checkin", { p_token: token, p_lat: lat, p_lng: lng });
        if (error || !data?.ok) { setEstado("erro"); setTexto(data?.erro || "Não foi possível marcar a presença."); return; }
        setEstado("ok");
        setTexto(`Presença marcada: ${data.turma}`);
        setDetalhe(data.atrasado ? `Você chegou ${data.atraso_min} min depois do início. Bora pro aquecimento! 🏃` : "Bom treino! 🥋");
      };
      if (!navigator.geolocation) return marcar(null, null);
      navigator.geolocation.getCurrentPosition(
        (p) => marcar(p.coords.latitude, p.coords.longitude),
        () => marcar(null, null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    })();
  }, [token]);

  const proximo = encodeURIComponent(`/${slug}/checkin?t=${token}`);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {estado === "carregando" && <p className="text-2xl">Marcando sua presença…</p>}
      {estado === "login" && (
        <>
          <h1 className="text-4xl font-extrabold">Entre para fazer o check-in</h1>
          <Link href={`/login?next=${proximo}`} className="btn">Entrar</Link>
        </>
      )}
      {estado === "ok" && (
        <>
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-ok text-6xl text-white">✓</div>
          <h1 className="text-4xl font-extrabold">{texto}</h1>
          <p className="text-lg text-suave">{detalhe}</p>
          <Link href={`/${slug}/app`} className="btn-sec">Abrir o app</Link>
        </>
      )}
      {estado === "erro" && (
        <>
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-erro text-6xl text-white">!</div>
          <h1 className="text-3xl font-extrabold">{texto}</h1>
          <p className="text-suave">Se estiver na academia, avise o professor para marcar na chamada.</p>
          <Link href={`/${slug}/app`} className="btn-sec">Abrir o app</Link>
        </>
      )}
    </main>
  );
}

export default function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <Suspense><Checkin slug={slug} /></Suspense>;
}
