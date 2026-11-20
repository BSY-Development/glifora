/** Dia local "AAAA-MM-DD" de um instante (a ofensiva conta por dia no fuso de quem joga). */
export function localDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
