// rules.v1 (D-49, W2-01 §8): XP, moedas, curva de nível, títulos, desbloqueios, domínio e conquistas.
// Tudo é tabela. Nada depende de tempo de resposta; só ajuda, modo de entrada e dia entram na conta.
import { Cefr, LocationId, type MissionKind } from "../schemas";
import { streak } from "./streak";
import type { Achievement, GameRules, InputMode, Level, RunAnswer, RunSummary, TitleId, Unlock, XpSource } from "./types";

const CEFR = Cefr.options;

/** Índice = `scaffold`. Falar e digitar valem igual (D-44); tocar vale 4 em qualquer degrau. */
const REPLY_XP: Record<InputMode, readonly [number, number, number, number]> = {
  voice: [16, 12, 8, 8],
  typed: [16, 12, 8, 8],
  tap: [4, 4, 4, 4],
};

/** Repetir hoje com a mesma ajuda (ou menos) paga ½ e depois ¼. Nunca zero. */
export function repeatFactor(repeat: number): number {
  return repeat <= 0 ? 1 : repeat === 1 ? 0.5 : 0.25;
}

const CLOSING_XP = { own: 24, model: 12, tap: 4 } as const;
const FIRST_XP = 24;
const STAR_XP = [40, 56, 80] as const; // A1, encontro
const FIRST_COINS = 5;
const STAR_COINS = [5, 10, 15] as const;
const SPELL_XP = { ai: 16, local: 12, self: 8 } as const;
const SPELL_TAP_XP = 2;
const DAILY = { xp: 40, coins: 10 } as const;
const ACH_REWARD = { S: { xp: 20, coins: 10 }, M: { xp: 50, coins: 25 }, L: { xp: 100, coins: 50 } } as const;

/** A1 = 1 … C2 = 2,25; chefe ×1,5. Os prêmios-base são múltiplos de 8: o resultado é sempre inteiro. */
function missionFactor(level: Cefr, kind: MissionKind): number {
  return ((4 + CEFR.indexOf(level)) / 4) * (kind === "boss" ? 1.5 : 1);
}

/** A estrela paga (1 a 3); 0 ou menos não paga estrela. */
function starIndex(mastery: number): number {
  return mastery >= 1 ? Math.min(Math.floor(mastery), 3) - 1 : -1;
}

const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first_mission", size: "S", check: (s) => s.missionsCompleted >= 1 },
  { id: "first_star3", size: "M", check: (s) => s.missionsWithStar3 >= 1 },
  { id: "first_boss", size: "M", check: (s) => s.bossesCompleted >= 1 },
  { id: "voice_50", size: "M", check: (s) => s.voiceReplies >= 50 },
  { id: "own_words_25", size: "M", check: (s) => s.ownClosings >= 25 },
  { id: "recast_10", size: "S", check: (s) => s.recasts >= 10 },
  { id: "spells_100", size: "L", check: (s) => s.spellsCast >= 100 },
  { id: "all_npcs", size: "L", check: (s) => s.npcsTotal > 0 && s.npcsMet >= s.npcsTotal },
  { id: "can_do_5", size: "M", check: (s) => s.canDo >= 5 },
  { id: "streak_7", size: "M", check: (s) => s.bestStreak >= 7 },
  { id: "days_30", size: "L", check: (s) => s.activeDays >= 30 },
  { id: "comeback", size: "S", check: (s) => s.longestGapDays >= 7 },
];
const ACH_SIZE = new Map(ACHIEVEMENTS.map((a) => [a.id, a.size] as const));
const achievementReward = (id: string) => ACH_REWARD[ACH_SIZE.get(id) ?? "S"];

/** XP acumulado para estar no nível `level`. Do nível L ao L+1 custa 50 × L. */
export const totalAt = (level: number): number => 25 * level * (level - 1);

/** Do mais alto para o mais baixo. */
const TITLES: readonly (readonly [number, TitleId])[] = [
  [50, "legend"],
  [40, "sage"],
  [31, "scholar"],
  [23, "ambassador"],
  [16, "diplomat"],
  [10, "merchant"],
  [5, "traveler"],
  [1, "apprentice"],
];

