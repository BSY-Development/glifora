// W2-11 — acessibilidade das telas novas da fase 2: lista de missões na Place, /play (apresentação, escuta, pergunta com ajuda,
// reação com recast, fecho, resposta-modelo, fim) e /report. axe em pt-BR e en, claro e escuro, 360×640. Mais o `lang=` nos textos
// em idioma-alvo. Dono: Revisor. Os seletores não dependem do idioma da interface.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installSpeech } from "../e2e/support/speech";

const PHONE = { width: 360, height: 640 };

async function axeNow(page: Page, label: string): Promise<void> {
  const fmt = (v: { impact?: string | null; id: string; nodes: { target: unknown[] }[] }) => `${v.impact}/${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`;
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  expect(r.violations.map(fmt), `axe em ${label}`).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const r22 = await new AxeBuilder({ page }).withTags(["wcag22aa"]).analyze();
  expect(r22.violations.map(fmt), `axe WCAG 2.2 em ${label}`).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function onboard(page: Page): Promise<void> {
  await page.goto("/welcome");
  await page.locator("main button.btn-primary").first().click();
  await expect(page).toHaveURL(/\/$/);
}

const typeAnswer = async (page: Page, text: string): Promise<void> => {
  await page.locator("#answer-text").fill(text);
  await page.locator(".answer-form button[type=submit]").click();
};
const cont = (page: Page) => page.locator("p.continue button");

/** Visita cada estado do player e roda o axe. Sem depender de texto da interface. */
async function walk(page: Page, onScreen: (label: string) => Promise<void>): Promise<string> {
  await page.goto("/play/bakery-01");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await onScreen("apresentação");
  await page.locator('input[name="play-mode"][value="1"]').check(); // frase à vista: a ajuda "frase" já aparece
  await cont(page).click(); // Começar
  await expect(page.locator("section[aria-labelledby=play-step]")).toBeVisible();
  await onScreen("escuta");
  for (let i = 0; i < 3; i += 1) await cont(page).click(); // 3 falas de escuta; a última abre a conversa
  await expect(page.locator(".answer-form")).toBeVisible();
  await onScreen("pergunta");
  await page.locator(".help button.btn").click(); // degrau 3: tocar
  await expect(page.locator(".tap-option").first()).toBeVisible();
  await onScreen("pergunta com ajuda de tocar");
  await typeAnswer(page, "zzz qqq");
  await typeAnswer(page, "qqq zzz");
  await onScreen("pergunta depois de duas falhas");
  await typeAnswer(page, "Good morning!");
  await expect(page.locator(".xp-chip")).toBeVisible();
  await onScreen("reação");
  await cont(page).click();
  await typeAnswer(page, "A roll of honey, please."); // erro previsto: recast destacado
  await expect(page.locator("mark.recast")).toBeVisible();
  await onScreen("reação com recast");
  await cont(page).click();
  for (const reply of ["Two, please.", "No, that's all, thanks.", "Here you go."]) {
    await typeAnswer(page, reply);
    await cont(page).click();
  }
  await expect(page.locator(".answer-form")).toBeVisible();
  await onScreen("fecho");
  await typeAnswer(page, "zzz");
  await onScreen("fecho depois de uma falha (dica)");
  await typeAnswer(page, "qqq");
  await expect(page.locator("section.notice, p.notice, .bubble-model, .dialogue")).not.toHaveCount(0);
  await onScreen("resposta-modelo");
  await typeAnswer(page, "Can I have two cheese rolls, please?");
  await expect(page.locator("p.continue button")).toBeVisible();
  await onScreen("fim da rodada");
  await cont(page).click();
  await expect(page).toHaveURL(/\/report\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1200); // o level up anima (0,8 s): o axe mede contraste com o texto já parado
  await onScreen("relatório");
  return page.url();
}

for (const locale of ["pt-BR", "en"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`axe das telas novas · ${locale} · ${scheme}`, () => {
      test.use({ locale, colorScheme: scheme, viewport: PHONE });

      test("lista de missões na Place", async ({ page }) => {
        await installSpeech(page, "ok", { consent: true });
        await onboard(page);
        await page.goto("/place/bakery");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (locale === "pt-BR") await expect(page.locator("li.mission-card")).not.toHaveCount(0); // o par pt-BR → en tem missões
        await axeNow(page, `place/bakery (${locale})`);
        await page.goto("/place/tavern");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await axeNow(page, `place/tavern (${locale})`);
      });

      test("player e relatório, tela a tela", async ({ page }) => {
        await installSpeech(page, "ok", { consent: true });
        await onboard(page);
        await walk(page, (label) => axeNow(page, `${label} (${locale}, ${scheme})`));
      });
    });
  }
}

