// W1-14 — acessibilidade no navegador (W0-03 §7; SPEC "Acessibilidade"). Dono: Revisor.
// Cobre: axe em TODAS as rotas (pt-BR e en, claro e escuro, texto normal e "Muito grande"), foco no título ao trocar de rota,
// `prefers-reduced-motion` e a preferência "Movimento", e 360×640 com texto "Muito grande" sem rolagem lateral nem coisa cortada.
// Toda rota nova entra em ROUTES (aqui e em tests/e2e/csp.spec.ts).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", name: "vila" },
  { path: "/welcome", name: "boas-vindas" }, // sem perfil; com perfil volta para "/"
  { path: "/place/bakery", name: "padaria" },
  { path: "/profile", name: "perfil" },
  { path: "/settings", name: "ajustes" },
  { path: "/about", name: "sobre" },
  { path: "/rota-que-nao-existe", name: "404" },
  { path: "/place/padaria-falsa", name: "404 de local" },
] as const;

const PHONE = { width: 360, height: 640 };

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** Cria o perfil (senão "/" e "/place/*" mandam para /welcome) e fica em "/". */
async function onboard(page: Page) {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /Começar|Let's go/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function noSideScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, "rolagem lateral").toBeLessThanOrEqual(0);
}

/** Nada visível pode passar da borda direita da tela (texto cortado em vez de rolagem). */
async function nothingClippedRight(page: Page) {
  const bad = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("main *, nav *, header *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest("[aria-hidden='true']")) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${String(el.className)} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent ?? "").trim().slice(0, 30)}"`);
    }
    return out;
  });
  expect(bad, "elementos fora da tela").toEqual([]);
}

async function axeAll(page: Page) {
  const fmt = (v: { impact?: string | null; id: string; nodes: { target: unknown[] }[] }) => `${v.impact}/${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`;
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map(fmt), "violações WCAG 2.1 A/AA").toEqual([]);
  // WCAG 2.2 (tamanho do alvo, 2.5.8): com a página no topo, a barra de baixo (fixa) cobre botões que a rolagem libera.
  // Medimos no fim da página, onde nada fica sob a barra.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const r22 = await new AxeBuilder({ page }).withTags(["wcag22aa"]).analyze();
  expect(r22.violations.map(fmt), "violações WCAG 2.2 AA").toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Boas práticas do axe: qualquer violação derruba (hoje não há nenhuma).
  const bp = await new AxeBuilder({ page }).withTags(["best-practice"]).analyze();
  expect(bp.violations.map(fmt), "boas práticas").toEqual([]);
}

for (const locale of ["pt-BR", "en"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`axe · ${locale} · ${scheme}`, () => {
      test.use({ locale, colorScheme: scheme });
      for (const route of ROUTES) {
        test(`${route.name} (${route.path})`, async ({ page }) => {
          const problems = watch(page);
          if (route.path !== "/welcome") await onboard(page);
          await page.goto(route.path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await axeAll(page);
          expect(problems).toEqual([]);
        });
      }
    });
  }
}

test.describe("texto 'Muito grande' em 360×640", () => {
  test.use({ locale: "pt-BR", viewport: PHONE });
  for (const scheme of ["light", "dark"] as const) {
    test(`todas as rotas: sem rolagem lateral, sem corte, axe limpo (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const problems = watch(page);
      await onboard(page);
      await page.goto("/settings");
      await page.getByRole("radio", { name: "Muito grande" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeGreaterThanOrEqual(24); // 150% de 16px

      for (const route of ROUTES) {
        await page.goto(route.path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
        await noSideScroll(page);
        await nothingClippedRight(page);
        await axeAll(page);
      }
      // A navegação inferior continua alcançável (rola junto com a página, não cobre o conteúdo).
      await page.goto("/about");
      const nav = page.getByRole("navigation");
      await nav.scrollIntoViewIfNeeded();
      await expect(nav.getByRole("link")).toHaveCount(4);
      for (const link of await nav.getByRole("link").all()) await expect(link).toBeInViewport();
      expect(problems).toEqual([]);
    });
  }

  test("a barra de navegação fixa não cobre o último conteúdo (texto normal)", async ({ page }) => {
    await onboard(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: /Apagar/ }).scrollIntoViewIfNeeded();
    const hit = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => /Apagar/.test(b.textContent ?? ""));
      const nav = document.querySelector("nav.bottom-nav");
      if (!btn || !nav) return "faltou elemento";
      const b = btn.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      return b.bottom <= n.top + 1 || getComputedStyle(nav).position === "static" ? "ok" : `botão ${b.bottom} sob a barra ${n.top}`;
    });
    expect(hit).toBe("ok");
  });
});

