// Tipos do motor de regras (W0-03 §6 com as mudanças de D-49 / W2-01 §8). TypeScript puro.
import type { Cefr, LocationId, MissionKind } from "../schemas";

export type InputMode = "voice" | "typed" | "tap";
/** 0 sem ajuda · 1 ideia no idioma base · 2 frase à vista · 3 tocou. */
export type Scaffold = 0 | 1 | 2 | 3;
export type Grade = "again" | "hard" | "good" | "easy";
export type GradedBy = "local" | "self" | "ai";

export const TITLE_IDS = ["apprentice", "traveler", "merchant", "diplomat", "ambassador", "scholar", "sage", "legend"] as const;
export type TitleId = (typeof TITLE_IDS)[number];

/**
 * O que paga XP ou moeda. `repeat` = quantas vezes hoje a pessoa já fez o mesmo com a mesma ajuda ou menos
 * (0 = primeira vez). `flawed` e `attempt` existem para as guardas pedagógicas: não mudam o XP.
 * A fonte `mission` paga um prêmio por chamada: `firstTime` soma a 1ª conclusão, `mastery` 1 a 3 soma só aquela estrela.
 */
export type XpSource =
  | { kind: "reply"; input: InputMode; scaffold: Scaffold; flawed: boolean; attempt: number; repeat: number }
  | { kind: "closing"; input: InputMode; accepted: boolean; usedModelAnswer: boolean; repeat: number }
  | { kind: "mission"; missionKind: MissionKind; level: Cefr; firstTime: boolean; mastery: number }
  | { kind: "spell"; input: InputMode; grade: Grade; gradedBy: GradedBy; repeat: number }
  | { kind: "daily_complete" }
  | { kind: "achievement"; id: string };

export type Unlock = { type: "location"; id: LocationId } | { type: "title"; id: TitleId };

/** Uma resposta que casou, na ordem da rodada. `node` é o id da fala. */
export interface RunAnswer {
  node: string;
  input: InputMode;
  scaffold: Scaffold;
}

/** O fecho da rodada: como foi dito e se ficou com a frase própria. */
export interface RunClosing {
  input: InputMode;
  accepted: boolean;
  /** A pessoa precisou da resposta-modelo (`Run.closing.usedModel`). */
  usedModel: boolean;
}

/** O que o motor lê de uma rodada concluída (a linha de `runs` serve, com campos a mais). */
export interface RunSummary {
  /** Id da rodada (a linha de `runs`); permite ao motor não contar a própria rodada ao replanejar. */
  id?: string | undefined;
  missionId: string;
  day: string;
  answers: readonly RunAnswer[];
  closing?: RunClosing | undefined;
}

/** O que o motor lê de um evento do livro-razão (a linha de `events` serve). */
export interface LedgerEvent {
  id: string;
  at: number;
  day: string;
  kind: string;
  xp: number;
  coins: number;
  ref?: string | undefined;
}

export interface Stats {
  missionsCompleted: number;
  missionsWithStar3: number;
  bossesCompleted: number;
  voiceReplies: number;
  ownClosings: number;
  recasts: number;
  spellsCast: number;
  npcsMet: number;
  npcsTotal: number;
  canDo: number;
  bestStreak: number;
  activeDays: number;
  longestGapDays: number;
}

export interface Achievement {
  id: string;
  size: "S" | "M" | "L";
  check(stats: Stats): boolean;
}

export interface StreakState {
  current: number;
  best: number;
  freezesLeft: number;
  frozenDays: string[];
}

export interface Level {
  level: number;
  /** Quanto já andou dentro do nível. */
  into: number;
  /** Quanto falta para o próximo. A barra é `into / (into + toNext)`. */
  toNext: number;
  title: TitleId;
}

export interface GameRules {
  readonly version: number;
  xpFor(source: XpSource): number;
  coinsFor(source: XpSource): number;
  levelAt(totalXp: number): Level;
  /** O que abre exatamente neste nível. */
  unlocksAt(level: number): Unlock[];
  masteryOf(runs: readonly RunSummary[]): number;
  /** `freezeGifts`: congelamentos de presente; em v1 é `[]` e é ignorado (D-49, ganhar é derivado). */
  streak(activeDays: readonly string[], freezeGifts: readonly string[], today: string): StreakState;
  readonly achievements: readonly Achievement[];
}

export interface Progress {
  xp: number;
  /** Saldo, nunca abaixo de zero (dois aparelhos offline podem gastar o mesmo saldo). */
  coins: number;
  level: number;
  into: number;
  toNext: number;
  title: TitleId;
  /** Tudo que já abriu, até o nível atual. */
  unlocks: Unlock[];
  streak: StreakState;
  /** Dias com jogo, sem repetição (nunca desce). */
  activeDays: number;
  /** Ids das conquistas já gravadas (`ach:<id>`). */
  achievements: string[];
}
