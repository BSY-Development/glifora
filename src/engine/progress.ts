// Progresso derivado do livro-razão (W0-03 §4.1): total de XP e moedas, nível, título, ofensiva, desbloqueios.
// O XP é gravado já calculado; o nível sai do total pela curva atual.
import type { GameRules, LedgerEvent, Progress, Unlock } from "./types";

/** Eventos que contam como "dia jogado" para a ofensiva. Prêmio, compra e conquista não contam. */
const PLAY_KINDS: ReadonlySet<string> = new Set(["mission_completed", "boss_defeated", "spell_cast"]);

export function deriveProgress(events: readonly LedgerEvent[], rules: GameRules, today: string): Progress {
  // Mesmo id vale uma vez só: importar a mesma rodada duas vezes não paga em dobro.
  const unique = new Map<string, LedgerEvent>();
  for (const event of events) if (!unique.has(event.id)) unique.set(event.id, event);

  let xp = 0;
  let coins = 0;
  const days = new Set<string>();
  const achievements: string[] = [];
  for (const event of unique.values()) {
    xp += Math.max(0, event.xp);
    coins += event.coins;
    if (PLAY_KINDS.has(event.kind)) days.add(event.day);
    if (event.kind === "achievement" && event.id.startsWith("ach:")) achievements.push(event.id.slice(4));
  }

  const { level, into, toNext, title } = rules.levelAt(xp);
  const unlocks: Unlock[] = [];
  for (let l = 1; l <= level; l++) unlocks.push(...rules.unlocksAt(l));
  const activeDays = [...days].sort();

  return {
    xp,
    coins: Math.max(0, coins),
    level,
    into,
    toNext,
    title,
    unlocks,
    streak: rules.streak(activeDays, [], today),
    activeDays: activeDays.length,
    achievements,
  };
}
