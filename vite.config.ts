import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { buildDefines, resolveCommit, versionJson } from "./config/buildInfo.ts";
import { previewHeaders } from "./config/headers.ts";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const commit = resolveCommit();

// O preview aplica o bloco `/*` de public/_headers: a mesma CSP da produção (W0-03 §2.8). O `dev` roda sem CSP.
// PWA (W1-12): service worker gerado no build; o registro é escrito à mão (src/sw-register.ts). Nada de SW no `dev`.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt", // versão nova espera; quem ativa é o sw-register (ao abrir) ou o botão do aviso
      injectRegister: false, // o virtual:pwa-register passaria uma string ao register(): o Trusted Types barra
      manifestFilename: "manifest.webmanifest",
      manifest: {
        id: "/",
        name: "Glifora",
        short_name: "Glifora",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "pt-BR",
        theme_color: "#fbf7ef",
        background_color: "#fbf7ef",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        inlineWorkboxRuntime: true, // sem importScripts: o worker é um arquivo só
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"], // app, textos (no bundle) e arte
        globIgnores: ["version.json"], // o deploy confere o commit publicado: tem de ir sempre à rede
        runtimeCaching: [], // o SW não toca em nada de outra origem
      },
      devOptions: { enabled: false },
    }),
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
