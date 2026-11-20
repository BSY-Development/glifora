// Gera os ícones do PWA (W1-12) em public/icons/: arte própria em pixel art, um "G" de Glifora sobre o roxo da marca.
// Só Node (zlib), sem sharp nem binário nativo. Os PNG gerados entram no git; rode de novo só se mudar o desenho:
//   node scripts/assets/make-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const BACKGROUND = [0x3b, 0x2f, 0x7a]; // o mesmo roxo do favicon.svg
const SHADOW = [0x24, 0x1a, 0x52];
const LETTER = [0xfb, 0xf7, 0xef];

// "G" em grade 8×8.
const GLYPH = ["..####..", ".##..##.", "##....##", "##......", "##..####", "##....##", ".##..##.", "..####.."];

function png(size: number, glyphScale: number): Buffer {
  const cell = Math.floor(size * glyphScale);
  const origin = Math.floor((size - cell * 8) / 2);
  const shadowShift = Math.max(1, Math.floor(cell / 2));
  const raw = Buffer.alloc(size * (size * 3 + 1)); // por linha: 1 byte de filtro (0) + RGB
  const paint = (px: number, py: number, color: number[]) => {
    if (px < 0 || py < 0 || px >= size || py >= size) return;
    const at = py * (size * 3 + 1) + 1 + px * 3;
    raw[at] = color[0] ?? 0;
    raw[at + 1] = color[1] ?? 0;
    raw[at + 2] = color[2] ?? 0;
  };
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) paint(x, y, BACKGROUND);
  for (const [color, shift] of [[SHADOW, shadowShift], [LETTER, 0]] as const) {
    GLYPH.forEach((row, gy) => {
      [...row].forEach((ch, gx) => {
        if (ch !== "#") return;
        for (let dy = 0; dy < cell; dy += 1) for (let dx = 0; dx < cell; dx += 1) paint(origin + gx * cell + dx + shift, origin + gy * cell + dy + shift, color);
      });
    });
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("public/icons", { recursive: true });
// "any": o G ocupa ~60% do quadrado. "maskable": ~44%, dentro da zona segura (80%) que o Android recorta em círculo/gota.
const files: Array<[string, number, number]> = [
  ["icon-192.png", 192, 0.075],
  ["icon-512.png", 512, 0.075],
  ["icon-maskable-512.png", 512, 0.055],
  ["apple-touch-icon.png", 180, 0.055],
];
for (const [name, size, scale] of files) {
  writeFileSync(`public/icons/${name}`, png(size, scale));
  console.log(`public/icons/${name}`);
}
