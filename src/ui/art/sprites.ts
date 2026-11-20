// Os desenhos do jogo, todos originais (public/assets/CREDITS.md). Grades pequenas; o CSS decide o tamanho.
import { Grid } from "./grid";
import type { Palette } from "./PixelArt";

export type Figure = "a" | "b" | "c" | "d";

export interface Art {
  rows: readonly string[];
  palette: Palette;
}

// ---------- Avatares (12 × 14) ----------
// Rosto e corpo são iguais; o que muda é a cabeça (capuz, chapéu, cabelo, elmo) e as cores.
const FACE = ["..ksessesk..", "..kssssssk..", "..kssSSssk..", "...kssssk..."];
const BODY = ["..kggggggk..", ".kGggggggGk.", ".kbbbbbbbbk.", "..kggggggk..", "..kgg..ggk..", "..kbb..bbk.."];
const HEADS: Record<Figure, readonly string[]> = {
  a: ["....kkkk....", "...kggggk...", "..kggggggk..", "..kgssssgk.."],
  b: [".....kk.....", "...kkggkk...", ".kkkkkkkkkk.", "..kssssssk.."],
  c: ["...kkkkkk...", "..khhhhhhk..", "..khhhhhhk..", "..khsssshk.."],
  d: ["....kkkk....", "...kyyyyk...", "..kyyyyyyk..", "..kyssssyk.."],
};
const BASE_COLORS = { k: "#2a1d17", s: "#f2c29b", S: "#c97f5b", e: "#241f1a" };
const AVATAR_COLORS: Record<Figure, Palette> = {
  a: { ...BASE_COLORS, g: "#3f8f4a", G: "#2c6a36", b: "#7a4b24" },
  b: { ...BASE_COLORS, g: "#7a4bc2", G: "#5a329a", b: "#3b2f7a" },
  c: { ...BASE_COLORS, g: "#c44a3a", G: "#8f2f24", h: "#d8662a", b: "#5a3a20" },
  d: { ...BASE_COLORS, g: "#4a6fa5", G: "#34517c", y: "#d39a35", b: "#4a3a2a" },
};

export function avatarArt(figure: Figure): Art {
  return { rows: [...HEADS[figure], ...FACE, ...BODY], palette: AVATAR_COLORS[figure] };
}

// ---------- Tilda, a padeira (12 × 15) ----------
export const TILDA: Art = {
  rows: [
    "....kkkk....",
    "...kwwwwk...",
    "..kwwwwwwk..",
    "..kwhhhhwk..",
    ".khhsssshhk.",
    ".khsesseshk.",
    ".khpssssphk.",
    "..kssSSssk..",
    "...kssssk...",
    "..kddddddk..",
    ".kdwwwwwwdk.",
    ".ksdwwwwdsk.",
    "..kdwwwwdk..",
    "..kddddddk..",
    "..kbb..bbk..",
  ],
  palette: { ...BASE_COLORS, w: "#fffaf0", h: "#8a5a3c", p: "#ef9a8a", d: "#b5443a", b: "#5a3a20" },
};

// ---------- Bram, o dono da taverna (12 × 17) ----------
// Mais alto que a Tilda, de barba e avental escuros, com a caneca na mão: de longe é um vulto escuro e barbudo, não uma touca branca.
export const BRAM: Art = {
  rows: [
    "...kkkkkk...",
    "..khhhhhhk..",
    "..kssssssk..",
    "..ksessesk..",
    ".knnssssnnk.",
    ".knnnnnnnnk.",
    "..knnnnnnk..",
    "...knnnnk...",
    "..kaaaaaak..",
    ".kaaaaaaaak.",
    ".ksaaaaaask.",
    "kmmksaaaask.",
    "kmmk.aaaak..",
    "..kaaaaaak..",
    "..kaaaaaak..",
    "..kaa..aak..",
    "..kbb..bbk..",
  ],
  palette: { ...BASE_COLORS, h: "#4a3a30", n: "#6b4a2b", a: "#3a3a48", m: "#e0a23a", b: "#2e2018" },
};

// ---------- A padaria (24 × 16) ----------
const BAKERY_COLORS: Palette = {
  k: "#2a1d17",
  c: "#8a7f77", // chaminé
  r: "#c0493c", // telhado
  R: "#9a352b",
  t: "#f3e1bc", // parede
  T: "#d9c394",
  w: "#fffaf0",
  d: "#7a4b24", // porta e madeira
  D: "#5a3418",
  y: "#8fd0e8", // vidro
  Y: "#e8a93a", // maçaneta e pão
  q: "#f6c866",
};

function bakery(): Art {
  const g = new Grid(24, 16);
  // chaminé
  g.box(14, 0, 3, 6, "k", "c");
  // telhado: cada fileira abre 2 quadradinhos de cada lado
  for (let i = 0; i < 5; i += 1) {
    const left = 8 - 2 * i;
    const width = 8 + 4 * i;
    g.rect(left, 2 + i, width, 1, "k");
    if (i > 0 && i < 4) g.rect(left + 1, 2 + i, width - 2, 1, "r");
    if (i === 4) g.rect(left + 1, 2 + i, width - 2, 1, "R");
  }
  for (let x = 8; x < 16; x += 1) g.put(x, 3, x % 2 === 0 ? "r" : "R");
  // parede
  g.box(2, 7, 20, 9, "k", "t");
  g.rect(3, 15, 18, 1, "T");
  // toldo listrado (vermelho e branco) com bordinha recortada
  for (let x = 2; x < 22; x += 1) {
    const stripe = Math.floor((x - 2) / 2) % 2 === 0 ? "r" : "w";
    g.rect(x, 8, 1, 2, stripe);
    if (x % 2 === 0) g.put(x, 10, stripe);
  }
  g.rect(2, 7, 20, 1, "k");
  // pão na placa do telhado
  g.rect(10, 4, 4, 1, "q");
  g.rect(9, 5, 6, 1, "Y");
  g.rect(10, 5, 1, 1, "q");
  // janelas
  for (const x of [4, 16]) {
    g.box(x, 11, 4, 4, "d", "y");
    g.rect(x + 1, 12, 1, 1, "w");
  }
  // porta
  g.box(10, 11, 4, 5, "D", "d");
  g.put(12, 13, "Y");
  return { rows: g.rows(), palette: BAKERY_COLORS };
}
export const BAKERY: Art = bakery();

