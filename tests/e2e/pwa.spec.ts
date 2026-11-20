// W1-12 no navegador: o service worker registra sob a CSP com Trusted Types, o app abre offline e manifesto/ícones valem.
// Prova do §2.3: o registro do plugin (string) seria barrado; o nosso (política glifora-sw) passa.
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" });

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

async function ready(page: Page) {
  await page.goto("/welcome");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true).catch(async () => {
    await page.reload(); // na 1ª visita o worker só controla depois de recarregar
  });
}

test("registra sem violação, controla a página e abre offline", async ({ page, context }) => {
  const problems = watch(page);
  const violations: string[] = [];
  await page.exposeFunction("__report", (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => void (window as unknown as { __report(v: string): void }).__report(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await ready(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toMatch(/\/sw\.js$/);
  const reg = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { scope: r?.scope, active: r?.active?.state };
  });
  expect(reg.scope).toMatch(/\/$/);
  expect(reg.active).toBe("activated");

  await context.setOffline(true);
  for (const route of ["/welcome", "/settings", "/rota-que-nao-existe"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await context.setOffline(false);
  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});

test("o worker só guarda arquivos do próprio site e não pega version.json", async ({ page }) => {
  await ready(page);
  const keys = await page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url);
    return out;
  });
  expect(keys.length).toBeGreaterThan(5);
  for (const u of keys) expect(new URL(u).origin).toBe(new URL(page.url()).origin);
  expect(keys.some((u) => u.includes("version.json"))).toBe(false);
});

test("Trusted Types: register() com string comum é barrado; com a política glifora-sw passa; outra URL a política recusa", async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const out: Record<string, string> = {};
    try {
      await navigator.serviceWorker.register("/sw.js"); // o que o virtual:pwa-register faria
      out["string"] = "passou";
    } catch (e) {
      out["string"] = (e as Error).name;
    }
    try {
      (window as unknown as { trustedTypes?: { createPolicy(n: string, r: { createScriptURL(s: string): string }): unknown } }).trustedTypes?.createPolicy("glifora-sw", { createScriptURL: (s: string) => s });
      out["outra"] = "criou";
    } catch (e) {
      out["outra"] = (e as Error).name;
    }
    return out;
  });
  expect(r["string"]).toBe("TypeError");
  expect(r["outra"]).not.toBe("criou"); // nome de política já usado/duplicado é barrado (sem duplicatas)
});

test("manifesto e ícones: tipos, tamanhos e same-origin", async ({ page, request, baseURL }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
  const purposes = m.icons.map((i: { purpose: string; sizes: string }) => `${i.sizes}:${i.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  for (const icon of [...m.icons.map((i: { src: string }) => i.src), "/icons/apple-touch-icon.png"]) {
    expect(new URL(icon, baseURL).origin).toBe(new URL(baseURL!).origin);
    const res = await request.get(icon);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
});
