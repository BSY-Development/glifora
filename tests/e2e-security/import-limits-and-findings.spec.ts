// W1-16 — importação: limites de tamanho, conteúdo binário e os achados F-W1-16-03/04 (corrigidos na W1-17). Dono: QA Tester.
import { readFileSync, statSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "pt-BR" });

const large = JSON.parse(readFileSync("tests/payloads/imports-large.json", "utf8")) as {
  limitBytes: number;
  "roundtrip-growth": { docId: string; deleted: 0 | 1; arrayOnes: number };
  "over-limit-by-one": { padTo: number };
  "at-limit": { padTo: number };
  binary: Record<string, number[] | string>;
};
const imports = JSON.parse(readFileSync("tests/payloads/imports.json", "utf8")) as { head: string };
const HEAD = imports.head;

async function start(page: Page, nickname = "Ana") {
  await page.goto("/welcome");
  await page.getByLabel("Apelido (opcional)").fill(nickname);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function importBuffer(page: Page, buffer: Buffer) {
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer });
  const alert = page.locator('.notice[role="alert"]');
  const status = page.locator('.notice[role="status"]');
  await expect(alert.or(status).first()).toBeVisible({ timeout: 60_000 });
  const isAlert = (await alert.count()) > 0;
  return { isAlert, text: (await (isAlert ? alert : status).first().innerText()).trim() };
}

async function exportSize(page: Page): Promise<{ size: number; path: string }> {
  await page.goto("/settings");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: /Exportar meu progresso/ }).click()]);
  const path = (await dl.path())!;
  return { size: statSync(path).size, path };
}

const padded = (target: number): Buffer => {
  const body = `{${HEAD},"docs":[]}`;
  return Buffer.concat([Buffer.from(body), Buffer.alloc(target - body.length, 0x20)]);
};

test("arquivo exatamente no limite de 20 MiB é lido sem travar; um byte acima é recusado como grande demais", async ({ page }) => {
  await start(page);
  const t0 = Date.now();
  const atLimit = await importBuffer(page, padded(large["at-limit"].padTo));
  expect(atLimit.isAlert, atLimit.text).toBe(false);
  expect(Date.now() - t0, "no limite: lento demais").toBeLessThan(20_000);
  const over = await importBuffer(page, padded(large["over-limit-by-one"].padTo));
  expect(over.isAlert).toBe(true);
  expect(over.text).toMatch(/20 ?MB|grande/i);
  await page.goto("/");
  await expect(page.getByText("Olá, Ana!")).toBeVisible();
});

for (const [name, spec] of Object.entries(large.binary)) {
  test(`.json com conteúdo binário/codificação errada: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    const valid = `{${HEAD},"docs":[]}`;
    let buffer: Buffer;
    if (Array.isArray(spec)) buffer = Buffer.from(spec);
    else if (spec === "utf16le") buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(valid, "utf16le")]);
    else buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(valid)]);
    const out = await importBuffer(page, buffer);
    if (spec === "utf8bom") expect(out.isAlert, "UTF-8 com BOM é JSON válido do Windows").toBe(false);
    else if (spec !== "utf16le") expect(out.isAlert, out.text).toBe(true); // UTF-16 com BOM: o Chrome decodifica e é JSON válido; só exige que nada quebre
    await page.goto("/");
    await expect(page.getByText("Olá, Ana!")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("F-W1-16-03: arquivo com documento de versão mais nova é recusado e o perfil legível fica", async ({ page }) => {
  await start(page, "Ana");
  const now = Date.now() + 3_600_000;
  await importBuffer(page, Buffer.from(`{${HEAD},"docs":[{"id":"profile","v":2,"data":{"x":1},"updatedAt":${now},"deleted":0}]}`));
  await expect(page.locator(".notice[role=alert]")).toContainText(/versão mais nova/i);
  await page.goto("/");
  await expect(page.getByText("Olá, Ana!"), "o perfil legível foi substituído por um que o app não lê").toBeVisible();
});

test("F-W1-16-03b: arquivo com preferências de versão mais nova não pode travar o salvamento dos ajustes", async ({ page }) => {
  await start(page, "Ana");
  const now = Date.now() + 3_600_000;
  await importBuffer(page, Buffer.from(`{${HEAD},"docs":[{"id":"prefs","v":99,"data":{"x":1},"updatedAt":${now},"deleted":0}]}`));
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Muito grande/ }).click();
  await expect(page.getByText("Não consegui salvar")).toHaveCount(0);
});

test("F-W1-16-03c: depois de um arquivo de versão mais nova, apagar os dados do aparelho recupera o app (caminho de saída existe)", async ({ page }) => {
  await start(page, "Ana");
  const now = Date.now() + 3_600_000;
  await importBuffer(page, Buffer.from(`{${HEAD},"docs":[{"id":"profile","v":2,"data":{"x":1},"updatedAt":${now},"deleted":0}]}`));
  await page.goto("/settings");
  await page.getByRole("button", { name: /Apagar os dados/ }).click();
  await page.getByRole("button", { name: /Sim, apagar tudo/ }).click();
  await expect(page).toHaveURL(/\/(welcome)?$/);
  await page.goto("/welcome");
  await page.getByLabel("Apelido (opcional)").fill("Bia");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByText("Olá, Bia!")).toBeVisible();
});

test("F-W1-16-04: data acima de 32 KB é recusado (invalid) e nada é gravado; lápide com lixo entra sem conteúdo e a exportação fica pequena", async ({ page }) => {
  await start(page);
  const r = large["roundtrip-growth"];
  const now = Date.now() + 3_600_000;
  const ones = "1,".repeat(r.arrayOnes - 1) + "1";
  const big = Buffer.from(`{${HEAD},"docs":[{"id":"${r.docId}","v":1,"data":{"x":[${ones}]},"updatedAt":${now},"deleted":${r.deleted}}]}`);
  expect(big.length, "arquivo de ataque abaixo do limite").toBeLessThan(large.limitBytes);
  const refused = await importBuffer(page, big);
  expect(refused.isAlert, refused.text).toBe(true);
  // lápide com lixo pequeno: aceita, mas o conteúdo não é guardado
  const small = Buffer.from(`{${HEAD},"docs":[{"id":"avatar","v":1,"data":{"x":"<script>alert(1)</script>"},"updatedAt":${now},"deleted":1}]}`);
  const ok = await importBuffer(page, small);
  expect(ok.isAlert, ok.text).toBe(false);
  const exported = await exportSize(page);
  expect(exported.size).toBeLessThan(2000);
  expect(readFileSync(exported.path, "utf8")).not.toContain("<script>");
});