export function levelAt(totalXp: number): Level {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 25)) / 2));
  while (totalAt(level + 1) <= xp) level++; // corrige o arredondamento da raiz
  while (level > 1 && totalAt(level) > xp) level--;
  const title = (TITLES.find(([min]) => level >= min) ?? TITLES[TITLES.length - 1]!)[1];
  return { level, into: xp - totalAt(level), toNext: totalAt(level + 1) - xp, title };
}

/** Nível em que abre o local de cada posição (`order` do local em locations.json). */
const UNLOCK_LEVELS = [1, 3, 8, 13, 19, 26] as const;
const LOCATION_ORDER = LocationId.options;

export function unlocksAt(level: number): Unlock[] {
  const unlocks: Unlock[] = [];
  UNLOCK_LEVELS.forEach((min, order) => {
    const id = LOCATION_ORDER[order];
    if (min === level && id !== undefined) unlocks.push({ type: "location", id });
  });
  for (const [min, id] of TITLES) if (min === level) unlocks.push({ type: "title", id });
  return unlocks;
}

/** Nível de ajuda usado: 3 se tocou; senão o degrau (3 vale como 2: ler em voz alta). */
export function helpOf(answer: Pick<RunAnswer, "input" | "scaffold">): number {
  return answer.input === "tap" ? 3 : Math.min(answer.scaffold, 2);
}

/** Estrelas que uma rodada concluída prova (0 a 3). Folga de 1 fala a cada 5 (o microfone erra). */
export function runDegree(run: Pick<RunSummary, "answers" | "closing">): number {
  const n = run.answers.length;
  if (n === 0) return 0; // rodada sem falas não prova estrela
  const need = n - Math.floor(n / 5);
  const upTo = (h: number) => run.answers.filter((a) => helpOf(a) <= h).length;
  // Fecho dito ou digitado que valeu: aceito ou com a resposta-modelo. Sem isso é "não houve fecho" (§2.3).
  const produced = run.closing !== undefined && run.closing.input !== "tap" && (run.closing.accepted || run.closing.usedModel);
  const own = produced && run.closing!.accepted && !run.closing!.usedModel;
  if (own && upTo(0) >= need) return 3;
  if (own && upTo(1) >= need) return 2;
  if (produced && upTo(2) >= need) return 1;
  return 0;
}

/** O maior degrau entre as rodadas concluídas da missão. Nunca desce. */
export function masteryOf(runs: readonly RunSummary[]): number {
  return runs.reduce((best, run) => Math.max(best, runDegree(run)), 0);
}

export function xpFor(s: XpSource): number {
  switch (s.kind) {
    case "reply": // `flawed` e `attempt` não entram na conta
      return Math.ceil(REPLY_XP[s.input][s.scaffold] * repeatFactor(s.repeat));
    case "closing": {
      const base =
        s.input === "tap" ? CLOSING_XP.tap : s.accepted && !s.usedModelAnswer ? CLOSING_XP.own : s.usedModelAnswer ? CLOSING_XP.model : 0;
      return Math.ceil(base * repeatFactor(s.repeat));
    }
    case "mission": {
      const star = starIndex(s.mastery);
      return ((s.firstTime ? FIRST_XP : 0) + (star >= 0 ? STAR_XP[star]! : 0)) * missionFactor(s.level, s.missionKind);
    }
    case "spell": {
      const base = s.input === "tap" ? SPELL_TAP_XP : SPELL_XP[s.gradedBy];
      const half = s.input !== "tap" && s.gradedBy !== "self" && s.grade === "again";
      return Math.ceil(base * (half ? 0.5 : 1) * repeatFactor(s.repeat));
    }
    case "daily_complete":
      return DAILY.xp;
    case "achievement":
      return achievementReward(s.id).xp;
  }
}

export function coinsFor(s: XpSource): number {
  switch (s.kind) {
    case "mission": {
      const star = starIndex(s.mastery);
      return ((s.firstTime ? FIRST_COINS : 0) + (star >= 0 ? STAR_COINS[star]! : 0)) * (s.missionKind === "boss" ? 2 : 1);
    }
    case "daily_complete":
      return DAILY.coins;
    case "achievement":
      return achievementReward(s.id).coins;
    default:
      return 0;
  }
}

export const rulesV1: GameRules = {
  version: 1,
  xpFor,
  coinsFor,
  levelAt,
  unlocksAt,
  masteryOf,
  streak,
  achievements: ACHIEVEMENTS,
};