test.describe("foco ao trocar de rota", () => {
  test.use({ locale: "pt-BR" });

  test("pela navegação inferior (Perfil, Ajustes, Sobre), o foco vai ao h1 da tela nova e o título da aba acompanha", async ({ page }) => {
    await onboard(page);
    const nav = page.locator("nav.bottom-nav");
    for (const [link, url] of [
      ["Perfil", /\/profile$/],
      ["Ajustes", /\/settings$/],
      ["Sobre", /\/about$/],
    ] as const) {
      await nav.getByRole("link", { name: link }).click();
      await expect(page).toHaveURL(url);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeFocused();
      expect(await page.title()).toContain(((await h1.textContent()) ?? "").trim());
    }
  });

  test("pela vila (link da padaria), o foco vai ao h1", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Padaria" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  // Regressão (W1-14, corrigida pelo App): a Home mostrava só <Loading/> até o Dexie responder e o foco se perdia ao voltar para "/".
  test.describe("voltar para a vila", () => {
    test("pela aba Vila", async ({ page }) => {
      await onboard(page);
      await page.locator("nav.bottom-nav").getByRole("link", { name: "Ajustes" }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await page.locator("nav.bottom-nav").getByRole("link", { name: "Vila" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused({ timeout: 2000 });
    });
    test("pelo Voltar do navegador", async ({ page }) => {
      await onboard(page);
      await page.getByRole("link", { name: "Padaria" }).click();
      await expect(page).toHaveURL(/\/place\/bakery$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused({ timeout: 2000 });
    });
  });

  test("rota desconhecida por navegação do histórico também foca o título", async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => {
      history.pushState({}, "", "/nada-aqui");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("heading", { level: 1, name: "Página não encontrada" })).toBeFocused();
  });

  test("o link 'Pular para o conteúdo' é o primeiro foco e leva ao conteúdo sem criar entrada no histórico", async ({ page }) => {
    await onboard(page);
    await page.goto("/"); // página nova: o foco começa no corpo e o 1º Tab cai no link
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const before = await page.evaluate(() => history.length);
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test("tudo se alcança só pelo teclado: nenhum elemento focável fica sem nome nem invisível", async ({ page }) => {
    await onboard(page);
    for (const path of ["/", "/profile", "/settings", "/about"]) {
      await page.goto(path);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const cs = getComputedStyle(el);
          const hidden = cs.display === "none" || cs.visibility === "hidden";
          if (hidden) continue;
          const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim() || (el as HTMLInputElement).labels?.[0]?.textContent?.trim() || el.getAttribute("aria-labelledby");
          if (!name) out.push(el.outerHTML.slice(0, 80));
        }
        return out;
      });
      expect(bad, path).toEqual([]);
    }
  });
});

test.describe("movimento", () => {
  test.use({ locale: "pt-BR" });
  const duration = async (page: Page) => {
    await page.locator(".place-art").first().waitFor();
    return page.evaluate(() => getComputedStyle(document.querySelector(".place-art")!).transitionDuration);
  };
  const isReduced = (d: string) => d.split(",").every((x) => parseFloat(x) < 0.001);

  test("o CSS não tem animação infinita nem piscante", async ({ request }) => {
    // A folha de estilo do build, lida pelo preview (o mesmo que o celular recebe).
    const html = await (await request.get("/")).text();
    const href = /href="([^"]+\.css)"/.exec(html)?.[1];
    expect(href).toBeTruthy();
    const css = await (await request.get(href!)).text();
    expect(css).not.toMatch(/animation[^;{}]*infinite/);
    expect(css).not.toMatch(/animation-iteration-count:\s*infinite/);
  });

  test("'Seguir o sistema' respeita prefers-reduced-motion (e só ele)", async ({ page }) => {
    await onboard(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(isReduced(await duration(page))).toBe(false); // há mesmo uma transição para reduzir
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(isReduced(await duration(page))).toBe(true);
  });

  test("'Reduzir movimento' vale mesmo sem o pedido do sistema; 'Não reduzir' vale mesmo com ele", async ({ page }) => {
    await onboard(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Reduzir movimento" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await page.goto("/");
    expect(isReduced(await duration(page))).toBe(true);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Não reduzir" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.goto("/");
    expect(isReduced(await duration(page))).toBe(false);

    await page.goto("/settings");
    await page.getByRole("radio", { name: "Seguir o sistema" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-motion", /.*/);
    await page.goto("/");
    expect(isReduced(await duration(page))).toBe(true); // o sistema ainda pede
  });
});
