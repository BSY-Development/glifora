// Revisão do relatório com IA (D-56; docs/propostas/W2-22-prompt-relatorio.md). Uma chamada por missão, com todas as falas juntas.
// Só vai o mínimo: idioma, nível, a fala da NPC (sem o vocativo), as respostas da missão e o que a pessoa disse (até 100 caracteres,
// limpo, entre marcadores, com o apelido trocado por [name]). Sem perfil, sem ids, sem toques. Volta SÓ DADO validado.
//
// Aceitação parcial: envelope quebrado (JSON, chaves, tamanho da lista, `i`) falha tudo; item quebrado derruba só aquela fala,
// que volta ao relatório sem IA (`null`). O jogo vence a IA quando casou um erro previsto e a IA disse "natural".
import { z } from "zod";
import { ContentLang, fillPlayer, normalize, spokenName } from "../../schemas";
import { completeJson, wrapUtterance } from "../structured";
import type { JsonSchema } from "../providers/gemini";
import { REVIEW_SYSTEM } from "./reviewReport.prompt";

/** Quanto da fala da pessoa vai à IA (D-56). */
export const SAID_MAX = 100;
/** No máximo 12 falas por pedido; se a missão passar disso, ficam as 12 primeiras. */
export const MAX_TURNS = 12;
const LINE_MAX = 200;

export const NAME_MARK = "[name]";
export const VERDICTS = ["natural", "polish", "fix", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** `good`/`flawed`: o que o jogo casou (dica, não veredito) · `none`: nada casou. */
export type Match = "good" | "flawed" | "none";

export interface ReviewTurnInput {
  /** Fala da NPC no idioma-alvo (pode trazer o vocativo `{player}`: sai antes de ir). */
  npc: string;
  /** As respostas boas que a missão previa (nem `flawed`, nem `free`). */
  ok: readonly string[];
  /** Erros previstos da missão: o trecho com erro e o jeito certo. */
  slips: readonly { from: string; to: string }[];
  match: Match;
  said: string;
}

export interface ReviewInput {
  target: string;
  level: string;
  turns: readonly ReviewTurnInput[];
  /** Apelido da pessoa: dentro da fala vira [name] (melhor esforço). Nunca vai à IA. */
  nickname: string | null;
}

/** O que a IA disse de uma fala já conferida. `[name]` ainda não foi trocado de volta. */
export interface ReviewedTurn {
  verdict: Verdict;
  correction?: string;
  natural?: string;
  tip?: string;
}

// ---------- limpeza ----------

const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Uma linha de texto da missão para o pedido: sem `<`, `>`, controle, `|` nem quebra, e com teto. */
export function missionLine(text: string, max = LINE_MAX): string {
  const cleaned = fillPlayer(text, null).normalize("NFC").replace(/[<>|]/g, " ").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, max).join("");
}

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Troca por [name] cada palavra inteira que seja parte do apelido (sem diferenciar maiúsculas nem acentos). */
export function maskName(text: string, nickname: string | null): string {
  if (!nickname) return text;
  const names = new Set<string>();
  for (const source of [nickname, spokenName(nickname) ?? ""]) for (const part of source.split(/[^\p{L}\p{M}]+/u)) if (Array.from(part).length >= 2) names.add(fold(part));
  if (names.size === 0) return text;
  const masked = text.replace(/[\p{L}\p{M}]+/gu, (word) => (names.has(fold(word)) ? NAME_MARK : word));
  return masked.replace(/\[name\](?: \[name\])+/g, NAME_MARK);
}

/** A fala da pessoa como vai à IA, na ordem: NFC, sem `<`/`>`/controle, apelido → [name], espaços juntos, 100 pontos de código. */
export function saidForAi(said: string, nickname: string | null): string {
  const cleaned = said.normalize("NFC").replace(/[<>]/g, " ").replace(CONTROL, " ");
  return maskName(cleaned, nickname);
}

/** O pedido ao modelo (texto). Exportado para os testes conferirem o que sai do aparelho. */
export function buildReviewPrompt(input: ReviewInput, uiLang: string): string {
  const turns = input.turns.slice(0, MAX_TURNS);
  const blocks = turns.map((turn, i) => {
    const lines = [`[${i}]`, `NPC: ${missionLine(turn.npc)}`, `OK: ${turn.ok.map((o) => missionLine(o)).join(" | ")}`];
    for (const slip of turn.slips) lines.push(`SLIP: ${missionLine(slip.from)} => ${missionLine(slip.to)}`);
    lines.push(`MATCH: ${turn.match}`, wrapUtterance(saidForAi(turn.said, input.nickname), SAID_MAX));
    return lines.join("\n");
  });
  return [`target: ${input.target}`, `ui: ${uiLang}`, `level: ${input.level}`, "", blocks.join("\n\n")].join("\n");
}

/** A fala da pessoa já limpa, como foi enviada (sem os marcadores): é com ela que a IA é conferida. */
export function sentSaid(turn: ReviewTurnInput, nickname: string | null): string {
  return Array.from(saidForAi(turn.said, nickname).replace(/\s+/g, " ").trim()).slice(0, SAID_MAX).join("");
}

