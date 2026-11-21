// W2-11 — o player de missão no navegador: a bakery-01 do começo ao fim, por texto e por voz (dublês de SpeechRecognition e
// speechSynthesis), recast sem tela de erro, ajuda que sobe, fecho com resposta-modelo, relatório, level up, rodada retomável,
// repetição no mesmo dia, "De cor" e os caminhos sem voz. Dono: Revisor. Interface em inglês (locale en-US).
import { expect, test, type Page } from "@playwright/test";
import { installSpeech, queueSpeech, spokenLines } from "./support/speech";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, MODEL_ANSWER, next, onboard, setUi, skipListen, startMission, type, xpTotal } from "./support/play";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** O jogo é uma rodada de conversa: nunca uma tela de erro nem vocabulário de punição. */
async function noPunishment(page: Page): Promise<void> {
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/\b(wrong|incorrect|mistake|failed|game over|lives?)\b/i);
}

test.describe("bakery-01 por texto", () => {
  test("do começo ao fim, pela vila, com relatório e XP", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok");
    await onboard(page);
    await setUi(page, "pt-BR"); // a lista de missões é do par pt-BR → en (com a interface em inglês a Place diz "em breve")
    await page.getByRole("link", { name: /Padaria/ }).click();
    const card = page.locator("li.mission-card", { hasText: "Pão quentinho" });
    await expect(card.locator(".mission-stars-text")).toHaveText("Estrelas: 0 de 3");
    await expect(card).toContainText("XP cheio hoje");
    await page.locator("a.mission-link").first().click();
    await expect(page).toHaveURL(/\/play\/bakery-01$/);
    await setUi(page, "en");
    await page.getByRole("radio", { name: /With the phrase/ }).check();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await skipListen(page);

    await expect(page.locator("p.hint", { hasText: "Line 1 of 5" })).toBeVisible();
    await answerAllByText(page);
    await expect(page.getByRole("heading", { name: "Now, in your own words" })).toBeVisible();
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();

    await expect(page).toHaveURL(/\/report\//);
    await expect(page.getByRole("heading", { name: "Goal achieved" })).toBeVisible();
    await expect(page.getByText("Stars: 1 of 3")).toBeVisible();
    // modo 1 (frase à vista), 1ª vez: 5×8 de conversa + 24 do fecho; prêmios: 24 (1ª) + 40 (★)
    await expect(page.getByText("Conversation: 64 XP")).toBeVisible();
    await expect(page.getByText("Mission prizes: 64 XP")).toBeVisible();
    expect(await xpTotal(page)).toBe(128);
    await expect(page.getByRole("heading", { name: "Your closing phrase" })).toBeVisible();
    await expect(page.getByText(CLOSING_OWN)).toBeVisible();
    await expect(page.getByText("No expected slips this time. Very good!")).toBeVisible();
    expect((await spokenLines(page)).some((l) => /Good morning! Oh, a new face/.test(l))).toBe(true); // a NPC falou pela voz do dublê
    expect(problems).toEqual([]);
  });

  test("a resposta com erro mostra o recast destacado, sem tela de erro, e o relatório explica", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, "Good morning!");
    await next(page);
    await type(page, "A roll of honey, please.");
    await expect(page.locator("mark.recast")).toHaveText("A honey roll"); // a forma natural, destacada como texto
    await expect(page.getByText(/Good choice!/)).toBeVisible();
    await noPunishment(page);
    await expect(page.getByText("You earned +8 XP")).toBeVisible(); // o erro previsto paga igual
    await next(page);
    await answerAllByText(page, BAKERY_REPLIES.slice(2));
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByRole("heading", { name: "More natural ways to say it" })).toBeVisible();
    await expect(page.getByText(/You said “A roll of honey” and the talk went on with “A honey roll”/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goal achieved" })).toBeVisible();
    await expect(page.getByText("Stars: 1 of 3")).toBeVisible(); // o erro não tira a estrela
  });

  test("duas falhas seguidas fazem a ajuda subir, sem punir", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "memory");
    await type(page, "zzz qqq");
    await expect(page.locator("p.hint", { hasText: "Line 1 of 5" })).toBeVisible(); // não andou, nada foi perdido
    await expect(page.getByText("No problem! One more help on screen.")).toHaveCount(0); // na 1ª falha só pede outra vez
    await expect(page.getByRole("heading", { name: "Ideas for your answer" })).toHaveCount(0);
    await type(page, "qqq zzz");
    await expect(page.getByText("No problem! One more help on screen.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ideas for your answer" })).toBeVisible();
    await noPunishment(page);
    await type(page, "Hello");
    await expect(page.getByText(/You earned \+\d+ XP/)).toBeVisible(); // segue normalmente
  });

  test("o fecho: duas tentativas e depois a resposta-modelo, que a pessoa pode dizer", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await answerAllByText(page);
    await type(page, "zzz");
    await expect(page.getByText(/^Hint:/)).toBeVisible(); // 1ª falha: dica
    await expect(page.getByRole("heading", { name: "Now, in your own words" })).toBeVisible();
    await type(page, "qqq");
    await expect(page.getByRole("heading", { name: "Try saying it like this" })).toBeVisible(); // 2ª: a resposta-modelo
    await expect(page.getByText(MODEL_ANSWER).first()).toBeVisible();
    await noPunishment(page);
    await type(page, MODEL_ANSWER);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByText(/You said: .Can I have two cheese rolls/)).toBeVisible();
    await expect(page.getByText("Conversation: 52 XP")).toBeVisible(); // 40 + 12: o modelo paga menos que a frase própria
  });

  test("seguir sem dizer a resposta-modelo também fecha a rodada", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await answerAllByText(page);
    await type(page, "zzz");
    await type(page, "qqq");
    await page.getByRole("button", { name: "Move on without saying it" }).click();
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByRole("heading", { name: "Mission report" })).toBeVisible();
    await expect(page.getByText("Stars: 0 of 3")).toBeVisible(); // sem fecho próprio não há estrela
  });
});

