// W2-13 — apelido nas falas das NPCs (D-53): o nome falado entra na fala e no TTS só como texto, e só se for "nome" de verdade.
// Tabela em tests/payloads/nicknames-npc.json (os "suspect" são o achado F-W2-13-04, em w2-findings.spec.ts). Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { installSpeech, spokenLines } from "../e2e/support/speech";
import { skipListen } from "../e2e/support/play";
import { onboard, payload, setNickname, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const table = payload<{ ok: Record<string, string | null>; none: Record<string, string | null> }>("nicknames-npc.json");

for (const [nick, spoken] of Object.entries({ ...table.ok, ...table.none })) {
  test(`NPC chama por "${nick.slice(0, 24)}" → ${spoken === null ? "sem nome" : spoken}: só texto, sem marcador, sem HTML`, async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page, "Ana");
    await setNickname(page, nick);
    await page.goto("/play/tavern-03");
    // tavern-03 é o chefe: sem escolha de modo
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await skipListen(page);
    const expected = spoken === null ? "So, how was your day in the village?" : `So, ${spoken}, how was your day in the village?`;
    await expect(page.locator("main")).toContainText(expected);
    const body = await page.locator("main").innerText();
    expect(body, "marcador ou apelido cru vazou").not.toMatch(/\{player\}|\{|\}/);
    if (spoken === null && nick.length > 0) expect(body).not.toContain(nick);
    expect(await page.locator("main img[src=x], main script, main b, main mark.hostile").count()).toBe(0);
    // o TTS leu o mesmo texto da tela
    await expect.poll(async () => (await spokenLines(page)).some((l) => l.includes(expected))).toBe(true);
    const lines = await spokenLines(page);
    expect(lines.every((l) => !/\{player\}/.test(l))).toBe(true);
    expect(problems).toEqual([]);
  });
}

test("o nome falado aparece no perfil sem virar HTML, mesmo com apelido-marcador", async ({ page }) => {
  const problems = watch(page);
  await onboard(page, "Ana");
  await setNickname(page, "&lt;b&gt;x");
  await expect(page.locator("main b")).toHaveCount(0);
  expect(problems).toEqual([]);
});
