import { z } from "zod";
import { text } from "./text";

/** Palavra ou expressão da missão; vira card do Grimório (fase 3). W0-03 §5.2. */
export const VocabItem = z.strictObject({
  /** No idioma-alvo. */
  term: text(60),
  /** No idioma base. */
  translation: text(80),
  /** Frase de exemplo no idioma-alvo. */
  example: text(160),
  /** Japonês e chinês (fase 9). */
  romanization: text(160).optional(),
});
export type VocabItem = z.infer<typeof VocabItem>;
