// W2-24 (alvo 6): a tela Ajustes > IA (opcional): campo, máscara, "Testar a key", armazenamento adulterado, a11y em 360x640. Dono: QA Tester.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installSpeech } from "../e2e/support/speech";
import { FAKE_KEY, dumpStorage, gemini, mockGemini, saveKeyUi } from "./support/ai";
import { onboard, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const field = (page: import("@playwright/test").Page) => page.locator("#ai-key-field");
async function open(page: import("@playwright/test").Page) {
  await installSpeech(page, "ok", { consent: true });
  await onboard(page);
  await page.goto("/settings/ai");
}

test("campo de senha, não controlado, autocomplete desligado e limpo ao salvar (com sucesso ou recusa)", async ({ page }) => {
  await open(page);
  const f = field(page);
  expect(await f.getAttribute("type")).toBe("password");
  expect(await f.getAttribute("autocomplete")).toBe("off");
  expect(await f.getAttribute("spellcheck")).toBe("false");
  expect(await f.getAttribute("value"), "valor como atributo").toBeNull();
  await f.fill("curta");
  await page.getByRole("button", { name: "Save the key" }).click();
  await expect(page.getByText("That key does not look right")).toBeVisible();
  expect(await f.inputValue()).toBe("");
  await f.fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save the key" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Key saved." })).toBeVisible();
  expect(await f.inputValue()).toBe("");
  expect(await f.getAttribute("value")).toBeNull();
  // a key não está em nenhum atributo nem texto da página
  const html = await page.content();
  expect(html).not.toContain(FAKE_KEY);
  expect(html).not.toContain(FAKE_KEY.slice(4, 20));
});

test("a key mascarada mostra só os 4 últimos e o resto da key não está em lugar nenhum da tela", async ({ page }) => {
  await open(page);
  await saveKeyUi(page, FAKE_KEY, "session");
  const body = await page.locator("body").innerText();
  expect(body).toContain(`Saved key: ••••${FAKE_KEY.slice(-4)}`);
  expect(body).not.toContain(FAKE_KEY.slice(-8));
  expect(body).not.toContain("AIza");
  expect(await page.evaluate(() => document.title)).not.toContain("AIza");
});

test("espaços e quebras de linha colados são tirados (key do dono, 2026-11-20); <script>, cabeçalho forjado, símbolo, bidi, NUL e 100 mil caracteres são recusados e o campo esvazia", async ({ page }) => {
  const problems = watch(page);
  await open(page);
  const mock = await mockGemini(page, () => ({ json: gemini("OK") }));
  const f = field(page);
  for (const bad of ["AIza+Sy-qa_fake0Sy-qa_fake0Sy-qa", "<script>alert(1)</script>AAAAAAAAAAAA", `${FAKE_KEY}\r\nX-Evil: 1`, "A".repeat(100_000), "AIza‮Sy-qa_fake0Sy-qa_fake0Sy", `${FAKE_KEY}\u0000`]) {
    await f.fill(bad);
    await page.getByRole("button", { name: "Save the key" }).click();
    await expect(page.getByText("That key does not look right")).toBeVisible();
    expect(await f.inputValue()).toBe("");
    await expect(page.getByText(/Saved key/)).toHaveCount(0);
  }
  await f.fill(`   ${FAKE_KEY.slice(0, 12)} ${FAKE_KEY.slice(12)}  `);
  await page.getByRole("button", { name: "Save the key" }).click();
  await expect(page.getByText(`Saved key: ••••${FAKE_KEY.slice(-4)}`)).toBeVisible();
  expect(mock.calls).toHaveLength(0);
  expect(problems).toEqual([]);
});