test.describe("o foco e o leitor de tela no player", () => {
  test.use({ locale: "en-US", viewport: PHONE });

  test("o foco vai para 'Continuar' ou o microfone a cada passo, e as falas da NPC ficam numa região aria-live", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await expect(cont(page)).toBeFocused(); // Começar
    await cont(page).click();
    await expect(cont(page)).toBeFocused(); // escuta
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    await expect(page.getByRole("button", { name: "Tap and speak" })).toBeFocused(); // pergunta: o microfone
    expect(await page.locator(".dialogue[aria-live=polite]").count()).toBeGreaterThanOrEqual(1);
    await typeAnswer(page, "Good morning!");
    await expect(cont(page)).toBeFocused(); // reação
  });

  test("sem voz o foco vai para o campo de texto", async ({ page }) => {
    await installSpeech(page, "none");
    await onboard(page);
    await page.goto("/play/bakery-01");
    await cont(page).click();
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    await expect(page.locator("#answer-text")).toBeFocused();
  });

  test("com 'reduzir movimento' o level up não anima", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await page.locator('input[name="play-mode"][value="3"]').check();
    await cont(page).click();
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    for (const reply of ["Good morning!", "Can I have a honey roll, please?", "Two, please.", "No, that's all, thanks.", "Here you go."]) {
      await typeAnswer(page, reply);
      await cont(page).click();
    }
    await typeAnswer(page, "Can I have a cheese roll, please?");
    await cont(page).click();
    await expect(page.locator(".levelup")).toBeVisible();
    const animated = await page.evaluate(() => {
      const el = document.querySelector(".levelup, .levelup *");
      const names = [document.querySelector(".levelup"), ...document.querySelectorAll(".levelup *")].flatMap((e) => (e ? [parseFloat(getComputedStyle(e).animationDuration)] : []));
      return { names, el: !!el };
    });
    expect(animated.names.filter((d) => d > 0.01)).toEqual([]); // a regra põe 0,001 ms: sem movimento visível
  });
});

// ---------- lang= nos textos em idioma-alvo ----------

/** O `lang` efetivo do menor elemento que contém o texto (o do próprio ou de um ancestral; senão o do <html>). */
async function langOf(page: Page, text: string): Promise<string | null> {
  return page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let found: Element | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.textContent ?? "").includes(needle) && n.parentElement && !n.parentElement.closest("[aria-hidden=true]")) {
        found = n.parentElement;
        break;
      }
    }
    return found ? (found.closest("[lang]")?.getAttribute("lang") ?? null) : "NOT-FOUND";
  }, text);
}

test.describe("lang= nos textos em inglês (idioma-alvo) dentro da interface em pt-BR", () => {
  test.use({ locale: "pt-BR", viewport: PHONE });

  test("player: falas da NPC, frases da ajuda, resposta-modelo e fecho", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await page.locator('input[name="play-mode"][value="1"]').check();
    await cont(page).click();
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    expect(await langOf(page, "Good morning! Oh, a new face")).toMatch(/^en/);
    await page.locator(".help button.btn").click(); // frase à vista → tocar
    expect(await langOf(page, "Good morning!")).toMatch(/^en/);
    await typeAnswer(page, "Good morning!");
    expect(await langOf(page, "Good morning! I'm Tilda.")).toMatch(/^en/);
  });

  test("relatório: frase do fecho, palavras novas, recast e exemplo", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await cont(page).click();
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    for (const reply of ["Good morning!", "A roll of honey, please.", "Two, please.", "No, that's all, thanks.", "Here you go."]) {
      await typeAnswer(page, reply);
      await cont(page).click();
    }
    await typeAnswer(page, "Can I have a cheese roll, please?");
    await cont(page).click();
    await expect(page).toHaveURL(/\/report\//);
    expect(await langOf(page, "Can I have a cheese roll, please?"), "frase do fecho").toMatch(/^en/);
    const words = page.locator("section[aria-labelledby=words-title] strong");
    await expect(words.first()).toBeVisible();
    expect(await words.first().getAttribute("lang"), "palavra nova").toMatch(/^en/);
  });

  // ACHADO R-W2-11-1 (menor, App): Report.tsx monta "Você disse “A roll of honey” e a conversa seguiu com “A honey roll”" com t(), sem marcar
  // o trecho em inglês com lang="en" (nem o exemplo "Em vez de / Melhor"). Leitor de tela lê o inglês com a voz do português.
  // Quando o App corrigir, este test.fail passa a falhar: troque por test.
  test.fail("R-W2-11-1 · relatório: o inglês citado no recast tem lang=en", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await cont(page).click();
    for (let i = 0; i < 3; i += 1) await cont(page).click();
    for (const reply of ["Good morning!", "A roll of honey, please.", "Two, please.", "No, that's all, thanks.", "Here you go."]) {
      await typeAnswer(page, reply);
      await cont(page).click();
    }
    await typeAnswer(page, "Can I have a cheese roll, please?");
    await cont(page).click();
    await expect(page.locator("section[aria-labelledby=recasts-title]").getByText("A roll of honey").first()).toBeVisible();
    expect(await langOf(page, "A roll of honey"), "original").toMatch(/^en/);
    expect(await langOf(page, "A honey roll"), "corrigido").toMatch(/^en/);
  });
});
