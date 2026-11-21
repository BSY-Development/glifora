import { z } from "zod";
import { Cefr, ContentLang } from "./lang";
import { formatPath, type MissionIssue } from "./mission.check";
import { MISSION_LIMITS, MissionId, MissionKind } from "./mission";
import { LocalId, text } from "./text";
import { LocationId } from "./world";

// Formatos gerados ou lidos pelo catálogo além da missão: o índice (W0-03 §5.3) e as frases do teste
// de voz (D-48). O índice é gerado por scripts/content/build-index.ts; o app só lê.

/** Uma missão no índice: o bastante para listar sem carregar o arquivo dela. */
export const CatalogEntry = z.strictObject({
  id: MissionId,
  base: ContentLang,
  target: ContentLang,
  level: Cefr,
  kind: MissionKind,
  title: text(80),
  location: LocationId,
  can_do: text(160),
  /** Caminho relativo a content/: "missions/pt-BR_en/A1/bakery-01.json". A chave do glob é "/content/" + file. */
  file: z.string().regex(/^missions\/[A-Za-z-]+_[A-Za-z-]+\/(A1|A2|B1|B2|C1|C2)\/[a-z][a-z0-9-]{1,39}\.json$/, "caminho de missão inválido"),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

/** src/catalog/generated/index.json, ordenado por par, nível e id. */
export const CatalogIndex = z.strictObject({
  schema: z.literal(1),
  missions: z.array(CatalogEntry).max(2000),
});
export type CatalogIndex = z.infer<typeof CatalogIndex>;

/** Uma frase do teste de voz: a pessoa lê `text`, e o acerto é casar com a resposta `expect`. */
export const VoiceEvalPhrase = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/, "use minúsculas, números e hífen (2 a 64)"),
  text: text(200),
  expect: z.strictObject({
    mission: MissionId,
    node: LocalId,
    reply: z.number().int().min(0).max(MISSION_LIMITS.replies - 1),
  }),
});
export type VoiceEvalPhrase = z.infer<typeof VoiceEvalPhrase>;

/** content/eval/stt/<base>_<alvo>.json — frases do teste da taxa de casamento da voz (W2-12, D-48). */
export const VoiceEvalSet = z
  .strictObject({
    schema: z.literal(1),
    base: ContentLang,
    target: ContentLang,
    phrases: z.array(VoiceEvalPhrase).min(1).max(60),
  })
  .superRefine((set, ctx) => {
    if (set.base === set.target) ctx.addIssue({ code: "custom", message: "base e target precisam ser diferentes", path: ["target"] });
    const seen = new Set<string>();
    set.phrases.forEach((p, i) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", message: `frase repetida: ${p.id}`, path: ["phrases", i, "id"] });
      seen.add(p.id);
    });
  });
export type VoiceEvalSet = z.infer<typeof VoiceEvalSet>;

export type ParseVoiceEvalSetResult =
  | { readonly ok: true; readonly set: VoiceEvalSet }
  | { readonly ok: false; readonly issues: readonly MissionIssue[] };

/** Valida as frases do teste de voz. Se `expect` aponta para uma resposta que existe, quem confere é o build-index. */
export function parseVoiceEvalSet(input: unknown): ParseVoiceEvalSetResult {
  const parsed = VoiceEvalSet.safeParse(input);
  if (parsed.success) return { ok: true, set: parsed.data };
  return { ok: false, issues: parsed.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })) };
}
