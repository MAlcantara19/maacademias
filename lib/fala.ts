"use client";
// Pronúncia em japonês com a voz do próprio celular/computador (grátis).
// Converte o romaji (O-soto-gari) para hiragana (おそとがり) para sair certo.

const SILABAS: Record<string, string> = {
  kya: "きゃ", kyu: "きゅ", kyo: "きょ", sha: "しゃ", shu: "しゅ", sho: "しょ", cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ", hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ", mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ", gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ", bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ", ja: "じゃ", ju: "じゅ", jo: "じょ", shi: "し", chi: "ち", tsu: "つ",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", su: "す", se: "せ", so: "そ", za: "ざ", ji: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", te: "て", to: "と", da: "だ", de: "で", do: "ど", na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", he: "へ", ho: "ほ", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ", ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ", ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を",
  a: "あ", i: "い", u: "う", e: "え", o: "お",
};

export function romajiParaKana(texto: string) {
  const s = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "").split("/")[0].replace(/[^a-z]/g, "");
  let out = "", i = 0;
  while (i < s.length) {
    // consoante dobrada (ippon, hakkoda) → っ
    if (i + 1 < s.length && s[i] === s[i + 1] && !"aeioun".includes(s[i])) { out += "っ"; i++; continue; }
    if (s[i] === "t" && s.slice(i + 1, i + 3) === "ch") { out += "っ"; i++; continue; }
    // n antes de consoante ou no fim → ん
    if (s[i] === "n" && (i + 1 === s.length || !"aeiouy".includes(s[i + 1]))) { out += "ん"; i++; continue; }
    let achou = false;
    for (const t of [3, 2, 1]) {
      const p = s.slice(i, i + t);
      if (SILABAS[p]) { out += SILABAS[p]; i += t; achou = true; break; }
    }
    if (!achou) i++;
  }
  return out;
}

export type Genero = "feminina" | "masculina" | "grave";
const MASC = /(ichiro|keita|otoya|hattori|daichi|naoki|male|男)/i;
const FEM = /(haruka|ayumi|sayaka|kyoko|nanami|mizuki|o-ren|female|女|google)/i;

function vozesJaponesas(): SpeechSynthesisVoice[] {
  return typeof window !== "undefined" ? window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ja")) : [];
}

export function vozesDisponiveis() {
  const v = vozesJaponesas();
  return { total: v.length, masculina: v.some((x) => MASC.test(x.name)), feminina: v.some((x) => FEM.test(x.name) || !MASC.test(x.name)) };
}

export function generoSalvo(): Genero {
  try { return (localStorage.getItem("voz_genero") as Genero) || "feminina"; } catch { return "feminina"; }
}
export function salvarGenero(g: Genero) {
  try { localStorage.setItem("voz_genero", g); } catch { /* sem armazenamento: usa o padrão */ }
}

// Fala o termo. Se não houver voz do gênero escolhido, ajusta o tom da voz disponível.
// "grave" = voz masculina com tom bem mais baixo (fica com cara de árbitro).
// fila: true → espera a fala anterior terminar (ex.: "Ippon" … "Sore-made").
export function falar(romaji: string, kana?: string | null, genero: Genero = generoSalvo(), opcoes: { fila?: boolean } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const texto = kana || romajiParaKana(romaji) || romaji;
  const vozes = vozesJaponesas();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "ja-JP";
  u.rate = genero === "grave" ? 0.72 : 0.8;
  const homem = genero !== "feminina";
  const certa = vozes.find((v) => (homem ? MASC.test(v.name) : !MASC.test(v.name)));
  if (certa) { u.voice = certa; if (genero === "grave") u.pitch = 0.45; }
  else { if (vozes[0]) u.voice = vozes[0]; u.pitch = genero === "grave" ? 0.1 : genero === "masculina" ? 0.6 : 1.3; }
  if (!opcoes.fila) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
