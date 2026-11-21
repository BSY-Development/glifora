// W2-24 (alvo 3): injeção pela fala. O pedido mantém a fala como dado; apelido e nome livre (D-51) não vão. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { BAKERY_REPLIES } from "../e2e/support/play";
import { TURNS, gemini, mockGemini, reportWithKey, review, reviewButton, aiSection, type Seen } from "./support/ai";
import { idbAll, payload, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const { utterances } = payload<{ utterances: { id: string; text: string }[] }>("ai-utterances.json");
const ok = () => ({ json: gemini(JSON.stringify(review(TURNS))) });
const OPEN = "<player_utterance>";
const CLOSE = "</player_utterance>";
// Toda linha do pedido tem uma destas formas; nada mais passa.
const LINE = /^(target: [\w-]+|ui: [\w-]+|level: \w+|\[\d+\]|NPC: [^\n]*|OK: [^\n]*|SLIP: [^\n]*|MATCH: (good|flawed|none)|<player_utterance>[^<>\n]*<\/player_utterance>)?$/;

function structure(seen: Seen): { problems: string[]; said: string[] } {
  const problems: string[] = [];
  const said: string[] = [];
  for (const line of seen.user.split("\n")) {
    if (!LINE.test(line)) problems.push(`linha fora do formato: ${JSON.stringify(line)}`);
    if (line.startsWith(OPEN)) said.push(line.slice(OPEN.length, -CLOSE.length));
  }
  if (seen.user.split(OPEN).length - 1 !== said.length) problems.push("marcador de abertura a mais");
  if (seen.user.split(CLOSE).length - 1 !== said.length) problems.push("marcador de fechamento a mais");
  return { problems, said };
}

let baselineSystem = "";
test.beforeAll(() => {
  baselineSystem = "";
});

for (const { id, text } of utterances) {
  test(`injeção '${id}': a fala (na 1ª resposta e no fecho) vai como dado limpo, sem forjar marcador, linha nem JSON`, async ({ page }) => {
    const problems = watch(page);
    const mock = await mockGemini(page, ok);
    // 1ª resposta casa por palavra-chave ("honey"); o fecho é livre. A fala hostil vai nas duas.
    const replies = [BAKERY_REPLIES[0], `Can I have a honey roll, please? ${text}`, ...BAKERY_REPLIES.slice(2)];
    await reportWithKey(page, { replies, closing: `Can I have a cheese roll, please? ${text}` });
    await reviewButton(page).click();
    await expect(aiSection(page).locator("ol")).toBeVisible();
    expect(mock.calls).toHaveLength(1);
    const seen = mock.calls[0]!;
    const { problems: shape, said } = structure(seen);
    expect(shape).toEqual([]);
    expect(said).toHaveLength(TURNS);
    for (const s of said) {
      expect(Array.from(s).length, "teto de 100 caracteres").toBeLessThanOrEqual(100);
      expect(s).not.toMatch(/[<>\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
    }
    // o sistema é texto fixo: igual para toda fala
    if (baselineSystem === "") baselineSystem = seen.system;
    expect(seen.system).toBe(baselineSystem);
    expect(seen.system).not.toContain(text.slice(0, 20));
    // a tela não executou nem mostrou HTML
    await expect(page.locator("img[src='x'], script:not([src])")).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}

test("apelido e dados da pessoa não vão no pedido (apelido dito em maiúsculas, com acento, com vírgula, duas vezes)", async ({ page }) => {
  const mock = await mockGemini(page, ok);
  const nick = "Zorbax";
  const replies = [`Good morning! ${nick}`, `Can I have a honey roll, please? ${nick.toUpperCase()}, ${nick}`, ...BAKERY_REPLIES.slice(2)];
  await reportWithKey(page, { nickname: nick, replies, closing: `Can I have a cheese roll, please? ZORBAX` });
  const runs = await idbAll(page, "runs");
  const meta = await idbAll(page, "meta");
  await reviewButton(page).click();
  await expect(aiSection(page).locator("ol")).toBeVisible();
  const body = mock.calls[0]!.body;
  expect(body.toLowerCase(), "o apelido foi à IA").not.toContain("zorbax");
  expect(body).toContain("[name]");
  for (const secret of [String(runs[0]!["id"]), ...meta.map((m) => String(m["value"])).filter((v) => v.length > 8)]) expect(body, "id/dispositivo vazou").not.toContain(secret);
  expect(body).not.toMatch(/deviceId|runId|createdAt|nickname|profile/i);
});

test("F-W2-24-02 (médio): o apelido escrito com letras trocadas por visuais parecidas ou separado vai à IA", async ({ page }) => {
  // Resíduo aceito (D-56): 'Zorbaxx' (letra a mais) passa, porque não há busca aproximada ('Ana' mascararia palavras comuns).
  const mock = await mockGemini(page, ok);
  const nick = "Zorbax";
  const replies = ["Good morning! Ｚｏｒｂａｘ", `Can I have a honey roll, please? Z o r b a x`, ...BAKERY_REPLIES.slice(2)];
  await reportWithKey(page, { nickname: nick, replies, closing: "Can I have a cheese roll, please? Zorbaxx" });
  await reviewButton(page).click();
  await expect(aiSection(page).locator("ol")).toBeVisible();
  const folded = mock.calls[0]!.body.normalize("NFKC").toLowerCase().replace(/[\s-]/g, "");
  expect(folded.replaceAll("zorbaxx", ""), "só o resíduo aceito 'Zorbaxx' pode sobrar").not.toContain("zorbax");
  expect(folded, "o resíduo aceito continua visível, para ficar documentado").toContain("zorbaxx");
});

test("o pedido só leva o necessário: sem apelido no campo target/ui/level, no máximo 12 falas, idioma e nível da missão", async ({ page }) => {
  const mock = await mockGemini(page, ok);
  await reportWithKey(page, { nickname: "Maria" });
  await reviewButton(page).click();
  await expect(aiSection(page).locator("ol")).toBeVisible();
  const user = mock.calls[0]!.user;
  expect(user).toMatch(/^target: en\nui: en\nlevel: A1\n/);
  expect(user.match(/^\[\d+\]$/gm)).toHaveLength(TURNS);
  expect(JSON.parse(mock.calls[0]!.body).generationConfig.maxOutputTokens).toBe(2048);
  expect(user).not.toContain("Maria");
});
