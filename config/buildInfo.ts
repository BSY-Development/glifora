// Versão e commit mostrados em /about (W1-08). O Vite injeta os dois por `define` no build.
// Commit: GITHUB_SHA (no CI o checkout é raso, mas a variável existe), senão o git local, senão "dev".
import { execFileSync } from "node:child_process";

export const DEV_COMMIT = "dev";

export function shortCommit(value: string | undefined | null): string {
  const hash = (value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(hash) ? hash.slice(0, 7) : DEV_COMMIT;
}

function gitHead(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined; // sem git, ou fora de um repositório
  }
}

export function resolveCommit(env: Record<string, string | undefined> = process.env, git: () => string | undefined = gitHead): string {
  const fromCi = shortCommit(env["GITHUB_SHA"]);
  return fromCi !== DEV_COMMIT ? fromCi : shortCommit(git());
}

/** Valores para o `define` do Vite (strings já em JSON, como o Vite pede). */
export function buildDefines(version: string, commit: string = resolveCommit()): Record<string, string> {
  return { __APP_VERSION__: JSON.stringify(version), __APP_COMMIT__: JSON.stringify(commit) };
}

/** Conteúdo de `version.json` (W1-13): o mesmo commit do /about e nenhuma data, para o build ser reprodutível. */
export function versionJson(version: string, commit: string): string {
  return `${JSON.stringify({ version, commit }, null, 2)}
`;
}