test.describe("bakery-01 por voz", () => {
  test("falando do começo ao fim em 'De cor': ★★★, level up e a privacidade antes do 1º microfone", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok"); // sem consentimento prévio: o aviso aparece no 1º toque
    await onboard(page);
    await startMission(page, "memory");

    await queueSpeech(page, "good morning", "good mourning");
    await page.getByRole("button", { name: "Tap and speak" }).click();
    await expect(page.getByRole("heading", { name: "Before you use the microphone" })).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("You earned +16 XP")).toBeVisible(); // voz sem ajuda: 16
    await next(page);

    // o dublê devolve alternativas; a certa pode vir na 2ª
    const heard: string[][] = [["can i have a hone roll please", "can i have a honey roll please"], ["to please", "two please"], ["no that's all thanks"], ["here you go"]];
    for (const alts of heard) {
      await queueSpeech(page, ...alts);
      await page.getByRole("button", { name: "Tap and speak" }).click();
      await expect(page.getByText("You earned +16 XP")).toBeVisible();
      await next(page);
    }
    await queueSpeech(page, "can i have a cheese roll please");
    await page.getByRole("button", { name: "Tap and speak" }).click();
    await page.getByRole("button", { name: "See the report" }).click();

    await expect(page.getByText("Stars: 3 of 3")).toBeVisible();
    await expect(page.getByText("New star!")).toBeVisible();
    await expect(page.getByText("Conversation: 104 XP")).toBeVisible(); // 5×16 + 24
    await expect(page.getByText("Mission prizes: 200 XP")).toBeVisible(); // 24 + 40 + 56 + 80
    expect(await xpTotal(page)).toBe(304);
    await expect(page.getByRole("status").filter({ hasText: /You reached level 4!/ })).toBeVisible(); // 300 XP = nível 4
    expect((await spokenLines(page)).length).toBeGreaterThan(5);
    expect(problems).toEqual([]);
  });

  test("o consentimento fica: o microfone não pergunta de novo", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await queueSpeech(page, "hello");
    await page.getByRole("button", { name: "Tap and speak" }).click();
    await expect(page.getByRole("heading", { name: "Before you use the microphone" })).toHaveCount(0);
    await expect(page.getByText(/You earned \+\d+ XP/)).toBeVisible();
  });

  test("nada ouvido (no-speech): mensagem, sem contar como erro, e o texto segue valendo", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await page.getByRole("button", { name: "Tap and speak" }).click(); // fila vazia
    await expect(page.getByText(/I did not hear anything/)).toBeVisible();
    await expect(page.locator("p.hint", { hasText: "Line 1 of 5" })).toBeVisible();
    await type(page, "Hello");
    await expect(page.getByText(/You earned \+\d+ XP/)).toBeVisible();
  });
});

