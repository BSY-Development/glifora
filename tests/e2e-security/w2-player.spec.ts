// W2-13 — player: offline no meio, troca de idioma, duas abas, voltar/avançar, recarregar em cada passo, ids estranhos em /play e /report.
// Pagamento único e XP sempre iguais ao caminho reto (bakery-01, modo 1, 1ª vez: 128 XP). Dono: QA Tester.
import { expect, test, type Page } from "@playwright/test";
import { installSpeech } from "../e2e/support/speech";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, next, setUi, skipListen, startMission, type, xpTotal } from "../e2e/support/play";
import { idbAll, onboard, sessionAt, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const resume = async (page: Page, phase: string, steps: number) => {
  await sessionAt(page, phase, steps);
  await page.goto("/play/bakery-01");
  await page.getByRole("button", { name: /Continue where I/ }).click();
};
const seeReport = async (page: Page) => {
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page).toHaveURL(/\/report\//);
};
/** Espera o service worker assumir a página (como numa 2ª visita), para o teste offline ser fiel. */
async function underServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}
const startFresh = async (page: Page) => {
  await page.goto("/play/bakery-01");
  const restart = page.getByRole("button", { name: "Start over" });
  const radio = page.getByRole("radio", { name: /With the phrase/ });
  await expect(restart.or(radio).first()).toBeVisible();
  if (await restart.isVisible()) await restart.click();
  await page.getByRole("radio", { name: /With the phrase/ }).check();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await skipListen(page);
};
async function ledger(page: Page) {
  const events = await idbAll(page, "events");
  const ids = events.map((e) => String(e["id"]));
  return { events, ids, xp: events.reduce((s, e) => s + Number(e["xp"]), 0), runs: await idbAll(page, "runs") };
}

test.describe("recarregar em cada passo", () => {
  test("escuta, fala, reação, fecho e fim: a rodada retoma do mesmo ponto e paga 128 XP uma vez", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await page.goto("/play/bakery-01");
    await page.getByRole("radio", { name: /With the phrase/ }).check();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    // escuta
    await expect(page.getByRole("heading", { name: "Listen to the scene" })).toBeVisible();
    await resume(page, "listen", 0);
    await skipListen(page);
    // fala (pergunta)
    await expect(page.locator("#answer-text")).toBeVisible();
    await resume(page, "ask", 0);
    await expect(page.locator("#answer-text")).toBeVisible();
    await type(page, BAKERY_REPLIES[0]);
    // reação
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await resume(page, "react", 1);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await next(page);
    await answerAllByText(page, BAKERY_REPLIES.slice(1));
    // fecho
    await expect(page.getByRole("heading", { name: "Now, in your own words" })).toBeVisible();
    await resume(page, "closing", 5);
    await expect(page.getByRole("heading", { name: "Now, in your own words" })).toBeVisible();
    await type(page, CLOSING_OWN);
    // fim (a rodada já foi gravada; recarregar antes de abrir o relatório não pode pagar de novo nem perder a rodada)
    await expect(page.getByRole("button", { name: "See the report" })).toBeVisible();
    const [saved] = await idbAll(page, "runs");
    expect(saved, "a rodada foi gravada ao fechar").toBeTruthy();
    await page.goto("/play/bakery-01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(`/report/${String(saved!["id"])}`);
    expect(await xpTotal(page)).toBe(128);
    await page.reload();
    expect(await xpTotal(page)).toBe(128);
    const l = await ledger(page);
    expect(l.runs.length, "uma rodada só").toBe(1);
    expect(l.xp).toBe(128);
    expect(new Set(l.ids).size).toBe(l.ids.length);
    expect(problems).toEqual([]);
  });
});

test.describe("voltar e avançar do navegador", () => {
  test("no meio da missão, na reação e no relatório: nada duplica e nada quebra", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, BAKERY_REPLIES[0]);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await resume(page, "react", 1);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await next(page);
    await answerAllByText(page, BAKERY_REPLIES.slice(1));
    await type(page, CLOSING_OWN);
    await seeReport(page);
    expect(await xpTotal(page)).toBe(128);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/report\//);
    expect(await xpTotal(page)).toBe(128);
    const l = await ledger(page);
    expect(l.xp).toBe(128);
    expect(l.runs.length).toBe(1);
    expect(problems).toEqual([]);
  });
});

test.describe("offline e idioma", () => {
  test("offline no meio da missão: a rodada termina, grava e o relatório abre", async ({ page, context }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await underServiceWorker(page);
    await startMission(page, "phrase");
    await type(page, BAKERY_REPLIES[0]);
    await context.setOffline(true);
    await next(page);
    await answerAllByText(page, BAKERY_REPLIES.slice(1));
    await type(page, CLOSING_OWN);
    await seeReport(page);
    expect(await xpTotal(page)).toBe(128);
    await context.setOffline(false);
    expect(problems.filter((p) => !/Failed to load resource|net::ERR/.test(p))).toEqual([]);
  });

  test("trocar o idioma da interface no meio: a fala e o progresso ficam, e a rodada fecha com o mesmo XP", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, BAKERY_REPLIES[0]);
    await setUi(page, "pt-BR");
    await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await setUi(page, "en");
    await expect(page.locator("#answer-text")).toBeVisible();
    await type(page, BAKERY_REPLIES[1]);
    await setUi(page, "pt-BR");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await setUi(page, "en");
    await answerAllByText(page, BAKERY_REPLIES.slice(2));
    await type(page, CLOSING_OWN);
    await seeReport(page);
    expect(await xpTotal(page)).toBe(128);
    expect(problems).toEqual([]);
  });
});

