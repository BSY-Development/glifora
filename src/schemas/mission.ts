import { z } from "zod";
import { Cefr, ContentLang } from "./lang";
import { PatternId } from "./pattern";
import { hasControl, LocalId, text } from "./text";
import { VocabItem } from "./vocab";
import { LocationId, NpcId, Slug } from "./world";

// Missão v1 (D-43; W0-03 §5.1 com closing.target_words no lugar de accept). Objeto estrito em todos os
// níveis, enums fechados. As conferências que olham a missão inteira (grafo, casamento, recast, fecho)
// ficam em mission.check.ts; parseMission junta as duas coisas.

/** Emoção da fala da NPC (a mesma lista do contrato do turno, W0-03 §5.4). */
export const Emotion = z.enum(["neutral", "happy", "curious", "confused", "surprised", "sad", "proud"]);
export type Emotion = z.infer<typeof Emotion>;

export const MissionKind = z.enum(["encounter", "boss"]);
export type MissionKind = z.infer<typeof MissionKind>;

/**
 * Id da missão: slug na embutida ("bakery-01"). Na fábrica e na IA o app gera "local:<uuid>" e passa
 * em `parseMission(..., { id })`; o que a IA mandar é ignorado.
 */
export const MissionId = z.union([
  Slug,
  z.string().regex(/^local:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, "id local inválido"),
]);
export type MissionId = z.infer<typeof MissionId>;

/** Fala no idioma-alvo com a tradução no idioma base. */
export const Line = z.strictObject({
  text: text(300),
  translation: text(300),
  romanization: text(300).optional(),
});
export type Line = z.infer<typeof Line>;

/** Fala da escuta inicial (`listen`), dita por um personagem. */
export const ListenLine = z.strictObject({
  speaker: LocalId,
  text: text(300),
  translation: text(300),
  romanization: text(300).optional(),
});
export type ListenLine = z.infer<typeof ListenLine>;

/** Reação curta da NPC a uma resposta. Com `flawed`, traz `recast.corrected` literal no texto. */
export const Reaction = z.strictObject({
  text: text(300),
  translation: text(300),
  romanization: text(300).optional(),
  emotion: Emotion.optional(),
});
export type Reaction = z.infer<typeof Reaction>;

export const Recast = z.strictObject({
  /** Trecho com erro, como está no texto da resposta. */
  original: text(200),
  /** Forma certa, como aparece na reação da NPC (o app destaca). */
  corrected: text(200),
  /**
   * Forma certa na boca da pessoa, quando a NPC muda a pessoa do verbo ("You're from Brazil" → "I'm from
   * Brazil"). É o que o relatório mostra ao lado do "Você disse" (D-54). Sem ele, vale `corrected`.
   */
  learner: text(200).optional(),
  /**
   * O erro só é erro como resposta a esta fala ("Good night" ao chegar, "I eat" sobre hoje). Com `true`,
   * ele não vale no fecho (D-54); sem ele, o fecho também reconhece o erro e mostra a correção.
   */
  local: z.boolean().optional(),
});
export type Recast = z.infer<typeof Recast>;

/** Palavra ou expressão que tem de aparecer na fala ou no texto da pessoa. */
const Keyword = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((s) => !hasControl(s), "tem caractere de controle");

/**
 * Lista de alternativas; cada alternativa é uma lista de palavras ou expressões que têm de aparecer
 * todas. `[["honey"], ["sweet", "roll"]]` = "honey" OU ("sweet" E "roll").
 */
export const Keywords = z.array(z.array(Keyword).min(1).max(6)).min(1).max(12);
export type Keywords = z.infer<typeof Keywords>;

export const Reply = z
  .strictObject({
    /** O que a pessoa diz, no idioma-alvo. */
    text: text(300),
    /**
     * A ideia no idioma base: o 2º degrau de ajuda (D-43). Na resposta com erro, é o que a pessoa
     * quis dizer, não a tradução do erro.
     */
    translation: text(300),
    romanization: text(300).optional(),
    /** Obrigatório nas embutidas; opcional na fábrica (sem ele, casa por 60% das palavras de conteúdo). */
    keywords: Keywords.optional(),
    /** Resposta com um erro previsto: só casa no passe exato e gera o recast (D-43). */
    flawed: z.boolean().default(false),
    reaction: Reaction.optional(),
    recast: Recast.optional(),
    /** Só no relatório (princípio 5), no idioma base. */
    note: text(200).optional(),
    /** Id do catálogo de erros do par; só no relatório. */
    pattern: PatternId.optional(),
    /** Id de uma fala posterior, para ramificar. Sem ele, segue para a próxima fala da lista. */
    next: LocalId.optional(),
    /**
     * Resposta livre (D-51): se nada mais casar, aceita fala de 1 a 3 palavras ("Maria"). O `text` é o
     * modelo da ajuda, e a reação da NPC não repete nada do que a pessoa disse.
     */
    free: z.enum(["name"]).optional(),
    /**
     * Trecho-chave da resposta boa, como está no `text` (D-54): a reação da NPC repete esse trecho (recast
     * implícito), e quem já disse o trecho falou do jeito natural. Ex.: "a honey roll".
     */
    chunk: text(80).optional(),
    /**
     * Como a NPC repete o trecho quando muda a pessoa do verbo ("I'm from" → "you're from"). Sem ele, a
     * reação repete o próprio `chunk`.
     */
    echo: text(80).optional(),
  })
  .superRefine((r, ctx) => {
    if (r.flawed) {
      if (!r.reaction) ctx.addIssue({ code: "custom", message: "resposta com erro (flawed) precisa de reaction", path: ["reaction"] });
      if (!r.recast) ctx.addIssue({ code: "custom", message: "resposta com erro (flawed) precisa de recast", path: ["recast"] });
    } else if (r.recast) {
      ctx.addIssue({ code: "custom", message: "recast só vale em resposta com erro (flawed: true)", path: ["recast"] });
    }
    if (r.chunk !== undefined && (r.flawed || r.free)) {
      ctx.addIssue({ code: "custom", message: "chunk só vale em resposta boa (a com erro usa recast; a livre não repete nada)", path: ["chunk"] });
    }
    if (r.chunk !== undefined && !r.reaction) ctx.addIssue({ code: "custom", message: "resposta com chunk precisa de reaction", path: ["reaction"] });
    if (r.echo !== undefined && r.chunk === undefined) ctx.addIssue({ code: "custom", message: "echo só vale junto com chunk", path: ["echo"] });
  });
