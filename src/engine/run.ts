// De uma rodada concluída aos eventos do livro-razão (W2-01 §2.2, §2.4 e §2.7).
// Puro: recebe o histórico e os ids já gravados, devolve o que gravar. Quem grava é services/.
import type { Cefr, MissionKind } from "../schemas";
import { helpOf, runDegree } from "./rules.v1";
import type { GameRules, RunAnswer, RunClosing, RunSummary, XpSource } from "./types";

/** Nível do fecho para o `repeat`: frase própria 0, resposta-modelo repetida 1, toque 2. Sem fecho: 3 (não paga). */
export function closingLevel(closing: RunClosing | undefined): number {
  if (closing === undefined) return 3;
  if (closing.input === "tap") return 2;
  if (closing.accepted && !closing.usedModel) return 0;
  return closing.usedModel ? 1 : 3;
}

/** Quantas vezes, entre os níveis de hoje, a pessoa já fez com este nível de ajuda ou menos. */
export function repeatOf(today: readonly number[], help: number): number {
  return today.filter((h) => h <= help).length;
}

/** `repeat` de cada resposta da rodada, pelas rodadas concluídas da mesma missão no mesmo dia (a rodada de agora não conta). */
export function repeatsFor(answers: readonly RunAnswer[], closing: RunClosing | undefined, missionId: string, day: string, history: readonly RunSummary[], runId?: string) {
  const sameDay = history.filter((r) => r.missionId === missionId && r.day === day && (runId === undefined || r.id !== runId));
  return {
    answers: answers.map((a) =>
      repeatOf(
        sameDay.flatMap((r) => r.answers.filter((b) => b.node === a.node).map(helpOf)),
        helpOf(a),
      ),
    ),
    closing: repeatOf(
      sameDay.map((r) => closingLevel(r.closing)),
      closingLevel(closing),
    ),
  };
}

/** Um evento a gravar. `id` ausente = uuid (quem grava sorteia). */
export interface PlannedEvent {
  id?: string;
  kind: "mission_completed" | "boss_defeated" | "mission_first" | "mission_star";
  xp: number;
  coins: number;
  rules: number;
  /** A missão. */
  ref: string;
  runId: string;
  day: string;
}

export interface PlanRunInput {
  rules: GameRules;
  runId: string;
  missionId: string;
  mission: { kind: MissionKind; level: Cefr };
  /** O dia local do INÍCIO da rodada: vale para a rodada inteira, mesmo que passe da meia-noite. */
  day: string;
  answers: readonly RunAnswer[];
  closing?: RunClosing | undefined;
  /** Rodadas já concluídas (de qualquer missão; o motor filtra). */
  history: readonly RunSummary[];
  /** Ids de eventos já gravados (para não pagar o prêmio único de novo). */
  granted: ReadonlySet<string>;
}

export interface RunPlan {
  /** XP de conversa da rodada (respostas e fecho), o `Run.xp`. */
  xp: number;
  /** Estrelas que esta rodada prova (0 a 3). */
  degree: number;
  /** XP de cada resposta, na ordem (para o "+16 XP" da tela). */
  answerXp: number[];
  closingXp: number;
  events: PlannedEvent[];
}

/** Id do evento do prêmio de 1ª conclusão. */
export const firstId = (missionId: string): string => `first:${missionId}`;
/** Id do evento da estrela `n` (1 a 3). */
export const starId = (missionId: string, n: number): string => `star:${missionId}:${n}`;
/** Id do evento da rodada: derivado do `runId`, então gravar a mesma rodada duas vezes vale uma só. */
export const runEventId = (runId: string): string => `run:${runId}`;

/**
 * Transforma uma rodada concluída nos eventos: o da rodada (respostas + fecho) e, para cada prêmio único ainda não
 * pago, `mission_first` e `mission_star`. Pular degraus nunca perde prêmio: uma rodada que prova ★★★ paga as três
 * estrelas que faltam.
 */
export function planRun(input: PlanRunInput): RunPlan {
  const { rules, runId, missionId, mission, day, answers, closing, history, granted } = input;
  const repeats = repeatsFor(answers, closing, missionId, day, history, runId);

  const answerXp = answers.map((a, i) =>
    rules.xpFor({ kind: "reply", input: a.input, scaffold: a.scaffold, flawed: false, attempt: 1, repeat: repeats.answers[i]! }),
  );
  const closingXp =
    closing === undefined
      ? 0
      : rules.xpFor({ kind: "closing", input: closing.input, accepted: closing.accepted, usedModelAnswer: closing.usedModel, repeat: repeats.closing });
  const xp = answerXp.reduce((sum, v) => sum + v, 0) + closingXp;
  const degree = runDegree({ answers, closing });

  const base = { rules: rules.version, ref: missionId, runId, day } as const;
  const events: PlannedEvent[] = [];
  const mainId = runEventId(runId);
  if (!granted.has(mainId)) {
    events.push({ ...base, id: mainId, kind: mission.kind === "boss" ? "boss_defeated" : "mission_completed", xp, coins: 0 });
  }

  const prize = (id: string, kind: "mission_first" | "mission_star", source: XpSource) => {
    if (granted.has(id)) return;
    events.push({ ...base, id, kind, xp: rules.xpFor(source), coins: rules.coinsFor(source) });
  };
  const common = { kind: "mission", missionKind: mission.kind, level: mission.level } as const;
  prize(firstId(missionId), "mission_first", { ...common, firstTime: true, mastery: 0 });
  for (let n = 1; n <= degree; n++) {
    prize(starId(missionId, n), "mission_star", { ...common, firstTime: false, mastery: n });
  }

  return { xp, degree, answerXp, closingXp, events };
}
