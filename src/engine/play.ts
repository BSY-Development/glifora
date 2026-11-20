// A rodada de uma missão como máquina de estados (D-43, W2-08). Puro: `step(missão, estado, entrada)` devolve o novo
// estado e o que aconteceu. Quem fala, grava e mostra é services/ e ui/. O estado é JSON pequeno: vai para `session`
// a cada passo, e a rodada volta de onde parou (`parseState`).
import { checkClosingAnswer, closingTargets, matchReply, type Mission } from "../schemas";
import { helpOf } from "./rules.v1";
import { closingLevel, repeatOf } from "./run";
import type { GameRules, InputMode, RunAnswer, RunClosing, RunSummary, Scaffold } from "./types";

/** Modo da rodada (D-43): 1 frases à vista · 2 só a ideia · 3 nada. */
export type Mode = 1 | 2 | 3;
export const MODES: readonly Mode[] = [1, 2, 3];

export type Phase = "listen" | "ask" | "react" | "closing" | "model" | "done";

/** Uma resposta que casou: `reply` é a posição na fala (para a reação e o recast). */
export interface Step {
  node: string;
  reply: number;
  input: InputMode;
  scaffold: Scaffold;
}

export interface Finish extends RunClosing {
  /** O que a pessoa disse ou digitou (ou a resposta-modelo, se tocou para seguir). */
  text: string;
}

export interface PlayState {
  v: 1;
  runId: string;
  missionId: string;
  /** Dia local do INÍCIO da rodada (D-49). */
  day: string;
  mode: Mode;
  phase: Phase;
  /** Posição na escuta inicial. */
  listen: number;
  /** Fala atual. */
  node: string;
  /** Degrau de ajuda em vigor na fala atual: 0 nada · 1 ideia · 2 frase · 3 opções para tocar. */
  help: Scaffold;
  /** Não casou, nesta fala (ou no fecho). */
  fails: number;
  /** Total de vezes que não casou na rodada. */
  retries: number;
  steps: Step[];
  /** Fecho: a pessoa ainda não terminou até `phase: "done"`. */
  closing?: Finish;
}

/** O degrau de ajuda com que o modo começa. O chefe começa sempre sem ajuda (D-43). */
export function startHelp(mode: Mode, kind: Mission["kind"]): Scaffold {
  if (kind === "boss") return 0;
  return mode === 1 ? 2 : mode === 2 ? 1 : 0;
}

/** O modo da rodada: o chefe é sempre o 3. */
export const effectiveMode = (mode: Mode, kind: Mission["kind"]): Mode => (kind === "boss" ? 3 : mode);

/** Modo sugerido: o próximo degrau a conquistar, `min(estrelas + 1, 3)`. */
export function suggestedMode(stars: number, kind: Mission["kind"]): Mode {
  if (kind === "boss") return 3;
  return Math.min(Math.max(stars, 0) + 1, 3) as Mode;
}

export function start(mission: Mission, init: { runId: string; day: string; mode: Mode }): PlayState {
  const mode = effectiveMode(init.mode, mission.kind);
  const first = mission.nodes[0]!;
  return {
    v: 1,
    runId: init.runId,
    missionId: mission.id,
    day: init.day,
    mode,
    phase: mission.listen.length > 0 ? "listen" : "ask",
    listen: 0,
    node: first.id,
    help: startHelp(mode, mission.kind),
    fails: 0,
    retries: 0,
    steps: [],
  };
}

export type Input =
  /** Continuar: próxima fala da escuta, da reação ou do fecho. */
  | { type: "next" }
  /** Pedir ajuda: ideia → frase → tocar. Livre. */
  | { type: "help" }
  /** Falou (alternativas do reconhecedor, da melhor para a pior) ou digitou (uma só). */
  | { type: "say"; input: "voice" | "typed"; utterances: readonly string[] }
  /** Tocou numa opção (só com o degrau 3). */
  | { type: "tap"; reply: number }
  /** Tocou para seguir (só depois da resposta-modelo). */
  | { type: "skip" };

export type Outcome =
  | { kind: "none" }
  | { kind: "matched"; reply: number; /** Qual alternativa do reconhecedor casou (0 se digitou). */ alternative: number }
  /** Não casou; `raised`: a ajuda subiu sozinha (2ª falha, D-43). */
  | { kind: "retry"; raised: boolean }
  | { kind: "closing_ok" }
  | { kind: "closing_retry" }
  | { kind: "closing_model" }
  | { kind: "finished" };

const NONE: Outcome = { kind: "none" };

/** A fala que vem depois de responder com a resposta `reply` de `node`; `null` = acabaram as falas (vem o fecho). */
export function nextNodeId(mission: Mission, nodeId: string, replyIndex: number): string | null {
  const at = mission.nodes.findIndex((n) => n.id === nodeId);
  if (at < 0) return null;
  const forced = mission.nodes[at]!.replies[replyIndex]?.next;
  if (forced !== undefined && mission.nodes.some((n) => n.id === forced)) return forced;
  return mission.nodes[at + 1]?.id ?? null;
}

