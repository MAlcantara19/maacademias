"use client";
// Tira o fundo da foto (pessoa) no próprio aparelho, com o modelo de "selfie"
// do MediaPipe (Google). Na primeira vez baixa uns 10 MB; depois fica em cache.
const VERSAO = "0.10.35";
let segmentador: any = null;

async function carregar() {
  if (segmentador) return segmentador;
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO}/wasm`);
  segmentador = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite" },
    runningMode: "IMAGE", outputCategoryMask: false, outputConfidenceMasks: true,
  });
  return segmentador;
}

// Devolve um canvas com a pessoa sobre a cor escolhida (ou transparente se cor = null)
export async function removerFundo(img: HTMLImageElement, cor: string | null = "#ffffff"): Promise<HTMLCanvasElement> {
  const seg = await carregar();
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  const res = seg.segment(c);
  const m = res.confidenceMasks?.[0]; // categoria 0 = fundo
  if (!m) throw new Error("Não achei uma pessoa na foto.");
  const fundo: Float32Array = m.getAsFloat32Array();
  const mw = m.width, mh = m.height;
  const px = g.getImageData(0, 0, W, H);
  const d = px.data;
  const rgb = cor ? [parseInt(cor.slice(1, 3), 16), parseInt(cor.slice(3, 5), 16), parseInt(cor.slice(5, 7), 16)] : null;
  for (let y = 0; y < H; y++) {
    const my = Math.min(mh - 1, Math.floor((y / H) * mh));
    for (let x = 0; x < W; x++) {
      const mx = Math.min(mw - 1, Math.floor((x / W) * mw));
      let a = 1 - fundo[my * mw + mx];
      a = Math.max(0, Math.min(1, (a - 0.25) / 0.5)); // borda mais limpa
      const i = (y * W + x) * 4;
      if (rgb) { d[i] = d[i] * a + rgb[0] * (1 - a); d[i + 1] = d[i + 1] * a + rgb[1] * (1 - a); d[i + 2] = d[i + 2] * a + rgb[2] * (1 - a); }
      else d[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(px, 0, 0);
  res.close?.();
  return c;
}