// ---------- contrato de saída ----------

/** Envelope: chaves fechadas e tipos certos. Os tetos de texto e as regras de cada veredito vêm depois, por item. */
function envelopeSchema(n: number) {
  return z
    .strictObject({
      items: z.array(z.strictObject({ i: z.number().int(), meant: z.string(), verdict: z.enum(VERDICTS), correction: z.string(), natural: z.string(), tip: z.string() })),
    })
    .superRefine((value, ctx) => {
      if (value.items.length !== n) ctx.addIssue({ code: "custom", message: "número de itens", path: ["items"] });
      value.items.forEach((item, k) => {
        if (item.i !== k) ctx.addIssue({ code: "custom", message: "índice fora de ordem", path: ["items", k, "i"] });
      });
    });
}
type Envelope = z.infer<ReturnType<typeof envelopeSchema>>;

/** Texto de uma linha para a tela: sem `<`, `>`, controle, link nem quebra. */
function shown(max: number, required: boolean) {
  return z
    .string()
    .max(max)
    .refine((s) => !/[<>]|:\/\/|www\./i.test(s) && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(s), "texto com caractere proibido")
    .refine((s) => (required ? s.trim() !== "" : true), "obrigatório");
}

const ITEM_LIMITS = { meant: 60, correction: 140, natural: 140, tip: 160 } as const;

/** A tabela do veredito (§3.2): vazio onde é vazio, preenchido onde é obrigatório. */
function itemSchema(verdict: Verdict) {
  const empty = z.literal("");
  const base = { meant: shown(ITEM_LIMITS.meant, false) };
  switch (verdict) {
    case "natural":
      return z.object({ ...base, correction: empty, natural: empty, tip: empty });
    case "polish":
    case "unclear":
      return z.object({ ...base, correction: empty, natural: shown(ITEM_LIMITS.natural, true), tip: shown(ITEM_LIMITS.tip, true) });
    case "fix":
      return z.object({ ...base, correction: shown(ITEM_LIMITS.correction, true), natural: shown(ITEM_LIMITS.natural, false), tip: shown(ITEM_LIMITS.tip, true) });
  }
}

/**
 * Confere um item (§3.3). `null`: aquela fala volta ao relatório sem IA.
 * `said`: a fala limpa que foi enviada · `target`: idioma-alvo (para comparar sem maiúscula nem pontuação).
 */
export function checkItem(item: Envelope["items"][number], turn: Pick<ReviewTurnInput, "match">, said: string, target: string): ReviewedTurn | null {
  if (!itemSchema(item.verdict).safeParse(item).success) return null;
  // O jogo vence a IA: casou um erro previsto e a IA disse "natural" → fica o recast da missão.
  if (turn.match === "flawed" && item.verdict === "natural") return null;
  if (item.verdict === "fix") {
    const lang = ContentLang.safeParse(target);
    if (lang.success && normalize(item.correction, lang.data) === normalize(said, lang.data)) return null; // não corrigiu nada
  }
  return {
    verdict: item.verdict,
    ...(item.correction !== "" ? { correction: item.correction.trim() } : {}),
    ...(item.natural !== "" ? { natural: item.natural.trim() } : {}),
    ...(item.tip !== "" ? { tip: item.tip.trim() } : {}),
  };
}

/** O schema que o Gemini recebe como `responseSchema` (ajuda, não garantia: quem vale é o Zod). */
export function reviewJsonSchema(n: number): JsonSchema {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          properties: {
            i: { type: "integer", minimum: 0, maximum: Math.max(0, n - 1) },
            meant: { type: "string", maxLength: ITEM_LIMITS.meant },
            verdict: { type: "string", enum: VERDICTS },
            correction: { type: "string", maxLength: ITEM_LIMITS.correction },
            natural: { type: "string", maxLength: ITEM_LIMITS.natural },
            tip: { type: "string", maxLength: ITEM_LIMITS.tip },
          },
          required: ["i", "meant", "verdict", "correction", "natural", "tip"],
          propertyOrdering: ["i", "meant", "verdict", "correction", "natural", "tip"],
        },
      },
    },
    required: ["items"],
  };
}

/**
 * Revisa as falas. Devolve uma posição por fala enviada (as primeiras 12): o item conferido, ou `null` quando aquela
 * fala deve voltar ao relatório sem IA. Envelope quebrado lança `invalid_output` (depois de 1 nova tentativa).
 */
export async function reviewReport(input: ReviewInput, uiLang: string, signal?: AbortSignal): Promise<(ReviewedTurn | null)[]> {
  const turns = input.turns.slice(0, MAX_TURNS);
  if (turns.length === 0) return [];
  const envelope = await completeJson<Envelope>({
    system: REVIEW_SYSTEM,
    user: buildReviewPrompt(input, uiLang),
    jsonSchema: reviewJsonSchema(turns.length),
    schema: envelopeSchema(turns.length),
    ...(signal ? { signal } : {}),
  });
  return envelope.items.map((item, k) => checkItem(item, turns[k]!, sentSaid(turns[k]!, input.nickname), input.target));
}
