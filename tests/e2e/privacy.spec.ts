// W1-14 — privacidade e conteúdo hostil no navegador (W0-03 §1.2 C). Dono: Revisor.
// Fluxos reais (primeira visita, ajustes, exportar, importar, apagar, idioma): nenhum pedido sai do site, a exportação só leva
// o permitido, o apelido é texto puro, o arquivo hostil é recusado, e o service worker não guarda nada fora do precache.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { idbAll, idbPut } from "../e2e-security/support/w2";

test.use({ locale: "pt-BR" });

function watch(page: Page) {
  const problems: string[] = [];
  const foreign: string[] = [];
  const origin = new URL(page.url() === "about:blank" ? "http://localhost:4173" : page.url()).origin;
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "data:" || u.protocol === "blob:") return; // blob: é o próprio arquivo de exportação indo para o download
    if (u.origin !== origin && u.hostname !== "localhost") foreign.push(`${r.method()} ${r.url()}`);
  });
  return { problems, foreign };
}

async function start(page: Page, nickname = "") {
  await page.goto("/welcome");
  if (nickname) await page.getByLabel("Apelido (opcional)").fill(nickname);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function exportFile(page: Page): Promise<string> {
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Exportar meu progresso|Export my progress/ }).click()]);
  return readFileSync((await download.path())!, "utf8");
}

test("fluxo completo (visita, perfil, ajustes, exportar, importar, idioma, apagar): nenhum pedido para fora do site", async ({ page }) => {
  const { problems, foreign } = watch(page);
  await start(page, "Ana");
  await page.getByRole("link", { name: "Padaria" }).click();
  await page.goto("/profile");
  await page.getByRole("group", { name: "Idioma da interface" }).getByRole("radio", { name: "English" }).click();
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Extra large|Muito grande/ }).click();
  const text = await exportFile(page);
  expect(text.length).toBeGreaterThan(50);
  await page.goto("/about");
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "glifora.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("status").or(page.getByRole("alert")).first()).toBeVisible();
  await page.getByRole("button", { name: /Erase the data|Apagar os dados/ }).click();
  await page.getByRole("button", { name: /Yes, erase everything|Sim, apagar tudo/ }).click();
  await expect(page).toHaveURL(/\/(welcome)?$/);
  expect(foreign).toEqual([]);
  expect(problems).toEqual([]);
});

test("exportação: só app/device/docs/events/exportedAt/format/runs/version; cada doc só id/v/data/updatedAt/deleted; nada de key, meta ou dirty", async ({ page }) => {
  await start(page, "Ana");
  const text = await exportFile(page);
  const file = JSON.parse(text) as Record<string, unknown>;
  expect(Object.keys(file).sort()).toEqual(["app", "device", "docs", "events", "exportedAt", "format", "runs", "version"]);
  expect(file["format"]).toBe("glifora-export");
  expect(file["version"]).toBe(1);
  const docs = file["docs"] as Record<string, unknown>[];
  expect(docs.map((d) => d["id"]).sort()).toEqual(expect.arrayContaining(["profile"]));
  for (const d of docs) {
    expect(Object.keys(d).sort()).toEqual(["data", "deleted", "id", "updatedAt", "v"]);
    expect(["profile", "prefs", "avatar"]).toContain(d["id"]);
  }
  for (const word of ["apikey", "api_key", "api-key", "token", "secret", "password", "authorization", "bearer", "dirty", "owner", "lastExportAt", "session"]) {
    expect(text.toLowerCase(), word).not.toContain(word.toLowerCase());
  }
  // O id do aparelho é um UUID aleatório: não é a identidade da pessoa.
  expect(file["device"]).toMatch(/^[0-9a-f-]{36}$/);
  expect(file["events"]).toEqual([]);
  expect(file["runs"]).toEqual([]);
});

// Campos permitidos de cada registro exportado (src/data/schema/records.ts, W2-05): EventFile e RunFile, sem `synced`.
const EVENT_KEYS = ["id", "at", "day", "kind", "xp", "coins", "rules", "target", "ref", "runId", "device"];
const EVENT_REQUIRED = ["id", "at", "day", "kind", "xp", "coins", "rules", "device"];
const RUN_KEYS = ["id", "missionId", "at", "day", "level", "xp", "rules", "canDo", "replies", "recasts", "words", "answers", "closing", "device"];
const RUN_REQUIRED = RUN_KEYS.filter((k) => k !== "closing");

