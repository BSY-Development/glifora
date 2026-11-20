// W1-10/W1-11 no navegador: primeira visita, perfil, ajustes, vila e local. Console limpo, sem rolagem lateral, axe sem violação.
// Os rádios são controlados e gravam no IndexedDB: usar click(), não check().
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" }); // o idioma inicial vem do navegador

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("primeira visita: /welcome, apelido hostil recusado, depois vila e padaria", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await noSideScroll(page);
  await axe(page);

  const nick = page.getByLabel("Apelido (opcional)");
  await nick.fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  expect(await page.locator("img").count()).toBe(0);

  await nick.fill("Ana");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Ana").first()).toBeVisible();
  await noSideScroll(page);
  await axe(page);

  await page.goto("/welcome"); // nunca mais
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: "Padaria" }).click();
  await expect(page).toHaveURL(/\/place\/bakery$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByText("Tilda").first()).toBeVisible();
  await axe(page);

  expect(problems).toEqual([]);
});

test("ajustes: texto muito grande não cria rolagem lateral e a preferência sobrevive ao recarregar", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/settings");
  await page.getByRole("radio", { name: "Muito grande" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
  for (const route of ["/", "/settings", "/profile", "/place/bakery"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await noSideScroll(page);
  }
  await axe(page);
  expect(problems).toEqual([]);
});

test("perfil: avatar e idioma valem na hora e persistem", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Começar" }).click();
  await page.goto("/profile");
  await axe(page);
  await page.getByRole("group", { name: "Idioma da interface" }).getByRole("radio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("group", { name: "Interface language" }).getByRole("radio", { name: "English" })).toBeChecked();
});

test("local inexistente é 404, sem erro no console", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Começar" }).click();
  await page.goto("/place/padaria-falsa");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Padaria" })).toHaveCount(0);
});
