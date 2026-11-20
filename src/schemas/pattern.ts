import { z } from "zod";
import { Cefr, ContentLang } from "./lang";
import { text } from "./text";

/**
 * Id de um padrão de erro do catálogo: "<alvo>.<nome>" ("en.uncountable_noun") ou "other".
 * Quem confere se o id existe no catálogo do par é o checkMission (com o catálogo) e o build-index.
 */
export const PatternId = z.string().regex(/^(other|[a-z]{2}\.[a-z0-9_]{2,40})$/, 'use "<idioma>.<nome>" (ex.: en.plural_s) ou "other"');
export type PatternId = z.infer<typeof PatternId>;

/** Um padrão de erro do aluno, explicado no idioma base. Aparece só no relatório (princípio 5). */
export const Pattern = z.strictObject({
  id: PatternId,
  cefr: Cefr,
  title: text(80),
  explanation: text(400),
  example: z.strictObject({ wrong: text(120), right: text(120) }).optional(),
});
export type Pattern = z.infer<typeof Pattern>;

/** content/patterns/<base>_<alvo>.json — catálogo de erros do par. W0-03 §5.2. */
export const PatternCatalog = z
  .strictObject({
    schema: z.literal(1),
    base: ContentLang,
    target: ContentLang,
    patterns: z.array(Pattern).min(1).max(200),
  })
  .superRefine((cat, ctx) => {
    if (cat.base === cat.target) ctx.addIssue({ code: "custom", message: "base e target precisam ser diferentes", path: ["target"] });
    const prefix = `${cat.target.slice(0, 2)}.`;
    const seen = new Set<string>();
    cat.patterns.forEach((p, i) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", message: `padrão repetido: ${p.id}`, path: ["patterns", i, "id"] });
      seen.add(p.id);
      if (p.id !== "other" && !p.id.startsWith(prefix)) {
        ctx.addIssue({ code: "custom", message: `o id tem de começar com "${prefix}"`, path: ["patterns", i, "id"] });
      }
    });
    if (!seen.has("other")) ctx.addIssue({ code: "custom", message: 'falta o padrão "other"', path: ["patterns"] });
  });
export type PatternCatalog = z.infer<typeof PatternCatalog>;
