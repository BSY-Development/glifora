// W2-13 — resposta livre para nome (D-51): "Sorry", "What?", nomes de 4+ palavras e texto com marcador ({player}, $&, <script>).
// Nada do que a pessoa diz entra na fala da NPC, e nada vira HTML. Payloads em tests/payloads/free-name.json. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { installSpeech } from "../e2e/support/speech";
import { next, startMission, type } from "../e2e/support/play";
import { idbAll, onboard, payload, watch } from "./support/w2";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const data = payload<{ accepted: string[]; rejected: string[] }>("free-name.json");

async function atNameLine(page: import("@playwright/test").Page) {
  await installSpeech(page, "ok", { consent: true });
  await onboard(page, "Ana");
  await startMission(page, "phrase", "bakery-02");
  await type(page, "Yes, please! Two honey rolls.");
  await next(page);
  await expect(page.locator("main")).toContainText("What's your name?");
}
const state = async (page: import("@playwright/test").Page) => (await idbAll(page, "session"))[0]!["state"] as { phase: string; node: string; fails: number; steps: unknown[] };

for (const text of data.accepted) {
  test(`nome aceito: ${JSON.stringify(text).slice(0, 40)} — reação fixa, eco só como texto, nada na fala da NPC`, async ({ page }) => {
    const problems = watch(page);
    await atNameLine(page);
    await type(page, text);
    await expect(page.getByText(/Nice to meet you, (too, )?dear!/)).toBeVisible();
    expect((await state(page)).phase).toBe("react");
    expect(await page.locator("main img[src=x], main script, main b").count()).toBe(0);
    // a próxima fala da NPC usa o apelido do perfil, nunca o que foi dito
    await next(page);
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("$&");
    expect(body).not.toContain("${7*7}");
    expect(problems).toEqual([]);
  });
}

for (const text of data.rejected) {
  test(`não é nome: ${JSON.stringify(text).slice(0, 40)} — a NPC pede de novo, sem punir e sem pagar`, async ({ page }) => {
    const problems = watch(page);
    await atNameLine(page);
    await type(page, text);
    await expect(page.getByText(/Nice to meet you, (too, )?dear!/)).toHaveCount(0);
    const st = await state(page);
    expect(st.phase).toBe("ask");
    expect(st.fails).toBe(1);
    expect(st.steps.length).toBe(1); // só a fala anterior
    expect(await page.locator("main img[src=x], main script").count()).toBe(0);
    expect(problems).toEqual([]);
  });
}
