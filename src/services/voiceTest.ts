// Teste das frases de voz (W2-16, D-48): a pessoa lê cada frase de content/eval/stt/ e o app confere se o
// reconhecedor casou com a resposta esperada, do mesmo jeito que o player (`matchReply`, alternativas em ordem).
// Nada daqui é gravado: o resultado só existe na tela e no texto que a pessoa copiar.
import { load as loadMission, loadVoicePhrases, type VoicePhrase, type VoicePhrasesResult } from "../catalog";
import { matchReply, type Mission } from "../schemas";
import { plain } from "./play";
import type { SttAlternative, SttFailReason } from "./voice";

export type { VoicePhrase };
export type PhraseSetResult = VoicePhrasesResult;

/** Par do conjunto de frases (só pt-BR → en por enquanto). */
const PAIR = { base: "pt-BR", target: "en" } as const;

export const loadPhraseSet = (): Promise<PhraseSetResult> => loadVoicePhrases(PAIR);

export type Outcome =
  | { kind: "match" } // casou com a resposta esperada
  | { kind: "other"; index: number; text: string } // casou com outra resposta
  | { kind: "none" } // não casou com nenhuma
  | { kind: "failed"; reason: SttFailReason } // o reconhecedor não devolveu nada
  | { kind: "skipped" }
  | { kind: "broken" }; // a missão ou a fala esperada não existe (erro de conteúdo)

export interface Attempt {
  phrase: VoicePhrase;
  outcome: Outcome;
  heard: readonly SttAlternative[];
}

/** O que cada missão carregada guarda, para não reabrir a cada frase. */
export type MissionLoader = (id: string) => Promise<Mission | undefined>;

export function createMissionLoader(): MissionLoader {
  const cache = new Map<string, Promise<Mission | undefined>>();
  return (id) => {
    let hit = cache.get(id);
    if (hit === undefined) {
      hit = loadMission(id).then((r) => (r.ok ? r.mission : undefined));
      cache.set(id, hit);
    }
    return hit;
  };
}

/** Confere a fala contra a resposta esperada. */
export async function judge(phrase: VoicePhrase, heard: readonly SttAlternative[], mission: MissionLoader): Promise<Outcome> {
  const { mission: missionId, node: nodeId, reply } = phrase.expect;
  const m = await mission(missionId);
  const node = m?.nodes.find((n) => n.id === nodeId);
  if (m === undefined || node === undefined || node.replies[reply] === undefined) return { kind: "broken" };
  const hit = matchReply(node.replies, heard.map((a) => a.text), m.target);
  if (hit === null) return { kind: "none" };
  return hit.index === reply ? { kind: "match" } : { kind: "other", index: hit.index, text: hit.reply.text };
}

export interface Tally {
  total: number;
  done: number; // tentadas (sem contar as puladas)
  ok: number;
  pct: number; // ok / done, arredondado; 0 se nada foi tentado
}

export function tally(total: number, attempts: readonly Attempt[]): Tally {
  const tried = attempts.filter((a) => a.outcome.kind !== "skipped");
  const ok = tried.filter((a) => a.outcome.kind === "match").length;
  return { total, done: tried.length, ok, pct: tried.length === 0 ? 0 : Math.round((ok / tried.length) * 100) };
}

/** A transcrição vem do reconhecedor: texto puro, numa linha só e com teto (nada de linhas falsas no texto copiado). */
const clean = (text: string): string => plain(text, 200);

const heardText = (heard: readonly SttAlternative[]): string =>
  heard.length === 0 ? "-" : heard.map((a) => `"${clean(a.text)}" (${a.confidence > 0 ? `${Math.round(a.confidence * 100)}%` : "?"})`).join(" | ");

function line(a: Attempt): string {
  const { id, expect } = a.phrase;
  const want = `${expect.mission}/${expect.node}/${expect.reply}`;
  const got =
    a.outcome.kind === "match"
      ? "ok"
      : a.outcome.kind === "other"
        ? `other:${a.outcome.index}`
        : a.outcome.kind === "failed"
          ? `failed:${a.outcome.reason}`
          : a.outcome.kind;
  return `${id} | expected ${want} | matched ${got} | heard ${heardText(a.heard)}`;
}

/** Texto simples, em inglês (é para colar numa conversa técnica): cabeçalho, taxa e uma linha por frase tentada. */
export function formatResult(total: number, attempts: readonly Attempt[]): string {
  const s = tally(total, attempts);
  const skipped = attempts.length - s.done;
  return [
    `Glifora voice test pt-BR_en: ${s.ok}/${s.done} = ${s.pct}% (${total} phrases, ${skipped} skipped)`,
    ...attempts.filter((a) => a.outcome.kind !== "skipped").map(line),
  ].join("\n");
}
