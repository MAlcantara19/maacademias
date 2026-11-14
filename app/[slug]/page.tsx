import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServidor } from "@/lib/supabase/server";
import { buscarAcademia, corDa, modulo } from "@/lib/academia";
import { DIAS_CURTOS, DIAS, hora, whatsapp, dataHoraBR } from "@/lib/util";
import { Faixa } from "@/components/Faixa";
import { Avatar } from "@/components/Avatar";
import { FormExperimental } from "./FormExperimental";
import { BotaoWhats } from "@/components/BotaoWhats";
import { EfeitosTela, efeitoDaTemporada } from "@/components/EfeitosTela";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await buscarAcademia(slug);
  return { title: a ? `${a.nome} — horários e aula experimental` : "Academia", description: a?.slogan || undefined };
}

// Se algo der errado ao montar a página, mostra uma versão simples (nome, WhatsApp)
// em vez da tela de erro, e anota o motivo real em "Atividade e erros" do master.
export default async function PaginaAcademia(props: { params: Promise<{ slug: string }> }) {
  try {
    return await Conteudo(props);
  } catch (e: any) {
    if (typeof e?.digest === "string" && e.digest.startsWith("NEXT_")) throw e; // notFound/redirect
    const { slug } = await props.params;
    try {
      const sb = await supabaseServidor();
      await sb.from("erros_app").insert({ pagina: `/${slug}`, mensagem: `[servidor] ${String(e?.message || e).slice(0, 480)}`, detalhe: String(e?.stack || "").slice(0, 2000), navegador: "servidor" });
    } catch { /* sem conexão */ }
    const a = await buscarAcademia(slug).catch(() => null);
    if (!a) notFound();
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6" style={{ ["--cor" as any]: corDa(a) }}>
        <h1 className="text-5xl font-extrabold">{String(a.nome || "")}</h1>
        {a.slogan && <p className="text-suave">{String(a.slogan)}</p>}
        <p className="text-suave">A página completa está sendo ajustada. Fale com a academia:</p>
        {a.whatsapp && <a className="btn w-fit" href={`https://wa.me/${String(a.whatsapp).replace(/\D/g, "")}`} target="_blank">WhatsApp</a>}
        <Link href="/login" className="btn-sec w-fit">Área do aluno</Link>
      </main>
    );
  }
}

