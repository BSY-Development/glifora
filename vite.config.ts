import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildDefines } from "./config/buildInfo.ts";
import { previewHeaders } from "./config/headers.ts";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

// O preview aplica o bloco `/*` de public/_headers: a mesma CSP da produção (W0-03 §2.8). O `dev` roda sem CSP.
// PWA entra na W1-12.
export default defineConfig({
  plugins: [react()],
  // __APP_VERSION__ e __APP_COMMIT__ (tela /about); o commit vem do GITHUB_SHA ou do git, senão "dev".
  define: buildDefines(pkg.version),
  build: {
    // CSP sem `data:` em img/font: nenhum ativo vira data URI (W0-03 §2.8).
    assetsInlineLimit: 0,
  },
  preview: {
    headers: previewHeaders(readFileSync("public/_headers", "utf8")),
  },
});
