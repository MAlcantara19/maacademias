"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Faixa } from "./Faixa";

function distanciaKm(a: [number, number], b: [number, number]) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function Diretorio({ academias: todas, mostrarPilotos = true }: { academias: any[]; mostrarPilotos?: boolean }) {
  // banco sem a ATUALIZAÇÃO 25: reconhece os pilotos pelo endereço
  const academias = todas.map((a) => ({ ...a, demonstracao: a.demonstracao ?? String(a.slug || "").startsWith("piloto-") }));
  const [posicao, setPosicao] = useState<[number, number] | null>(null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"reais" | "pilotos">(() => (todas.some((a) => !(a.demonstracao ?? String(a.slug || "").startsWith("piloto-"))) ? "reais" : "pilotos"));
  const [cidade, setCidade] = useState("");
  const [modalidade, setModalidade] = useState("");
  const reais = academias.filter((a) => !a.demonstracao);
  const pilotos = mostrarPilotos ? academias.filter((a) => a.demonstracao) : [];
  const base = aba === "pilotos" && pilotos.length ? pilotos : reais;
  const cidades = Array.from(new Set(base.map((a) => a.cidade).filter(Boolean))).sort();
  const modalidades = Array.from(new Set(base.flatMap((a) => a.modalidades || []))).sort();
  // se a pessoa já liberou a localização antes, já mostra a distância sem perguntar
  useEffect(() => {
    (navigator as any).permissions?.query({ name: "geolocation" }).then((r: any) => {
      if (r.state === "granted") navigator.geolocation.getCurrentPosition((p) => setPosicao([p.coords.latitude, p.coords.longitude]), () => {}, { maximumAge: 10 * 60 * 1000 });
    }).catch(() => {});
  }, []);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);

  function pertoDeMim() {
    setErro("");
    if (!navigator.geolocation) return setErro("Seu navegador não informa a localização.");
    if (!window.isSecureContext) return setErro("A localização só funciona no site com https (ou em localhost).");
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPosicao([p.coords.latitude, p.coords.longitude]); setBuscando(false); },
      (e) => {
        setBuscando(false);
        setErro(e.code === 1 ? "Você bloqueou a localização. Libere no cadeado ao lado do endereço do site e tente de novo."
          : e.code === 3 ? "Demorou para achar sua localização. Ative o GPS/localização do aparelho e tente de novo."
          : "Não foi possível pegar sua localização neste aparelho.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 }
    );
  }

  const lista = useMemo(() => {
    const t = busca.toLowerCase();
    let l = base.filter((a) => (!cidade || a.cidade === cidade) && (!modalidade || (a.modalidades || []).includes(modalidade))).filter((a) =>
      !t || a.nome.toLowerCase().includes(t) || (a.cidade || "").toLowerCase().includes(t) ||
      (a.modalidades || []).some((m: string) => m.toLowerCase().includes(t))
    ).map((a) => ({
      ...a,
      km: posicao && a.latitude ? distanciaKm(posicao, [a.latitude, a.longitude]) : null,
    }));
    if (posicao) l = l.sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
    return l;
  }, [base, busca, posicao, cidade, modalidade]);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="campo" placeholder="Buscar por nome, cidade ou modalidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn-sec shrink-0" onClick={pertoDeMim} disabled={buscando}>{buscando ? "📍 Buscando…" : posicao ? "📍 Ordenado por distância" : "📍 Perto de mim"}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pilotos.length > 0 && (
          <div className="flex rounded-full border border-linha p-1 text-sm">
            <button className={`rounded-full px-3 py-1 ${aba === "reais" ? "font-bold text-white" : "text-suave"}`} style={aba === "reais" ? { background: "var(--cor)" } : {}} onClick={() => { setAba("reais"); setCidade(""); setModalidade(""); }}>🥋 Academias ({reais.length})</button>
            <button className={`rounded-full px-3 py-1 ${aba === "pilotos" ? "font-bold text-white" : "text-suave"}`} style={aba === "pilotos" ? { background: "var(--cor)" } : {}} onClick={() => { setAba("pilotos"); setCidade(""); setModalidade(""); }}>🧪 Pilotos ({pilotos.length})</button>
          </div>
        )}
        {cidades.length > 1 && (
          <select className="campo w-auto py-1.5 text-sm" value={cidade} onChange={(e) => setCidade(e.target.value)} aria-label="Cidade">
            <option value="">📍 Todas as cidades</option>
            {cidades.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        {modalidades.length > 1 && (
          <select className="campo w-auto py-1.5 text-sm" value={modalidade} onChange={(e) => setModalidade(e.target.value)} aria-label="Modalidade">
            <option value="">🥋 Todas as modalidades</option>
            {modalidades.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
      </div>
      {aba === "pilotos" && <p className="mt-2 text-sm text-suave">🧪 Academias de demonstração: entre e veja o app por dentro, com dados de exemplo.</p>}
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
                  <h2 className="text-2xl font-bold">{a.nome}{a.demonstracao ? <span className="ml-2 align-middle text-xs font-normal text-suave">🧪 demonstração</span> : null}</h2>
                  <p className="text-sm text-suave">
                    {a.cidade || "—"}{a.km != null ? <> · <b>{a.km < 1 ? `${Math.round(a.km * 1000)} m` : `${a.km.toFixed(1)} km`}</b> de você</> : posicao ? " · sem endereço no mapa" : ""}
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
