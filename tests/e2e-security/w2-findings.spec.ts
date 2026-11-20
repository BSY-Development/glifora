// W2-13 — achados da fase 2. Cada um nasce como falha esperada (test.fail, id no título) até o dono corrigir; aí vira teste normal
// (tirar o test.fail). Relatório: ver o pedido do Arquiteto na W2-13. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { installHostileVoice, script } from "./support/voice";
import { installSpeech } from "../e2e/support/speech";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, next, startMission, type } from "../e2e/support/play";
import { HEAD, idbAll, idbPut, importText, onboard, payload, setNickname, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-01 (médio): a palavra "constructor" (qualquer caixa) dita ou digitada derruba o casamento.
// Dono: Conteúdo (src/schemas/match.ts: tabela EN_BARE é objeto comum, "constructor" volta a função de Object.prototype).
for (const word of ["constructor", "Constructor", "CONSTRUCTOR", "my name is constructor"]) {
  test(`F-W2-13-01: "${word}" digitado na fala não lança exceção e a rodada responde (pede de novo)`, async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, word);
    await page.waitForTimeout(300);
    expect(problems, "exceção no casamento").toEqual([]);
    const [row] = await idbAll(page, "session");
    const st = row!["state"] as { fails: number; phase: string };
    expect(st.fails === 1 || st.phase !== "ask", "a fala foi ignorada sem contar nem avançar").toBe(true);
  });
}

test("F-W2-13-01b: 'constructor' dito por voz (alternativa do reconhecedor) também não lança exceção", async ({ page }) => {
  const problems = watch(page);
  await installHostileVoice(page);
  await onboard(page);
  await startMission(page, "phrase");
  await script(page, { alts: ["constructor"] });
  await page.getByRole("button", { name: "Tap and speak" }).click();
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-02 (baixo): sessão com `day` no formato certo mas que não existe no calendário (2026-13-45) é retomada,
// e a rodada nunca grava ("I couldn't save the mission on this device", "Try again" sem fim).
// Dono: Conteúdo/App (engine/play.ts: parseState confere só o formato do day, não o calendário).
for (const day of ["2026-13-45", "2026-02-30", "9999-99-99"]) {
  test(`F-W2-13-02: sessão com day=${day} não pode prender a rodada sem gravar`, async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, BAKERY_REPLIES[0]);
    const [row] = await idbAll(page, "session");
    await idbPut(page, "session", { ...row, state: { ...(row!["state"] as object), day } });
    await page.goto("/play/bakery-01");
    const resume = page.getByRole("button", { name: /Continue where I/ });
    const fresh = page.getByRole("radio", { name: /With the phrase/ });
    await expect(resume.or(fresh).first()).toBeVisible();
    if (await resume.isVisible()) {
      await resume.click();
      await next(page);
      await answerAllByText(page, BAKERY_REPLIES.slice(1));
      await type(page, CLOSING_OWN);
      // com o bug, no lugar do botão aparece "I couldn't save the mission on this device" e "Try again"
      await expect(page.getByRole("button", { name: "See the report" }), "a rodada não gravou").toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "See the report" }).click();
      await expect(page).toHaveURL(/\/report\//, { timeout: 5000 });
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-03 (baixo): speechSynthesis.speak() que lança (Safari/WebView com síntese quebrada) vira exceção solta a cada fala.
// Dono: App (speech/tts.ts não envolve o speak em try/catch). A missão segue jogável.
test("F-W2-13-03: speak() que lança não vira exceção solta", async ({ page }) => {
  const problems = watch(page);
  await installHostileVoice(page, { tts: "throw" });
  await onboard(page);
  await startMission(page, "phrase");
  await type(page, BAKERY_REPLIES[0]);
  await next(page);
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-04 (baixo): o nome falado (D-53) aceita marcas combinantes sem limite: keycap (U+20E3), CGJ (U+034F), VS16 (U+FE0F),
// vogal inerente khmer (U+17B4) e Zalgo. Entram na fala da NPC e no TTS como símbolo ou caractere invisível.
// Dono: Conteúdo (schemas/player.ts: SPOKEN_WORD_RE usa \p{L}\p{M}* sem teto de marcas).
const suspect = payload<{ suspect: Record<string, string> }>("nicknames-npc.json").suspect;
for (const [id, nick] of Object.entries(suspect)) {
  test(`F-W2-13-04: apelido com marca combinante (${id}) não vira nome falado`, async ({ page }) => {
    await installSpeech(page, "ok", { consent: true });
    await onboard(page, "Ana");
    await setNickname(page, nick);
    await expect(page.getByText(/will not use a name/)).toBeVisible();
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-05 está em w2-voice-test.spec.ts (copiar resultado: quebra de linha e controle da transcrição vão crus ao texto copiado).

// ---------------------------------------------------------------------------------------------------------------------
// F-W2-13-06 (baixo, cosmético): o HUD da vila mostra "Level 1 · Apprentice, 0 of 50 XP" até o livro-razão carregar,
// mesmo para quem está no nível 632. Dono: App (Home.tsx: sem estado de carregando para o progresso).
test("F-W2-13-06: o HUD não mostra o nível 1 enquanto o progresso carrega", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as Record<string, unknown>)["__hud"] = seen;
    const look = () => {
      const el = document.querySelector(".hud-level");
      if (el && el.textContent) seen.push(el.textContent.trim());
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await onboard(page, "Ana");
  const events = Array.from({ length: 25_000 }, (_, i) => ({ id: `g${i}`, at: 1795176000000, day: "2026-11-20", kind: "mission_completed", xp: 400, coins: 0, rules: 1, device: "dev-y" }));
  await importText(page, `{${HEAD},"docs":[],"events":${JSON.stringify(events)},"runs":[]}`);
  await page.goto("/");
  await expect(page.locator(".hud-level")).toContainText("Level 632", { timeout: 15_000 });
  const seen = await page.evaluate(() => (window as unknown as { __hud: string[] }).__hud);
  expect(seen.filter((s) => /^Level 1\b/.test(s)), "nível 1 apareceu antes do real").toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// INFO-W2-13-A (informativo, fase 5): prêmio único com id não determinístico é aceito na importação e paga em dobro.
// Por desenho (D-49: app local, o schema só barra o absurdo), mas a fase 5 (Supabase/sincronização) precisa fechar isto:
// mission_first só com id "first:<missão>" e mission_star só com "star:<missão>:<n>".
test("INFO-W2-13-A: dois mission_first da mesma missão com ids diferentes não pagam duas vezes", async ({ page }) => {
  test.fail(true, "INFO-W2-13-A: o ledger aceita (por desenho, app local); revisar na fase 5");
  await onboard(page, "Ana");
  const base = { at: 1795176000000, day: "2026-11-20", kind: "mission_first", xp: 24, coins: 0, rules: 1, device: "dev-y", target: "bakery-01" };
  const body = `{${HEAD},"docs":[],"events":${JSON.stringify([
    { id: "first:bakery-01", ...base },
    { id: "uuid-forjado-1", ...base },
    { id: "uuid-forjado-2", ...base },
  ])},"runs":[]}`;
  const out = await importText(page, body);
  const firsts = (await idbAll(page, "events")).filter((e) => e["kind"] === "mission_first");
  expect(out.isAlert ? 0 : firsts.length, "mesmo prêmio único gravado mais de uma vez").toBeLessThanOrEqual(1);
});
