// W2-24 (alvo 2): CSP, redirecionamento, service worker. Só o prefixo /v1beta/models/ do Gemini sai do app. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { FAKE_KEY, GEMINI_HOST, TURNS, aiSection, dumpStorage, gemini, mockGemini, reportWithKey, review, reviewButton } from "./support/ai";

test.use({ viewport: { width: 360, height: 640 }, locale: "en-US" });

const BLOCKED = [
  `https://${GEMINI_HOST}/v1beta/interactions`,
  `https://${GEMINI_HOST}/v1beta/models`, // sem a barra final
  `https://${GEMINI_HOST}/v1/models/x:generateContent`,
  `https://${GEMINI_HOST}/v1beta/models/../files`,
  `https://${GEMINI_HOST}/v1beta/Models/x`,
  `https://${GEMINI_HOST}:8443/v1beta/models/x`,
  `http://${GEMINI_HOST}/v1beta/models/x`,
  `https://${GEMINI_HOST}.evil.example/v1beta/models/x`,
  `https://${GEMINI_HOST}@evil.example/v1beta/models/x`,
  `https://evil.example/v1beta/models/x`,
  `https://api.openai.com/v1/chat/completions`,
  `wss://${GEMINI_HOST}/v1beta/models/x`,
];

test("CSP: fora do prefixo /v1beta/models/ do Gemini, todo fetch é barrado antes de sair (key falsa guardada)", async ({ page }) => {
  const mock = await mockGemini(page, () => ({ json: {} }));
  await reportWithKey(page);
  const result = await page.evaluate(async (urls) => {
    const out: Record<string, string> = {};
    for (const u of urls) {
      try {
        if (u.startsWith("wss")) {
          await new Promise<void>((res, rej) => {
            const ws = new WebSocket(u);
            ws.onopen = () => res();
            ws.onerror = () => rej(new Error("blocked"));
          });
        } else await fetch(u, { method: "POST", headers: { "x-goog-api-key": "AIzaFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE" }, body: "x", mode: "no-cors" });
        out[u] = "SAIU";
      } catch {
        out[u] = "barrado";
      }
    }
    return out;
  }, BLOCKED);
  for (const u of BLOCKED) expect(result[u], u).toBe("barrado");
  expect(mock.calls, "nada chegou ao host liberado").toHaveLength(0);
  expect(mock.other).toEqual([]);
});

test("CSP: o caminho liberado funciona (controle) e img externa continua barrada", async ({ page }) => {
  const mock = await mockGemini(page, () => ({ json: gemini("{}") }));
  await reportWithKey(page);
  const r = await page.evaluate(async () => {
    const ok = await fetch("https://generativelanguage.googleapis.com/v1beta/models/x:generateContent", { method: "POST", body: "{}" }).then(
      () => "saiu",
      () => "barrado",
    );
    const img = await new Promise<string>((res) => {
      const i = new Image();
      i.onload = () => res("carregou");
      i.onerror = () => res("barrado");
      i.src = "https://generativelanguage.googleapis.com/v1beta/models/x.png";
    });
    return { ok, img };
  });
  expect(r.ok).toBe("saiu");
  expect(r.img, "img-src é só 'self'").toBe("barrado");
  expect(mock.calls.every((c) => c.url.includes("/v1beta/models/"))).toBe(true);
});

for (const target of ["https://evil.example/steal", `https://${GEMINI_HOST}/v1beta/interactions`, `https://${GEMINI_HOST}/v1beta/models/gemini-3.5-flash-lite:generateContent?x=1`]) {
  test(`redirecionamento do Gemini para ${target.slice(8, 50)}: barrado, no máximo 2 chamadas, nada vai ao destino`, async ({ page }) => {
    const mock = await mockGemini(page, () => ({ status: 302, headers: { location: target }, text: "" }));
    await reportWithKey(page);
    await reviewButton(page).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(mock.calls.length, "chamadas ao Gemini").toBeLessThanOrEqual(2);
    expect(mock.other, "o redirecionamento foi seguido").toEqual([]);
    expect(mock.calls.every((c) => !c.url.includes("interactions"))).toBe(true);
    expect(await page.getByRole("alert").first().innerText()).not.toContain("AIza");
  });
}

test("service worker: não guarda resposta da IA nem pedido com a key; a revisão não fica no cache", async ({ page }) => {
  await mockGemini(page, () => ({ json: gemini(JSON.stringify(review(TURNS))) }));
  await reportWithKey(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await reviewButton(page).click();
  await expect(aiSection(page).getByText("A more natural way").first()).toBeVisible();
  const dump = await dumpStorage(page);
  const caches = dump.split(String.fromCharCode(10)).filter((l) => l.startsWith("cache:"));
  expect(caches.join(" ")).not.toContain(GEMINI_HOST);
  expect(caches.join(" ")).not.toContain("AIza");
  expect(caches.join(" ")).not.toContain(FAKE_KEY.slice(-8));
});
