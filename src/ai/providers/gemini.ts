// Adaptador do Gemini (Google AI Studio), direto do navegador (D-56; W0-03 §2.6).
// A key vai no cabeçalho `x-goog-api-key`, nunca na URL. Origem e modelo são constantes (sem "URL personalizada").
// Conferido em ai.google.dev: o endpoint responde ao preflight CORS com `x-goog-api-key` e `content-type` permitidos.
import { AiError, type AiErrorKind } from "../errors";

/** Prefixo exato que está no `connect-src` de public/_headers (o teste confere os dois). */
export const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/v1beta/models/";
/** O modelo num lugar só: Flash estável com cota grátis (ai.google.dev/gemini-api/docs/pricing). Trocar aqui. */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
/** Raciocínio mínimo: é o padrão do flash-lite e poupa saída (o raciocínio é cobrado como saída). O 3.8-flash não aceita "minimal". */
export const GEMINI_THINKING = "minimal";

const TIMEOUT_MS = 30_000;
const RETRY_WAIT_MS = 800;
const MAX_OUTPUT_TOKENS = 2048;
const MAX_BODY_CHARS = 200_000;

/** O pedaço de JSON Schema que o Gemini aceita em `responseSchema`. */
export interface JsonSchema {
  type: "object" | "array" | "string" | "integer" | "boolean" | "number";
  description?: string;
  enum?: readonly string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  maxItems?: number;
  minItems?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  propertyOrdering?: readonly string[];
}

export interface GeminiRequest {
  system: string;
  user: string;
  schema: JsonSchema;
  signal?: AbortSignal;
  /** Quantas novas tentativas ainda restam nesta tarefa (compartilhado com o structured.ts): no máximo 1, nunca em laço. */
  budget?: { left: number };
  /** Teste da key: resposta curta, sem JSON estruturado. */
  ping?: boolean;
  /** Sem `thinkingConfig`: a nova tentativa depois de um 400 que pode ser o `thinkingLevel` que o modelo não aceita. */
  noThinking?: boolean;
}

interface ErrorBody {
  error?: { code?: unknown; status?: unknown; message?: unknown; details?: unknown };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function reasonOf(body: ErrorBody): string {
  const details = body.error?.details;
  if (!Array.isArray(details)) return "";
  for (const detail of details) {
    if (typeof detail === "object" && detail !== null && "reason" in detail) return asString((detail as { reason: unknown }).reason);
  }
  return "";
}

/**
 * Converte a resposta de erro no tipo do aplicativo. Olha o status HTTP e `error.status`/`reason` do corpo
 * (códigos de ai.google.dev/gemini-api/docs/troubleshooting). Nunca devolve texto do servidor.
 */
export function classifyHttpError(status: number, body: unknown): AiErrorKind {
  const parsed: ErrorBody = typeof body === "object" && body !== null ? (body as ErrorBody) : {};
  const state = asString(parsed.error?.status).toUpperCase();
  const reason = reasonOf(parsed).toUpperCase();
  const message = asString(parsed.error?.message).toLowerCase();
  const says = (re: RegExp) => re.test(message);

  if (says(/location is not supported|not available in your (country|region)|user location/)) return "region";
  // O 429 padrão traz "check your plan and billing details": a cota grátis esgotada NÃO é falta de crédito.
  // No 429 só vira `credits` se a mensagem falar de créditos/prepay e não de cota.
  if (status === 429 || state === "RESOURCE_EXHAUSTED") return says(/prepay|credits? (are |is |have )?(exhausted|depleted|expired)/) && !says(/quota/) ? "credits" : "quota";
  if (status === 402 || says(/billing|outstanding balance|payment|credits? (are |is |have )?(exhausted|depleted|expired)|prepay/)) return "credits";
  if (status === 401 || state === "UNAUTHENTICATED" || reason === "API_KEY_INVALID" || reason === "API_KEY_EXPIRED" || says(/api key (not valid|expired|invalid)|leaked|revoked/)) return "auth";
  if (status === 403 || state === "PERMISSION_DENIED") return "auth";
  if (status === 404 || state === "NOT_FOUND") return "model";
  if (state === "FAILED_PRECONDITION") return "region";
  if (status >= 500) return "server";
  return "unknown";
}

/** Troca por [key] a key inteira (sem diferenciar maiúsculas) e qualquer trecho com cara de key do Google ('AIza' + 8 ou mais). */
export function scrubKey(text: string, key: string | null): string {
  let out = text;
  if (key) out = out.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[key]");
  return out.replace(/aiza[A-Za-z0-9_-]{8,}/gi, "[key]");
}

/** A mensagem do Google como texto puro de uma linha, até 200 caracteres, sem nenhum trecho parecido com a key. */
export function errorDetail(body: unknown, key: string): string | undefined {
  const message = typeof body === "object" && body !== null ? (body as ErrorBody).error?.message : undefined;
  if (typeof message !== "string") return undefined;
  const cleaned = scrubKey(message.normalize("NFC"), key)
    .replace(/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = Array.from(cleaned).slice(0, 200).join("").trim();
  return cut === "" ? undefined : cut;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (text.length > MAX_BODY_CHARS) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** O texto da 1ª resposta; recusa e bloqueio viram `refused`; o resto fora do formato, `invalid_output`. */
export function extractText(json: unknown, ping = false): string {
  if (typeof json !== "object" || json === null) throw new AiError("invalid_output");
  const root = json as { promptFeedback?: { blockReason?: unknown }; candidates?: unknown };
  if (root.promptFeedback?.blockReason !== undefined) throw new AiError("refused");
  const first: unknown = Array.isArray(root.candidates) ? root.candidates[0] : undefined;
  if (typeof first !== "object" || first === null) throw new AiError("refused");
  const candidate = first as { finishReason?: unknown; content?: { parts?: unknown } };
  const finish = asString(candidate.finishReason);
  if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(finish)) throw new AiError("refused");
  const parts = candidate.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: unknown) => (typeof p === "object" && p !== null ? asString((p as { text?: unknown }).text) : "")).join("") : "";
  if (ping) return text;
  if (finish === "MAX_TOKENS" || text.trim() === "") throw new AiError("invalid_output");
  return text;
}

