// W2-13 — voz: sem microfone, permissão negada e revogada no meio, reconhecedor que devolve lixo, TTS ausente ou travado,
// muitos toques seguidos no microfone. O dublê é roteirizado (support/voice.ts). Dono: QA Tester.
import { expect, test, type Page } from "@playwright/test";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, next, startMission, type, xpTotal } from "../e2e/support/play";
import { CH, hiddenChars, idbAll, onboard, watch } from "./support/w2";
import { installHostileVoice, script, sttStats, type SttStep, type TtsMode } from "./support/voice";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const mic = (page: Page) => page.getByRole("button", { name: /Tap and speak|Stop listening/ });

async function begin(page: Page, opts: { tts?: TtsMode; stt?: "ok" | "none" } = {}) {
  const problems = watch(page);
  await installHostileVoice(page, opts);
  await onboard(page);
  await startMission(page, "phrase");
  return problems;
}

async function finish(page: Page, replies = BAKERY_REPLIES.slice(0)) {
  await answerAllByText(page, replies);
  await type(page, CLOSING_OWN);
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page).toHaveURL(/\/report\//);
}

test.describe("microfone ausente, negado e revogado", () => {
  test("sem a API de escuta: o microfone some, o texto leva a missão até o fim", async ({ page }) => {
    const problems = await begin(page, { stt: "none" });
    await expect(mic(page)).toHaveCount(0);
    await finish(page);
    expect(await xpTotal(page)).toBe(128);
    expect(problems).toEqual([]);
  });

  test("permissão negada no meio: aviso claro, o texto continua e o XP é o mesmo", async ({ page }) => {
    const problems = await begin(page);
    await script(page, { alts: ["Good morning!"] }, { error: "not-allowed" }, { error: "service-not-allowed" });
    await mic(page).click();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await next(page);
    await mic(page).click();
    await expect(page.getByText(/microphone is blocked/i)).toBeVisible();
    await mic(page).click();
    await expect(page.getByText(/microphone is blocked/i)).toBeVisible();
    await finish(page, BAKERY_REPLIES.slice(1));
    expect(await xpTotal(page)).toBe(128);
    expect(problems).toEqual([]);
  });

  test("permissão revogada e devolvida: nenhum estado preso", async ({ page }) => {
    const problems = await begin(page);
    await script(page, { error: "not-allowed" }, { error: "audio-capture" }, { alts: ["Good morning!"] });
    await mic(page).click();
    await expect(page.getByText(/microphone is blocked/i)).toBeVisible();
    await mic(page).click();
    await expect(page.getByText(/cannot listen|no microphone/i)).toBeVisible();
    await mic(page).click();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("start() lançando InvalidStateError: não quebra e o texto responde", async ({ page }) => {
    const problems = await begin(page);
    await script(page, { throwOnStart: true });
    await mic(page).click();
    await type(page, BAKERY_REPLIES[0]);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  });
});

const GARBAGE: Record<string, SttStep> = {
  vazio: { alts: [""] },
  espacos: { alts: ["     "] },
  controle: { alts: ["\u0000\u0001\u0007\u001b[31m"] },
  rtl: { alts: ["‮evil‬"] },
  "zero-width": { alts: ["Good​ morning‍!"] },
  "bidi-isolates": { alts: ["⁦Good morning⁩"] },
  html: { alts: ["<script>alert(1)</script><img src=x onerror=alert(2)>"] },
  marcadores: { alts: ["{player} $& $1 $` $' ${x} %s %d"] },
  proto: { alts: ["__proto__ toString valueOf hasOwnProperty"] },
  "surrogate-solto": { alts: ["\ud800 ok \udfff"] },
  "100-alternativas": { alts: Array.from({ length: 100 }, (_, i) => `alternativa ${i}`) },
  "confianca-nan": { alts: ["Good morning!"], confidence: [Number.NaN] },
  "confianca-negativa": { alts: ["Good morning!"], confidence: [-5] },
  "confianca-infinita": { alts: ["Good morning!"], confidence: [1e308] },
  "interim-html": { interim: "<img src=x onerror=alert(1)>", alts: ["zzz"] },
  "interim-gigante": { interim: "x".repeat(200_000), alts: ["zzz"] },
  "texto-100k": { genLength: 100_000 },
  "texto-1M": { genLength: 1_000_000 },
  "unicode-emoji": { alts: ["😀".repeat(500)] },
  "so-lixo-e-erro-depois": { alts: ["???"], error: "network" },
};

test.describe("reconhecedor devolve lixo", () => {
  for (const [id, step] of Object.entries(GARBAGE)) {
    test(`lixo: ${id} — nada executa, a tela segue e dá para terminar por texto`, async ({ page }) => {
      test.setTimeout(60_000);
      const problems = await begin(page);
      await script(page, step);
      const t0 = Date.now();
      await mic(page).click();
      // a tela assenta: pede de novo, mostra o aviso, ou seguiu (o lixo casou com algo)
      await expect(mic(page).or(page.getByRole("button", { name: "Continue", exact: true })).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Listening…")).toHaveCount(0, { timeout: 15_000 });
      expect(Date.now() - t0, "travou para processar o lixo").toBeLessThan(8000);
      expect(await page.locator("img[src=x], script:not([src])").count(), "HTML virou elemento").toBe(0);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/TypeError|\[object|NaN|undefined/);
      // continua jogável por texto
      if (await page.locator("#answer-text").isVisible()) await finish(page);
      expect(problems).toEqual([]);
    });
  }

  test("fecho dito em voz: transcrição de 1 MB, bidi e controle viram texto curto e limpo na rodada gravada", async ({ page }) => {
    test.setTimeout(90_000);
    const problems = await begin(page);
    await answerAllByText(page, BAKERY_REPLIES);
    await expect(page.getByRole("heading", { name: "Now, in your own words" })).toBeVisible();
    await script(page, { alts: [`I want ${CH.rlo}bread${CH.zwsp} <b>x</b> ${CH.nul} ${"z".repeat(5000)}`] });
    await mic(page).click();
    await expect(page.getByRole("button", { name: "See the report" })).toBeVisible({ timeout: 20_000 });
    const [run] = await idbAll(page, "runs");
    expect(run, "rodada não gravada").toBeTruthy();
    const closing = (run!["closing"] as { text: string }).text;
    expect(closing.length).toBeLessThanOrEqual(300);
    expect(closing).not.toMatch(/[<>]/);
    expect(hiddenChars(closing), "controle/bidi/invisível na rodada gravada").toBe(false);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.locator("main")).toContainText("I want");
    expect(await page.locator("main b").count()).toBe(0);
    expect(problems).toEqual([]);
  });
});

test.describe("microfone que trava", () => {
  test("reconhecedor que nunca termina: dá para parar, e o texto responde", async ({ page }) => {
    const problems = await begin(page);
    await script(page, { hang: true });
    await mic(page).click();
    await expect(mic(page)).toHaveText(/Stop listening/);
    await mic(page).click();
    await expect(mic(page)).toHaveText(/Tap and speak/);
    expect((await sttStats(page)).live, "reconhecedor ficou aberto").toBe(0);
    await type(page, BAKERY_REPLIES[0]);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("sair da tela enquanto escuta: aborta o reconhecedor, sem exceção", async ({ page }) => {
    const problems = await begin(page);
    await script(page, { hang: true });
    await mic(page).click();
    await expect(mic(page)).toHaveText(/Stop listening/);
    await page.getByRole("link", { name: "Back to the place" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(async () => (await sttStats(page)).live, { message: "reconhecedor ficou aberto depois de sair" }).toBe(0);
    expect(problems).toEqual([]);
  });

  test("30 toques seguidos no microfone: um reconhecedor por vez, a resposta conta uma vez e o XP não dobra", async ({ page }) => {
    test.setTimeout(60_000);
    const problems = await begin(page);
    await script(page, ...Array.from({ length: 40 }, () => ({ alts: ["Good morning!"] }) as SttStep));
    for (let i = 0; i < 30; i += 1) await mic(page).click({ timeout: 2000, noWaitAfter: true }).catch(() => undefined);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    const stats = await sttStats(page);
    expect(stats.maxLive, "mais de um reconhecedor aberto ao mesmo tempo").toBeLessThanOrEqual(1);
    const [row] = await idbAll(page, "session");
    expect((row!["state"] as { steps: unknown[] }).steps.length, "a mesma fala contada mais de uma vez").toBe(1);
    await next(page);
    await finish(page, BAKERY_REPLIES.slice(1));
    expect(await xpTotal(page)).toBe(128);
    expect(problems).toEqual([]);
  });

  test("toque duplo no 'Continuar' do aviso de privacidade: um reconhecedor só", async ({ page }) => {
    const problems = watch(page);
    await installHostileVoice(page, { consent: false });
    await onboard(page);
    await startMission(page, "phrase");
    await script(page, { alts: ["Good morning!"] }, { alts: ["Good morning!"] });
    await mic(page).click();
    const accept = page.getByRole("button", { name: "Continue", exact: true });
    await expect(accept).toBeVisible();
    await accept.dblclick({ noWaitAfter: true }).catch(() => undefined);
    await expect(page.getByText("Listening…")).toHaveCount(0, { timeout: 10_000 });
    await expect(mic(page).or(page.getByRole("button", { name: "Continue", exact: true })).first()).toBeVisible();
    expect((await sttStats(page)).maxLive).toBeLessThanOrEqual(1);
    expect(problems).toEqual([]);
  });
});

test.describe("síntese de voz (TTS)", () => {
  // "throw" (speak() que lança) é o achado F-W2-13-03, em w2-findings.spec.ts
  for (const mode of ["absent", "hang", "no-voices"] as const) {
    test(`TTS ${mode}: a missão se joga até o fim e o relatório abre`, async ({ page }) => {
      test.setTimeout(60_000);
      const problems = await begin(page, { tts: mode });
      await finish(page);
      expect(await xpTotal(page)).toBe(128);
      expect(problems).toEqual([]);
    });
  }
});
