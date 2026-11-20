// W1-16 — apelido hostil, pela tela (/welcome e /profile). Dono: QA Tester. Payloads em tests/payloads/nicknames.json.
// refuse: tem de ser recusado com mensagem. accept: guardado literal e inofensivo. suspect: invisíveis/bidi que o filtro
// deixa passar (achado F-W1-16-01/02): corrigidos na W1-17: agora são testes normais (têm de ser recusados).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" });

const payloads = JSON.parse(readFileSync("tests/payloads/nicknames.json", "utf8")) as {
  refuse: Record<string, string>;
  suspect: Record<string, string>;
  accept: Record<string, string>;
};

/** ids do relatório: F-W1-16-01 = marcas bidi (LRM, RLM, ALM); F-W1-16-02 = invisíveis (largura zero, separadores, tags). */
const SUSPECT_FINDING: Record<string, string> = {
  lrm: "F-W1-16-01",
  rlm: "F-W1-16-01",
  alm: "F-W1-16-01",
  zwsp: "F-W1-16-02",
  "zwj-solo": "F-W1-16-02",
  bom: "F-W1-16-02",
  "line-sep": "F-W1-16-02",
  "para-sep": "F-W1-16-02",
  "word-joiner": "F-W1-16-02",
  "so-invisiveis": "F-W1-16-02",
  "tag-chars": "F-W1-16-02",
  interlinear: "F-W1-16-02",
};

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("dialog", (d) => {
    problems.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  return problems;
}

async function welcomeWith(page: Page, nickname: string) {
  await page.goto("/welcome");
  await page.getByLabel("Apelido (opcional)").fill(nickname);
  await page.getByRole("button", { name: "Começar" }).click();
}

async function profileSave(page: Page, nickname: string) {
  await page.goto("/profile");
  await page.getByLabel(/Apelido/).first().fill(nickname);
  await page.getByRole("button", { name: "Salvar apelido" }).click();
}

for (const [id, text] of Object.entries(payloads.refuse)) {
  test(`apelido recusado na /welcome e no /profile: ${id}`, async ({ page }) => {
    const problems = watch(page);
    await welcomeWith(page, text);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/welcome$/);
    // o campo tem maxLength de 60 (UTF-16): "tamanho-31" ainda entra e é a conferência por caractere que recusa
    await welcomeWith(page, "Ana");
    await expect(page).toHaveURL(/\/$/);
    await profileSave(page, text);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Olá, Ana!")).toBeVisible();
    expect(problems).toEqual([]);
  });
}

for (const [id, text] of Object.entries(payloads.suspect)) {
  const finding = SUSPECT_FINDING[id] ?? "F-W1-16-02";
  test(`${finding}: apelido com ${id} é recusado`, async ({ page }) => {
    await welcomeWith(page, `A${text}`);
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 3000 });
  });
}

for (const [id, text] of Object.entries(payloads.accept)) {
  test(`apelido estranho mas legítimo fica literal e inofensivo: ${id}`, async ({ page }) => {
    const problems = watch(page);
    await welcomeWith(page, text);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`Olá, ${text}!`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)["__pwned"])).toBeUndefined();
    expect(await page.locator("main img, main script, main style, main a[href^='javascript']").count()).toBe(0);
    expect(await page.title()).not.toContain(text.slice(0, 5)); // o título da aba não leva o apelido
    expect(await page.evaluate(() => ({} as Record<string, unknown>)["polluted"])).toBeUndefined();
    await page.goto("/profile");
    await expect(page.getByLabel(/Apelido/).first()).toHaveValue(text);
    expect(problems).toEqual([]);
  });
}

test("borda dos 30 caracteres: 30 passa; 31 é recusado ou cortado em 30 (emoji e combinantes contam por ponto de código)", async ({ page }) => {
  const cases = ["x".repeat(30), "x".repeat(31), "😀".repeat(30), "😀".repeat(31), "é".repeat(15), "é".repeat(16)];
  for (const text of cases) {
    await page.goto("/welcome");
    await page.getByLabel("Apelido (opcional)").fill(text);
    await page.getByRole("button", { name: "Começar" }).click();
    const refused = await page.getByRole("alert").first().isVisible();
    if (!refused) {
      await expect(page).toHaveURL(/\/$/);
      // maxLength=60 (UTF-16) corta antes do app ver: o que ficou guardado nunca passa de 30 pontos de código
      await page.goto("/profile");
      const stored = await page.getByLabel(/Apelido/).first().inputValue();
      expect(Array.from(stored).length, JSON.stringify(text)).toBeLessThanOrEqual(30);
      await page.goto("/settings");
      await page.getByRole("button", { name: /Apagar os dados/ }).click();
      await page.getByRole("button", { name: /Sim, apagar tudo/ }).click();
      await expect(page).toHaveURL(/\/(welcome)?$/);
    }
    if (text === "x".repeat(31)) expect(refused, "31 caracteres comuns").toBe(true);
  }
});

test("texto gigante colado no campo: o campo trava em 60 e nada quebra", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/welcome");
  const field = page.getByLabel("Apelido (opcional)");
  await field.evaluate((el: HTMLInputElement) => {
    el.focus();
  });
  await field.fill("x".repeat(5_000_000));
  expect((await field.inputValue()).length).toBeLessThanOrEqual(60);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("apelido largo (WWW…, combinantes empilhados) não cria rolagem lateral em 360px nem na Home nem no perfil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const wide = "W".repeat(30);
  await welcomeWith(page, wide);
  for (const route of ["/", "/profile"]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} com apelido largo`).toBeLessThanOrEqual(0);
  }
  await profileSave(page, "a" + "́̂̃̄̅̆̇̈".repeat(3) + "b");
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
