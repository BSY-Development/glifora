// Playwright do Glifora (W1-04; W0-03 §7): Chromium com viewport de celular (Pixel 7) contra o `vite preview`,
// que aplica a CSP de public/_headers. Dono: Revisor. O job `e2e` do ci.yml roda `npx playwright test`.
import { defineConfig, devices } from "@playwright/test";

// A porta é fixa: alguns testes (e2e-security) citam a 4173. O servidor só é reaproveitado com PW_REUSE_SERVER=1:
// reaproveitar um `vite preview` esquecido serviu o build ANTIGO a uma rodada (2026-11-20, W2-19).
const PORT = 4173;

export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "a11y/**/*.spec.ts", "e2e-security/**/*.spec.ts"],
  fullyParallel: true,
  // Fora do CI, no máximo 3 workers: sem limite o Playwright usa metade das CPUs (8 Chromes numa máquina de 16),
  // e vários terminais rodando juntos travaram o PC do dono (2026-11-20). No CI o padrão do Playwright vale.
  workers: process.env["CI"] ? undefined : 3,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  // No CI, o reporter "github" vira annotations, que a API pública do GitHub mostra sem login (os logs pedem login).
  reporter: process.env["CI"] ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // PW_CHANNEL=chrome usa o Chrome instalado (sem baixar o Chromium do Playwright). No CI fica vazio.
    ...(process.env["PW_CHANNEL"] ? { channel: process.env["PW_CHANNEL"] } : {}),
  },
  projects: [{ name: "pixel-7", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: process.env["PW_REUSE_SERVER"] === "1" && !process.env["CI"],
    timeout: 120_000,
  },
});
