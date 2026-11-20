// W2-13 — teste das frases em /settings/voice (W2-16): o resultado copiado não leva nada além do que está na tela.
// Transcrições hostis (quebra de linha, bidi, largura zero, HTML, texto enorme) não podem forjar linhas nem trazer controle. Dono: QA Tester.
import { expect, test, type Page } from "@playwright/test";
import { installHostileVoice, script } from "./support/voice";
import { CH, hiddenChars, onboard, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

async function runTest(page: Page, transcripts: (string | { genLength: number })[]) {
  await page.goto("/settings/voice");
  await page.getByRole("button", { name: "Start the test" }).click();
  for (let i = 0; i < transcripts.length; i += 1) {
    const t = transcripts[i]!;
    await script(page, typeof t === "string" ? { alts: [t] } : { genLength: t.genLength });
    await page.getByRole("button", { name: "Tap and read the phrase" }).click();
    await expect(page.getByRole("button", { name: "Repeat this phrase" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "See summary" }).click();
}

test("copiar resultado: o texto copiado é idêntico ao da tela e tem uma linha por frase tentada", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const problems = watch(page);
  await installHostileVoice(page);
  await onboard(page);
  await runTest(page, ["Good morning", "I would like bread", "zzz"]);
  await page.getByRole("button", { name: "Copy result" }).click();
  await expect(page.getByText(/Copied/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const shown = await page.locator("#voice-test-text").inputValue();
  expect(copied.split("\r\n").join("\n")).toBe(shown); // o Windows entrega o clipboard com CRLF
  expect(copied.split("\n").length).toBe(1 + 3);
  expect(problems).toEqual([]);
});

test("transcrição com quebra de linha não forja linhas extras no resultado copiado (F-W2-13-05)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installHostileVoice(page);
  await onboard(page);
  await runTest(page, ["hello\nbakery-01.fake | expected a | matched a | heard ok", "second"]);
  await page.getByRole("button", { name: "Copy result" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n").length, "linhas forjadas no texto copiado").toBe(1 + 2);
});

test("transcrição com controle, bidi e largura zero não vai para o texto copiado (F-W2-13-05)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installHostileVoice(page);
  await onboard(page);
  await runTest(page, [["a", CH.rlo, "b", CH.zwsp, "c", CH.bel, "d", CH.lri, "e"].join("")]);
  await page.getByRole("button", { name: "Copy result" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(hiddenChars(copied.split(String.fromCharCode(13)).join("").split(String.fromCharCode(10)).join("")), "controle/bidi/invisivel no texto copiado").toBe(false);
});

test("HTML na transcrição aparece só como texto na tela do teste e no resumo", async ({ page }) => {
  const problems = watch(page);
  await installHostileVoice(page);
  await onboard(page);
  await runTest(page, ["<img src=x onerror=alert(1)><script>alert(2)</script>", "<b>bold</b>"]);
  expect(await page.locator("main img[src=x], main script, main b").count()).toBe(0);
  expect(problems).toEqual([]);
});

test("transcrição de 100 mil caracteres: a tela do teste e o resumo continuam respondendo", async ({ page }) => {
  test.setTimeout(60_000);
  const problems = watch(page);
  await installHostileVoice(page);
  await onboard(page);
  const t0 = Date.now();
  await runTest(page, [{ genLength: 100_000 }, { genLength: 100_000 }]);
  await expect(page.getByRole("button", { name: "Copy result" })).toBeEnabled();
  expect(Date.now() - t0, "travou").toBeLessThan(20_000);
  expect(problems).toEqual([]);
});

test("o teste não grava nada: sem escrita em events, runs ou session", async ({ page }) => {
  await installHostileVoice(page);
  await onboard(page);
  await page.goto("/");
  const before = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const open = indexedDB.open("glifora");
        open.onsuccess = () => {
          const db = open.result;
          const counts: number[] = [];
          const tx = db.transaction(["events", "runs", "session"], "readonly");
          for (const s of ["events", "runs", "session"]) {
            const req = tx.objectStore(s).count();
            req.onsuccess = () => counts.push(req.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(counts);
          };
        };
      }),
  );
  await runTest(page, ["Good morning", "bread"]);
  const after = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const open = indexedDB.open("glifora");
        open.onsuccess = () => {
          const db = open.result;
          const counts: number[] = [];
          const tx = db.transaction(["events", "runs", "session"], "readonly");
          for (const s of ["events", "runs", "session"]) {
            const req = tx.objectStore(s).count();
            req.onsuccess = () => counts.push(req.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(counts);
          };
        };
      }),
  );
  expect(after).toEqual(before);
});