export function nodeOf(mission: Mission, id: string) {
  return mission.nodes.find((n) => n.id === id);
}

/** Falhas seguidas até a ajuda subir sozinha (D-43). */
export const FAILS_PER_RAISE = 2;
/** Tentativas do fecho antes da resposta-modelo (D-43). */
export const CLOSING_ATTEMPTS = 2;

const clip = (s: string): string => s.slice(0, 300);

/**
 * Um passo. Entrada fora de hora é ignorada (`none`): o botão errado nunca quebra a rodada. Nunca trava e nunca tira XP:
 * não casar só devolve a fala de `retry`, e a ajuda sobe.
 */
export function step(mission: Mission, state: PlayState, input: Input): { state: PlayState; outcome: Outcome } {
  switch (input.type) {
    case "next":
      return next(mission, state);
    case "help":
      if (state.phase !== "ask" || state.help >= 3) return { state, outcome: NONE };
      return { state: { ...state, help: (state.help + 1) as Scaffold }, outcome: NONE };
    case "tap":
      return tap(mission, state, input.reply);
    case "say":
      return say(mission, state, input);
    case "skip":
      if (state.phase !== "model") return { state, outcome: NONE };
      return finishClosing(state, { input: "tap", accepted: false, usedModel: true, text: clip(mission.closing.model_answer.text) });
  }
}

function next(mission: Mission, state: PlayState): { state: PlayState; outcome: Outcome } {
  if (state.phase === "listen") {
    const last = state.listen + 1 >= mission.listen.length;
    return { state: last ? { ...state, phase: "ask" } : { ...state, listen: state.listen + 1 }, outcome: NONE };
  }
  if (state.phase === "react") {
    const done = state.steps[state.steps.length - 1];
    const to = done ? nextNodeId(mission, done.node, done.reply) : null;
    if (to === null) return { state: { ...state, phase: "closing", fails: 0 }, outcome: NONE };
    return { state: { ...state, phase: "ask", node: to, help: startHelp(state.mode, mission.kind), fails: 0 }, outcome: NONE };
  }
  return { state, outcome: NONE };
}

function matched(state: PlayState, replyIndex: number, input: InputMode, scaffold: Scaffold, alternative = 0): { state: PlayState; outcome: Outcome } {
  const stepDone: Step = { node: state.node, reply: replyIndex, input, scaffold };
  return { state: { ...state, phase: "react", steps: [...state.steps, stepDone], fails: 0 }, outcome: { kind: "matched", reply: replyIndex, alternative } };
}

function tap(mission: Mission, state: PlayState, replyIndex: number): { state: PlayState; outcome: Outcome } {
  const node = nodeOf(mission, state.node);
  if (state.phase !== "ask" || state.help < 3 || !node || !Number.isInteger(replyIndex) || !node.replies[replyIndex]) return { state, outcome: NONE };
  return matched(state, replyIndex, "tap", 3);
}

function say(mission: Mission, state: PlayState, input: { input: "voice" | "typed"; utterances: readonly string[] }): { state: PlayState; outcome: Outcome } {
  const heard = input.utterances.map((u) => u.trim()).filter((u) => u !== "");
  if (heard.length === 0) return { state, outcome: NONE };

  if (state.phase === "ask") {
    const node = nodeOf(mission, state.node);
    if (!node) return { state, outcome: NONE };
    const hit = matchReply(node.replies, heard, mission.target);
    if (hit) return matched(state, hit.index, input.input, state.help, hit.alternative);
    const fails = state.fails + 1;
    const raised = fails % FAILS_PER_RAISE === 0 && state.help < 3;
    return {
      state: { ...state, fails, retries: state.retries + 1, help: raised ? ((state.help + 1) as Scaffold) : state.help },
      outcome: { kind: "retry", raised },
    };
  }

  if (state.phase === "closing") {
    const check = checkClosingAnswer(closingTargets(mission), heard, mission.target);
    if (check.accepted) return finishClosing(state, { input: input.input, accepted: true, usedModel: false, text: clip(heard[check.alternative ?? 0] ?? heard[0]!) });
    const fails = state.fails + 1;
    if (fails >= CLOSING_ATTEMPTS) return { state: { ...state, phase: "model", fails, retries: state.retries + 1 }, outcome: { kind: "closing_model" } };
    return { state: { ...state, fails, retries: state.retries + 1 }, outcome: { kind: "closing_retry" } };
  }

  if (state.phase === "model") {
    // Repetir a resposta-modelo: qualquer coisa dita ou digitada vale, a pessoa nunca fica presa aqui.
    return finishClosing(state, { input: input.input, accepted: false, usedModel: true, text: clip(heard[0]!) });
  }
  return { state, outcome: NONE };
}

