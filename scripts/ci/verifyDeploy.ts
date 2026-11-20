// Lógica pura da conferência pós-deploy (W1-13; W0-03 §7 "CSP — produção"). O script que roda no CI é verify-deploy.ts.
import { previewHeaders } from "../../config/headers.ts";

export interface HeaderMismatch {
  name: string;
  expected: string;
  actual: string | null;
}

/** Cada cabeçalho do bloco `/*` do _headers tem de chegar com o valor exato. Cabeçalho a mais (do Cloudflare) não é erro. */
export function compareHeaders(headersFileText: string, received: Headers): HeaderMismatch[] {
  const mismatches: HeaderMismatch[] = [];
  for (const [name, expected] of Object.entries(previewHeaders(headersFileText))) {
    const actual = received.get(name);
    if (actual === null || actual.trim() !== expected) mismatches.push({ name, expected, actual });
  }
  return mismatches;
}

export function describeMismatches(mismatches: readonly HeaderMismatch[]): string {
  return mismatches
    .map((m) => `  ${m.name}\n    esperado: ${m.expected}\n    recebido: ${m.actual ?? "(ausente)"}`)
    .join("\n");
}

/** `version.json` tem de trazer o commit desta rodada. Devolve o problema, ou `null` se está certo. */
export function checkVersion(body: unknown, expectedCommit: string): string | null {
  if (typeof body !== "object" || body === null) return "version.json não é um objeto";
  const commit = (body as Record<string, unknown>)["commit"];
  return commit === expectedCommit ? null : `commit em version.json: ${JSON.stringify(commit)}; esperado: ${expectedCommit}`;
}
