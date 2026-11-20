// W2-15 no navegador: a vila com dois locais (padaria e taverna) em 360×640, sem sobreposição nem rolagem lateral,
// e a taverna com o Bram. Dono: Revisor.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

async function onboard(page: Page) {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /Let's go|Começar/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function boxes(page: Page) {
  const bakery = await page.getByRole("link", { name: /Bakery/ }).boundingBox();
  const tavern = await page.getByRole("link", { name: /Tavern/ }).boundingBox();
  expect(bakery, "link da padaria visível").not.toBeNull();
  expect(tavern, "link da taverna visível").not.toBeNull();
  return { bakery: bakery!, tavern: tavern! };
}

const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const size of ["normal", "xlarge"] as const) {
  test(`vila 360×640 (texto ${size}): os dois locais aparecem, sem sobrepor e sem rolagem lateral`, async ({ page }) => {
    await onboard(page);
    if (size === "xlarge") await page.evaluate(() => document.documentElement.setAttribute("data-text-size", "xlarge"));
    await expect(page.getByRole("link", { name: /Bakery/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tavern/ })).toBeVisible();
    const { bakery, tavern } = await boxes(page);
    expect(overlap(bakery, tavern), `padaria ${JSON.stringify(bakery)} × taverna ${JSON.stringify(tavern)}`).toBe(false);
    for (const box of [bakery, tavern]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("o leitor de tela anuncia os dois locais como links", async ({ page }) => {
  await onboard(page);
  const names = await page.locator("main").getByRole("link").allInnerTexts();
  expect(names.some((n) => /Bakery/.test(n))).toBe(true);
  expect(names.some((n) => /Tavern/.test(n))).toBe(true);
});

test("tocar na taverna abre /place/tavern com o Bram", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await onboard(page);
  await page.getByRole("link", { name: /Tavern/ }).click();
  await expect(page).toHaveURL(/\/place\/tavern$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tavern");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByText("Bram").first()).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  expect(problems).toEqual([]);
});