async function once(key: string, req: GeminiRequest): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AiError("timeout")), TIMEOUT_MS);
  const onOuter = () => controller.abort(new AiError("aborted"));
  if (req.signal?.aborted) onOuter();
  req.signal?.addEventListener("abort", onOuter, { once: true });
  try {
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        ...(req.ping ? { maxOutputTokens: 16 } : { responseMimeType: "application/json", responseSchema: req.schema, maxOutputTokens: MAX_OUTPUT_TOKENS }),
        ...(req.noThinking ? {} : { thinkingConfig: { thinkingLevel: GEMINI_THINKING } }),
      },
    };
    let response: Response;
    try {
      response = await fetch(`${GEMINI_ORIGIN}${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
    } catch {
      const why: unknown = controller.signal.reason;
      throw why instanceof AiError ? why : new AiError("network");
    }
    const json = await readJson(response);
    // Estouro de tempo ou cancelamento durante a leitura do corpo: o erro é esse, não o corpo ilegível.
    const cut: unknown = controller.signal.aborted ? controller.signal.reason : null;
    if (cut instanceof AiError) throw cut;
    if (!response.ok) {
      const kind = classifyHttpError(response.status, json);
      const detail = kind === "unknown" ? errorDetail(json, key) : undefined;
      throw new AiError(kind, { status: response.status, ...(detail !== undefined ? { detail } : {}) });
    }
    return extractText(json, req.ping === true);
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener("abort", onOuter);
  }
}

/**
 * Uma chamada ao Gemini. No máximo 1 nova tentativa no total, nunca em laço, e só para:
 * erro de rede, 5xx, ou um 400 desconhecido (pode ser o `thinkingLevel` que o modelo não aceita: a nova tentativa vai sem `thinkingConfig`).
 * Devolve o texto (JSON) da resposta; quem valida é `structured.ts`.
 */
export async function generate(key: string, req: GeminiRequest): Promise<string> {
  const budget = req.budget ?? { left: 1 };
  let current = req;
  for (;;) {
    try {
      return await once(key, current);
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      const transient = error.kind === "network" || error.kind === "server";
      const thinkingRejected = error.kind === "unknown" && error.status === 400 && !current.noThinking;
      if ((!transient && !thinkingRejected) || budget.left <= 0) throw error;
      budget.left -= 1;
      if (thinkingRejected) current = { ...current, noThinking: true };
      else await wait(RETRY_WAIT_MS, req.signal);
      if (req.signal?.aborted) throw new AiError("aborted");
    }
  }
}