function finishClosing(state: PlayState, closing: Finish): { state: PlayState; outcome: Outcome } {
  return { state: { ...state, phase: "done", closing }, outcome: { kind: closing.accepted ? "closing_ok" : "finished" } };
}

// ---------- O que a rodada entrega ----------

export const answersOf = (state: PlayState): RunAnswer[] => state.steps.map(({ node, input, scaffold }) => ({ node, input, scaffold }));

/** Quantas respostas foram dadas (para "fala 2 de 5"). */
export const progressOf = (mission: Mission, state: PlayState): { done: number; total: number } => ({ done: state.steps.length, total: mission.nodes.length });

// ---------- "+N XP" na hora ----------

/** O que a pessoa já fez hoje na mesma missão, por fala: níveis de ajuda das rodadas concluídas (para o `repeat`). */
export interface TodayLevels {
  nodes: Record<string, number[]>;
  closing: number[];
}

/** As rodadas concluídas de hoje da missão (não conta a rodada de `exceptRunId`). */
export function todayLevels(history: readonly RunSummary[], missionId: string, day: string, exceptRunId?: string): TodayLevels {
  const nodes: Record<string, number[]> = {};
  const closing: number[] = [];
  for (const run of history) {
    if (run.missionId !== missionId || run.day !== day || (exceptRunId !== undefined && run.id === exceptRunId)) continue;
    for (const a of run.answers) (nodes[a.node] ??= []).push(helpOf(a));
    closing.push(closingLevel(run.closing));
  }
  return { nodes, closing };
}

/** O XP da resposta que acabou de casar: o mesmo número que `planRun` vai gravar. */
export function replyXp(rules: GameRules, answered: Step, today: TodayLevels): number {
  const repeat = repeatOf(today.nodes[answered.node] ?? [], helpOf(answered));
  return rules.xpFor({ kind: "reply", input: answered.input, scaffold: answered.scaffold, flawed: false, attempt: 1, repeat });
}

/** A missão ainda paga cheio hoje (nenhuma rodada dela hoje)? Vira a marca "XP cheio hoje". */
export function paysFullToday(history: readonly RunSummary[], missionId: string, day: string): boolean {
  return !history.some((r) => r.missionId === missionId && r.day === day);
}

// ---------- Estado vindo do disco ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const PHASES: readonly Phase[] = ["listen", "ask", "react", "closing", "model", "done"];
const INPUTS: readonly InputMode[] = ["voice", "typed", "tap"];

/**
 * Lê o estado guardado em `session` e confere com a missão (ids de fala, posições). Qualquer coisa fora do formato devolve
 * `null`: a rodada começa de novo, nunca quebra.
 */
export function parseState(mission: Mission, raw: unknown): PlayState | null {
  if (!isObj(raw) || raw["v"] !== 1 || raw["missionId"] !== mission.id) return null;
  const { runId, day, mode, phase, listen, node, help, fails, retries, steps, closing } = raw;
  if (typeof runId !== "string" || !/^[A-Za-z0-9_.:-]{1,100}$/.test(runId) || typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (mode !== 1 && mode !== 2 && mode !== 3) return null;
  if (typeof phase !== "string" || !(PHASES as readonly string[]).includes(phase)) return null;
  if (!isInt(listen, 0, Math.max(0, mission.listen.length - 1)) || typeof node !== "string" || !nodeOf(mission, node)) return null;
  if (!isInt(help, 0, 3) || !isInt(fails, 0, 1000) || !isInt(retries, 0, 100_000) || !Array.isArray(steps) || steps.length > mission.nodes.length) return null;
  const parsedSteps: Step[] = [];
  for (const s of steps) {
    if (!isObj(s) || typeof s["node"] !== "string") return null;
    const n = nodeOf(mission, s["node"]);
    if (!n || !isInt(s["reply"], 0, n.replies.length - 1) || !isInt(s["scaffold"], 0, 3)) return null;
    if (typeof s["input"] !== "string" || !(INPUTS as readonly string[]).includes(s["input"])) return null;
    parsedSteps.push({ node: s["node"], reply: s["reply"], input: s["input"] as InputMode, scaffold: s["scaffold"] as Scaffold });
  }
  let finish: Finish | undefined;
  if (closing !== undefined) {
    if (!isObj(closing) || typeof closing["text"] !== "string" || typeof closing["accepted"] !== "boolean" || typeof closing["usedModel"] !== "boolean") return null;
    if (typeof closing["input"] !== "string" || !(INPUTS as readonly string[]).includes(closing["input"])) return null;
    finish = { text: clip(closing["text"]), input: closing["input"] as InputMode, accepted: closing["accepted"], usedModel: closing["usedModel"] };
  }
  if (phase === "done" && !finish) return null;
  if (phase === "react" && parsedSteps.length === 0) return null;
  const state: PlayState = { v: 1, runId, missionId: mission.id, day, mode, phase: phase as Phase, listen, node, help: help as Scaffold, fails, retries, steps: parsedSteps };
  if (finish) state.closing = finish;
  return state;
}
