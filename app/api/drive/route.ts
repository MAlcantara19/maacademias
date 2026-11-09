import { NextResponse } from "next/server";

// Lista as fotos e vídeos de uma pasta PÚBLICA do Google Drive
// ("Qualquer pessoa com o link pode ver"). Precisa da GOOGLE_API_KEY.
export const revalidate = 600;

export async function GET(req: Request) {
  const pasta = new URL(req.url).searchParams.get("pasta") || "";
  const chave = process.env.GOOGLE_API_KEY;
  if (!chave) return NextResponse.json({ erro: "Falta a variável GOOGLE_API_KEY." }, { status: 500 });
  if (!/^[\w-]{10,}$/.test(pasta)) return NextResponse.json({ erro: "Pasta inválida." }, { status: 400 });

  const q = encodeURIComponent(`'${pasta}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`);
  const campos = encodeURIComponent("files(id,name,mimeType,createdTime,thumbnailLink)");
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${campos}&orderBy=createdTime desc&pageSize=200&key=${chave}`,
    { next: { revalidate: 600 } }
  );
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message || "erro";
    return NextResponse.json({ erro: msg.includes("not found") ? "Pasta não encontrada. Ela está compartilhada como “Qualquer pessoa com o link”?" : msg }, { status: 400 });
  }
  const arquivos = (j.files || []).map((f: any) => ({
    id: f.id,
    nome: f.name,
    tipo: f.mimeType.startsWith("video") ? "video" : "foto",
    criado: f.createdTime,
    miniatura: `https://drive.google.com/thumbnail?id=${f.id}&sz=w600`,
    grande: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1600`,
    baixar: `https://drive.google.com/uc?export=download&id=${f.id}`,
    abrir: `https://drive.google.com/file/d/${f.id}/view`,
  }));
  return NextResponse.json({ arquivos });
}
