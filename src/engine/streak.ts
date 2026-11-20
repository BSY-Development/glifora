// Ofensiva com congelamento (D-49, W2-01 §5.3). Derivada só dos dias com jogo: dois aparelhos chegam ao mesmo
// resultado, em qualquer ordem e com repetições. Nenhum dado de acerto, erro ou XP chega aqui.
import type { StreakState } from "./types";

const FREEZE_CAP = 2;

/** Dias desde 1970-01-01 de um "AAAA-MM-DD" (aritmética inteira; sem Date). */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverso de `dayNumber`. */
function dayString(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
}

/** Os dias inteiros entre dois dias (sem contar nenhum dos dois). */
function between(a: number, b: number): number[] {
  const out: number[] = [];
  for (let n = a + 1; n < b; n++) out.push(n);
  return out;
}

export function streak(activeDays: readonly string[], _freezeGifts: readonly string[], today: string): StreakState {
  const todayN = dayNumber(today);
  const days = [...new Set(activeDays.map(dayNumber).filter((n) => n <= todayN))].sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, best: 0, freezesLeft: 0, frozenDays: [] };

  let played = 0;
  let stock = 0;
  let current = 0;
  let best = 0;
  const frozen: number[] = [];
  let previous: number | undefined;
  for (const day of days) {
    const gap = previous === undefined ? [] : between(previous, day);
    if (previous === undefined || gap.length > stock) {
      current = 1;
    } else {
      stock -= gap.length;
      frozen.push(...gap);
      current += 1;
    }
    played += 1;
    if (played % 2 === 0) stock = Math.min(FREEZE_CAP, stock + 1);
    best = Math.max(best, current);
    previous = day;
  }

  const tail = between(previous!, todayN);
  if (tail.length > stock) current = 0;
  else {
    stock -= tail.length;
    frozen.push(...tail);
  }
  return { current, best, freezesLeft: stock, frozenDays: frozen.map(dayString) };
}

/** Dias inteiros entre dois dias com jogo (0 se vizinhos): para a conquista "de volta à vila". */
export function longestGapDays(activeDays: readonly string[]): number {
  const days = [...new Set(activeDays.map(dayNumber))].sort((a, b) => a - b);
  let longest = 0;
  for (let i = 1; i < days.length; i++) longest = Math.max(longest, days[i]! - days[i - 1]! - 1);
  return longest;
}
