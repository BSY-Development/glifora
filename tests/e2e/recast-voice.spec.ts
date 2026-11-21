// W2-21 (D-54) — a fala "order" da bakery-01 ouvida pelo reconhecedor: 'I roll of honey' é o erro previsto e leva o recast;
// vale a 1ª alternativa que casa (regra 6). Relatório: "Correction". Dono: Revisor. Interface em inglês.
import { expect, test, type Page } from "@playwright/test";
import { installSpeech, queueSpeech } from "./support/speech";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, next, onboard, startMission, type } from "./support/play";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

/** Joga a saudação por texto, diz a fala "order" pela voz com estas alternativas e devolve a página logo depois. */
async function sayOrder(page: Page, ...alternatives: string[]): Promise<void> {
  await installSpeech(page, "ok", { consent: true });
  await onboard(page);
  await startMission(page, "phrase");
  await answerAllByText(page, BAKERY_REPLIES.slice(0, 1));
  await queueSpeech(page, ...alternatives);
  await page.getByRole("button", { name: "Tap and speak" }).click();
}

async function finish(page: Page): Promise<void> {
  await next(page);
  await answerAllByText(page, BAKERY_REPLIES.slice(2));
  await type(page, CLOSING_OWN);
  await page.getByRole("button", { name: "See the report" }).click();
}

test("'I roll of honey' → recast 'A honey roll' e 'Correction' no relatório", async ({ page }) => {
  await sayOrder(page, "I roll of honey");
  await expect(page.locator("mark.recast")).toHaveText("A honey roll");
  await expect(page.getByText(/Good choice!/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await finish(page);
  await expect(page.getByText("You said: “I roll of honey”")).toBeVisible();
  await expect(page.getByText("Correction: “A honey roll”")).toBeVisible();
});

test("['I roll of honey', 'I roll honey'] → recast (a 1ª alternativa que casa)", async ({ page }) => {
  await sayOrder(page, "I roll of honey", "I roll honey");
  await expect(page.locator("mark.recast")).toHaveText("A honey roll");
  await finish(page);
  await expect(page.getByText("Correction: “A honey roll”")).toBeVisible();
});

test("['I roll honey', 'I roll of honey'] → resposta boa, sem recast (regra 6)", async ({ page }) => {
  await sayOrder(page, "I roll honey", "I roll of honey");
  await expect(page.locator("mark.recast")).toHaveCount(0);
  await expect(page.getByText(/A honey roll\? Good choice!/)).toHaveCount(0);
  await finish(page);
  await expect(page.getByText(/Correction:/)).toHaveCount(0);
  await expect(page.getByText("You said: “I roll honey”")).toBeVisible();
});
