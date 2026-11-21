// W2-13 — sessão adulterada: a linha session/current editada à mão no IndexedDB. O app recusa (a rodada recomeça) e não trava.
// Payloads em tests/payloads/session-tamper.json. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { installSpeech } from "../e2e/support/speech";
import { startMission, type } from "../e2e/support/play";
import { idbAll, idbPut, onboard, payload, sessionAt, watch } from "./support/w2";

test.use({ locale: "en-US" });

interface Case {
  id: string;
  set?: Record<string, unknown>;
  row?: Record<string, unknown>;
  raw?: string;
}
const cases = payload<{ cases: Case[] }>("session-tamper.json").cases;

const BIG = "A".repeat(2 * 1024 * 1024);
const step = { node: "greet", reply: 0, input: "typed", scaffold: 2 };
const fill = (v: unknown): unknown => {
  if (v === "$BIG") return BIG;
  if (v === "$STEPS25") return Array.from({ length: 25 }, () => step);
  if (Array.isArray(v)) return v.map(fill);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
  return v;
};

for (const c of cases) {
  test(`session adulterada: ${c.id} — recusa, não trava e a missão segue jogável`, async ({ page }) => {
    const problems = watch(page);
    await installSpeech(page, "ok", { consent: true });
    await onboard(page);
    await startMission(page, "phrase");
    await type(page, "Good morning!");
    await sessionAt(page, "react", 1);
    const [row] = await idbAll(page, "session");
    expect(row).toBeTruthy();
    let tampered: unknown;
    if (c.raw) tampered = JSON.parse(c.raw);
    else {
      const state = { ...(row!["state"] as Record<string, unknown>), ...(fill(c.set ?? {}) as Record<string, unknown>) };
      tampered = { ...row, state, ...(fill(c.row ?? {}) as Record<string, unknown>) };
    }
    await idbPut(page, "session", tampered);
    await page.goto("/play/bakery-01");
    // continua uma tela utilizável, com título, e nenhum HTML injetado
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("img[src=x], script:not([src])").count(), "HTML injetado a partir do state").toBe(0);
    // recomeça do zero ou retoma: de qualquer modo dá para ir até a primeira fala
    const start = page.getByRole("button", { name: "Start", exact: true });
    await expect(page.getByRole("status").filter({ hasText: "Loading" })).toHaveCount(0);
    await expect(page.locator("main button, main a.btn").first()).toBeVisible();
    if (await start.isVisible()) {
      await page.getByRole("radio", { name: /With the phrase/ }).check();
      await start.click();
    }
    await expect(page.locator("main")).toBeVisible();
    // a rota de outra missão e a vila continuam abrindo
    await page.goto("/place/bakery");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(problems).toEqual([]);
  });
}

test("session adulterada com fecho em HTML (fase done): a rodada grava limpa e o relatório mostra só texto", async ({ page }) => {
  const problems = watch(page);
  await installSpeech(page, "ok", { consent: true });
  await onboard(page);
  await startMission(page, "phrase");
  await type(page, "Good morning!");
  await sessionAt(page, "react", 1);
  const [row] = await idbAll(page, "session");
  const state = { ...(row!["state"] as Record<string, unknown>), phase: "done", closing: { text: `<img src=x onerror=alert(1)><script>alert(2)</script> ok ${BIG.slice(0, 5000)}`, accepted: true, usedModel: false, input: "typed" } };
  await idbPut(page, "session", { ...row, state });
  await page.goto("/play/bakery-01");
  await page.getByRole("button", { name: /Continue where I/ }).click();
  await page.getByRole("button", { name: "See the report" }).click().catch(() => undefined);
  await page.waitForTimeout(800);
  const runs = await idbAll(page, "runs");
  for (const r of runs) {
    const text = (r["closing"] as { text: string } | undefined)?.text ?? "";
    expect(text).not.toMatch(/[<>]/);
    expect(text.length).toBeLessThanOrEqual(300);
  }
  expect(await page.locator("img[src=x], main script").count()).toBe(0);
  expect(problems).toEqual([]);
});
