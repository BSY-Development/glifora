// W1-16 — CSP e Trusted Types, tentativas ALÉM das do Revisor (tests/e2e/csp.spec.ts): WebSocket, EventSource, Worker de blob/data,
// import() externo, setTimeout/setInterval com string, javascript: em location e em <a>, <base>, <object>/<embed>, <meta refresh>,
// SVG com imagem externa, registro de outro service worker, ping de link e CSS externo via @import.
// A sonda entra no bundle como código da página (page.route): page.evaluate ignora a CSP de eval via CDP (aviso do Revisor).
import { expect, test, type Page } from "@playwright/test";

type Probe = Record<string, () => unknown>;
declare global {
  interface Window {
    __cspx: { violated: string; blocked: string }[];
    __x: Probe;
  }
}

const PROBE = String.raw`
;(() => {
  const attempt = (f) => { try { const r = f(); return r === undefined ? "passou" : String(r); } catch (e) { return e.name; } };
  const settle = (setup) => new Promise((resolve) => { try { setup(resolve); } catch (e) { resolve(e.name); } });
  window.__x = {
    websocket: () => settle((done) => { const w = new WebSocket("wss://example.com/"); w.onerror = () => done("erro"); w.onopen = () => done("abriu"); setTimeout(() => done("sem-resposta"), 1500); }),
    websocketLocal: () => settle((done) => { const w = new WebSocket("ws://localhost:4173/"); w.onerror = () => done("erro"); w.onopen = () => done("abriu"); setTimeout(() => done("sem-resposta"), 1500); }),
    eventSource: () => settle((done) => { const e = new EventSource("https://example.com/stream"); e.onerror = () => done("erro"); e.onopen = () => done("abriu"); setTimeout(() => done("sem-resposta"), 1500); }),
    workerBlob: () => settle((done) => { const b = new Blob(["postMessage(1)"], { type: "text/javascript" }); const w = new Worker(URL.createObjectURL(b)); w.onerror = () => done("erro"); w.onmessage = () => done("rodou"); setTimeout(() => done("sem-resposta"), 1500); }),
    workerData: () => settle((done) => { const w = new Worker("data:text/javascript,postMessage(1)"); w.onerror = () => done("erro"); w.onmessage = () => done("rodou"); setTimeout(() => done("sem-resposta"), 1500); }),
    workerExterno: () => settle((done) => { const w = new Worker("https://example.com/w.js"); w.onerror = () => done("erro"); w.onmessage = () => done("rodou"); setTimeout(() => done("sem-resposta"), 1500); }),
    sharedWorker: () => attempt(() => { new SharedWorker("https://example.com/w.js"); }),
    importExterno: () => import("https://example.com/m.js").then(() => "importou", () => "bloqueado"),
    importData: () => import("data:text/javascript,window.__pwned=1").then(() => "importou", () => "bloqueado"),
    setTimeoutString: () => attempt(() => { setTimeout("window.__pwned=1", 0); }),
    setIntervalString: () => attempt(() => { const i = setInterval("window.__pwned=1", 10); clearInterval(i); }),
    locationJs: () => attempt(() => { location.href = "javascript:window.__pwned=1"; }),
    anchorJs: () => { const a = document.createElement("a"); a.href = "javascript:window.__pwned=1"; document.body.append(a); a.click(); return "clicou"; },
    base: () => { const b = document.createElement("base"); b.href = "https://example.com/"; document.head.append(b); return "anexou"; },
    objectEmbed: () => [
      attempt(() => { const o = document.createElement("object"); o.data = "https://example.com/x.swf"; document.body.append(o); }),
      attempt(() => { const e = document.createElement("embed"); e.src = "https://example.com/x.swf"; document.body.append(e); }),
    ],
    metaRefresh: () => { const m = document.createElement("meta"); m.httpEquiv = "refresh"; m.content = "0;url=https://example.com/"; document.head.append(m); return "anexou"; },
    svgExterno: () => {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg"); const img = document.createElementNS(ns, "image");
      img.setAttribute("href", "https://example.com/x.png"); svg.append(img); document.body.append(svg);
      return "anexou";
    },
    cssImport: () => { const s = document.createElement("style"); s.textContent = "@import url(https://example.com/x.css); body{background:url(https://example.com/b.png)}"; document.head.append(s); return "anexou"; },
    styleAttr: () => { const d = document.createElement("div"); d.setAttribute("style", "background:url(https://example.com/s.png)"); document.body.append(d); return "anexou"; },
    ping: () => { const a = document.createElement("a"); a.href = "#ping"; a.ping = "https://example.com/ping"; document.body.append(a); a.click(); return "clicou"; },
    swOutro: () => navigator.serviceWorker.register("/sw.js?outro=1").then(() => "registrou", (e) => e.name),
    swExterno: () => navigator.serviceWorker.register("https://example.com/sw.js").then(() => "registrou", (e) => e.name),
    swBlob: () => navigator.serviceWorker.register(URL.createObjectURL(new Blob(["1"], { type: "text/javascript" }))).then(() => "registrou", (e) => e.name),
    ttPolitica: () => ["glifora-sw", "glifora-sw-2", "default", "dompurify", "goog#html"].map((n) => { try { window.trustedTypes.createPolicy(n, { createHTML: (s) => s }); return "criou"; } catch { return "bloqueado"; } }),
    ttSemTrava: () => attempt(() => { const d = document.createElement("div"); d.innerHTML = "<b>x</b>"; }),
    fetchMesmaOrigem: () => fetch("/version.json").then((r) => String(r.status), () => "falhou"),
    fetchProxyEscapes: () => Promise.all(["//example.com/x", "https://example.com@localhost/x", "http://localhost:4173.example.com/x"].map((u) => fetch(u).then(() => "enviou", () => "bloqueado"))),
  };
})();
`;

