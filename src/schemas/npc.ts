import { z } from "zod";
import { ContentLang } from "./lang";
import { text } from "./text";
import { LocationId, NpcId } from "./world";

/** Tradução de uma fala fixa para cada idioma base que existir (a fala em si está no idioma-alvo). */
const Translations = z.strictObject({
  "pt-BR": text(200).optional(),
  en: text(200).optional(),
  es: text(200).optional(),
});

/** Fala fixa da NPC, no idioma-alvo. */
export const NpcLine = z.strictObject({
  text: text(200),
  translation: Translations.optional(),
});
export type NpcLine = z.infer<typeof NpcLine>;

/** Falas fixas da NPC num idioma-alvo. */
export const NpcLines = z.strictObject({
  /** Não casou nenhuma resposta: a NPC pede para repetir (D-43). */
  retry: NpcLine,
  /** Modo completo (fase 6): a IA falhou duas vezes. */
  contingency: NpcLine,
});
export type NpcLines = z.infer<typeof NpcLines>;

/** Voz do navegador (Web Speech API). A região é obrigatória: "en-US", não "en". */
export const NpcVoice = z.strictObject({
  lang: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, 'use idioma e região, como "en-US"'),
  rate: z.number().min(0.5).max(1.5),
  pitch: z.number().min(0.5).max(1.5),
});
export type NpcVoice = z.infer<typeof NpcVoice>;

/** content/npcs/<id>.json — ficha da NPC. A persona é em inglês, para o prompt do modo completo. W0-03 §5.2. */
export const Npc = z
  .strictObject({
    schema: z.literal(1),
    id: NpcId,
    name: text(40),
    location: LocationId,
    role: text(80),
    persona: z.strictObject({
      summary: text(600),
      personality: z.array(text(200)).min(1).max(8),
      speaking_style: z.array(text(200)).min(1).max(8),
      world_details: z.array(text(200)).max(8),
    }),
    voice: NpcVoice,
    lines: z.strictObject({
      "pt-BR": NpcLines.optional(),
      en: NpcLines.optional(),
      es: NpcLines.optional(),
    }),
  })
  .superRefine((npc, ctx) => {
    const targets = ContentLang.options.filter((l) => npc.lines[l]);
    if (targets.length === 0) ctx.addIssue({ code: "custom", message: "a NPC precisa das falas de pelo menos um idioma-alvo", path: ["lines"] });
  });
export type Npc = z.infer<typeof Npc>;
