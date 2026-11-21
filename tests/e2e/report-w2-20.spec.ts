// W2-20 (D-55) — apelido com regra nova, relatório "O que você disse", "Copiar relatório", botões de "jogar de novo" por estrela
// e o cartão de missão em andamento na vila. Dono: Revisor. Interface em inglês (en-US), 360×640.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installSpeech } from "./support/speech";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, next, onboard, sessionAt, startMission, type, type ModeName } from "./support/play";
import { idbAll, idbPut } from "../e2e-security/support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const MARKER = /\{\s*\w+\s*\}/;

/** Joga a bakery-01 inteira por texto e abre o relatório. `own`: frase do fecho (null = seguir sem dizer). */
async function playAll(page: Page, mode: ModeName, own: string | null = CLOSING_OWN, replies: readonly string[] = BAKERY_REPLIES): Promise<void> {
  await startMission(page, mode);
  await answerAllByText(page, replies);
  if (own === null) {
    await type(page, "zzz");
    await type(page, "qqq");
    await page.getByRole("button", { name: "Move on without saying it" }).click();
  } else {
    await type(page, own);
  }
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page).toHaveURL(/\/report\//);
}

async function axe(page: Page, label: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" }); // sem a animação de entrada no meio do cálculo de contraste (como tests/a11y/play.spec.ts)
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  expect(r.violations.map((v) => `${v.impact}/${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `axe em ${label}`).toEqual([]);
}

test.describe("apelido (D-55)", () => {
  async function nick(page: Page, value: string): Promise<void> {
    await page.goto("/profile");
    await page.getByLabel(/^Nickname/).first().fill(value);
    await page.getByRole("button", { name: "Save nickname" }).click();
  }

  test("11 letras, número e emoji dão erro; José vale", async ({ page }) => {
    await onboard(page);
    await nick(page, "Abcdefghijk");
    await expect(page.getByRole("alert").filter({ hasText: "at most 10" })).toBeVisible();
    await nick(page, "Ana1");
    await expect(page.getByRole("alert").filter({ hasText: /only letters/ })).toBeVisible();
    await nick(page, "Ana😀");
    await expect(page.getByRole("alert").filter({ hasText: /only letters/ })).toBeVisible();
    await nick(page, "José");
    await expect(page.getByText("Nickname saved.")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("apelido antigo de 20 caracteres continua e salva sem erro se não for editado", async ({ page }) => {
    await onboard(page);
    const old = "Maria da Silva Souza"; // 20 caracteres
    const row = (await idbAll(page, "docs")).find((d) => d["id"] === "profile")!;
    await idbPut(page, "docs", { ...row, data: { ...(row["data"] as object), nickname: old }, updatedAt: Date.now() + 1000 });
    await page.goto("/profile");
    const field = page.getByLabel(/^Nickname/).first();
    await expect(field).toHaveValue(old);
    await page.getByRole("button", { name: "Save nickname" }).click();
    await expect(page.getByText("Nickname saved.")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await field.fill("Maria da Silva Sousa"); // editou (20 caracteres, o campo trava em 20): vale a regra nova
    await page.getByRole("button", { name: "Save nickname" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at most 10" })).toBeVisible();
  });
});

test.describe("relatório: o que você disse", () => {
  test("erro previsto: 'You said' + 'Correction'; só 'honey': 'Natural way'; sobrevive a recarregar; sem '{'", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, "Good morning!");
    await next(page);
    await type(page, "A roll of honey, please.");
    await next(page);
    await type(page, "Two, please.");
    await next(page);
    await type(page, "No, that's all, thanks.");
    await next(page);
    await type(page, "Here you go.");
    await next(page);
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    const said = page.getByRole("heading", { name: "What you said" }).locator("..");
    await expect(said.getByText("You said: “A roll of honey, please.”")).toBeVisible();
    await expect(said.getByText("Correction: “A honey roll”")).toBeVisible();
    await expect(said.locator("[lang=en]").first()).toBeVisible(); // texto em inglês leva lang
    await page.reload();
    await expect(page.getByText("You said: “A roll of honey, please.”")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(MARKER);
  });

  test("resposta só 'honey': 'Natural way'", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase", CLOSING_OWN, ["Good morning!", "honey", "Two, please.", "No, that's all, thanks.", "Here you go."]);
    await expect(page.getByText("You said: “honey”")).toBeVisible();
    await expect(page.getByText("Natural way: “Can I have a honey roll, please?”")).toBeVisible();
    await page.reload();
    await expect(page.getByText("You said: “honey”")).toBeVisible();
  });

  test("fecho tocado: 'Natural way' com o modelo", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase", null);
    await expect(page.getByText("Natural way: “Can I have two cheese rolls, please?”")).toBeVisible();
  });

  for (const ui of ["pt-BR", "en"] as const) {
    test(`sem "{" na tela e no texto copiado (${ui})`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
      await installSpeech(page, "ok");
      await onboard(page);
      await playAll(page, "phrase");
      await page.locator("header select").selectOption(ui);
      expect(await page.locator("body").innerText()).not.toMatch(MARKER);
      await page.getByRole("button", { name: /Copy report|Copiar relat/ }).click();
      const area = page.locator("#report-copy-text");
      const copied = (await area.count()) > 0 ? await area.inputValue() : await page.evaluate(() => navigator.clipboard.readText());
      expect(copied.length).toBeGreaterThan(20);
      expect(copied).not.toMatch(/[{}<>]/);
    });
  }
});

test.describe("Copiar relatório", () => {
  test("clipboard ok: 'Report copied.'; texto sem < > { } nem controle", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase", "Can I have a <b>cheese</b> roll, please?");
    await page.getByRole("button", { name: "Copy report" }).click();
    await expect(page.getByText("Report copied.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Glifora");
    expect(copied).not.toMatch(/[<>{}]/);
    expect(copied).not.toMatch(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.source.length ? /[\p{Cf}\p{Zl}\p{Zp}]/u : /x/); // Cc: só o \n entre linhas\n    expect(copied.replace(/\n/g, "")).not.toMatch(/\p{Cc}/u);
  });

  test("clipboard negado: textarea somente leitura com o texto", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new DOMException("negado", "NotAllowedError")) }, configurable: true });
    });
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase");
    await page.getByRole("button", { name: "Copy report" }).click();
    await expect(page.getByText(/Could not copy/)).toBeVisible();
    const area = page.locator("#report-copy-text");
    await expect(area).toHaveAttribute("readonly", "");
    await expect(page.getByLabel("Report text")).toBeVisible();
    const value = await area.inputValue();
    expect(value).toContain("Glifora");
    expect(value).not.toMatch(/[<>{}]/);
  });
});

test.describe("botões do relatório por estrela", () => {
  test("0 → 1ª, 1 → 2ª, 2 → 3ª e 3 → 'Play again' com a dica de treino", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    const again = (name: string | RegExp) => page.getByRole("link", { name });

    await playAll(page, "phrase", null); // sem fecho próprio: 0 estrela
    await expect(page.getByText("Stars: 0 of 3")).toBeVisible();
    await expect(again("Earn the 1st star: play with the phrase")).toHaveAccessibleDescription(/phrases show on screen/);

    await playAll(page, "phrase"); // 1 estrela
    await expect(page.getByText("Stars: 1 of 3")).toBeVisible();
    await expect(again("Earn the 2nd star: play with just the idea")).toHaveAccessibleDescription(/show only in/);

    await playAll(page, "idea"); // 2 estrelas
    await expect(page.getByText("Stars: 2 of 3")).toBeVisible();
    await expect(again("Earn the 3rd star: play from memory")).toHaveAccessibleDescription(/Nothing shows on screen/);

    await playAll(page, "memory"); // 3 estrelas
    await expect(page.getByText("Stars: 3 of 3")).toBeVisible();
    await expect(again("Play again")).toHaveAccessibleDescription(/Just for practice/);
    await expect(page.getByRole("link", { name: /Earn the/ })).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(MARKER);
    await axe(page, "relatório com 3 estrelas");
  });

  test("a11y do relatório com a cópia falhada", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("x")) }, configurable: true });
    });
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase");
    await page.getByRole("button", { name: "Copy report" }).click();
    await expect(page.locator("#report-copy-text")).toBeVisible();
    await axe(page, "relatório com textarea");
  });
});

test.describe("missão em andamento na vila", () => {
  test("cartão com a rua ainda à vista, leva à missão e retoma; sem rodada não aparece", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await expect(page.getByText("Mission in progress")).toHaveCount(0);
    await startMission(page, "phrase");
    await answerAllByText(page, BAKERY_REPLIES.slice(0, 2));
    await sessionAt(page, "ask", 2);
    await page.goto("/");
    const card = page.locator(".resume-card");
    await expect(card).toBeVisible();
    await expect(card.getByText("Mission in progress")).toBeVisible();
    // a rua continua na primeira tela (360×640): um local aparece sem rolar
    const place = page.getByRole("link", { name: /Bakery|Padaria/ }).first();
    await expect(place).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await axe(page, "vila com o cartão");
    await card.getByRole("link", { name: "Continue the mission" }).click();
    await expect(page).toHaveURL(/\/play\/bakery-01$/);
    await expect(page.getByRole("button", { name: "Continue where I stopped" })).toBeVisible();
  });

  test("depois de concluir a rodada o cartão some", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await playAll(page, "phrase");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".resume-card")).toHaveCount(0);
  });
});
