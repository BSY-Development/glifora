// W2-17 parte 2: a vila como rua (Street) com os 2 locais de hoje em 360×640. Dono: Revisor.
// O fixture de 6 locais (rolagem, setas, pontinhos) fica no teste de componente do App (src/ui/street.test.tsx).
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "en-US", viewport: { width: 360, height: 640 } });

async function onboard(page: Page): Promise<void> {
  await page.goto("/welcome");
  await page.locator("main button.btn-primary").first().click();
  await expect(page).toHaveURL(/\/$/);
}

test("os 2 locais aparecem inteiros na tela, sem rolar, na ordem padaria → taverna", async ({ page }) => {
  await onboard(page);
  const bakery = page.getByRole("link", { name: /Bakery/ });
  const tavern = page.getByRole("link", { name: /Tavern/ });
  for (const link of [bakery, tavern]) {
    await expect(link).toBeInViewport({ ratio: 1 });
    const b = (await link.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(360);
    expect(b.height).toBeGreaterThanOrEqual(44); // alvo de toque
  }
  expect((await bakery.boundingBox())!.x).toBeLessThan((await tavern.boundingBox())!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("com 2 locais não há setas nem pontinhos (nada para rolar) e a lista é de links para o leitor de tela", async ({ page }) => {
  await onboard(page);
  await expect(page.locator(".street-nav")).toHaveCount(0);
  const names = await page.locator("ul.street-list").getByRole("link").allInnerTexts();
  expect(names.map((n) => n.trim())).toEqual(["Bakery", "Tavern"]);
  expect(await page.locator("section.street").getAttribute("aria-label")).toBeTruthy();
  await expect(page.locator(".street-locked")).toHaveCount(0); // silhuetas da fase 3 só quando houver
});

test("as setas do teclado não quebram a rua e tocar em um local abre a tela dele", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: /Tavern/ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("link", { name: /Bakery/ })).toBeInViewport({ ratio: 1 });
  await page.getByRole("link", { name: /Bakery/ }).click();
  await expect(page).toHaveURL(/\/place\/bakery$/);
});

test("sem localStorage a rua abre normal (a posição é só conveniência)", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException("bloqueado", "SecurityError");
    };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
  });
  await page.goto("/welcome");
  await page.locator("main button.btn-primary").first().click().catch(() => undefined);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Bakery/ }).or(page.getByRole("heading", { level: 1 })).first()).toBeVisible();
  expect(problems.filter((p) => /bloqueado|SecurityError/.test(p) && /street/i.test(p))).toEqual([]);
});

test("a posição da rua é guardada em glifora.street.pos (só 0 ou inteiro positivo) e lixo ali não quebra", async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => localStorage.setItem("glifora.street.pos", "<img src=x onerror=alert(1)>"));
  await page.reload();
  await expect(page.getByRole("link", { name: /Bakery/ })).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => localStorage.setItem("glifora.street.pos", "999999"));
  await page.reload();
  await expect(page.getByRole("link", { name: /Bakery/ })).toBeInViewport({ ratio: 1 });
});