test.describe("duas abas na mesma missão", () => {
  test("as duas terminam: prêmio único (first/star) não é pago em dobro e nada quebra", async ({ page, context }) => {
    test.setTimeout(60_000);
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    const other = await context.newPage();
    const problems2 = watch(other);
    await installSpeech(other, "ok", { consent: true });
    await startFresh(page);
    await startFresh(other);
    await type(page, BAKERY_REPLIES[0]);
    await type(other, BAKERY_REPLIES[0]);
    await next(page);
    await next(other);
    await Promise.all([answerAllByText(page, BAKERY_REPLIES.slice(1)), answerAllByText(other, BAKERY_REPLIES.slice(1))]);
    await Promise.all([type(page, CLOSING_OWN), type(other, CLOSING_OWN)]);
    await Promise.all([seeReport(page), seeReport(other)]);
    const l = await ledger(page);
    expect(l.events.filter((e) => e["kind"] === "mission_first").length, "prêmio da 1ª conclusão pago em dobro").toBe(1);
    expect(l.events.filter((e) => e["kind"] === "mission_star").length, "estrela 1 paga em dobro").toBe(1);
    expect(new Set(l.ids).size).toBe(l.ids.length);
    expect(l.runs.length).toBeLessThanOrEqual(2);
    expect(await idbAll(page, "session")).toHaveLength(0);
    expect(problems).toEqual([]);
    expect(problems2).toEqual([]);
  });

  test("a aba A termina e a aba B (mesma rodada, em tela) continua: não quebra e não paga a rodada de novo", async ({ page, context }) => {
    test.setTimeout(60_000);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    const other = await context.newPage();
    await installSpeech(other, "ok", { consent: true });
    await startMission(other, "phrase");
    await type(other, BAKERY_REPLIES[0]);
    await resume(page, "react", 1);
    await next(page);
    await answerAllByText(page, BAKERY_REPLIES.slice(1));
    await type(page, CLOSING_OWN);
    await seeReport(page);
    const before = await ledger(page);
    await next(other);
    await answerAllByText(other, BAKERY_REPLIES.slice(1));
    await type(other, CLOSING_OWN);
    await seeReport(other);
    const after = await ledger(page);
    expect(after.xp, "a mesma rodada paga duas vezes").toBe(before.xp);
    expect(after.runs.length).toBe(1);
  });
});

const WEIRD_IDS = [
  "../../etc/passwd",
  "..%2f..%2fetc%2fpasswd",
  "%00",
  "<script>alert(1)</script>",
  "%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E",
  "__proto__",
  "constructor",
  "toString",
  "bakery-01/../tavern-01",
  "bakery-01%00",
  "nao-existe-99",
  "BAKERY-01",
  "%E2%80%AEbakery-01",
  "a".repeat(5000),
  "%F0%9F%98%80",
  "javascript:alert(1)",
  "bakery-01?x=1#y",
];

test.describe("ids estranhos", () => {
  for (const [i, id] of WEIRD_IDS.entries()) {
    test(`/play/${id.slice(0, 30)} (#${i}): tela amigável, sem exceção, sem HTML injetado`, async ({ page }) => {
      const problems = watch(page);
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));
      await onboard(page);
      await page.goto(`/play/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Loading" })).toHaveCount(0);
      expect(await page.locator("img[src=x], script:not([src])").count()).toBe(0);
      expect(await page.locator("main").innerText()).not.toMatch(/TypeError|undefined|\[object|NaN|at \w+ \(/);
      expect(requests.filter((u) => !u.startsWith("http://localhost:4173")), "pediu domínio externo").toEqual([]);
      expect(problems).toEqual([]);
    });
    test(`/report/${id.slice(0, 30)} (#${i}): sem exceção, sem HTML injetado`, async ({ page }) => {
      const problems = watch(page);
      await onboard(page);
      await page.goto(`/report/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Loading" })).toHaveCount(0);
      expect(await page.locator("img[src=x], script:not([src])").count()).toBe(0);
      expect(await page.locator("main").innerText()).not.toMatch(/TypeError|undefined|\[object|NaN/);
      expect(problems).toEqual([]);
    });
  }

  test("URL com percent-encoding malformado (%E0%A4%A) servida pelo fallback de SPA: sem exceção solta", async ({ page }) => {
    const problems = watch(page);
    await onboard(page);
    // o vite preview responde 404 a essa URL; o Cloudflare Pages devolve o index.html (200). Imita o Cloudflare.
    const html = await (await page.request.get("/")).text();
    for (const path of ["/play/%E0%A4%A", "/report/%E0%A4%A", "/place/%E0%A4%A"]) {
      await page.route(`**${path}`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
      await page.goto(path);
      await expect(page.locator("body")).not.toBeEmpty();
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    }
    expect(problems).toEqual([]);
  });

  test("/report/<rodada de uma missão que não existe no catálogo, com padrão desconhecido> abre sem quebrar", async ({ page }) => {
    const problems = watch(page);
    await onboard(page);
    const body = `{"format":"glifora-export","version":1,"exportedAt":"2026-11-20T15:00:00Z","app":"0.1.0","device":"dev-x","docs":[],"events":[],"runs":[{"id":"orfa","missionId":"nao-existe-99","at":1795176000000,"day":"2026-11-20","level":1,"xp":10,"rules":1,"canDo":true,"replies":{"good":1,"flawed":0,"retry":0},"recasts":[{"pattern":"padrao-que-nao-existe","count":2}],"words":[],"answers":[],"device":"dev-y"}]}`;
    await page.goto("/settings");
    await page.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from(body) });
    await expect(page.locator('.notice[role="status"]')).toBeVisible();
    await page.goto("/report/orfa");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading" })).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(/TypeError|undefined|\[object|NaN/);
    expect(problems).toEqual([]);
  });
});
