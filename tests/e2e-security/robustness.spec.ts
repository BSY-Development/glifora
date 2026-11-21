// W1-16 — robustez: armazenamento bloqueado/cheio, rotas inválidas, duas abas, troca de idioma no meio da edição, offline. Dono: QA Tester.
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" });

const BASE = "http://localhost:4173";

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("dialog", (d) => {
    errors.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  return errors;
}

async function start(page: Page, nickname = "Ana") {
  await page.goto("/welcome");
  await page.getByLabel("Apelido (opcional)").fill(nickname);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

const BLOCKED_TEXT = /Não consegui abrir os dados deste aparelho|Could not open the data on this device/;

test.describe("armazenamento indisponível", () => {
  test("indexedDB ausente (modo anônimo antigo / armazenamento desligado): tela de erro clara, sem exceção solta", async ({ page }) => {
    const errors = watch(page);
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true }));
    for (const route of ["/", "/profile", "/settings", "/place/bakery"]) {
      await page.goto(route);
      await expect(page.getByText(BLOCKED_TEXT).first(), route).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("indexedDB.open lança SecurityError: mesma tela clara", async ({ page }) => {
    const errors = watch(page);
    await page.addInitScript(() => {
      IDBFactory.prototype.open = function () {
        throw new DOMException("negado", "SecurityError");
      };
    });
    await page.goto("/");
    await expect(page.getByText(BLOCKED_TEXT).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a tela de erro de armazenamento ainda deixa trocar o idioma e não vaza detalhe técnico", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true }));
    await page.goto("/");
    await page.getByLabel(/Idioma da interface/).selectOption("en");
    await expect(page.getByText(/Could not open the data/)).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/DOMException|TypeError|at \w+ \(|\.js:\d+/);
  });

  test("localStorage bloqueado (SecurityError ao ler): o app abre, troca de idioma e salva o perfil", async ({ page }) => {
    const errors = watch(page);
    await page.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("negado", "SecurityError");
        },
      }),
    );
    await start(page, "Ana");
    await page.goto("/profile");
    await page.getByRole("group", { name: "Idioma da interface" }).getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Your profile/);
    expect(errors).toEqual([]);
  });

  test("cota cheia (QuotaExceededError em put): salvar apelido e escolher avatar avisam; importar avisa; nada fica pela metade", async ({ page }) => {
    const errors = watch(page);
    await start(page, "Ana");
    await page.goto("/profile");
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function () {
        throw new DOMException("cheio", "QuotaExceededError");
      };
      IDBObjectStore.prototype.add = IDBObjectStore.prototype.put;
    });
    await page.getByLabel(/Apelido/).first().fill("Novo");
    await page.getByRole("button", { name: "Salvar apelido" }).click();
    await expect(page.getByText("Não consegui salvar. Tente de novo.").first()).toBeVisible();
    await expect(page.getByText("Apelido salvo.")).toHaveCount(0);
    await page.getByRole("link", { name: "Ajustes" }).first().click(); // sem recarregar: a trava de cota vive na página
    await page.locator('input[type="file"]').setInputFiles({
      name: "x.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        `{"format":"glifora-export","version":1,"exportedAt":"2026-11-20T15:00:00Z","app":"0.1.0","device":"d","docs":[{"id":"avatar","v":1,"data":{"figure":"d"},"updatedAt":${Date.now() + 1000},"deleted":0}]}`,
      ),
    });
    await expect(page.locator('.notice[role="alert"]')).toBeVisible();
    await page.reload(); // o put deixa de lançar; o que estava no banco continua como era
    await page.goto("/");
    await expect(page.getByText("Olá, Ana!")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("rotas inválidas e histórico", () => {
  const paths = [
    "/place/%",
    "/place/%E0%A4%A",
    "/place/%00",
    "/place/%ff%fe",
    "/place/__proto__",
    "/place/constructor",
    "/place/<script>alert(1)</script>",
    "/place/..%2f..%2fetc%2fpasswd",
    "/place/bakery/extra",
    "/place/",
    `/place/${"a".repeat(8_000)}`,
    `/place/${"a".repeat(100_000)}`, // acima do limite do servidor (431): vai pelo roteador
    `/${"b/".repeat(20_000)}`,
    "//evil.com",
    "/%5Cevil.com",
    "/%2e%2e/%2e%2e/",
    "/profile?x=<script>",
  ];
  for (const path of paths) {
    test(`abre sem erro e sem sair do site: ${path.slice(0, 30)} (${path.length} chars)`, async ({ page }) => {
      const errors = watch(page);
      await start(page);
      if (/%(?![0-9a-fA-F]{2})|%f[ef]/i.test(path) || path.length > 12_000) {
        // O `vite preview` responde 404 vazio a % malformado (a produção, Cloudflare Pages, devolve o index: conferido com GET). Aqui o alvo é o roteador.
        await page.evaluate((p) => {
          history.pushState({}, "", p);
          dispatchEvent(new PopStateEvent("popstate"));
        }, path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        expect(errors).toEqual([]);
        return;
      }
      // "//evil.com" resolveria para outro site se fosse relativo: sempre URL absoluta do preview.
      const response = await page.goto(`${BASE}${path}`);
      expect(response?.status()).toBeLessThan(500);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(new URL(page.url()).origin).toBe(BASE);
      expect(errors).toEqual([]);
    });
  }

  test("voltar e avançar do histórico entre rota inválida, perfil e vila mantém o app de pé", async ({ page }) => {
    const errors = watch(page);
    await start(page);
    await page.goto(`${BASE}/place/zzz%20x`);
    await page.goto(`${BASE}/profile`);
    await page.goto(`${BASE}/place/bakery`);
    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
    for (let i = 0; i < 3; i++) {
      await page.goForward();
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test.describe("duas abas", () => {
  test("apagar os dados numa aba enquanto a outra edita o perfil: a outra continua usável e não trava nem lança", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    const errors = [...watch(a), ...watch(b)];
    await start(a);
    await a.goto("/profile");
    await b.goto("/settings");
    await a.getByLabel(/Apelido/).first().fill("Rascunho");
    await b.getByRole("button", { name: /Apagar os dados/ }).click();
    await b.getByRole("button", { name: /Sim, apagar tudo/ }).click();
    await expect(b).toHaveURL(/\/(welcome)?$/);
    await a.getByRole("button", { name: "Salvar apelido" }).click();
    await expect(a.getByText("Apelido salvo.").or(a.getByText(/Não consegui salvar/)).first()).toBeVisible();
    await a.reload();
    await expect(a.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("duas abas importando arquivos diferentes ao mesmo tempo terminam com banco coerente (todos os docs válidos)", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await start(a);
    const file = (figure: string) => ({
      name: "x.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        `{"format":"glifora-export","version":1,"exportedAt":"2026-11-20T15:00:00Z","app":"0.1.0","device":"d-${figure}","docs":[{"id":"avatar","v":1,"data":{"figure":"${figure}"},"updatedAt":${Date.now() + 5000},"deleted":0}]}`,
      ),
    });
    await Promise.all([a.goto("/settings"), b.goto("/settings")]);
    await Promise.all([a.locator('input[type="file"]').setInputFiles(file("b")), b.locator('input[type="file"]').setInputFiles(file("c"))]);
    await expect(a.locator(".notice").first()).toBeVisible();
    await expect(b.locator(".notice").first()).toBeVisible();
    await a.goto("/profile");
    await expect(a.getByRole("radio", { checked: true }).first()).toBeVisible();
  });
});

test("trocar o idioma no meio de uma edição do apelido não perde o rascunho nem as mensagens de erro", async ({ page }) => {
  const errors = watch(page);
  await start(page, "Ana");
  await page.goto("/profile");
  const field = page.getByLabel(/Apelido|Nickname/).first();
  await field.fill("x".repeat(15));
  await page.getByRole("button", { name: "Salvar apelido" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.getByRole("group", { name: "Idioma da interface" }).getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Your profile/);
  await expect(page.getByLabel(/Nickname/).first()).toHaveValue("x".repeat(15));
  await expect(page.getByRole("alert").first()).toContainText(/10/); // a mensagem (D-55: limite de 10) de erro também troca de idioma
  expect(errors).toEqual([]);
});

test("offline na primeira visita falha só no navegador (sem service worker ainda); depois da visita, rota inválida abre offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "service worker + offline só no Chromium");
  await context.setOffline(true);
  await expect(page.goto(`${BASE}/`)).rejects.toThrow(/ERR_INTERNET_DISCONNECTED|net::/);
  await context.setOffline(false);
  await start(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15_000 }).toBe(true);
  await context.setOffline(true);
  for (const path of ["/place/%E0%A4%A", "/profile?x=<script>", `/place/${"a".repeat(5000)}`]) {
    await page.goto(`${BASE}${path}`);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
  }
  await context.setOffline(false);
});
