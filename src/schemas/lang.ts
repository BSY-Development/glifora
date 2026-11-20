import { z } from "zod";

/** Idiomas da interface (SPEC: pt-BR e inglês). */
export const UiLang = z.enum(["pt-BR", "en"]);
export type UiLang = z.infer<typeof UiLang>;

/** Idiomas de conteúdo, base ou alvo. Cresce com o conteúdo (D-40: inglês primeiro, espanhol depois). */
export const ContentLang = z.enum(["pt-BR", "en", "es"]);
export type ContentLang = z.infer<typeof ContentLang>;

/** Nível CEFR. */
export const Cefr = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type Cefr = z.infer<typeof Cefr>;

/** Par de idiomas do conteúdo: base (traduções, dicas) e alvo (o que se aprende). */
export const Pair = z
  .strictObject({ base: ContentLang, target: ContentLang })
  .refine((p) => p.base !== p.target, { message: "base e target precisam ser diferentes" });
export type Pair = z.infer<typeof Pair>;

/** Id do par usado em pastas e índices: "pt-BR_en". */
export function pairId(pair: Pair): string {
  return `${pair.base}_${pair.target}`;
}
