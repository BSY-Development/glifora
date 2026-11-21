// IA opcional com a key da própria pessoa (D-56). A interface fala com a IA só por aqui, e daqui nunca sai a key:
// só "tem key", "últimos 4" e o resultado. A revisão fica na memória da aba (não gasta cota ao reabrir o relatório)
// e nunca toca em XP, estrelas nem na rodada guardada (D-49).
import { clearKey, hasKey, isRemembered, isValidKeyShape, maskedKey, setKey } from "../ai/keyVault";
import { isAiError, toAiError, type AiErrorKind } from "../ai/errors";
import { pingKey } from "../ai/structured";
import { NAME_MARK, reviewReport, type ReviewedTurn, type ReviewInput, type ReviewTurnInput, type Verdict } from "../ai/tasks/reviewReport";
import { spokenName } from "../schemas";
import type { Report } from "./play";
import { loadProfile } from "./player";
export type AiProblem = Exclude<AiErrorKind, "aborted">;

const PROVIDER = "gemini";
/** Último problema (tipo e hora), para a tela "IA (opcional)". Nunca guarda a key nem texto do servidor. */
const LAST_PROBLEM_KEY = "glifora.ai.last.v1";
const PROBLEMS: readonly string[] = ["auth", "quota", "credits", "model", "region", "network", "timeout", "refused", "invalid_output", "server", "no_key", "unknown"];

export interface KeyInfo {
  has: boolean;
  /** "••••abcd" */
  masked: string | null;
  /** Guardada neste aparelho (e não só na memória da aba). */
  remembered: boolean;
}

export function keyInfo(): KeyInfo {
  return { has: hasKey(PROVIDER), masked: maskedKey(PROVIDER), remembered: isRemembered(PROVIDER) };
}

export function keyLooksValid(key: string): boolean {
  return isValidKeyShape(key);
}

/** `false`: formato impossível ou o aparelho não deixou guardar. */
export function saveKey(key: string, remember: boolean): boolean {
  const ok = setKey(PROVIDER, key, remember);
  if (ok) clearLastProblem();
  return ok;
}

export function eraseKey(): void {
  clearKey(PROVIDER);
  reviews.clear();
}

// ---------- último problema ----------

export interface LastProblem {
  kind: AiProblem;
  at: number;
  /** Só no erro desconhecido: a mensagem do Google, limpa e sem a key (até 200 caracteres). */
  detail?: string;
}

