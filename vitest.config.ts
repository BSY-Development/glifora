import { defineConfig } from "vitest/config";

// Unidade ao lado do código (src/**) e guardas do Revisor (tests/**). O e2e roda no Playwright, fora daqui.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    environment: "node",
  },
});
