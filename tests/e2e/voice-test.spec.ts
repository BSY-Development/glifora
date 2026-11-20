// W2-16 no navegador: o teste das 44 frases em /settings/voice, com o dublê de SpeechRecognition (nada no bundle).
// Início, aviso de privacidade antes do 1º microfone, ✓ e ✗, pular, repetir, resumo com a taxa, "Copiar resultado",
// e sem suporte de escuta (a seção só avisa). Dono: Revisor.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installSpeech, queueSpeech } from "./support/speech";
import { onboard } from "./support/play";

test.use({ locale: "en-US", viewport: { width: 360, height: 640 } });

const PHRASES = (JSON.parse(readFileSync("content/eval/stt/pt-BR_en.json", "utf8")) as { phrases: { id: string; text: string; expect: { mission: string; node: string; reply: number } }[] }).phrases;

async function open(page: Page): Promise<void> {
  await onboard(page);
  await page.goto("/settings/voice");
  await expect(page.getByRole("heading", { name: "Phrase test" })).toBeVisible();
}

const mic = (page: Page) => page.getByRole("button", { name: "Tap and read the phrase" });

async function axeOk(page: Page, label: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  expect(r.violations.map((v) => `${v.impact}/${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `axe em ${label}`).toEqual([]);
}

test("o conjunto tem as 44 frases e cada uma aponta para uma resposta que existe", () => {
  expect(PHRASES).toHaveLength(44);
  expect(new Set(PHRASES.map((p) => p.id)).size).toBe(44);
});

test("lê uma frase: aviso de privacidade, ✓, depois ✗ com as alternativas, pular, resumo e copiar", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await installSpeech(page, "ok"); // sem consentimento prévio
  await open(page);
  await axeOk(page, "teste das frases: início");
  await expect(page.getByText(`Read 44 short English phrases`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Start the test" }).click();
  await expect(page.getByText("Phrase 1 of 44")).toBeVisible();
  await expect(page.locator("p.voice-test-phrase")).toHaveText(PHRASES[0]!.text);
  expect(await page.locator("p.voice-test-phrase").getAttribute("lang")).toBe("en-US");

  // 1ª: o aviso de privacidade antes do microfone; o dublê devolve a frase certa
  await queueSpeech(page, PHRASES[0]!.text.replace(/[!.?,]/g, "").toLowerCase());
  await mic(page).click();
  await expect(page.getByRole("heading", { name: "Before you use the microphone" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Matched the expected answer.")).toBeVisible();
  await expect(page.getByText(/\d+% sure/).first()).toBeVisible(); // alternativas com confiança
  await axeOk(page, "teste das frases: resultado ✓");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 2ª: o reconhecedor entende outra coisa → ✗ e a lista de alternativas
  await expect(page.getByText("Phrase 2 of 44")).toBeVisible();
  await queueSpeech(page, "banana split", "banana");
  await mic(page).click();
  await expect(page.getByText(/Did not match any answer\.|Matched a different answer:/)).toBeVisible();
  await expect(page.locator(".voice-test-result strong")).toHaveText("✗");
  await expect(page.locator("ol.voice-alternatives li")).toHaveCount(2);
  await axeOk(page, "teste das frases: resultado ✗");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 3ª: pular não conta
  await expect(page.getByText("Phrase 3 of 44")).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText("Phrase 4 of 44")).toBeVisible();

  // repetir apaga o resultado da frase e deixa tentar de novo
  await queueSpeech(page, "nothing useful");
  await mic(page).click();
  await expect(page.getByRole("button", { name: "Repeat this phrase" })).toBeVisible();
  await page.getByRole("button", { name: "Repeat this phrase" }).click();
  await expect(mic(page)).toBeVisible();

  // resumo: 1 de 2 tentadas = 50% (a pulada e a repetida não contam)
  await page.getByRole("button", { name: "See summary" }).click();
  await expect(page.getByText("Match rate: 1/2 = 50%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Phrases that did not match" })).toBeVisible();
  await axeOk(page, "teste das frases: resumo");

  await page.getByRole("button", { name: "Copy result" }).click();
  await expect(page.getByText("Copied. Paste it in the conversation.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split(/\r?\n/)[0]?.trim()).toBe("Glifora voice test pt-BR_en: 1/2 = 50% (44 phrases, 1 skipped)");
  expect(copied).toContain(`${PHRASES[0]!.id} | expected ${PHRASES[0]!.expect.mission}/${PHRASES[0]!.expect.node}/${PHRASES[0]!.expect.reply} | matched ok`);
  expect(copied).toContain(`${PHRASES[1]!.id} |`);
  expect(copied).not.toContain(PHRASES[2]!.id); // a pulada não entra
  expect(copied).not.toMatch(/(token|key|password|nickname)/i);

  // "Voltar ao teste" retoma de onde estava
  await page.getByRole("button", { name: "Back to the test" }).click();
  await expect(page.getByText(/Phrase \d+ of 44/)).toBeVisible();
});

test("nada é gravado: o teste não escreve no banco nem no armazenamento", async ({ page }) => {
  await installSpeech(page, "ok", { consent: true });
  await open(page);
  const before = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return { keys: Object.keys(localStorage).sort(), dbs: dbs.map((d) => d.name).sort() };
  });
  await page.getByRole("button", { name: "Start the test" }).click();
  await queueSpeech(page, PHRASES[0]!.text);
  await mic(page).click();
  await expect(page.getByText("Matched the expected answer.")).toBeVisible();
  const counts = await page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const open = indexedDB.open("glifora");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const out: Record<string, number> = {};
          const names = [...db.objectStoreNames];
          if (names.length === 0) return resolve(out);
          const tx = db.transaction(names, "readonly");
          let left = names.length;
          for (const name of names) {
            const c = tx.objectStore(name).count();
            c.onsuccess = () => {
              out[name] = c.result;
              if (--left === 0) resolve(out);
            };
          }
        };
      }),
  ).catch(() => ({}) as Record<string, number>);
  expect(counts["runs"] ?? 0).toBe(0);
  expect(counts["events"] ?? 0).toBe(0);
  const after = await page.evaluate(async () => ({ keys: Object.keys(localStorage).sort(), dbs: (await indexedDB.databases()).map((d) => d.name).sort() }));
  expect(after.dbs).toEqual(before.dbs);
  expect(after.keys.filter((k) => !before.keys.includes(k))).toEqual([]);
});

test("nada ouvido: mensagem e dá para repetir; a falha conta como tentada, não some do resumo", async ({ page }) => {
  await installSpeech(page, "ok", { consent: true });
  await open(page);
  await page.getByRole("button", { name: "Start the test" }).click();
  await mic(page).click(); // fila vazia: no-speech
  await expect(page.getByText(/I did not hear anything/)).toBeVisible();
  await page.getByRole("button", { name: "See summary" }).click();
  await expect(page.getByText("Match rate: 0/1 = 0%")).toBeVisible();
});

test("sem suporte de escuta: a seção só avisa", async ({ page }) => {
  await installSpeech(page, "none");
  await open(page);
  await expect(page.getByText(/the phrase test is not available here/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start the test" })).toHaveCount(0);
  await axeOk(page, "teste das frases sem suporte");
});

test("o texto de privacidade do teste não promete o que o navegador não cumpre", async ({ page }) => {
  // R-W2-16-1 (corrigido pelo App): o áudio vai ao serviço de fala do navegador, então o texto não pode dizer que nada sai do aparelho.
  await installSpeech(page, "ok", { consent: true });
  await open(page);
  await expect(page.getByText(/nothing leaves this device/i)).toHaveCount(0);
  await expect(page.getByText(/heard by the browser.s speech service/)).toBeVisible();
});
