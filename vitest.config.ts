import { defineConfig } from "vitest/config";

// Unidade ao lado do código (src/**) e guardas do Revisor (tests/**). O e2e roda no Playwright, fora daqui.
// Ambiente `node` por padrão; teste de componente pede jsdom com `// @vitest-environment jsdom` na primeira linha.
export default defineConfig({
  // Mesmos nomes que o vite.config.ts injeta no build (tela /about).
  define: { __APP_VERSION__: JSON.stringify("0.0.0-test"), __APP_COMMIT__: JSON.stringify("testing") },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts", "config/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    environment: "node",
  },
});
