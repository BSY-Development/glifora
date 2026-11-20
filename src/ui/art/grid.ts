// Uma grade de letras para montar cenas em código (retângulos, pontos) e entregar ao PixelArt.
export class Grid {
  private readonly cells: string[][];

  constructor(
    readonly width: number,
    readonly height: number,
    fill = ".",
  ) {
    this.cells = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  }

  put(x: number, y: number, ch: string): void {
    const row = this.cells[y];
    if (row && x >= 0 && x < this.width) row[x] = ch;
  }

  rect(x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.put(i, j, ch);
  }

  /** Retângulo com contorno de uma letra e miolo de outra. */
  box(x: number, y: number, w: number, h: number, outline: string, fill: string): void {
    this.rect(x, y, w, h, outline);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  rows(): string[] {
    return this.cells.map((row) => row.join(""));
  }
}
