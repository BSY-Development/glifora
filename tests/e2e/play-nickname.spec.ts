// W2-18 (D-53): a NPC fala o apelido da pessoa (balão, tradução e voz); sem apelido a frase fica natural; nunca "{player}" na tela.
// Missão: bakery-02, fala "like". Dono: Revisor.
import { expect, test, type Page } from "@playwright/test";
import { installSpeech, spokenLines } from "./support/speech";
import { skipListen, type } from "./support/play";

test.use({ locale: "en-US", viewport: { width: 360, height: 640 } });

async function onboardAs(page: Page, nickname: string | null): Promise<void> {
  await page.goto("/welcome");
  if (nickname !== null) await page.locator("main input[type=text]").first().fill(nickname);
  await page.locator("main button.btn-primary").first().click();
  await expect(page).toHaveURL(/\/$/);
}

async function noMarker(page: Page): Promise<void> {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\{\s*player\s*\}/i);
}

/** Joga a bakery-02 até a fala "like" e devolve a página nela. */
async function toLike(page: Page): Promise<void> {
  await page.goto("/play/bakery-02");
  await page.getByRole("radio", { name: /With the phrase/ }).check();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await skipListen(page);
  for (const reply of ["Yes, please! Two honey rolls.", "I'm Alex.", "I'm from Brazil."]) {
    await type(page, reply);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await noMarker(page);
  }
}

test("com apelido, a Tilda fala o nome: balão, tradução e voz; o fim da missão também", async ({ page }) => {
  await installSpeech(page, "ok");
  await onboardAs(page, "Maria");
  await toLike(page);
  await expect(page.getByText("So, do you like it here, Maria?")).toBeVisible();
  await page.getByRole("button", { name: "Show translation" }).first().click();
  await expect(page.getByText("E aí, Maria, está gostando daqui?")).toBeVisible();
  expect((await spokenLines(page)).some((l) => l === "So, do you like it here, Maria?")).toBe(true);
  await noMarker(page);
  // a fala com erro previsto também sai com o nome e o recast continua destacado
  await type(page, "Yes! Is very beautiful.");
  await expect(page.locator("mark.recast")).toHaveText("It's very beautiful");
  await noMarker(page);
});

test("sem apelido, a frase fica natural, sem vírgula solta nem marcador", async ({ page }) => {
  await installSpeech(page, "ok");
  await onboardAs(page, null);
  await toLike(page);
  await expect(page.getByText("So, do you like it here?")).toBeVisible();
  await page.getByRole("button", { name: "Show translation" }).first().click();
  await expect(page.getByText("E aí, está gostando daqui?")).toBeVisible(); // ", {player}" some inteiro, a frase segue natural
  expect((await spokenLines(page)).some((l) => l === "So, do you like it here?")).toBe(true);
  await noMarker(page);
});

test("apelido com emoji: só a primeira palavra que vale vira nome falado; sem nenhuma, a NPC não usa nome", async ({ page }) => {
  await installSpeech(page, "ok");
  await onboardAs(page, "Zé 😀");
  await toLike(page);
  await expect(page.getByText("So, do you like it here, Zé?")).toBeVisible();
  await noMarker(page);
});

test("apelido só de emoji: a NPC não usa nome e nada quebra", async ({ page }) => {
  await installSpeech(page, "ok");
  await onboardAs(page, "😀");
  await toLike(page);
  await expect(page.getByText("So, do you like it here?")).toBeVisible();
  await noMarker(page);
});
