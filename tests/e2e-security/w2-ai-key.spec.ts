// W2-24 (alvo 1 e 6): a key só vai ao Gemini, só no cabeçalho, e não aparece em nenhum outro lugar. Dono: QA Tester.
// Só keys falsas e Gemini simulado (page.route). Nenhuma chamada real.
import { expect, test, type Page } from "@playwright/test";
import { FAKE_KEY, FAKE_KEY_2, GEMINI_HOST, TURNS, aiSection, dumpStorage, gemini, mockGemini, reportWithKey, review, reviewButton, saveKeyUi } from "./support/ai";
import { onboard, watch } from "./support/w2";
import { installSpeech } from "../e2e/support/speech";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const ok = () => ({ json: gemini(JSON.stringify(review(TURNS))) });
const consoleText = (page: Page) => {
  const lines: string[] = [];
  page.on("console", (m) => lines.push(m.text()));
  page.on("pageerror", (e) => lines.push(e.message));
  return lines;
};

test.describe("a key só vai ao Gemini", () => {
  test("revisão feliz: cabeçalho certo, nada na URL, no corpo ou em outro host, e sem Referer", async ({ page }) => {
    const mock = await mockGemini(page, ok);
    const logs = consoleText(page);
    const problems = watch(page);
    const hosts: string[] = [];
    page.on("request", (r) => hosts.push(new URL(r.url()).host));
    await reportWithKey(page);
    await reviewButton(page).click();
    await expect(aiSection(page).getByText("A more natural way").first()).toBeVisible();
    expect(mock.calls).toHaveLength(1);
    const seen = mock.calls[0]!;
    expect(seen.headers["x-goog-api-key"]).toBe(FAKE_KEY);
    expect(seen.url).not.toContain("key");
    expect(seen.url).not.toContain("AIza");
    expect(seen.body).not.toContain(FAKE_KEY);
    expect(seen.user + seen.system).not.toContain("AIza");
    expect(seen.headers["referer"], "Referer vazou").toBeUndefined();
    expect(seen.headers["origin"] ?? "").not.toContain("AIza");
    expect(mock.other, "pedido a outro host").toEqual([]);
    expect(new Set(hosts.filter((h) => !h.startsWith("localhost")))).toEqual(new Set([GEMINI_HOST]));
    expect(logs.join("\n")).not.toContain(FAKE_KEY);
    expect(page.url()).not.toContain("AIza");
    expect(problems).toEqual([]);
  });

  test("a key não está no Dexie, na exportação, nos caches nem na URL; no aparelho só na entrada glifora.key.v1.gemini", async ({ page }) => {
    await mockGemini(page, ok);
    await reportWithKey(page);
    await reviewButton(page).click();
    await expect(aiSection(page).getByText("A more natural way").first()).toBeVisible();
    const dump = await dumpStorage(page);
    const keyLine = dump.split("\n").filter((l) => l.includes(FAKE_KEY));
    expect(keyLine, "só o localStorage tem a key").toHaveLength(1);
    expect(keyLine[0]).toContain("glifora.key.v1.gemini");
    const holders = await page.evaluate(() => Object.keys(localStorage).filter((k) => (localStorage.getItem(k) ?? "").includes("AIza")));
    expect(holders).toEqual(["glifora.key.v1.gemini"]);
    // exportação
    await page.goto("/settings");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export my progress" }).click()]);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const file = readFileSync(path, "utf8");
    expect(file).not.toContain("AIza");
    expect(file).not.toContain(FAKE_KEY.slice(-8));
    expect(file).not.toContain("review");
  });

  test("'Só nesta sessão': nada em localStorage/sessionStorage e a key some ao recarregar", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await saveKeyUi(page, FAKE_KEY, "session");
    const dump = await dumpStorage(page);
    expect(dump).not.toContain("AIza");
    await expect(page.getByText("Saved key: ••••" + FAKE_KEY.slice(-4))).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Saved key/)).toHaveCount(0);
    expect(await dumpStorage(page)).not.toContain("AIza");
  });

  test("trocar de 'neste aparelho' para 'só nesta sessão' apaga a cópia do aparelho", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await saveKeyUi(page, FAKE_KEY, "device");
    expect(await dumpStorage(page)).toContain(FAKE_KEY);
    await saveKeyUi(page, FAKE_KEY_2, "session");
    const dump = await dumpStorage(page);
    expect(dump).not.toContain(FAKE_KEY);
    expect(dump).not.toContain(FAKE_KEY_2);
  });

  test("'Apagar minha key' limpa tudo: memória, aparelho, último problema, e o próximo pedido nem sai", async ({ page }) => {
    const mock = await mockGemini(page, () => ({ status: 401, json: { error: { code: 401, status: "UNAUTHENTICATED", message: "bad" } } }));
    await reportWithKey(page);
    await reviewButton(page).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("glifora.ai.last.v1"))).not.toBeNull();
    await page.goto("/settings/ai");
    await page.getByRole("button", { name: "Delete my key" }).click();
    await expect(page.getByText("Key deleted.")).toBeVisible();
    const dump = await dumpStorage(page);
    expect(dump).not.toContain("AIza");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("glifora.key")))).toEqual([]);
    await page.reload();
    await expect(page.getByText(/Saved key/)).toHaveCount(0);
    expect(mock.calls, "o 401 não tem nova tentativa").toHaveLength(1);
    await page.goBack();
    await expect(page.getByRole("link", { name: /Set up your free key/ })).toBeVisible();
    await expect(reviewButton(page)).toHaveCount(0);
  });
});

