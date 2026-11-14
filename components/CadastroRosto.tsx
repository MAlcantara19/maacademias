"use client";
import { ColarImagem } from "@/components/ColarImagem";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { rostosDaFoto } from "@/lib/rosto";

// Cadastro do rosto para a chamada por foto (com autorização registrada)
export function CadastroRosto({ perfilId, academiaId, nome, podeEditar }: { perfilId: string; academiaId: string; nome: string; podeEditar: boolean }) {
  const sb = supabaseNavegador();
  const [tem, setTem] = useState<boolean | null>(null);
  const [aceito, setAceito] = useState(false);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const { data } = await sb.from("rostos").select("perfil_id").eq("perfil_id", perfilId).maybeSingle();
    setTem(!!data);
  }
  useEffect(() => { carregar(); }, [perfilId]); // eslint-disable-line

  async function cadastrar(arquivo?: File) {
    if (!arquivo) return;
    if (!aceito) return setMsg("Marque a autorização antes.");
    setOcupado(true); setMsg("Procurando o rosto na foto…");
    try {
      const rs = await rostosDaFoto(arquivo, false);
      if (!rs.length) { setMsg("Não achei um rosto. Use uma foto de frente, com boa luz e só a pessoa."); return; }
      const { data: ja } = await sb.from("consentimentos").select("id").eq("perfil_id", perfilId).eq("tipo", "biometria").is("revogado_em", null).limit(1);
      if (!ja?.length) {
        await sb.from("consentimentos").insert({ perfil_id: perfilId, academia_id: academiaId, tipo: "biometria", versao_termo: "chamada-facial-v1", aceito_por: nome });
      }
      await sb.from("rostos").delete().eq("perfil_id", perfilId);
      const { error } = await sb.from("rostos").insert({ perfil_id: perfilId, descritor: Array.from(rs[0]) });
      setMsg(error ? "Não foi possível salvar: " + error.message : "Rosto cadastrado! ✅ Já dá para usar na chamada por foto.");
      carregar();
    } catch (e: any) {
      setMsg("Não foi possível analisar a foto neste aparelho: " + (e?.message || e));
    } finally { setOcupado(false); }
  }

  async function apagar() {
    if (!confirm("Apagar o cadastro do rosto e a autorização?")) return;
    await sb.from("consentimentos").update({ revogado_em: new Date().toISOString() }).eq("perfil_id", perfilId).eq("tipo", "biometria").is("revogado_em", null);
    await sb.from("rostos").delete().eq("perfil_id", perfilId);
    setMsg("Apagado."); carregar();
  }

  if (tem === null) return null;
  return (
    <div className="space-y-2">
      {tem ? (
        <p className="text-sm">✅ Rosto cadastrado para a chamada por foto.{podeEditar && <> <button className="underline" onClick={apagar}>Apagar</button></>}</p>
      ) : podeEditar ? (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Autorizo guardar um código numérico do rosto de <b>{nome}</b> (a foto não é guardada) só para marcar presença. Posso apagar quando quiser.</span>
          </label>
          <label className={`btn-sec w-fit cursor-pointer text-sm ${ocupado ? "opacity-50" : ""}`}>🤳 {ocupado ? "Analisando…" : "Tirar/enviar foto do rosto"}
            <input type="file" accept="image/*" capture="user" className="hidden" disabled={ocupado} onChange={(e) => cadastrar(e.target.files?.[0])} />
          </label>
          {!ocupado && <ColarImagem rotulo="📋 Colar foto do rosto" onImagem={(arq) => cadastrar(arq)} />}
        </>
      ) : <p className="text-sm text-suave">Sem rosto cadastrado.</p>}
      {msg && <p className="text-sm text-suave">{msg}</p>}
    </div>
  );
}