/** Releitura do que veio do localStorage: a mesma limpeza do `errorDetail` (texto de uma linha, sem `<`, `>` nem controle, até 200). */
function cleanDetail(text: string): string {
  return Array.from(text.replace(/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim()).slice(0, 200).join("").trim();
}

export function loadLastProblem(): LastProblem | null {
  try {
    const raw = localStorage.getItem(LAST_PROBLEM_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { kind, at, detail } = value as { kind?: unknown; at?: unknown; detail?: unknown };
    if (typeof kind !== "string" || !PROBLEMS.includes(kind) || typeof at !== "number" || !Number.isFinite(at)) return null;
    return { kind: kind as AiProblem, at, ...(typeof detail === "string" && cleanDetail(detail) !== "" ? { detail: cleanDetail(detail) } : {}) };
  } catch {
    return null;
  }
}

function saveLastProblem(kind: AiProblem, detail: string | undefined): void {
  try {
    localStorage.setItem(LAST_PROBLEM_KEY, JSON.stringify({ kind, at: Date.now(), ...(detail !== undefined ? { detail } : {}) }));
  } catch {
    // sem localStorage: o aviso aparece só nesta tela, e tudo segue
  }
}

export function clearLastProblem(): void {
  try {
    localStorage.removeItem(LAST_PROBLEM_KEY);
  } catch {
    // nada a apagar
  }
}

// ---------- chamadas ----------

export type AiResult<T> = { ok: true; value: T } | { ok: false; problem: AiProblem; detail?: string };

let busy = false;

async function guarded<T>(job: () => Promise<T>): Promise<AiResult<T>> {
  if (busy) return { ok: false, problem: "unknown" };
  busy = true;
  try {
    const value = await job();
    clearLastProblem();
    return { ok: true, value };
  } catch (error) {
    const kind = isAiError(error) ? error.kind : toAiError(error).kind;
    const problem: AiProblem = kind === "aborted" ? "unknown" : kind;
    const detail = problem === "unknown" ? (error as { detail?: unknown }).detail : undefined;
    const text = typeof detail === "string" ? detail.slice(0, 200) : undefined;
    saveLastProblem(problem, text);
    return { ok: false, problem, ...(text !== undefined ? { detail: text } : {}) };
  } finally {
    busy = false;
  }
}

/** "Testar a key": uma chamada mínima. */
export function testKey(): Promise<AiResult<true>> {
  return guarded(async () => {
    await pingKey();
    return true as const;
  });
}

// ---------- revisão do relatório ----------

/** O que a IA disse de cada fala enviada (`null`: aquela fala volta ao relatório sem IA) e o que a pessoa tinha dito. */
interface StoredReview {
  said: string[];
  turns: (ReviewedTurn | null)[];
  nickname: string | null;
}
const reviews = new Map<string, StoredReview>();

/** Já existe revisão desta rodada nesta aba (reabrir o relatório não gasta cota de novo)? */
export function hasReview(runId: string): boolean {
  return reviews.has(runId);
}

/**
 * O pedido mínimo: sem perfil, sem ids e sem toques. A resposta livre de nome (D-51) não vai.
 * O apelido (`nickname`) só serve para trocar o nome dentro da fala por [name]; ele mesmo nunca é enviado.
 */
export function reviewInput(report: Report, nickname: string | null): ReviewInput {
  const { mission, lines, closingWay, run } = report;
  const turns: ReviewTurnInput[] = [];
  for (const line of lines) {
    const node = mission.nodes.find((n) => n.id === line.node);
    if (!node || line.said === undefined) continue;
    const index = run.answers.find((a) => a.node === line.node)?.reply;
    const reply = index === undefined ? undefined : node.replies[index];
    if (reply?.free === "name") continue;
    turns.push({
      npc: node.text,
      ok: node.replies.filter((r) => !r.flawed && r.free === undefined).map((r) => r.text),
      slips: node.replies.flatMap((r) => (r.flawed && r.recast ? [{ from: r.recast.original, to: r.recast.learner ?? r.recast.corrected }] : [])),
      match: reply === undefined ? "none" : reply.flawed ? "flawed" : "good",
      said: line.said,
    });
  }
  const closing = run.closing;
  if (closing && closing.input !== "tap") {
    turns.push({
      npc: mission.closing.question.text,
      ok: [mission.closing.model_answer, ...(mission.closing.models ?? [])].slice(0, 3).map((m) => m.text),
      slips: [],
      match: closingWay?.kind === "recast" ? "flawed" : closing.accepted ? "good" : "none",
      said: closing.text,
    });
  }
  return { target: mission.target, level: mission.level, turns, nickname };
}

/** Revisa a rodada com a IA. Só a memória da aba guarda o resultado; nada do jogo muda. */
export async function reviewRun(report: Report, uiLang: string): Promise<AiResult<true>> {
  const profile = await loadProfile();
  const nickname = profile?.nickname || null;
  const input = reviewInput(report, nickname);
  if (input.turns.length === 0) return { ok: false, problem: "unknown" };
  const result = await guarded(() => reviewReport(input, uiLang));
  if (!result.ok) return result;
  reviews.set(report.run.id, { said: input.turns.map((t) => t.said), turns: result.value, nickname });
  return { ok: true, value: true };
}

/** Uma fala revisada, pronta para a tela e para o Copiar relatório. */
export interface ReviewItem {
  said: string;
  verdict: Verdict;
  correction?: string;
  natural?: string;
  tip?: string;
}

/** O `[name]` volta a ser o nome falado da pessoa, só na hora de mostrar. */
function unmask(text: string, nickname: string | null): string {
  return text.replaceAll(NAME_MARK, spokenName(nickname) ?? "").replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

/** A revisão da rodada, só com as falas que a IA revisou e que passaram nas conferências. `null`: ainda não revisada. */
export function reviewItems(runId: string): ReviewItem[] | null {
  const stored = reviews.get(runId);
  if (!stored) return null;
  return stored.turns.flatMap((turn, k): ReviewItem[] => {
    if (!turn) return [];
    return [
      {
        said: stored.said[k] ?? "",
        verdict: turn.verdict,
        ...(turn.correction !== undefined ? { correction: unmask(turn.correction, stored.nickname) } : {}),
        ...(turn.natural !== undefined ? { natural: unmask(turn.natural, stored.nickname) } : {}),
        ...(turn.tip !== undefined ? { tip: unmask(turn.tip, stored.nickname) } : {}),
      },
    ];
  });
}