// ---------- A taverna (24 × 16) ----------
const TAVERN_COLORS: Palette = {
  k: "#2a1d17",
  c: "#8a7f77", // chaminé
  r: "#7a4b2a", // telhado
  R: "#5a341c",
  t: "#b88a5a", // parede de tábuas
  T: "#9a7048",
  d: "#5a3418", // madeira
  D: "#3e220f",
  q: "#fbdc7a", // luz quente da janela
  Y: "#e8a93a", // caneca e brilho
  w: "#fffaf0",
};

function tavern(): Art {
  const g = new Grid(24, 16);
  // chaminé, do lado esquerdo (a padaria tem do direito)
  g.box(5, 0, 3, 6, "k", "c");
  for (let i = 0; i < 5; i += 1) {
    const left = 8 - 2 * i;
    const width = 8 + 4 * i;
    g.rect(left, 2 + i, width, 1, "k");
    if (i > 0 && i < 4) g.rect(left + 1, 2 + i, width - 2, 1, "r");
    if (i === 4) g.rect(left + 1, 2 + i, width - 2, 1, "R");
  }
  for (let x = 8; x < 16; x += 1) g.put(x, 3, x % 2 === 0 ? "r" : "R");
  // parede de tábuas
  g.box(2, 7, 20, 9, "k", "t");
  for (const x of [6, 10, 14, 18]) g.rect(x, 8, 1, 7, "T");
  g.rect(3, 15, 18, 1, "T");
  // placa pendurada com uma caneca
  g.box(9, 8, 6, 4, "k", "d");
  g.rect(11, 9, 2, 1, "w");
  g.rect(11, 10, 2, 1, "Y");
  g.put(13, 10, "Y");
  // janelas com luz quente
  for (const x of [4, 16]) {
    g.box(x, 11, 4, 4, "d", "q");
    g.rect(x + 1, 13, 2, 1, "Y");
  }
  // porta
  g.box(10, 12, 4, 4, "D", "d");
  g.put(12, 14, "Y");
  return { rows: g.rows(), palette: TAVERN_COLORS };
}
export const TAVERN: Art = tavern();

// ---------- A vila (32 × 32) ----------
const VILLAGE_COLORS: Palette = {
  "1": "#86c8ec",
  "2": "#a6d9f2",
  "3": "#c4e7f4",
  w: "#ffffff",
  "4": "#5f9f58", // colina ao fundo
  "5": "#78bf68", // grama
  "6": "#69b05b",
  "7": "#dcba80", // caminho
  "8": "#c99f63",
  b: "#6b4a2b", // tronco
  g: "#3f8a47", // copa
  G: "#2f6f3a",
  f: "#f28aa8", // flores
  y: "#f7d44c",
  s: "#9a9a9a", // pedrinhas
};

function village(): Art {
  const g = new Grid(32, 32, "5");
  // céu em faixas
  g.rect(0, 0, 32, 6, "1");
  g.rect(0, 6, 32, 4, "2");
  g.rect(0, 10, 32, 6, "3");
  // nuvens
  g.rect(3, 3, 6, 1, "w");
  g.rect(4, 2, 4, 1, "w");
  g.rect(22, 6, 7, 1, "w");
  g.rect(24, 5, 4, 1, "w");
  // colinas ao fundo
  for (let x = 0; x < 32; x += 1) {
    const top = 13 + Math.round(Math.sin(x * 0.45) * 1.4 + Math.cos(x * 0.2));
    g.rect(x, top, 1, 16 - top, "4");
  }
  // grama com textura
  for (let y = 16; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      g.put(x, y, (x * 7 + y * 13) % 11 === 0 || (x * 5 + y * 3) % 17 === 0 ? "6" : "5");
    }
  }
  // caminho de terra, mais largo perto de quem olha
  for (let y = 20; y < 32; y += 1) {
    const half = 2 + Math.floor((y - 20) / 3);
    g.rect(16 - half, y, half * 2, 1, "7");
    if (y % 3 === 0) g.put(16 - half, y, "8");
    if (y % 4 === 1) g.put(15 + half, y, "8");
  }
  g.put(13, 27, "s");
  g.put(19, 29, "s");
  // árvores
  const tree = (x: number, y: number) => {
    g.rect(x + 2, y + 5, 2, 3, "b");
    g.rect(x, y + 2, 6, 3, "g");
    g.rect(x + 1, y, 4, 2, "g");
    g.rect(x + 1, y + 5, 4, 1, "G");
    g.put(x, y + 4, "G");
    g.put(x + 5, y + 4, "G");
    g.put(x + 2, y + 1, "G");
  };
  tree(1, 18);
  tree(25, 22);
  // flores
  for (const [x, y, c] of [[6, 27, "f"], [8, 29, "y"], [22, 18, "y"], [27, 30, "f"], [3, 30, "y"], [11, 24, "f"]] as const) {
    g.put(x, y, c);
  }
  return { rows: g.rows(), palette: VILLAGE_COLORS };
}
export const VILLAGE: Art = village();
