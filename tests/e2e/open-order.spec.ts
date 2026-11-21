// W2-23 (D-57) — o pedido aberto aceita qualquer item do local: "bread" no pedido da Tilda é aceito, a Tilda repete o item
// ("A loaf of bread!", recast implícito da D-54), as falas seguintes não falam de pãezinhos e o relatório mostra o jeito natural.
// Também confere a ajuda "tocar" com 6 opções em 360×640. Interface em inglês (en-US).
import { expect, test } from "@playwright/test";
import { installSpeech } from "./support/speech";
import { CLOSING_OWN, GREET, next, onboard, startMission, type } from "./support/play";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

test("'bread' no pedido da Tilda: aceito, repetido e com o jeito natural no relatório", async ({ page }) => {
  await installSpeech(page, "ok");
  await onboard(page);
  await startMission(page, "phrase");
  await type(page, GREET);
  await next(page);

  await expect(page.getByText("What can I get you? The rolls are still warm.")).toBeVisible();
  await type(page, "bread");
  await expect(page.getByText("A loaf of bread! Lovely, it's still warm.")).toBeVisible();
  await expect(page.getByText(/You earned \+\d+ XP/)).toBeVisible();
  await next(page);

  await type(page, "Two loaves, please.");
  await expect(page.getByText("Two? Sure. Here you go!")).toBeVisible();
  await next(page);
  await expect(page.getByText("Anything else? Everything is fresh today.")).toBeVisible();
  await type(page, "An apple pie, too.");
  await expect(page.getByText("An apple pie, too! You'll love it.")).toBeVisible();
  await next(page);
  await type(page, "Here you go.");
  await expect(page.getByText("Thank you, dear. And here you go. Enjoy your breakfast!")).toBeVisible();
  await next(page);

  await type(page, CLOSING_OWN);
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page).toHaveURL(/\/report\//);
  await expect(page.getByText("You said: “bread”")).toBeVisible();
  await expect(page.getByText("Natural way: “Can I have a loaf of bread, please?”")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/\b(wrong|incorrect|mistake)\b/i);
});

test("ajuda 'tocar' com 6 opções (anything-else) cabe em 360×640 e a 6ª opção funciona", async ({ page }, testInfo) => {
  await installSpeech(page, "ok");
  await onboard(page);
  await startMission(page, "phrase");
  for (const reply of [GREET, "Can I have a honey roll, please?", "Two, please."]) {
    await type(page, reply);
    await next(page);
  }
  await expect(page.getByText("Anything else? Everything is fresh today.")).toBeVisible();
  await page.getByRole("button", { name: "Choose by tapping" }).click();
  const taps = page.locator(".help-taps button.tap-option");
  await expect(taps).toHaveCount(6);

  // Quanto a pessoa precisa rolar para ver a última opção (registrado no relatório do teste).
  const box = await page.locator(".help-taps").boundingBox();
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  testInfo.annotations.push({ type: "tap-list", description: `lista: y=${Math.round(box!.y)} altura=${Math.round(box!.height)}; página: ${scrollHeight}px; tela: 640px` });
  await testInfo.attach("ajuda-tocar-6-opcoes", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  // Sem rolagem horizontal, e a última opção dá para tocar.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await taps.nth(5).scrollIntoViewIfNeeded();
  await taps.nth(5).click();
  await expect(page.getByText("A cheese roll, too. Good idea!")).toBeVisible();
});
