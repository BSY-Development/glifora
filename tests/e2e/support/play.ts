// Atalhos para jogar a bakery-01 no e2e (W2-11). Interface em inglês (locale en-US).
import { expect, type Page } from "@playwright/test";

/** Respostas certas, uma por fala da bakery-01 (as keywords casam por "honey", "one"/"two", "bread", "that is all", "thank you"). */
export const GOOD_REPLIES = ["Can I have a honey roll, please?", "Two, please.", "No, that's all, thanks.", "Here you go.", "Hello"] as const;
export const GREET = "Good morning!";
export const BAKERY_REPLIES = [GREET, "Can I have a honey roll, please?", "Two, please.", "No, that's all, thanks.", "Here you go."] as const;
export const CLOSING_OWN = "Can I have a cheese roll, please?";
export const MODEL_ANSWER = "Can I have two cheese rolls, please?";

export async function onboard(page: Page): Promise<void> {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /Let's go|Começar/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

export type ModeName = "phrase" | "idea" | "memory";
const MODE_LABEL: Record<ModeName, RegExp> = { phrase: /With the phrase/, idea: /With the idea/, memory: /From memory/ };

/** Abre a missão, escolhe o modo e passa a cena de escuta até a primeira fala. */
export async function startMission(page: Page, mode: ModeName, id = "bakery-01"): Promise<void> {
  await page.goto(`/play/${id}`);
  await page.getByRole("radio", { name: MODE_LABEL[mode] }).check();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await skipListen(page);
}

export async function skipListen(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Listen to the scene" })).toBeVisible();
  for (let i = 0; i < 6; i += 1) {
    const last = page.getByRole("button", { name: "Start the conversation" });
    if (await last.isVisible()) {
      await last.click();
      return;
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  throw new Error("a cena de escuta não terminou");
}

export async function type(page: Page, text: string): Promise<void> {
  await page.locator("#answer-text").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

export const next = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();

/** Digita cada resposta e segue. Não toca no fecho. */
export async function answerAllByText(page: Page, replies: readonly string[] = BAKERY_REPLIES): Promise<void> {
  for (const reply of replies) {
    await type(page, reply);
    await next(page);
  }
}

export const xpTotal = async (page: Page): Promise<number> => {
  const text = await page.getByText(/^Total: \d+ XP$/).innerText();
  return Number(/\d+/.exec(text)![0]);
};

/** A lista de missões só existe para o par pt-BR → en (D-40): com a interface em inglês a Place diz "em breve". */
export const setUi = (page: Page, code: "pt-BR" | "en"): Promise<string[]> => page.locator("header select").selectOption(code);
