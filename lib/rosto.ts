"use client";
// Reconhecimento facial no próprio celular (nada de foto vai para servidor:
// só um código de 128 números por pessoa, e só com autorização).
let api: any = null;
let pronto = false;

export async function carregarRosto() {
  if (!api) api = await import("@vladmandic/face-api");
  if (!pronto) {
    await api.tf.ready();
    await api.nets.ssdMobilenetv1.loadFromUri("/modelos-rosto");
    await api.nets.faceLandmark68Net.loadFromUri("/modelos-rosto");
    await api.nets.faceRecognitionNet.loadFromUri("/modelos-rosto");
    pronto = true;
  }
  return api;
}

// Reduz a foto (fotos de celular são enormes) para ficar rápido
async function prepararImagem(arquivo: File, max = 1280) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

// Um rosto (cadastro) ou vários (foto da turma)
export async function rostosDaFoto(arquivo: File, varios: boolean): Promise<Float32Array[]> {
  const fa = await carregarRosto();
  const img = await prepararImagem(arquivo, varios ? 1600 : 900);
  const opcoes = new fa.SsdMobilenetv1Options({ minConfidence: 0.45, maxResults: 80 });
  if (!varios) {
    const r = await fa.detectSingleFace(img, opcoes).withFaceLandmarks().withFaceDescriptor();
    return r ? [r.descriptor] : [];
  }
  const rs = await fa.detectAllFaces(img, opcoes).withFaceLandmarks().withFaceDescriptors();
  return rs.map((r: any) => r.descriptor);
}

export function distancia(a: ArrayLike<number>, b: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

// Liga cada rosto da foto ao aluno mais parecido (cada aluno uma vez só)
export function reconhecer(rostos: Float32Array[], cadastrados: { id: string; descritor: number[] }[], limite = 0.5) {
  const pares: { rosto: number; id: string; d: number }[] = [];
  rostos.forEach((r, i) => cadastrados.forEach((c) => {
    const d = distancia(r, c.descritor);
    if (d < limite) pares.push({ rosto: i, id: c.id, d });
  }));
  pares.sort((x, y) => x.d - y.d);
  const usadosRosto = new Set<number>(), usadosId = new Set<string>(), achados: { id: string; d: number }[] = [];
  for (const p of pares) {
    if (usadosRosto.has(p.rosto) || usadosId.has(p.id)) continue;
    usadosRosto.add(p.rosto); usadosId.add(p.id); achados.push({ id: p.id, d: p.d });
  }
  return { achados, semNome: rostos.length - achados.length };
}
