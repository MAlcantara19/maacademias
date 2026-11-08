"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Faixa } from "./Faixa";

function distanciaKm(a: [number, number], b: [number, number]) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function Diretorio({ academias }: { academias: any[] }) {
  const [posicao, setPosicao] = useState<[number, number] | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  function pertoDeMim() {
    setErro("");
    if (!navigator.geolocation) return setErro("Seu navegador não informa a localização.");
    navigator.geolocation.getCurrentPosition(
      (p) => setPosicao([p.coords.latitude, p.coords.longitude]),
      () => setErro("Permita o acesso à localização para ordenar por distância.")
    );
  }

  const lista = useMemo(() => {
    const t = busca.toLowerCase();
    let l = academias.filter((a) =>
      !t || a.nome.toLowerCase().includes(t) || (a.cidade || "").toLowerCase().includes(t) ||
      (a.modalidades || []).some((m: string) => m.toLowerCase().includes(t))
    ).map((a) => ({
      ...a,
      km: posicao && a.latitude ? distanciaKm(posicao, [a.latitude, a.longitude]) : null,
    }));
    if (posicao) l = l.sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
    return l;
  }, [academias, busca, posicao]);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="campo" placeholder="Buscar por nome, cidade ou modalidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn-sec shrink-0" onClick={pertoDeMim}>📍 Perto de mim</button>
      </div>
      {erro && <p className="mt-2 text-sm text-alerta">{erro}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {lista.map((a) => {
          const cor = a.cores?.primaria || "#7c3aed";
          return (
            <Link key={a.id} href={`/${a.slug}`} className="group block overflow-hidden rounded-2xl border border-linha bg-painel transition hover:border-[--c]" style={{ ["--c" as any]: cor }}>
              <Faixa cor={cor} graus={0} altura={8} className="rounded-none" />
              <div className="flex gap-4 p-5">
                {a.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="titulo flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-3xl font-extrabold" style={{ background: cor }}>
                    {a.nome.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold">{a.nome}</h2>
                  <p className="text-sm text-suave">
                    {a.cidade || "—"}{a.km != null && <> · {a.km < 1 ? `${Math.round(a.km * 1000)} m` : `${a.km.toFixed(1)} km`}</>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(a.modalidades || []).map((m: string) => <span key={m} className="chip">{m}</span>)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        {lista.length === 0 && <p className="text-suave">Nenhuma academia encontrada com essa busca.</p>}
      </div>
    </section>
  );
}
