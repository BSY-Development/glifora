// JSON estruturado (D-56; W0-03 §2.6): monta a chamada, pega a key no cofre, valida a saída com Zod rígido.
// Daqui só saem DADOS validados (nunca HTML). Quem chama nunca vê a key.
import type { z } from "zod";
import { AiError } from "./errors";
import { withKey, type ProviderId } from "./keyVault";
import { generate, type JsonSchema } from "./providers/gemini";

const PROVIDER: ProviderId = "gemini";

/** Marcadores em volta de qualquer coisa que a pessoa digitou ou falou: tudo ali dentro é DADO. */
export const UTTERANCE_OPEN = "<player_utterance>";
export const UTTERANCE_CLOSE = "</player_utterance>";

/**
 * A fala da pessoa pronta para ir à IA: sem `<` nem `>` (assim ela não fecha o marcador nem forja outro),
 * sem controle, bidi nem invisíveis, numa linha e com teto de `max` caracteres.
 */
export function plainUtterance(text: string, max: number): string {
  const cleaned = text.replace(/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, max).join("");
}

export function wrapUtterance(text: string, max: number): string {
  return `${UTTERANCE_OPEN}${plainUtterance(text, max)}${UTTERANCE_CLOSE}`;
}

/** Tira cercas ```json e texto em volta; devolve o objeto ou array JSON como texto, ou null. */
function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fenced?.[1] ?? trimmed;
  return body.startsWith("{") || body.startsWith("[") ? body : null;
}

export interface JsonTask<T> {
  system: string;
  user: string;
  /** O que o Gemini recebe como `responseSchema` (ajuda, não garantia). */
  jsonSchema: JsonSchema;
  /** O que de fato vale: Zod rígido (campos desconhecidos recusados, tetos de tamanho). */
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}

/** Uma chamada, uma validação. Resposta fora do contrato: `AiError("invalid_output")`. Sem nova tentativa por conteúdo. */
export async function completeJson<T>(task: JsonTask<T>): Promise<T> {
  // Uma única nova tentativa no total, para rede, 5xx OU JSON/envelope fora do contrato (nunca em laço: a cota do dia é pequena).
  // Resposta vazia ou cortada por max tokens falha direto em `invalid_output` (o provedor já a recusa), sem nova tentativa.
  const budget = { left: 1 };
  for (;;) {
    const raw = await withKey(PROVIDER, (key) =>
      generate(key, { system: task.system, user: task.user, schema: task.jsonSchema, budget, ...(task.signal ? { signal: task.signal } : {}) }),
    );
    const parsed = parse(raw, task.schema);
    if (parsed.ok) return parsed.value;
    if (budget.left <= 0) throw new AiError("invalid_output");
    budget.left -= 1;
  }
}

function parse<T>(raw: string, schema: z.ZodType<T>): { ok: true; value: T } | { ok: false } {
  const body = extractJson(raw);
  if (body === null) return { ok: false };
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return { ok: false };
  }
  const result = schema.safeParse(value);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

/** "Testar a key": uma chamada mínima. Resolve se a key funcionou; lança AiError com o motivo. */
export async function pingKey(signal?: AbortSignal): Promise<void> {
  await withKey(PROVIDER, (key) =>
    generate(key, { system: "Reply with OK.", user: "ping", schema: { type: "object" }, ping: true, ...(signal ? { signal } : {}) }),
  );
}