async function Conteudo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bruta = await buscarAcademia(slug);
  if (!bruta) notFound();
  // dados "limpos": número é número, texto é texto (evita quebrar a página com dado estranho)
  const num = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const txt = (v: any) => (v === null || v === undefined ? "" : typeof v === "string" ? v : String(v));
  const academia: any = {
    ...bruta, nome: txt(bruta.nome), slogan: txt(bruta.slogan), sobre: txt(bruta.sobre), endereco: txt(bruta.endereco), cidade: txt(bruta.cidade),
    latitude: num(bruta.latitude), longitude: num(bruta.longitude), maps_url: txt(bruta.maps_url), instagram: txt(bruta.instagram), whatsapp: txt(bruta.whatsapp),
    tema: bruta.tema && typeof bruta.tema === "object" ? bruta.tema : {}, cores: bruta.cores && typeof bruta.cores === "object" ? bruta.cores : {},
  };
  const supabase = await supabaseServidor();
  const cor = corDa(academia);

  const [{ data: modalidades }, { data: turmas }, { data: professores }, { data: eventos }, { data: avisos }, { data: propagandas }] =
    await Promise.all([
      supabase.from("modalidades").select("*").eq("academia_id", academia.id).eq("ativa", true).order("ordem"),
      supabase.from("turmas").select("id, nome, publico, modalidade_id, horarios(*)").eq("academia_id", academia.id).eq("ativa", true),
      supabase.from("professores_publicos").select("*").eq("academia_id", academia.id),
      supabase.from("eventos").select("*").eq("academia_id", academia.id).eq("publico", true)
        .gte("inicio", new Date().toISOString()).order("inicio").limit(6),
      supabase.from("avisos").select("*").eq("academia_id", academia.id).eq("publico", true).order("fixado", { ascending: false }).limit(3),
      modulo(academia, "propaganda")
        ? supabase.from("propagandas").select("*").eq("academia_id", academia.id).eq("ativa", true).order("ordem")
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const corMod = new Map((modalidades || []).map((m: any) => [m.id, m.cor || cor]));
  const nomeMod = new Map((modalidades || []).map((m: any) => [m.id, m.nome]));
  const grade: Record<number, any[]> = {};
  (turmas || []).forEach((t: any) =>
    (t.horarios || []).forEach((h: any) => {
      (grade[h.dia_semana] ||= []).push({ ...h, turma: t.nome, modalidade_id: t.modalidade_id });
    })
  );
  Object.values(grade).forEach((l) => l.sort((a, b) => txt(a.hora_inicio).localeCompare(txt(b.hora_inicio))));
  const diasComAula = [1, 2, 3, 4, 5, 6, 0].filter((d) => grade[d]?.length);

  return (
    <div style={{ ["--cor" as any]: cor }} className="min-h-dvh bg-fundo pb-28 text-texto"
      data-modo={academia.tema?.modo || "escuro"} data-fonte={academia.tema?.fonte || "esportiva"}>
      {/* Topo */}
      <header className="relative overflow-hidden">
        {academia.capa_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={academia.capa_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative mx-auto max-w-5xl px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <nav className="flex items-center justify-between py-3">
            <Link href="/" className="text-sm text-suave">Todas as academias</Link>
            <Link href="/login" className="btn-sec text-sm">Área do aluno</Link>
          </nav>
          <div className="mt-10 flex items-end gap-5">
            {academia.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={academia.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover sm:h-28 sm:w-28" />
            ) : (
              <div className="titulo flex h-20 w-20 items-center justify-center rounded-2xl text-5xl font-extrabold sm:h-28 sm:w-28" style={{ background: cor }}>
                {academia.nome.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-5xl font-extrabold sm:text-7xl">{academia.nome}</h1>
              {academia.slogan && <p className="mt-1 text-lg text-suave">{academia.slogan}</p>}
            </div>
          </div>
          <Faixa cor={cor} graus={4} altura={14} className="mt-8" />
          <div className="mt-5 flex flex-wrap gap-2">
            {(modalidades || []).map((m: any) => (
              <span key={m.id} className="chip" style={{ borderColor: m.cor || cor }}>{m.icone} {m.nome}</span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5">
        {/* Propagandas */}
        {(propagandas || []).length > 0 && (
          <section className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2">
            {(propagandas || []).map((p: any) => (
              <a key={p.id} href={p.link || "#experimental"} className="relative block w-[85%] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[48%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imagem_url} alt="" className="aspect-[12/5] w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="text-2xl font-bold">{p.titulo}</h3>
                  {p.texto && <p className="text-sm">{p.texto}</p>}
                </div>
              </a>
            ))}
          </section>
        )}

        {/* Avisos públicos */}
        {(avisos || []).filter((a: any) => !a.expira_em || new Date(a.expira_em) > new Date()).map((a: any) => (
          <div key={a.id} className="rounded-2xl border-l-4 bg-painel p-4" style={{ borderColor: cor }}>
            <p className="font-semibold">{a.titulo}</p>
            {a.texto && <p className="text-sm text-suave">{a.texto}</p>}
          </div>
        ))}

        {/* Horários */}
        <section id="horarios">
          <h2 className="text-4xl font-extrabold">Horários</h2>
          <div className="-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
            {diasComAula.map((d) => (
              <div key={d} className="w-44 shrink-0 snap-start lg:w-auto">
                <h3 className="mb-2 text-xl font-bold">
                  <span className="lg:hidden">{DIAS[d]}</span><span className="hidden lg:inline">{DIAS_CURTOS[d]}</span>
                </h3>
                <div className="space-y-2">
                  {grade[d].map((h: any) => (
                    <div key={h.id} className="rounded-xl bg-painel p-3" style={{ borderLeft: `4px solid ${corMod.get(h.modalidade_id)}` }}>
                      <p className="numero text-lg font-bold">{hora(h.hora_inicio)}–{hora(h.hora_fim)}</p>
                      <p className="text-sm font-semibold">{nomeMod.get(h.modalidade_id)}</p>
                      <p className="text-xs text-suave">{h.turma}{h.tipo_treino ? ` · ${h.tipo_treino}` : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {diasComAula.length === 0 && <p className="text-suave">Os horários aparecem aqui assim que a academia cadastrar as turmas.</p>}
          </div>
        </section>

        {/* Sobre */}
        {modulo(academia, "sobre") && academia.sobre && (
          <section>
            <h2 className="text-4xl font-extrabold">Sobre nós</h2>
            <p className="mt-4 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-suave">{academia.sobre}</p>
          </section>
        )}

        {/* Professores */}
        {(professores || []).length > 0 && (
          <section>
            <h2 className="text-4xl font-extrabold">Professores</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(professores || []).map((p: any) => {
                const link = whatsapp(p.whatsapp_publico, `Olá, professor(a)! Vi o site da ${academia.nome}.`);
                return (
                  <div key={p.membro_id + p.modalidade_id} className="flex items-center gap-4 rounded-2xl bg-painel p-4">
                    <Avatar foto={p.foto_url} nome={p.nome} cor="#111111" grau={0} tamanho={56} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold">{p.nome}</p>
                      <p className="text-sm text-suave">{nomeMod.get(p.modalidade_id)}{p.graduacao ? ` · ${p.graduacao}` : ""}</p>
                      {p.bio && <p className="mt-1 text-sm">{p.bio}</p>}
                    </div>
                    {link && <a href={link} target="_blank" className="btn-sec shrink-0 text-sm" aria-label={`WhatsApp de ${p.nome}`}>WhatsApp</a>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Eventos */}
        {(eventos || []).length > 0 && (
          <section>
            <h2 className="text-4xl font-extrabold">Próximos eventos</h2>
            <ul className="mt-5 divide-y divide-linha rounded-2xl bg-painel">
              {(eventos || []).map((e: any) => (
                <li key={e.id} className="flex items-center gap-4 p-4">
                  <div className="numero w-16 shrink-0 text-center">
                    <p className="text-3xl font-bold">{new Date(e.inicio).toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" })}</p>
                    <p className="text-xs text-suave">{new Date(e.inicio).toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" })}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{e.titulo}</p>
                    <p className="text-sm text-suave">{dataHoraBR(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Aula experimental */}
        {modulo(academia, "aula_experimental") && (
          <section id="experimental" className="rounded-3xl bg-painel p-6 sm:p-8">
            <h2 className="text-4xl font-extrabold">Agende sua aula experimental</h2>
            <p className="mt-2 text-suave">A primeira aula é para conhecer. Escolha a modalidade e o professor responde pelo WhatsApp.</p>
            {modulo(academia, "cadastro_online") && <p className="mt-1 text-sm text-suave">Já decidiu treinar? <Link href={`/${slug}/cadastro`} className="underline">Faça seu cadastro de aluno</Link>.</p>}
            <FormExperimental
              academiaId={academia.id}
              modalidades={modalidades || []}
              professores={professores || []}
              turmas={turmas || []}
            />
          </section>
        )}

        {/* Onde estamos */}
        <section>
          <h2 className="text-4xl font-extrabold">Onde estamos</h2>
          <p className="mt-3 text-lg">{academia.endereco}{academia.cidade ? `, ${academia.cidade}` : ""}</p>
          {academia.latitude != null && academia.longitude != null && (
            <iframe
              title="Mapa"
              className="mt-4 h-64 w-full rounded-2xl border border-linha"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${academia.longitude - 0.006},${academia.latitude - 0.004},${academia.longitude + 0.006},${academia.latitude + 0.004}&layer=mapnik&marker=${academia.latitude},${academia.longitude}`}
            />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {academia.maps_url && <a className="btn-sec" href={academia.maps_url} target="_blank">Abrir no Google Maps</a>}
            {academia.instagram && <a className="btn-sec" href={`https://instagram.com/${academia.instagram.replace("@", "")}`} target="_blank">Instagram</a>}
          </div>
        </section>
      </main>

      <EfeitosTela tipo={(academia.tema?.efeito_temporada && efeitoDaTemporada()) || academia.tema?.efeito || "nenhum"} logo={academia.logo_url} />
      <BotaoWhats numero={academia.whatsapp} acima={modulo(academia, "aula_experimental")} texto={`Olá! Vi o site da ${academia.nome} e quero saber mais.`} rotulo={`Falar com a ${academia.nome}`} />

      {/* Barra fixa no celular */}
      {modulo(academia, "aula_experimental") && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-fundo/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">

          {modulo(academia, "aula_experimental") && <a href="#experimental" className="btn flex-1">Aula experimental</a>}
        </div>
      </div>}
    </div>
  );
}