test("'Testar a key' com key falsa: 1 chamada mínima, key só no cabeçalho, mensagem clara; 401 e 200", async ({ page }) => {
  await open(page);
  let status = 200;
  const mock = await mockGemini(page, () => (status === 200 ? { json: gemini("OK") } : { status, json: { error: { code: status, status: "UNAUTHENTICATED", message: "nope" } } }));
  await saveKeyUi(page, FAKE_KEY, "session");
  await page.getByRole("button", { name: "Test the key" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The key works." })).toBeVisible();
  expect(mock.calls).toHaveLength(1);
  const sent = mock.calls[0]!;
  expect(sent.headers["x-goog-api-key"]).toBe(FAKE_KEY);
  expect(sent.url).not.toContain("AIza");
  expect(JSON.parse(sent.body).generationConfig.maxOutputTokens).toBe(16);
  expect(sent.user).toBe("ping");
  status = 401;
  await page.getByRole("button", { name: "Test the key" }).click();
  await expect(page.getByRole("alert")).toContainText("The key was not accepted");
  expect(mock.calls).toHaveLength(2);
  await expect(page.getByRole("heading", { name: "Last problem" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("AIza");
});

test("'Testar a key' tocado várias vezes seguidas: o botão fica desligado, 1 chamada por vez", async ({ page }) => {
  await open(page);
  const mock = await mockGemini(page, () => ({ json: gemini("OK"), delayMs: 600 }));
  await saveKeyUi(page, FAKE_KEY, "session");
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Test the key/.test(x.textContent ?? ""))!;
    for (let i = 0; i < 15; i += 1) b.click();
  });
  await expect(page.getByRole("status").filter({ hasText: "The key works." })).toBeVisible();
  expect(mock.calls).toHaveLength(1);
});

test("armazenamento adulterado: key guardada com lixo, cabeçalho forjado ou HTML é ignorada; 'último problema' hostil vira só texto", async ({ page }) => {
  const problems = watch(page);
  await open(page);
  const mock = await mockGemini(page, () => ({ json: gemini("OK") }));
  const evil = [`${FAKE_KEY}\r\nX-Evil: 1`, "<script>alert(1)</script>", "x".repeat(10_000), "short", `${FAKE_KEY}\n`, "[object Object]"];
  for (const value of evil) {
    await page.evaluate((v) => localStorage.setItem("glifora.key.v1.gemini", v), value);
    await page.reload();
    await expect(page.getByText(/Saved key/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Test the key" })).toHaveCount(0);
  }
  await page.evaluate(() => localStorage.removeItem("glifora.key.v1.gemini"));
  const last = [
    { kind: "unknown", at: Date.now(), detail: "<img src=x onerror=alert(1)><script>alert(2)</script>‮ hi" },
    { kind: "__proto__", at: 1 },
    { kind: "auth", at: "x" },
    { kind: "unknown", at: Date.now(), detail: "d".repeat(50_000) },
    [1, 2, 3],
  ];
  for (const row of last) {
    await page.evaluate((v) => localStorage.setItem("glifora.ai.last.v1", JSON.stringify(v)), row);
    await page.reload();
    expect(await page.locator("main").locator("img, script").count()).toBe(0);
    expect((await page.locator("main").innerText()).length).toBeLessThan(6000);
  }
  await page.evaluate(() => localStorage.setItem("glifora.ai.last.v1", "{not json"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "AI (optional)" })).toBeVisible();
  expect(mock.calls).toHaveLength(0);
  expect(problems).toEqual([]);
});

test("a11y e 360x640: sem violações do axe, sem rolagem horizontal, rótulo e dica ligados ao campo, estado em região de status", async ({ page }) => {
  await open(page);
  await saveKeyUi(page, FAKE_KEY, "session");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Paste your Google (Gemini) key")).toBeVisible();
  expect(await field(page).getAttribute("aria-describedby")).toBe("ai-key-hint");
  await expect(page.getByRole("status").first()).toBeAttached();
});

test("depois de tudo, sem key: nada de key em storage, URL ou título", async ({ page }) => {
  await open(page);
  await saveKeyUi(page, FAKE_KEY, "session");
  expect(await dumpStorage(page)).not.toContain("AIza");
  expect(page.url()).not.toContain("AIza");
});
