// Erros da IA (D-56). A mensagem do erro é só o tipo: nunca texto vindo do servidor nem da pessoa, e jamais a key.

/**
 * `auth`: key inválida, revogada ou vencida · `quota`: cota grátis do dia esgotada · `credits`: créditos ou cobrança ·
 * `model`: modelo indisponível · `region`: região não atendida · `network`: sem rede · `timeout` · `refused`: a IA recusou ·
 * `invalid_output`: resposta fora do contrato · `server`: erro do provedor · `no_key` · `aborted` · `unknown`.
 */
export type AiErrorKind = "auth" | "quota" | "credits" | "model" | "region" | "network" | "timeout" | "refused" | "invalid_output" | "server" | "no_key" | "aborted" | "unknown";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  /** Status HTTP, quando o erro veio de uma resposta. */
  readonly status: number | undefined;
  /** Só no erro desconhecido: a mensagem do provedor, já limpa e sem a key, para a pessoa copiar e mostrar a quem ajuda. */
  readonly detail: string | undefined;
  constructor(kind: AiErrorKind, extra: { status?: number; detail?: string } = {}) {
    super(`ai:${kind}`); // a mensagem é só o tipo: nunca texto do servidor nem a key
    this.name = "AiError";
    this.kind = kind;
    this.status = extra.status;
    this.detail = extra.detail;
  }
}

export function isAiError(value: unknown): value is AiError {
  return value instanceof AiError;
}

/** Qualquer coisa que tenha dado errado vira um AiError (nunca repassa a mensagem original). */
export function toAiError(value: unknown): AiError {
  return value instanceof AiError ? value : new AiError("unknown");
}
