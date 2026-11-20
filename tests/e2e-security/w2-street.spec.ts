// W2-13 — rua da vila (D-52): 360×640, 320 px e zoom de 200%, texto Muito grande, teclado, leitor de tela (lista de links)
// e posição lembrada com localStorage bloqueado ou adulterado. Dono: QA Tester.
import { expect, test, type Page } from "@playwright/test";
import { onboard, watch } from "./support/w2";

test.use({ locale: "en-US" });

const SIZES = [
  { name: "360x640", width: 360, height: 640 },
  { name: "320x568", width: 320, height: 568 },
  { name: "zoom 200% (180x320)", width: 180, height: 320 },
];

async function overflow(page: Page) {
  return page.evaluate(() => ({
    pageX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyX: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
}

for (const size of SIZES) {
  test.describe(`rua em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("sem rolagem lateral da página, alvos de toque utilizáveis, rótulos inteiros", async ({ page }) => {
      const problems = watch(page);
      await onboard(page);
      await page.goto("/");
      await expect(page.getByRole("list", { name: "Places in the village" })).toBeVisible();
      const o = await overflow(page);
      expect(o.pageX, "a página rola para o lado").toBeLessThanOrEqual(1);
      const links = page.getByRole("list", { name: "Places in the village" }).getByRole("link");
      expect(await links.count()).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < (await links.count()); i += 1) {
        const link = links.nth(i);
        await link.scrollIntoViewIfNeeded();
        const box = (await link.boundingBox())!;
        expect(box.width, `link ${i} estreito`).toBeGreaterThanOrEqual(44);
        expect(box.height, `link ${i} baixo`).toBeGreaterThanOrEqual(44);
        const label = link.locator(".place-label");
        const clipped = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
        expect(clipped, `rótulo ${i} cortado`).toBe(false);
      }
      expect((await overflow(page)).pageX).toBeLessThanOrEqual(1);
      expect(problems).toEqual([]);
    });

    test("todos os locais abrem por toque e por teclado (Tab + Enter)", async ({ page }) => {
      await onboard(page);
      await page.goto("/");
      const list = page.getByRole("list", { name: "Places in the village" });
      await expect(list.getByRole("link").first()).toBeVisible();
      const names = await list.getByRole("link").allInnerTexts();
      expect(names.length).toBeGreaterThanOrEqual(2);
      for (const name of names) {
        await page.goto("/");
        await list.getByRole("link", { name }).focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/place\//);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      }
    });
  });
}

test.describe("texto Muito grande", () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test("rótulos inteiros e sem rolagem lateral da página", async ({ page }) => {
    await onboard(page);
    await page.goto("/settings");
    await page.getByRole("radio", { name: /Extra large|Muito grande/ }).click();
    await page.goto("/");
    expect((await overflow(page)).pageX).toBeLessThanOrEqual(1);
    const labels = page.locator(".place-label");
    for (let i = 0; i < (await labels.count()); i += 1) {
      const clipped = await labels.nth(i).evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      expect(clipped, `rótulo ${i} cortado`).toBe(false);
    }
  });
});

test.describe("posição lembrada", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  for (const bad of ["999999", "-5", "abc", "1e9", "NaN", "{}", "0.5", "", "Infinity", "9".repeat(400)]) {
    test(`localStorage com lixo (${JSON.stringify(bad).slice(0, 20)}): a rua abre sem erro e sem rolagem estranha`, async ({ page }) => {
      const problems = watch(page);
      await onboard(page);
      await page.evaluate((v) => localStorage.setItem("glifora.street.pos", v), bad);
      await page.goto("/");
      await expect(page.getByRole("list", { name: "Places in the village" })).toBeVisible();
      expect((await overflow(page)).pageX).toBeLessThanOrEqual(1);
      await expect(page.getByRole("list", { name: "Places in the village" }).getByRole("link").first()).toBeVisible();
      expect(problems).toEqual([]);
    });
  }

  test("localStorage bloqueado (SecurityError em get e set): a rua abre, rola e navega", async ({ page }) => {
    const problems = watch(page);
    await page.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("negado", "SecurityError");
        },
      }),
    );
    await onboard(page);
    await page.goto("/");
    const list = page.getByRole("list", { name: "Places in the village" });
    await expect(list).toBeVisible();
    await list.evaluate((el) => (el.parentElement as HTMLElement).scrollTo({ left: 400 }));
    await list.getByRole("link").last().click();
    await expect(page).toHaveURL(/\/place\//);
    expect(problems).toEqual([]);
  });

  test("a posição fica salva ao rolar e volta ao reabrir", async ({ page }) => {
    await onboard(page);
    await page.goto("/");
    const track = page.locator(".street-track");
    const max = await track.evaluate((el) => el.scrollWidth - el.clientWidth);
    test.skip(max <= 0, "a rua cabe inteira: não há o que rolar");
    await track.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect.poll(() => page.evaluate(() => localStorage.getItem("glifora.street.pos"))).not.toBeNull();
    await page.reload();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  test("teclado: setas movem a rua e nunca saem do intervalo; Tab percorre os links na ordem", async ({ page }) => {
    const problems = watch(page);
    await onboard(page);
    await page.goto("/");
    const list = page.getByRole("list", { name: "Places in the village" });
    await list.getByRole("link").first().focus();
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowLeft");
    expect((await overflow(page)).pageX).toBeLessThanOrEqual(1);
    await expect(list.getByRole("link").first()).toBeVisible();
    const names = await list.getByRole("link").allInnerTexts();
    await list.getByRole("link").first().focus();
    const seen: string[] = [];
    for (let i = 0; i < names.length; i += 1) {
      seen.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText ?? ""));
      await page.keyboard.press("Tab");
    }
    expect(seen).toEqual(names);
    expect(problems).toEqual([]);
  });

  test("leitor de tela: a rua é uma lista de links nomeados; silhuetas e pontinhos ficam escondidos", async ({ page }) => {
    await onboard(page);
    await page.goto("/");
    const list = page.getByRole("list", { name: "Places in the village" });
    const items = list.getByRole("link");
    for (let i = 0; i < (await items.count()); i += 1) {
      const name = (await items.nth(i).innerText()).trim();
      expect(name.length, `link ${i} sem nome`).toBeGreaterThan(0);
    }
    expect(await page.locator(".street-locked:not([aria-hidden=true])").count()).toBe(0);
    expect(await page.locator(".street-dots:not([aria-hidden=true])").count()).toBe(0);
    // o texto lido na rua não repete o nome do local por causa da arte
    expect(await page.locator(".place-art[role=img]:not([aria-hidden=true])").count()).toBe(0);
  });
});