test.describe("a key nos erros", () => {
  const echo = (message: string) => ({ status: 418, json: { error: { code: 418, status: "I_AM_A_TEAPOT", message } } });

  test("erro desconhecido que ecoa a key: 'Detalhe', 'Último problema', localStorage e Copiar relatório sem a key", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockGemini(page, () => echo(`Request had key ${FAKE_KEY} and failed; again ${FAKE_KEY}.`));
    const logs = consoleText(page);
    await reportWithKey(page);
    await reviewButton(page).click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Detail:");
    expect(await alert.innerText()).not.toContain(FAKE_KEY);
    expect(await alert.innerText()).toContain("[key]");
    expect(await page.evaluate(() => localStorage.getItem("glifora.ai.last.v1"))).not.toContain("AIza");
    await page.getByRole("button", { name: "Copy report" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).not.toContain("AIza");
    await page.goto("/settings/ai");
    expect(await page.locator("main, body").first().innerText()).not.toContain(FAKE_KEY);
    expect(logs.join("\n")).not.toContain(FAKE_KEY);
    const holders = (await dumpStorage(page)).split(String.fromCharCode(10)).filter((l) => l.includes(FAKE_KEY));
    expect(holders, "a key só no cofre").toHaveLength(1);
    expect(holders[0]).toContain("glifora.key.v1.gemini");
  });

  test("F-W2-24-01 (baixo): o Google ecoa a key só em parte ou em minúsculas: o 'Detalhe' não pode trazer pedaço dela", async ({ page }) => {
    await mockGemini(page, () => echo(`bad key ${FAKE_KEY.slice(0, 30)} / ${FAKE_KEY.toLowerCase()}`));
    await reportWithKey(page);
    await reviewButton(page).click();
    const text = await page.getByRole("alert").first().innerText();
    expect(text).not.toContain(FAKE_KEY.slice(0, 20));
    expect(text.toLowerCase()).not.toContain(FAKE_KEY.toLowerCase().slice(0, 20));
  });

  test("todos os erros HTTP: nenhuma mensagem, console ou storage traz a key", async ({ page }) => {
    let status = 400;
    await mockGemini(page, () => ({ status, json: { error: { code: status, message: `key=${FAKE_KEY} ${status}` } } }));
    const logs = consoleText(page);
    await reportWithKey(page);
    for (const s of [400, 401, 403, 404, 429, 500, 503]) {
      status = s;
      await reviewButton(page).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(await page.getByRole("alert").first().innerText()).not.toContain("AIza");
      await expect(page.getByRole("status").filter({ hasText: "reading" })).toHaveCount(0);
    }
    expect(logs.join("\n")).not.toContain("AIza");
    expect(await page.evaluate(() => localStorage.getItem("glifora.ai.last.v1") ?? "")).not.toContain("AIza");
  });
});
