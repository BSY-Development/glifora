// Arte em pixel feita aqui, sem imagem de fora: cada letra da grade é um quadradinho de uma cor da paleta
// ("." = transparente). Vira <svg> com `shape-rendering="crispEdges"`, então as bordas ficam retas em qualquer zoom.
// Decorativa: o significado vem do texto ao lado (aria-hidden).
export type Palette = Readonly<Record<string, string>>;

interface Run {
  x: number;
  y: number;
  w: number;
  color: string;
}

function runsOf(rows: readonly string[], palette: Palette): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? ".";
      const color = palette[ch];
      if (ch === "." || color === undefined) {
        x += 1;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w += 1;
      runs.push({ x, y, w, color });
      x += w;
    }
  });
  return runs;
}

interface Props {
  rows: readonly string[];
  palette: Palette;
  className?: string;
}

export function PixelArt({ rows, palette, className }: Props) {
  const width = Math.max(...rows.map((row) => row.length));
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {runsOf(rows, palette).map((run) => (
        <rect key={`${run.x},${run.y}`} x={run.x} y={run.y} width={run.w} height={1} fill={run.color} />
      ))}
    </svg>
  );
}
