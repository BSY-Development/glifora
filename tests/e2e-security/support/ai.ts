// Atalhos do QA Tester para a W2-24 (revisão com IA e key, D-56). Dono: QA Tester.
// NUNCA key real: só FAKE_KEY (formato plausível). O host do Gemini é sempre interceptado com page.route: nenhuma chamada real ao Google.
import { expect, type Page, type Request, type Route } from "@playwright/test";
import { answerAllByText, BAKERY_REPLIES, CLOSING_OWN, startMission, type } from "../../e2e/support/play";
import { installSpeech } from "../../e2e/support/speech";
import { onboard } from "./w2";

/** "AIza" + 35 caracteres, só para o formato bater. Não é uma key de verdade. */
export const FAKE_KEY = `AIza${"Sy-qa_fake0".repeat(4).slice(0, 35)}`;
export const FAKE_KEY_2 = `AIza${"Zx_qa-other1".repeat(4).slice(0, 35)}`;
export const GEMINI_HOST = "generativelanguage.googleapis.com";
export const GEMINI_URL = `https://${GEMINI_HOST}/v1beta/models/gemini-3.5-flash-lite:generateContent`;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };

/** Uma chamada que chegou ao "Gemini" simulado. */
export interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  /** O texto do pedido (user) e o do sistema, já separados. */
  user: string;
  system: string;
}

export type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string>; delayMs?: number; hang?: boolean; abort?: boolean };
export type Handler = (seen: Seen, n: number) => Reply | Promise<Reply>;

/** Envelope de resposta do Gemini com `text` dentro de candidates[0]. */
export const gemini = (text: string, extra: Record<string, unknown> = {}) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", ...extra }] });

export interface ItemIn {
  i: number;
  meant?: string;
  verdict?: string;
  correction?: string;
  natural?: string;
  tip?: string;
  [extra: string]: unknown;
}
/** Uma revisão válida para `n` falas (todas "polish", que pede natural + tip). */
export function review(n: number, patch: (item: ItemIn, k: number) => ItemIn = (x) => x): { items: ItemIn[] } {
  return {
    items: Array.from({ length: n }, (_, k) => patch({ i: k, meant: "a bread", verdict: "polish", correction: "", natural: "Can I have some bread, please?", tip: "Add please." }, k)),
  };
}
export const TURNS = 6; // bakery-01: 5 falas + o fecho em palavras próprias

export interface Mock {
  calls: Seen[];
  /** Todo pedido a host que não é o do app nem o do Gemini simulado. */
  other: string[];
  /** Todo pedido ao Gemini com a key em lugar proibido (URL). */
  urlLeaks: string[];
}

/** Intercepta o host do Gemini (e só ele) e conta os pedidos. Qualquer outro host externo vai para `other` e é abortado. */
export async function mockGemini(page: Page, handler: Handler): Promise<Mock> {
  const mock: Mock = { calls: [], other: [], urlLeaks: [] };
  await page.route(/^https?:\/\/(?!localhost(:\d+)?\/)/, async (route: Route, request: Request) => {
    const url = new URL(request.url());
    if (url.hostname !== GEMINI_HOST) {
      mock.other.push(request.url());
      await route.abort();
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = request.postData() ?? "";
    let user = "";
    let system = "";
    try {
      const parsed = JSON.parse(body) as { contents?: { parts?: { text?: string }[] }[]; systemInstruction?: { parts?: { text?: string }[] } };
      user = parsed.contents?.[0]?.parts?.[0]?.text ?? "";
      system = parsed.systemInstruction?.parts?.[0]?.text ?? "";
    } catch {
      /* corpo que não é JSON fica só em `body` */
    }
    const seen: Seen = { url: request.url(), method: request.method(), headers: await request.allHeaders(), body, user, system };
    mock.calls.push(seen);
    if (/key=|AIza/.test(request.url())) mock.urlLeaks.push(request.url());
    const reply = await handler(seen, mock.calls.length);
    if (reply.abort) {
      await route.abort("failed");
      return;
    }
    if (reply.hang) return; // nunca responde
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    await route
      .fulfill({
        status: reply.status ?? 200,
        headers: { ...CORS, "content-type": "application/json", ...reply.headers },
        body: reply.text ?? JSON.stringify(reply.json ?? {}),
      })
      .catch(() => undefined); // a página pode ter ido embora
  });
  return mock;
}

/** Guarda a key pela tela /settings/ai (de verdade, como a pessoa). */
export async function saveKeyUi(page: Page, key: string, where: "session" | "device"): Promise<void> {
  await page.goto("/settings/ai");
  await page.locator("#ai-key-field").fill(key);
  await page.getByRole("radio", { name: where === "device" ? /Remember on this device/ : /This session only/ }).check();
  await page.getByRole("button", { name: "Save the key" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Key saved." })).toBeVisible();
}

/** Onboarding, key (no aparelho) e uma rodada completa até o relatório. Devolve o caminho do relatório. */
export async function reportWithKey(page: Page, opts: { key?: string | null; nickname?: string; replies?: readonly string[]; closing?: string } = {}): Promise<string> {
  await installSpeech(page, "ok", { consent: true });
  await onboard(page, opts.nickname ?? "");
  if (opts.key !== null) await saveKeyUi(page, opts.key ?? FAKE_KEY, "device");
  await startMission(page, "phrase");
  const replies = opts.replies ?? BAKERY_REPLIES;
  await answerAllByText(page, replies);
  await type(page, opts.closing ?? CLOSING_OWN);
  await page.getByRole("button", { name: "See the report" }).click();
  await expect(page).toHaveURL(/\/report\//);
  return new URL(page.url()).pathname;
}

export const reviewButton = (page: Page) => page.getByRole("button", { name: /Review with AI|Try again/ });
export const aiAlert = (page: Page) => page.locator("#ai-review-title").locator("xpath=..").locator('[role="alert"]');
export const aiSection = (page: Page) => page.locator('section[aria-labelledby="ai-review-title"]');

/** Tudo que o app guardou no navegador (sem passar por ele), como texto, para procurar a key. */
export async function dumpStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: string[] = [];
    out.push(JSON.stringify(Object.entries(localStorage)), JSON.stringify(Object.entries(sessionStorage)));
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name!);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const name of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((res, rej) => {
          const q = db.transaction(name, "readonly").objectStore(name).getAll();
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
        out.push(`${info.name}/${name}:${JSON.stringify(rows)}`);
      }
      db.close();
    }
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) out.push(`cache:${name}:${req.url}`);
    }
    out.push(`url:${location.href}`, `ref:${document.referrer}`, `title:${document.title}`);
    return out.join("\n");
  });
}