export type Reply = z.infer<typeof Reply>;

export const MissionNode = z
  .strictObject({
    id: LocalId,
    speaker: LocalId,
    text: text(300),
    translation: text(300),
    romanization: text(300).optional(),
    emotion: Emotion.default("neutral"),
    replies: z.array(Reply).min(1).max(3),
  })
  .superRefine((node, ctx) => {
    if (node.replies.every((r) => r.flawed)) {
      ctx.addIssue({ code: "custom", message: "cada fala precisa de pelo menos uma resposta sem erro", path: ["replies"] });
    }
  });
export type MissionNode = z.infer<typeof MissionNode>;

export const Character = z.strictObject({
  id: LocalId,
  name: text(40),
  /** No idioma base. */
  personality: text(160),
  /** Ficha da NPC na vila; sem ela, o app usa uma figura genérica do local. */
  npc: NpcId.optional(),
});
export type Character = z.infer<typeof Character>;

export const Closing = z.strictObject({
  /** A pergunta da NPC que pede a frase própria (princípio 2). */
  question: Line,
  /** A frase é aceita se tiver pelo menos uma destas (D-43). Sem a lista, valem as palavras do vocabulário. */
  target_words: z.array(Keyword).min(1).max(30).optional(),
  /** No idioma base; aparece na 2ª tentativa. */
  hint: text(160),
  /** Aparece para repetir depois de duas tentativas. Contém uma das palavras-alvo. É o modelo padrão. */
  model_answer: Line,
  /**
   * Outros modelos (D-54). O app mostra o mais próximo do que a pessoa disse, pelas palavras-alvo em
   * comum (`closestModel`); sem nada em comum, vale o `model_answer`. Cada um contém uma palavra-alvo.
   */
  models: z.array(Line).min(1).max(3).optional(),
  /** A despedida da NPC. */
  success: Line,
});
export type Closing = z.infer<typeof Closing>;

/** Teto de texto por campo, para as mensagens e para a fábrica (fase 4) citar no prompt. */
export const MISSION_LIMITS = {
  title: 80,
  theme: 120,
  can_do: 160,
  description: 300,
  characters: 4,
  listen: 6,
  nodes: { min: 2, max: 20 },
  replies: 3,
  vocabulary: 20,
} as const;

export const Mission = z
  .strictObject({
    schema: z.literal(1),
    id: MissionId,
    base: ContentLang,
    target: ContentLang,
    level: Cefr,
    kind: MissionKind.default("encounter"),
    title: text(MISSION_LIMITS.title),
    theme: text(MISSION_LIMITS.theme),
    can_do: text(MISSION_LIMITS.can_do),
    description: text(MISSION_LIMITS.description),
    location: LocationId,
    characters: z.array(Character).min(1).max(MISSION_LIMITS.characters),
    listen: z.array(ListenLine).max(MISSION_LIMITS.listen).default([]),
    nodes: z.array(MissionNode).min(MISSION_LIMITS.nodes.min).max(MISSION_LIMITS.nodes.max),
    closing: Closing,
    vocabulary: z.array(VocabItem).max(MISSION_LIMITS.vocabulary).default([]),
  })
  .superRefine((m, ctx) => {
    if (m.base === m.target) ctx.addIssue({ code: "custom", message: "base e target precisam ser diferentes", path: ["target"] });
    const seen = new Set<string>();
    m.characters.forEach((c, i) => {
      if (seen.has(c.id)) ctx.addIssue({ code: "custom", message: `personagem repetido: ${c.id}`, path: ["characters", i, "id"] });
      seen.add(c.id);
    });
  });
export type Mission = z.infer<typeof Mission>;
/** A missão como vem do JSON, antes dos valores padrão (`kind`, `emotion`, `flawed`, `listen`, `vocabulary`). */
export type MissionInput = z.input<typeof Mission>;
