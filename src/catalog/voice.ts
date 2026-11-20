// Frases do teste de voz (D-48): só `content/eval/stt/`, num pedaço próprio carregado por `import()` apenas em
// /settings/voice. O conjunto-ouro e o resto de `content/eval/` ficam fora do bundle.
// A conferência é a do Conteúdo (`parseVoiceEvalSet`); se `expect` aponta para uma resposta que existe, quem confere é o build-index.
import { pairId, parseVoiceEvalSet, type Pair, type VoiceEvalPhrase } from "../schemas";

export type VoicePhrase = VoiceEvalPhrase;

export type VoicePhrasesResult = { ok: true; phrases: readonly VoicePhrase[] } | { ok: false; reason: "missing" | "invalid" };

export type VoiceSources = Readonly<Record<string, () => Promise<unknown>>>;

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
  const parsed = parseVoiceEvalSet(raw);
  return parsed.ok ? { ok: true, phrases: parsed.set.phrases } : { ok: false, reason: "invalid" };
}
