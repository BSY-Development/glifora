// W2-27 — o relatório explica a estrela da rodada e marca as falas com ajuda; o "Copiar relatório" leva as duas coisas.
// Rodada "De cor" na bakery-01 com ajuda em falas escolhidas (duas falhas seguidas fazem a ajuda subir naquela fala).
import { expect, test, type Page } from "@playwright/test";
import { installSpeech } from "./support/speech";
import { BAKERY_REPLIES, CLOSING_OWN, next, onboard, startMission, type } from "./support/play";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US", permissions: ["clipboard-read", "clipboard-write"] });

/** Joga de cor. Nas falas de `helped` (a partir de 1) erra duas vezes antes de acertar, e a ajuda sobe. */
async function playMemory(page: Page, helped: number[]): Promise<void> {
  await installSpeech(page, "ok");
  await onboard(page);
  await startMission(page, "memory");
  for (const [i, reply] of BAKERY_REPLIES.entries()) {
    if (helped.includes(i + 1)) {
      await type(page, "zzz qqq");
      await type(page, "qqq zzz");
      await expect(page.getByRole("heading", { name: "Ideas for your answer" })).toBeVisible();
    }
    await type(page, reply);
    await next(page);
  }
  await type(page, CLOSING_OWN);
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page.getByRole("heading", { name: "Mission report" })).toBeVisible();
}

async function copied(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copy report" }).click();
  await expect(page.getByText("Report copied.")).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test("de cor com ajuda em 2 falas: ★★, diz quais, marca 'with help' e o Copiar leva as duas coisas", async ({ page }) => {
  await playMemory(page, [2, 4]);
  const why = "This run earned ★★. Help showed up on lines 2 and 4. For ★★★: from memory, with help on at most 1 line.";
  await expect(page.locator(".degree-why")).toHaveText(why);
  await expect(page.locator("main").getByText("with help", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Stars: 2 of 3")).toBeVisible();
  const text = await copied(page);
  expect(text).toContain(why);
  expect(text).toMatch(/\n2\. You said: .*\(with help\)/);
  expect(text).toMatch(/\n4\. You said: .*\(with help\)/);
  expect(text).not.toMatch(/\n[135]\. You said: .*\(with help\)/);
});

test("de cor com ajuda em 1 fala: ★★★ (dentro da folga), só 'valeu ★★★'", async ({ page }) => {
  await playMemory(page, [3]);
  await expect(page.locator(".degree-why")).toHaveText("This run earned ★★★.");
  await expect(page.getByText("Stars: 3 of 3")).toBeVisible();
  await expect(page.locator("main").getByText("with help", { exact: true })).toHaveCount(1);
  const text = await copied(page);
  expect(text).toContain("This run earned ★★★.");
  expect(text).toMatch(/\n3\. You said: .*\(with help\)/);
});
