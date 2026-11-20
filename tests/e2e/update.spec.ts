// W2-11 — a atualização com 2 builds (D-46, W2-10). O build A é o dist/ de agora; o B é uma cópia com o service worker
// diferente (e que responde "B" em /__build). Um servidor estático por teste troca de A para B no meio ("deploy"):
//   · na vila, nos primeiros 5 s da abertura: atualiza sozinho;
//   · no meio da missão: não recarrega, mostra o botão "Atualizar", e a rodada continua;
//   · depois da missão (ao abrir de novo, ou no botão): atualiza.
// Dono: Revisor. Usa as mesmas CSP e cabeçalhos do preview (public/_headers), senão o registro com Trusted Types não seria testado.
import { cpSync, mkdtempSync, readFileSync, rmSync, appendFileSync, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { previewHeaders } from "../../config/headers.ts";
import { installSpeech } from "./support/speech";

test.use({ locale: "en-US", viewport: { width: 360, height: 640 } });

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

let dirA = "";
let dirB = "";
let tmp = "";

test.beforeAll(() => {
  if (!existsSync(join("dist", "sw.js"))) throw new Error("dist/ não existe: o webServer do Playwright roda `npm run build` antes.");
  tmp = mkdtempSync(join(tmpdir(), "glifora-update-"));
  dirA = join(tmp, "a");
  dirB = join(tmp, "b");
  cpSync("dist", dirA, { recursive: true });
  cpSync("dist", dirB, { recursive: true });
  // O B é "outro deploy": o sw.js muda de bytes (o navegador acha a versão nova) e passa a responder em /__build.
  appendFileSync(join(dirB, "sw.js"), '\nself.addEventListener("fetch",function(e){if(new URL(e.request.url).pathname==="/__build"){e.respondWith(new Response("B"));}});\n');
});
test.afterAll(() => {
  if (tmp !== "") rmSync(tmp, { recursive: true, force: true });
});

interface Site {
  origin: string;
  /** Publica o build B. */
  deployB(): void;
  close(): Promise<void>;
}

async function serve(): Promise<Site> {
  let root = dirA;
  const headers = previewHeaders(readFileSync("public/_headers", "utf8"));
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    if (path === "/__build") {
      res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("A"); // o servidor sempre diz A: só o service worker do B diz B
      return;
    }
    const safe = normalize(path).replace(/^([/\\])+/, "");
    let file = join(root, safe);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html"); // fallback de SPA
    const noCache = /(^|[/\\])(sw\.js|index\.html|version\.json)$/.test(file) || file === join(root, "index.html");
    res.writeHead(200, { ...headers, "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": noCache ? "no-cache" : "public, max-age=31536000, immutable" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    deployB: () => {
      root = dirB;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const build = (page: Page): Promise<string> => page.evaluate(() => fetch("/__build", { cache: "no-store" }).then((r) => r.text())).catch(() => "?");

/** Primeira visita: cria o perfil, deixa o service worker A assumir (recarregando) e confirma que o A manda. */
async function openA(page: Page, site: Site): Promise<void> {
  await installSpeech(page, "ok", { consent: true });
  await page.goto(`${site.origin}/welcome`);
  await page.locator("main button.btn-primary").first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  expect(await build(page)).toBe("A");
}

const notice = (page: Page) => page.locator(".update-notice");

test("na vila, nos primeiros 5 s: atualiza sozinho, sem aviso", async ({ page }) => {
  const site = await serve();
  try {
    await openA(page, site);
    site.deployB();
    await page.reload(); // abre a vila de novo: o navegador acha o sw.js novo logo na abertura
    await expect.poll(() => build(page), { timeout: 20_000 }).toBe("B");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");
  } finally {
    await site.close();
  }
});

test("no meio da missão: não recarrega, mostra o botão, a rodada continua; depois da missão, atualiza", async ({ page }) => {
  const site = await serve();
  try {
    await openA(page, site);
    site.deployB();
    await page.goto(`${site.origin}/play/bakery-01`);
    await page.locator('input[name="play-mode"][value="1"]').check();
    await page.locator("p.continue button").click();
    for (let i = 0; i < 3; i += 1) await page.locator("p.continue button").click();
    const marker = await page.evaluate(() => {
      (window as unknown as { __alive: number }).__alive = 1; // some se a página recarregar
      return performance.now();
    });
    expect(marker).toBeGreaterThan(0);

    // a versão nova termina de instalar com a missão aberta: avisa, não recarrega
    await expect(notice(page)).toBeVisible({ timeout: 20_000 });
    await expect(notice(page).getByRole("button", { name: "Update" })).toBeVisible();
    await page.waitForTimeout(2500); // dá tempo de uma recarga indevida acontecer
    expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);
    expect(await build(page)).toBe("A");

    // a rodada segue normalmente
    await page.locator("#answer-text").fill("Good morning!");
    await page.locator(".answer-form button[type=submit]").click();
    await expect(page.locator(".xp-chip")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __alive?: number }).__alive)).toBe(1);

    // termina a missão (frases certas), volta à vila: ainda não recarregou sozinha (o aviso espera a pessoa)
    await page.locator("p.continue button").click();
    for (const reply of ["Can I have a honey roll, please?", "Two, please.", "No, that's all, thanks.", "Here you go."]) {
      await page.locator("#answer-text").fill(reply);
      await page.locator(".answer-form button[type=submit]").click();
      await page.locator("p.continue button").click();
    }
    await page.locator("#answer-text").fill("Can I have a cheese roll, please?");
    await page.locator(".answer-form button[type=submit]").click();
    await page.locator("p.continue button").click(); // relatório
    await expect(page).toHaveURL(/\/report\//);
    expect(await build(page)).toBe("A");

    // depois da missão: ao abrir o app de novo a versão que esperava assume
    await page.goto(`${site.origin}/`);
    await expect.poll(() => build(page), { timeout: 20_000 }).toBe("B");
    // a rodada concluída continua lá (o relatório abre igual)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  } finally {
    await site.close();
  }
});

test("o botão 'Atualizar' do aviso aplica a versão nova", async ({ page }) => {
  const site = await serve();
  try {
    await openA(page, site);
    site.deployB();
    await page.goto(`${site.origin}/settings`); // fora da vila: nunca recarrega sozinha
    await expect(notice(page)).toBeVisible({ timeout: 20_000 });
    expect(await build(page)).toBe("A");
    await notice(page).getByRole("button", { name: "Update" }).click();
    await expect.poll(() => build(page), { timeout: 20_000 }).toBe("B");
  } finally {
    await site.close();
  }
});