test.describe("sem voz", () => {
  test("sem suporte de reconhecimento: o microfone some e o texto funciona", async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "none");
    await onboard(page);
    await startMission(page, "phrase");
    await expect(page.getByRole("button", { name: /Tap and speak/ })).toHaveCount(0);
    await expect(page.getByText(/This browser cannot listen to your voice/)).toBeVisible();
    await answerAllByText(page);
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByRole("heading", { name: "Goal achieved" })).toBeVisible(); // digitar vale como falar
    expect(problems).toEqual([]);
  });

  test("permissão negada: mensagem clara e o texto continua", async ({ page }) => {
    await installSpeech(page, "denied", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await page.getByRole("button", { name: "Tap and speak" }).click();
    await expect(page.getByText(/The microphone is blocked\. Allow it in the browser's site settings, or type your answer instead\./)).toBeVisible();
    await expect(page.locator("p.hint", { hasText: "Line 1 of 5" })).toBeVisible();
    await noPunishment(page);
    await type(page, "Hello");
    await expect(page.getByText(/You earned \+\d+ XP/)).toBeVisible();
  });
});

test.describe("rodada retomável e repetição", () => {
  test("recarregar no meio devolve a rodada de onde parou", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await answerAllByText(page, BAKERY_REPLIES.slice(0, 2));
    await expect(page.locator("p.hint", { hasText: "Line 3 of 5" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "You were in the middle of this mission" })).toBeVisible();
    await page.getByRole("button", { name: "Continue where I stopped" }).click();
    await expect(page.locator("p.hint", { hasText: "Line 3 of 5" })).toBeVisible();
    await answerAllByText(page, BAKERY_REPLIES.slice(2));
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByText("Stars: 1 of 3")).toBeVisible();
    await page.goto("/play/bakery-01"); // concluída: a sessão guardada some
    await expect(page.getByRole("heading", { name: "You were in the middle of this mission" })).toHaveCount(0);
  });

  test("a pessoa pode recomeçar em vez de continuar", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await answerAllByText(page, BAKERY_REPLIES.slice(0, 1));
    await page.goto("/play/bakery-01");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await skipListen(page);
    await expect(page.locator("p.hint", { hasText: "Line 1 of 5" })).toBeVisible();
  });

  test("jogar de novo no mesmo dia paga menos, e a estrela não se perde", async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "memory"); // 1ª rodada: sem ajuda → ★★★
    await answerAllByText(page);
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByText("Stars: 3 of 3")).toBeVisible();
    const first = await xpTotal(page);
    expect(first).toBe(304);

    await setUi(page, "pt-BR");
    await page.goto("/place/bakery");
    await expect(page.locator("li.mission-card", { hasText: "Pão quentinho" }).locator(".mission-stars-text")).toHaveText("Estrelas: 3 de 3");
    await setUi(page, "en");
    await startMission(page, "phrase"); // 2ª rodada, mesmo dia, frase à vista
    await answerAllByText(page);
    await type(page, CLOSING_OWN);
    await page.getByRole("button", { name: "See the report" }).click();
    await expect(page.getByText("Conversation: 32 XP")).toBeVisible(); // 5×(8×½) + 24×½
    await expect(page.getByText("Mission prizes: 0 XP")).toBeVisible(); // as 3 estrelas já foram pagas
    expect(await xpTotal(page)).toBeLessThan(first);
    await expect(page.getByText("Stars: 3 of 3")).toBeVisible(); // mais ajuda não tira a estrela
    await expect(page.getByText("New star!")).toHaveCount(0);
    await noPunishment(page);
    await setUi(page, "pt-BR");
    await page.goto("/place/bakery");
    await expect(page.locator("li.mission-card", { hasText: "Pão quentinho" }).locator(".mission-stars-text")).toHaveText("Estrelas: 3 de 3");
    await expect(page.locator("li.mission-card", { hasText: "Pão quentinho" })).not.toContainText("XP cheio hoje");
  });
});

test.describe("tocar é um caminho, mas vale menos", () => {
  test("chegar ao degrau 3 e tocar numa opção paga 4 XP, não 8 nem 16", async ({ page }) => {
    await installSpeech(page, "ok");
    await onboard(page);
    await startMission(page, "phrase");
    await page.getByRole("button", { name: "Choose by tapping" }).click(); // modo 1: a frase já está à vista, falta o degrau 3
    await expect(page.getByRole("heading", { name: "Tap a phrase" })).toBeVisible();
    await page.locator(".tap-option").first().click();
    await expect(page.getByText("You earned +4 XP")).toBeVisible();
  });
});
