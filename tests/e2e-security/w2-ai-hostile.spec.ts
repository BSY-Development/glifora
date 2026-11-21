// W2-24 (alvos 4 e 5): resposta hostil do "Gemini" simulado, erros HTTP, laços e corrida. Dono: QA Tester.
// Regra: nada vira HTML; XP, estrelas e a rodada não mudam; item ruim derruba só aquela fala; no máximo 2 chamadas por pedido.
import { expect, test, type Page } from "@playwright/test";
import { TURNS, aiAlert, aiSection, gemini, mockGemini, reportWithKey, review, reviewButton, type Reply } from "./support/ai";
import { idbAll, payload, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const bad = payload<{ bad_texts: { id: string; text: string }[]; text_only_ok: { id: string; text: string }[] }>("ai-responses.json");
const body = (o: unknown): Reply => ({ json: gemini(JSON.stringify(o)) });
const items = (page: Page) => aiSection(page).locator("ol > li");

/** Tudo o que não pode mudar com a revisão: eventos (XP), rodadas e a sessão. */
async function ledger(page: Page) {
  return JSON.stringify([await idbAll(page, "events"), await idbAll(page, "runs"), await idbAll(page, "session")]);
}
async function shows(page: Page) {
  await reviewButton(page).click();
}

test.describe("item ruim derruba só aquela fala", () => {
  for (const { id, text } of [...bad.bad_texts, { id: "too-long", text: "x".repeat(5000) }]) {
    for (const field of ["natural", "tip"] as const) {
      test(`texto hostil '${id}' no campo ${field} da fala 2: some só essa fala, as outras 5 aparecem, nada vira HTML e o jogo não muda`, async ({ page }) => {
        const problems = watch(page);
        const mock = await mockGemini(page, () => body(review(TURNS, (it, k) => (k === 1 ? { ...it, [field]: text } : it))));
        await reportWithKey(page);
        const before = await ledger(page);
        await shows(page);
        await expect(items(page).first()).toBeVisible();
        expect(await items(page).count()).toBe(TURNS - 1);
        expect(mock.calls).toHaveLength(1);
        expect(await aiSection(page).locator("img, script, a, iframe, svg").count()).toBe(0);
        expect(await page.content()).not.toContain("onerror=alert");
        expect(await ledger(page)).toBe(before);
        expect(problems).toEqual([]);
      });
    }
  }

  test("um item 'natural' de uma fala que o jogo casou como boa: vale; sem dica nem correção", async ({ page }) => {
    await mockGemini(page, () => body(review(TURNS, (it) => ({ ...it, verdict: "natural", natural: "", tip: "" }))));
    await reportWithKey(page);
    await shows(page);
    await expect(aiSection(page).getByText("That sounded natural.").first()).toBeVisible();
    expect(await items(page).count()).toBe(TURNS);
  });

  test("'fix' cuja correção é a própria fala: a fala volta sem IA", async ({ page }) => {
    await mockGemini(page, () => body(review(TURNS, (it, k) => (k === 2 ? { ...it, verdict: "fix", correction: "Two, please.", natural: "", tip: "ok" } : it))));
    await reportWithKey(page);
    await shows(page);
    await expect(items(page).first()).toBeVisible();
    expect(await items(page).count()).toBe(TURNS - 1);
  });

  for (const { id, text } of bad.text_only_ok) {
    test(`texto estranho mas só texto '${id}': aparece como texto, não executa, sem link`, async ({ page }) => {
      const problems = watch(page);
      await mockGemini(page, () => body(review(TURNS, (it, k) => (k === 0 ? { ...it, tip: text } : it))));
      await reportWithKey(page);
      await shows(page);
      await expect(items(page).first()).toBeVisible();
      expect(await aiSection(page).locator("a, img, script, [onclick], iframe").count()).toBe(0);
      expect(await aiSection(page).innerText()).toContain(text.slice(0, 12));
      expect(problems).toEqual([]);
    });
  }

  test("'[name]' devolvido pela IA vira o nome falado da pessoa; sem apelido some sem sobrar espaço nem vírgula", async ({ page }) => {
    await mockGemini(page, () => body(review(TURNS, (it, k) => (k === 0 ? { ...it, natural: "Hello, [name], can I have bread?" } : it))));
    await reportWithKey(page, { nickname: "Zorbax" });
    await shows(page);
    await expect(items(page).first()).toContainText("Hello, Zorbax, can I have bread?");
  });
});

test.describe("envelope quebrado falha tudo (1 nova tentativa, nunca laço)", () => {
  const cases: [string, (n: number) => Reply][] = [
    ["campo a mais no item", () => body(review(TURNS, (it) => ({ ...it, evil: "x" })))],
    ["campo a mais na raiz", () => body({ ...review(TURNS), extra: 1 })],
    ["itens a menos", () => body(review(TURNS - 1))],
    ["itens a mais", () => body(review(TURNS + 3))],
    ["índice fora de ordem", () => body({ items: review(TURNS).items.reverse() })],
    ["índice repetido", () => body(review(TURNS, (it) => ({ ...it, i: 0 })))],
    ["veredito fora da lista", () => body(review(TURNS, (it) => ({ ...it, verdict: "perfect" })))],
    ["veredito com lixo", () => body(review(TURNS, (it) => ({ ...it, verdict: "fix\u0000" })))],
    ["tipo errado (i como texto)", () => body({ items: review(TURNS).items.map((it) => ({ ...it, i: String(it.i) })) })],
    ["JSON quebrado", () => ({ json: gemini('{"items":[{"i":0,') })],
    ["texto que não é JSON", () => ({ json: gemini("Sure! Here is my review.") })],
    ["200 com corpo vazio", () => ({ text: "" })],
    ["200 com HTML", () => ({ text: "<html><script>alert(1)</script></html>" })],
    ["200 com array na raiz", () => body([])],
    ["candidates vazio", () => ({ json: { candidates: [] } })],
    ["candidate sem texto", () => ({ json: { candidates: [{ content: { parts: [] }, finishReason: "STOP" }] } })],
    ["MAX_TOKENS", () => ({ json: gemini('{"items":[', { finishReason: "MAX_TOKENS" }) })],
    ["SAFETY", () => ({ json: { candidates: [{ finishReason: "SAFETY" }] } })],
    ["promptFeedback bloqueado", () => ({ json: { promptFeedback: { blockReason: "OTHER" } } })],
    ["__proto__ na raiz", () => ({ text: gemini('{"__proto__":{"polluted":1},"items":[]}').candidates[0]!.content.parts[0]!.text })],
  ];
  for (const [name, reply] of cases) {
    test(`${name}: aviso claro, no máximo 2 chamadas, nada muda`, async ({ page }) => {
      const problems = watch(page);
      const mock = await mockGemini(page, (_s, n) => reply(n));
      await reportWithKey(page);
      const before = await ledger(page);
      await shows(page);
      await expect(aiAlert(page).or(page.getByRole("alert")).first()).toBeVisible();
      await page.waitForTimeout(1500);
      expect(mock.calls.length, "chamadas").toBeLessThanOrEqual(2);
      expect(await items(page).count()).toBe(0);
      expect(await ledger(page)).toBe(before);
      expect(await page.evaluate(() => ({}).hasOwnProperty.call(Object.prototype, "polluted"))).toBe(false);
      expect(await page.getByRole("alert").first().innerText()).toMatch(/AI|answer|Google|Something/i);
      await expect(reviewButton(page)).toBeEnabled();
      expect(problems.filter((p) => !p.startsWith("console.error: Failed to load resource"))).toEqual([]);
    });
  }

  test("primeira tentativa quebrada e a segunda boa: a revisão aparece (1 nova tentativa)", async ({ page }) => {
    const mock = await mockGemini(page, (_s, n) => (n === 1 ? { json: gemini("nope") } : body(review(TURNS))));
    await reportWithKey(page);
    await shows(page);
    await expect(items(page).first()).toBeVisible();
    expect(mock.calls).toHaveLength(2);
  });
});

const MSG = {
  400: ["Something went wrong with the AI.", 2],
  401: ["The key was not accepted", 1],
  402: ["The credits or billing", 1],
  403: ["The key was not accepted", 1],
  404: ["The AI model is not available", 1],
  500: ["The Google service is having trouble.", 2],
  503: ["The Google service is having trouble.", 2],
} as const;

test.describe("erros HTTP: a mensagem certa e as chamadas certas", () => {
  for (const [status, [text, calls]] of Object.entries(MSG)) {
    test(`HTTP ${status}: '${text}' com ${calls} chamada(s)`, async ({ page }) => {
      const mock = await mockGemini(page, () => ({ status: Number(status), json: { error: { code: Number(status), message: "x" } } }));
      await reportWithKey(page);
      await shows(page);
      await expect(page.getByRole("alert").first()).toContainText(text);
      await page.waitForTimeout(1500);
      expect(mock.calls).toHaveLength(calls);
    });
  }

  test("429 com 'billing details' (o texto padrão do Google): é cota, não crédito; 1 chamada", async ({ page }) => {
    const mock = await mockGemini(page, () => ({ status: 429, json: { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota, please check your plan and billing details." } } }));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("The free quota for today is used up.");
    expect(mock.calls).toHaveLength(1);
  });

  test("429 sem texto algum: é cota", async ({ page }) => {
    await mockGemini(page, () => ({ status: 429, text: "" }));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("The free quota for today is used up.");
  });

  test("429 que fala de créditos esgotados (prepay): é crédito", async ({ page }) => {
    await mockGemini(page, () => ({ status: 429, json: { error: { code: 429, message: "Your prepayment credits are depleted." } } }));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("The credits or billing");
  });

  test("400 da key inválida (API_KEY_INVALID): 'key não aceita', 1 chamada", async ({ page }) => {
    const mock = await mockGemini(page, () => ({ status: 400, json: { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key.", details: [{ reason: "API_KEY_INVALID" }] } } }));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("The key was not accepted");
    expect(mock.calls).toHaveLength(1);
  });

  test("região não atendida (400 FAILED_PRECONDITION)", async ({ page }) => {
    await mockGemini(page, () => ({ status: 400, json: { error: { code: 400, status: "FAILED_PRECONDITION", message: "User location is not supported for the API use." } } }));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("Google does not serve your region");
  });

  test("offline (conexão cai): 'sem internet', 2 chamadas no máximo, e volta ao normal depois", async ({ page }) => {
    let down = true;
    const mock = await mockGemini(page, () => (down ? { abort: true } : body(review(TURNS))));
    await reportWithKey(page);
    await shows(page);
    await expect(page.getByRole("alert").first()).toContainText("No internet connection.");
    await page.waitForTimeout(1500);
    expect(mock.calls.length).toBeLessThanOrEqual(2);
    down = false;
    await shows(page);
    await expect(items(page).first()).toBeVisible();
  });

  test("tudo erro sem texto do servidor: a mensagem do Google (HTML) nunca aparece fora do 'Detalhe' limpo", async ({ page }) => {
    await mockGemini(page, () => ({ status: 418, json: { error: { code: 418, message: "<img src=x onerror=alert(1)><script>alert(2)</script>202e evil\u0000" } } }));
    await reportWithKey(page);
    await shows(page);
    const alert = page.getByRole("alert").first();
    await expect(alert).toContainText("Detail:");
    expect(await alert.locator("img, script").count()).toBe(0);
    const shown = await alert.innerText();
    expect(Array.from(shown).filter((c) => /[<>\p{Cc}\p{Cf}]/u.test(c) && c !== String.fromCharCode(10)).map((c) => c.codePointAt(0))).toEqual([]);
  });
});

test.describe("laços, corrida e tempo", () => {
  test("tocar 'Revisar com IA' 20 vezes no mesmo instante: 1 chamada, o botão não dispara em paralelo", async ({ page }) => {
    const mock = await mockGemini(page, () => ({ ...body(review(TURNS)), delayMs: 600 }));
    await reportWithKey(page);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Review with AI/.test(x.textContent ?? ""))!;
      for (let i = 0; i < 20; i += 1) b.click();
    });
    await expect(items(page).first()).toBeVisible();
    expect(mock.calls).toHaveLength(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("tocar 'Tentar de novo' 20 vezes seguidas (erro 500): no máximo 2 chamadas por pedido, sem laço depois", async ({ page }) => {
    test.setTimeout(120_000);
    const mock = await mockGemini(page, () => ({ status: 500, json: {} }));
    await reportWithKey(page);
    let requests = 0;
    for (let i = 0; i < 20; i += 1) {
      const btn = reviewButton(page);
      await btn.click({ timeout: 15_000 });
      requests += 1;
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "reading" })).toHaveCount(0);
    }
    const settled = mock.calls.length;
    expect(settled).toBeLessThanOrEqual(2 * requests);
    await page.waitForTimeout(3000);
    expect(mock.calls.length, "chamadas continuaram sozinhas").toBe(settled);
  });

  test("resposta que chega depois de sair da tela: não quebra nada e, ao voltar, a revisão está lá sem nova chamada", async ({ page }) => {
    const problems = watch(page);
    const mock = await mockGemini(page, () => ({ ...body(review(TURNS)), delayMs: 1500 }));
    await reportWithKey(page);
    await shows(page);
    await page.getByRole("link", { name: /Home|Village|Start|Back/ }).first().click();
    await page.waitForTimeout(2500);
    await page.goBack();
    await expect(page).toHaveURL(/\/report\//);
    await expect(items(page).first()).toBeVisible();
    expect(mock.calls).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  test("resposta lenta (30 s, sem resposta): 'demorou demais', 1 + no máximo 1 tentativa; o jogo segue", async ({ page }) => {
    await page.clock.install();
    const mock = await mockGemini(page, () => ({ hang: true }));
    await reportWithKey(page);
    await shows(page);
    await expect(aiSection(page).getByRole("status")).toContainText("reading");
    // O relógio de 30 s só existe depois que o fetch saiu: adiantar antes disso não dispara nada (falhou assim no CI do be3c77d).
    await expect.poll(() => mock.calls.length).toBe(1);
    await page.clock.fastForward(31_000);
    await expect(page.getByRole("alert").first()).toContainText("The AI took too long to answer.");
    expect(mock.calls.length).toBeLessThanOrEqual(2);
    await expect(reviewButton(page)).toBeEnabled();
  });

  test("F-W2-24-03 (baixo): apagar a key com o pedido no ar: a resposta não pode ressuscitar a revisão depois do 'Apagar minha key'", async ({ page }) => {
    const mock = await mockGemini(page, () => ({ ...body(review(TURNS)), delayMs: 1500 }));
    await reportWithKey(page);
    await shows(page);
    await expect.poll(() => mock.calls.length).toBe(1);
    // apaga por dentro do app (sem recarregar a página, para não matar o pedido)
    await page.evaluate(() => {
      history.pushState({}, "", "/settings/ai");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.getByRole("button", { name: "Delete my key" }).click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      history.back();
    });
    await expect(page).toHaveURL(/\/report\//);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("glifora.key")))).toEqual([]);
    await expect(items(page)).toHaveCount(0);
  });

  test("a revisão nunca muda XP, estrelas nem a rodada, e não fica em lugar nenhum além da memória da aba", async ({ page }) => {
    await mockGemini(page, () => body(review(TURNS)));
    await reportWithKey(page);
    const xp = await page.getByText(/^Total: \d+ XP$/).innerText();
    const before = await ledger(page);
    await shows(page);
    await expect(items(page).first()).toBeVisible();
    expect(await page.getByText(/^Total: \d+ XP$/).innerText()).toBe(xp);
    expect(await ledger(page)).toBe(before);
    const dump = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    expect(dump).not.toContain("natural");
    expect(dump).not.toContain("Can I have some bread");
    await page.reload();
    await expect(page.getByRole("button", { name: /Review with AI/ })).toBeVisible(); // memória da aba: some ao recarregar
  });
});
