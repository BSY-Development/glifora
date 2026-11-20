// W1-16 — importação hostil (porta de dado hostil até a fábrica de cenários chegar). Dono: QA Tester.
// Os arquivos ficam em tests/payloads/imports.json (dados). Para cada um: nada executa, nada fica pela metade,
// o erro é claro (alerta com detalhes) e o app segue usável (rotas abrem, sem erro de página, sem pedido para fora).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" });

interface Case {
  id: string;
  expect: "refuse" | "accept" | "either";
  finding?: string;
  raw: string;
}
const payloads = JSON.parse(readFileSync("tests/payloads/imports.json", "utf8")) as { head: string; cases: Case[] };

function build(raw: string): string {
  return raw
    .replaceAll("$HEAD", payloads.head)
    .replaceAll(/\$NOW\+(\d+)h/g, (_m, h: string) => String(Date.now() + Number(h) * 3_600_000))
    .replaceAll("$ID121", "i".repeat(121))
    .replaceAll("$A41", "a".repeat(41))
    .replaceAll("$N31", "n".repeat(31))
    .replaceAll("$N30", "n".repeat(30));
}

/** Observa erro de página, erro no console e pedido para fora. */
function watch(page: Page) {
  const problems: string[] = [];
  const foreign: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
  });
  page.on("dialog", (d) => {
    problems.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol !== "data:" && u.protocol !== "blob:" && u.hostname !== "localhost") foreign.push(r.url());
  });
  return { problems, foreign };
}

async function start(page: Page, nickname = "Ana") {
  await page.goto("/welcome");
  await page.getByLabel("Apelido (opcional)").fill(nickname);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export type Outcome = { kind: "alert" | "status"; text: string };

async function importText(page: Page, content: string | Buffer, name = "x.json"): Promise<Outcome> {
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "application/json",
    buffer: typeof content === "string" ? Buffer.from(content) : content,
  });
  const alert = page.locator('.notice[role="alert"]');
  const status = page.locator('.notice[role="status"]');
  await expect(alert.or(status).first()).toBeVisible({ timeout: 30_000 });
  const isAlert = (await alert.count()) > 0;
  return { kind: isAlert ? "alert" : "status", text: (await (isAlert ? alert : status).first().innerText()).trim() };
}

/** O app continua de pé: cada rota abre e tem conteúdo; nada de tela de erro. */
async function expectUsable(page: Page, label: string) {
  for (const route of ["/", "/profile", "/settings", "/place/bakery"]) {
    await page.goto(route);
    await expect(page.locator("main, #root").first(), `${label}: ${route}`).not.toBeEmpty();
    await expect(page.getByRole("heading", { level: 1 }).first(), `${label}: ${route} sem h1`).toBeVisible();
  }
}

for (const c of payloads.cases) {
  test(`${c.finding ? `${c.finding}: ` : ""}importação hostil: ${c.id}`, async ({ page }) => {
    const { problems, foreign } = watch(page);
    await start(page, "Ana");
    const out = await importText(page, build(c.raw));
    if (c.expect === "refuse") {
      expect(out.kind, `devia recusar: ${out.text}`).toBe("alert");
      await page.goto("/");
      await expect(page.getByText("Ana").first(), "perfil bom intacto").toBeVisible();
    }
    if (c.expect === "accept") expect(out.kind, out.text).toBe("status");
    const polluted = await page.evaluate(() => ({} as Record<string, unknown>)["polluted"]);
    expect(polluted, "poluição de protótipo").toBeUndefined();
    await expectUsable(page, c.id);
    expect(problems).toEqual([]);
    expect(foreign).toEqual([]);
  });
}
