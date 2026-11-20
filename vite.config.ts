import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildDefines, resolveCommit, versionJson } from "./config/buildInfo.ts";
import { previewHeaders } from "./config/headers.ts";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const commit = resolveCommit();

// O preview aplica o bloco `/*` de public/_headers: a mesma CSP da produção (W0-03 §2.8). O `dev` roda sem CSP.
// PWA entra na W1-12.
export default defineConfig({
  plugins: [
    react(),
    {
      // dist/version.json: o deploy confere na URL real que o commit publicado é o desta rodada (scripts/ci/verify-deploy.ts).
      name: "glifora-version-json",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: versionJson(pkg.version, commit) });
      },
    },
  ],
  // __APP_VERSION__ e __APP_COMMIT__ (tela /about); o commit vem do GITHUB_SHA ou do git, senão "dev".
  define: buildDefines(pkg.version, commit),
  build: {
    // CSP sem `data:` em img/font: nenhum ativo vira data URI (W0-03 §2.8).
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // O zod e o z.config({ jitless }) (src/zod-config.ts) ficam no MESMO bloco. Sem isto o empacotador pode pôr o zod
        // junto dos schemas do app, que seriam construídos antes do jitless: o zod tentaria `new Function`, a CSP
        // barraria e o console mostraria erro de TrustedScript.
        codeSplitting: {
          groups: [{ name: "zod", test: /[/\\]node_modules[/\\]zod[/\\]|[/\\]src[/\\]zod-config\.ts$/ }],
        },
      },
    },
  },
  preview: {
    headers: previewHeaders(readFileSync("public/_headers", "utf8")),
  },
});