test("exportação com events e runs: só os campos do schema, sem synced/dirty/session/key; a session nunca sai", async ({ page }) => {
  await start(page, "Ana");
  // Semeia direto no IndexedDB (o player ainda não grava): marcas locais synced=1 e uma rodada em andamento.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("glifora");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(["events", "runs", "session"], "readwrite");
      tx.objectStore("events").put({ id: "ev-1", at: 1000, day: "2026-11-20", kind: "mission_completed", xp: 20, coins: 5, rules: 1, target: "bakery-01", runId: "run-1", device: "dev-1", synced: 1 });
      tx.objectStore("runs").put({
        id: "run-1", missionId: "bakery-01", at: 1000, day: "2026-11-20", level: 1, xp: 20, rules: 1, canDo: true,
        replies: { good: 2, flawed: 1, retry: 0 }, recasts: [{ pattern: "p-1", count: 1 }], words: ["pão"],
        answers: [{ node: "n1", input: "typed", scaffold: 0 }], closing: { text: "Um pão, por favor.", input: "voice", accepted: true, usedModel: false },
        device: "dev-1", synced: 1,
      });
      tx.objectStore("session").put({ id: "current", v: 1, missionId: "bakery-01", updatedAt: 1000, state: { segredo: "SESSAO-NAO-EXPORTAR" } });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
  const text = await exportFile(page);
  const file = JSON.parse(text) as { events: Record<string, unknown>[]; runs: Record<string, unknown>[] };
  expect(file.events).toHaveLength(1);
  expect(file.runs).toHaveLength(1);
  for (const e of file.events) {
    for (const k of Object.keys(e)) expect(EVENT_KEYS, `events.${k}`).toContain(k);
    for (const k of EVENT_REQUIRED) expect(e, `events.${k}`).toHaveProperty(k);
  }
  for (const r of file.runs) {
    for (const k of Object.keys(r)) expect(RUN_KEYS, `runs.${k}`).toContain(k);
    for (const k of RUN_REQUIRED) expect(r, `runs.${k}`).toHaveProperty(k);
  }
  expect(text).not.toContain("SESSAO-NAO-EXPORTAR");
  expect(text).not.toContain('"synced"');
  expect(text).not.toContain('"dirty"');
  expect(Object.keys(file)).not.toContain("session");
  for (const word of ["apikey", "api_key", "token", "secret", "password", "authorization", "bearer"]) expect(text.toLowerCase(), word).not.toContain(word);
});

test("nada parecido com key fica no armazenamento do navegador (localStorage, sessionStorage, IndexedDB) na fase 1", async ({ page }) => {
  await start(page, "Ana");
  await page.goto("/settings");
  const dump = await page.evaluate(async () => {
    const out: Record<string, unknown> = { local: { ...localStorage }, session: { ...sessionStorage }, idb: {} };
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const tables: Record<string, unknown[]> = {};
      for (const t of Array.from(db.objectStoreNames)) {
        tables[t] = await new Promise<unknown[]>((res) => {
          const q = db.transaction(t).objectStore(t).getAll();
          q.onsuccess = () => res(q.result);
        });
      }
      (out["idb"] as Record<string, unknown>)[name] = tables;
      db.close();
    }
    return out;
  });
  const text = JSON.stringify(dump).toLowerCase();
  for (const word of ["apikey", "api_key", "api-key", "sk-", "bearer", "password", "secret", "authorization"]) expect(text, word).not.toContain(word);
  expect(Object.keys(dump["local"] as object).every((k) => k.startsWith("glifora."))).toBe(true);
  expect(Object.keys(dump["session"] as object)).toEqual([]);
});

test("apelido é texto puro: aparece literal, sem virar HTML, atributo, URL ou substituição", async ({ page }) => {
  const nick = "A&amp; {x} $& ${1+1} \"'`%s"; // até 30 caracteres
  expect(Array.from(nick).length).toBeLessThanOrEqual(30);
  const { problems } = watch(page);
  await start(page); // o campo só aceita letras (D-55): o apelido hostil entra como perfil/arquivo antigo, que a leitura ainda aceita
  const row = (await idbAll(page, "docs")).find((d) => d["id"] === "profile")!;
  await idbPut(page, "docs", { ...row, data: { ...(row["data"] as object), nickname: nick }, updatedAt: Date.now() + 1000 });
  await page.goto("/");
  await expect(page.getByText(nick, { exact: false }).first()).toBeVisible();
  expect(await page.locator("img, script:not([src]), iframe, svg [onload]").count()).toBe(0); // (as figuras do pixel art são SVG, sem imagem)
  expect(await page.locator("[onclick], [onerror], [onload], [onmouseover]").count()).toBe(0);
  expect(await page.locator("a[href^='javascript:']").count()).toBe(0);
  const html = await page.locator("main").innerHTML();
  expect(html).toContain("&amp;amp;"); // o "&amp;" digitado foi escapado como texto (não virou "&")
  expect(await page.title()).not.toContain("alert");
  expect(problems).toEqual([]);
  // Sobrevive a recarregar e a ir e voltar pelo perfil (campo de formulário, atributo value) sem quebrar.
  await page.goto("/profile");
  await expect(page.getByLabel("Apelido (opcional)").or(page.getByLabel(/Apelido/)).first()).toHaveValue(nick);
});

