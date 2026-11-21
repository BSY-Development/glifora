// Porta de entrada do motor de regras. Só importa schemas; nada de DOM, relógio ou sorteio.
export { deriveProgress } from "./progress";
export {
  CLOSING_ATTEMPTS,
  FAILS_PER_RAISE,
  MODES,
  answersOf,
  effectiveMode,
  nextNodeId,
  nodeOf,
  parseState,
  paysFullToday,
  progressOf,
  replyXp,
  start,
  startHelp,
  step,
  suggestedMode,
  todayLevels,
  type Finish,
  type Input,
  type Mode,
  type Outcome,
  type Phase,
  type PlayState,
  type Step,
  type TodayLevels,
} from "./play";
export type { DegreeWhy } from "./rules.v1";
export { coinsFor, degreeWhy, helpOf, levelAt, masteryOf, repeatFactor, rulesV1, runDegree, totalAt, unlocksAt, xpFor } from "./rules.v1";
export { closingLevel, firstId, planRun, repeatOf, repeatsFor, runEventId, starId, type PlanRunInput, type PlannedEvent, type RunPlan } from "./run";
export { longestGapDays, streak } from "./streak";
export {
  TITLE_IDS,
  type Achievement,
  type GameRules,
  type Grade,
  type GradedBy,
  type InputMode,
  type LedgerEvent,
  type Level,
  type Progress,
  type RunAnswer,
  type RunClosing,
  type RunSummary,
  type Scaffold,
  type Stats,
  type StreakState,
  type TitleId,
  type Unlock,
  type XpSource,
} from "./types";