async function open(page: Page, route = "/") {
  await page.addInitScript(() => {
    window.__cspx = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__cspx.push({ violated: e.violatedDirective, blocked: e.blockedURI }));
  });
  await page.route("**/assets/*.js", async (r) => {
    try {
      const res = await r.fetch();
      await r.fulfill({ response: res, body: `${await res.text()}\n${PROBE}` });
    } catch {
      // teste terminou com chunk a caminho
    }
  });
  await page.goto(route);
  await page.locator("#root *").first().waitFor();
  expect(await page.evaluate(() => typeof window.__x), "sonda não carregou").toBe("object");
}

const run = <T>(page: Page, name: string): Promise<T> => page.evaluate((n) => window.__x[n]!() as T, name);
const violated = async (page: Page) => (await page.evaluate(() => window.__cspx)).map((v) => v.violated);
const pwned = (page: Page) => page.evaluate(() => (window as unknown as Record<string, unknown>)["__pwned"]);

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  // "response", não "request": o Playwright anuncia o pedido que a CSP vai derrubar; resposta só existe se a rede foi tocada.
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.hostname !== "localhost") foreign.push(r.url());
  });
  return foreign;
}

test.describe("CSP além do Revisor", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("WebSocket (externo e do próprio host), EventSource: bloqueados por connect-src", async ({ page }) => {
    const foreign = watchForeign(page);
    expect(await run(page, "websocket")).not.toBe("abriu");
    expect(await run(page, "eventSource")).not.toBe("abriu");
    expect(await violated(page)).toContain("connect-src");
    expect(foreign).toEqual([]);
  });

  test("Worker de blob:, de data: e de fora: bloqueados por worker-src/script-src", async ({ page }) => {
    expect(await run(page, "workerBlob")).not.toBe("rodou");
    expect(await run(page, "workerData")).not.toBe("rodou");
    expect(await run(page, "workerExterno")).not.toBe("rodou");
  });

  test("import() de módulo externo e de data: é bloqueado", async ({ page }) => {
    expect(await run(page, "importExterno")).toBe("bloqueado");
    expect(await run(page, "importData")).toBe("bloqueado");
    expect(await pwned(page)).toBeUndefined();
  });

  test("setTimeout/setInterval com string, location=javascript: e <a href=javascript:> não executam", async ({ page }) => {
    expect(await run(page, "setTimeoutString")).toBe("TypeError");
    expect(await run(page, "setIntervalString")).toBe("TypeError");
    await run(page, "locationJs");
    await run(page, "anchorJs");
    await page.waitForTimeout(600);
    expect(await pwned(page)).toBeUndefined();
  });

  test("<base>, <object>, <embed>, SVG, @import, style inline e ping: nada sai e a página não é redirecionada", async ({ page, baseURL }) => {
    const foreign = watchForeign(page);
    expect(await run(page, "objectEmbed"), "Trusted Types barra object.data e embed.src").toEqual(["TypeError", "TypeError"]);
    for (const name of ["base", "svgExterno", "cssImport", "styleAttr", "ping"]) await run(page, name);
    await page.waitForTimeout(1200);
    expect(foreign).toEqual([]);
    expect(page.url().startsWith(baseURL ?? "")).toBe(true);
  });

  test("outro service worker (com query, de fora, de blob:) não registra", async ({ page }) => {
    expect(await run(page, "swOutro")).not.toBe("registrou");
    expect(await run(page, "swExterno")).not.toBe("registrou");
    expect(await run(page, "swBlob")).not.toBe("registrou");
  });

  test("Trusted Types: nenhuma política nova (nem a própria 'glifora-sw' de novo), e innerHTML lança", async ({ page }) => {
    expect(await run(page, "ttPolitica")).toEqual(Array(5).fill("bloqueado"));
    expect(await run(page, "ttSemTrava")).toBe("TypeError");
  });

  test("fetch para o próprio site funciona; variantes de URL que enganam o filtro continuam bloqueadas", async ({ page }) => {
    expect(await run(page, "fetchMesmaOrigem")).toBe("200");
    expect(await run(page, "fetchProxyEscapes")).toEqual(["bloqueado", "bloqueado", "bloqueado"]);
  });
});

test("injeção por URL (query, hash, caminho) não vira script nem HTML em nenhuma rota", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("dialog", (d) => {
    problems.push(`dialog ${d.message()}`);
    void d.dismiss();
  });
  const payload = encodeURIComponent('"><img src=x onerror=alert(1)><script>alert(1)</script>');
  for (const route of ["/", "/profile", "/settings", "/about", "/welcome", "/place/bakery", "/zzz"]) {
    await page.goto(`${route}?q=${payload}&lang=${payload}#${payload}`);
    await page.locator("#root *").first().waitFor();
    expect(await page.locator("main img, main script").count(), route).toBe(0);
    expect(await pwned(page), route).toBeUndefined();
  }
  expect(problems).toEqual([]);
});