test("apelido com < ou > é recusado, na tela e na importação; arquivo hostil não grava nada", async ({ page }) => {
  await start(page, "Ana");
  const good = JSON.parse(await exportFile(page)) as { docs: { id: string; data: Record<string, unknown> }[] };
  const hostile = (patch: (d: typeof good) => void) => {
    const copy = JSON.parse(JSON.stringify(good)) as typeof good;
    patch(copy);
    return Buffer.from(JSON.stringify(copy));
  };
  const cases: Record<string, Buffer> = {
    "tag no apelido": hostile((d) => void (d.docs.find((x) => x.id === "profile")!.data["nickname"] = "<img src=x onerror=alert(1)>")),
    "campo extra (apiKey)": hostile((d) => void ((d as unknown as Record<string, unknown>)["apiKey"] = "sk-teste-falsa")),
    "campo extra no doc": hostile((d) => void (d.docs.find((x) => x.id === "profile")!.data["extra"] = 1)),
    "apelido de 31 caracteres": hostile((d) => void (d.docs.find((x) => x.id === "profile")!.data["nickname"] = "x".repeat(31))),
    "bidi no apelido": hostile((d) => void (d.docs.find((x) => x.id === "profile")!.data["nickname"] = "Ana‮evil")),
    "não é JSON": Buffer.from("<html><script>alert(1)</script>"),
    "outro formato": Buffer.from(JSON.stringify({ format: "outra-coisa", version: 1 })),
    "versão futura": hostile((d) => void ((d as unknown as Record<string, unknown>)["version"] = 99)),
  };
  for (const [name, buffer] of Object.entries(cases)) {
    await page.goto("/settings");
    await page.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer });
    await expect(page.getByRole("alert").first(), name).toBeVisible();
    expect(await page.locator("img, script:not([src])").count(), name).toBe(0);
    await page.goto("/");
    await expect(page.getByText("Ana").first(), `${name}: o perfil bom continua`).toBeVisible();
  }
  await page.goto("/profile");
  const field = page.getByLabel(/Apelido/).first();
  await field.fill("<b>x</b>");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("service worker: nada fora do precache entra no cache, nem arquivo do site nem pedido novo", async ({ page }) => {
  await page.goto("/welcome");
  await page.evaluate(async () => void (await navigator.serviceWorker.ready));
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  const keys = () =>
    page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url);
      return out.sort();
    });
  const before = await keys();
  const origin = new URL(page.url()).origin;
  // Pedidos que NÃO estão no precache: um sub-recurso do site, o version.json e uma consulta qualquer.
  await page.evaluate(async () => {
    for (const u of ["/version.json", "/nao-existe.txt", "/assets/nao-existe.js?x=1", "/manifest.webmanifest?v=2"]) await fetch(u).catch(() => null);
  });
  const after = await keys();
  expect(after).toEqual(before);
  for (const u of after) expect(new URL(u).origin).toBe(origin);
  // O worker não responde por outra origem: com a CSP, o pedido nem sai; aqui só confirmamos que continua bloqueado sob o worker.
  const external = await page.evaluate(() => fetch("https://example.com/").then(() => "saiu", () => "bloqueado"));
  expect(external).toBe("bloqueado");
});

test("troca de idioma: <html lang>, título e rótulos mudam, persistem e a página 404 também", async ({ page }) => {
  await start(page);
  await page.goto("/profile");
  await page.getByRole("group", { name: "Idioma da interface" }).getByRole("radio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/nada-aqui");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  expect(await page.title()).toContain("Page not found");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("/about: licenças, link do código-fonte com rel seguro e versão com commit", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 2, name: "Licenças" })).toBeVisible();
  await expect(page.getByText(/AGPL-3\.0/)).toBeVisible();
  await expect(page.getByText(/CC BY-SA 4\.0/)).toBeVisible();
  const link = page.getByRole("link", { name: "Código-fonte no GitHub" });
  await expect(link).toHaveAttribute("href", "https://github.com/BSY-Development/glifora");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  expect(await page.locator("a[href^='http']").count()).toBe(1); // o único link para fora do site
  await expect(page.getByText(/Versão/)).toBeVisible();
  await expect(page.getByText(/commit/i)).toBeVisible();
});

test("portão da fase: exportar, apagar tudo e importar de volta recupera apelido, avatar e ajustes", async ({ page }) => {
  await start(page, "Teste");
  await page.goto("/profile");
  await page.locator("label", { hasText: "Chapéu roxo" }).click(); // o rádio fica sob o desenho: toca-se no cartão
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Grande", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  const text = await exportFile(page);

  await page.getByRole("button", { name: "Apagar os dados deste aparelho" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click(); // cancelar não apaga
  await page.goto("/");
  await expect(page.getByText("Teste").first()).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Apagar os dados deste aparelho" }).click();
  await page.getByRole("button", { name: "Sim, apagar tudo" }).click();
  await expect(page).toHaveURL(/\/(welcome)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Boas-vindas ao Glifora" })).toBeVisible(); // recomeçou do zero

  await page.getByRole("link", { name: "Ajustes" }).click(); // a barra de baixo continua lá
  await page.locator('input[type="file"]').setInputFiles({ name: "glifora.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByText(/Importação concluída/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");

  await page.getByRole("link", { name: "Vila" }).click();
  await expect(page.getByText("Teste").first()).toBeVisible();
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByRole("radio", { name: "Chapéu roxo" })).toBeChecked();
});
