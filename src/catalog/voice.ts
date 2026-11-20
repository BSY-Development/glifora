// Frases do teste de voz (D-48): só `content/eval/stt/`, num pedaço próprio carregado por `import()` apenas em
// /settings/voice. O conjunto-ouro e o resto de `content/eval/` ficam fora do bundle.
// Até o Conteúdo exportar `parseVoiceEvalSet` (W2-04), a conferência é a mínima: lista de frases com id e texto.
// Esta camada não usa pacotes, então é à mão.
import { pairId, type Pair } from "../schemas";

export interface VoicePhrase {
  id: string;
  text: string;
  expect?: { mission: string; node: string; reply: number };
}

export type VoicePhrasesResult = { ok: true; phrases: readonly VoicePhrase[] } | { ok: false; reason: "missing" | "invalid" };

export type VoiceSources = Readonly<Record<string, () => Promise<unknown>>>;

function parsePhrase(raw: unknown): VoicePhrase | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { id, text, expect } = raw as Record<string, unknown>;
  if (typeof id !== "string" || id === "" || typeof text !== "string" || text === "") return undefined;
  const e = expect as Record<string, unknown> | null | undefined;
  if (e !== null && typeof e === "object" && typeof e["mission"] === "string" && typeof e["node"] === "string" && Number.isInteger(e["reply"]) && (e["reply"] as number) >= 0) {
    return { id, text, expect: { mission: e["mission"], node: e["node"], reply: e["reply"] as number } };
  }
  return { id, text };
}

/** Chave do glob: "/content/eval/stt/<base>_<alvo>.json". */
export async function loadVoicePhrasesFrom(sources: VoiceSources, pair: Pair): Promise<VoicePhrasesResult> {
  const open = sources[`/content/eval/stt/${pairId(pair)}.json`];
  if (open === undefined) return { ok: false, reason: "missing" };
  let raw: unknown;
  try {
    raw = await open();
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "invalid" };
  const { schema, phrases } = raw as Record<string, unknown>;
  if (schema !== 1 || !Array.isArray(phrases) || phrases.length === 0) return { ok: false, reason: "invalid" };
  const parsed = phrases.map(parsePhrase);
  return parsed.every((p) => p !== undefined) ? { ok: true, phrases: parsed as VoicePhrase[] } : { ok: false, reason: "invalid" };
}
