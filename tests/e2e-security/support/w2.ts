// Atalhos do QA Tester para a W2-13 (IndexedDB cru, importação, vigia de erros). Dono: QA Tester.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const HEAD = `"format":"glifora-export","version":1,"exportedAt":"2026-11-20T15:00:00Z","app":"0.1.0","device":"dev-x"`;

export function payload<T>(name: string): T {
  return JSON.parse(readFileSync(`tests/payloads/${name}`, "utf8")) as T;
}

/** Erros soltos, diálogos e avisos do console (o app não pode lançar nada com dado hostil). */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("dialog", (d) => {
    problems.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
  });
  return problems;
}

export async function onboard(page: Page, nickname = ""): Promise<void> {
  await page.goto("/welcome");
  if (nickname) await page.locator("input[type=text], input:not([type])").first().fill(nickname);
  await page.getByRole("button", { name: /Let's go|Começar/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Lê todas as linhas de uma tabela do banco "glifora". */
export function idbAll(page: Page, store: "events" | "runs" | "session" | "docs" | "meta"): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (s) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open("glifora");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(s, "readonly").objectStore(s).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as Record<string, unknown>[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

/** Grava (put) uma linha crua, sem passar pelo app. */
export function idbPut(page: Page, store: "events" | "runs" | "session" | "docs", row: unknown): Promise<void> {
  return page.evaluate(
    ({ s, r }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("glifora");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(s, "readwrite");
          tx.objectStore(s).put(r);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { s: store, r: row },
  );
}

/** Importa um arquivo pela tela /settings e devolve o aviso mostrado. */
export async function importText(page: Page, text: string | Buffer): Promise<{ isAlert: boolean; text: string }> {
  await page.goto("/settings");
  const buffer = typeof text === "string" ? Buffer.from(text) : text;
  await page.locator('input[type="file"]').setInputFiles({ name: "x.json", mimeType: "application/json", buffer });
  const alert = page.locator('.notice[role="alert"]');
  const status = page.locator('.notice[role="status"]');
  await expect(alert.or(status).first()).toBeVisible({ timeout: 60_000 });
  const isAlert = (await alert.count()) > 0;
  return { isAlert, text: (await (isAlert ? alert : status).first().innerText()).trim() };
}

/** Troca o apelido pelo /profile (interface em inglês). */
export async function setNickname(page: Page, nickname: string): Promise<void> {
  await page.goto("/profile");
  await page.getByLabel(/Nickname/).first().fill(nickname);
  await page.getByRole("button", { name: /Save nickname/ }).click();
  await expect(page.getByText("Nickname saved")).toBeVisible();
}

/** Tem controle, formato (bidi, largura zero) ou separador de linha? (Cc, Cf, Zl, Zp) */
// Montada por código: o arquivo é só ASCII e uma barra invertida digitada aqui já se perdeu uma vez.
const BS = String.fromCharCode(92);
const HIDDEN = new RegExp(["Cc", "Cf", "Zl", "Zp"].map((c) => `${BS}p{${c}}`).join("|"), "u");
export const hiddenChars = (s: string): boolean => HIDDEN.test(s);

/** Caracteres invisíveis montados por código (o arquivo fica só em ASCII). */
export const CH = {
  nul: String.fromCharCode(0x0),
  bel: String.fromCharCode(0x7),
  rlo: String.fromCharCode(0x202e),
  zwsp: String.fromCharCode(0x200b),
  lri: String.fromCharCode(0x2066),
};
