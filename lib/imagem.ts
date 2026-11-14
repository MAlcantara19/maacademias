"use client";
// Diminui fotos antes de enviar (foto de celular de 4 MB vira ~250 KB).
// Vídeos e PDFs passam sem mexer.
export async function comprimir(arq: File, max = 1600, qualidade = 0.8): Promise<File> {
  if (!arq.type.startsWith("image/") || arq.type === "image/gif" || arq.type === "image/svg+xml") return arq;
  try {
    const bmp = await createImageBitmap(arq);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    const g = c.getContext("2d")!;
    g.drawImage(bmp, 0, 0, c.width, c.height);
    // PNG com fundo transparente (ex.: logo) continua PNG; o resto vira JPG (bem menor)
    let transparente = false;
    if (arq.type === "image/png") {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 64) if (d[i] < 250) { transparente = true; break; }
    }
    const tipo = transparente ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, tipo, qualidade));
    if (!blob || blob.size >= arq.size) return arq;
    return new File([blob], arq.name.replace(/\.\w+$/, "") + (transparente ? ".png" : ".jpg"), { type: tipo });
  } catch {
    return arq;
  }
}
