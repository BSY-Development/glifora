// Versão e commit do build (injetados pelo Vite; ver config/buildInfo.ts). Sem git: "dev".
export function getAppInfo(): { version: string; commit: string } {
  return { version: __APP_VERSION__, commit: __APP_COMMIT__ };
}
