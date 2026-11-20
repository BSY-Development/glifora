// W2-13 — XP forjado: events/runs hostis na importação (D-49). Recusa com mensagem, nada gravado pela metade, pagamento único
// e o nível do HUD igual à soma gravada (deriveProgress). Payloads em tests/payloads/events-hostile.json. Dono: QA Tester.
import { expect, test } from "@playwright/test";
import { HEAD, idbAll, importText, onboard, payload, watch } from "./support/w2";

test.use({ locale: "en-US" });

interface Case {
  id: string;
  expect: "refuse" | "accept" | "either";
  one?: boolean;
  events?: Record<string, unknown>[];
  runs?: Record<string, unknown>[];
  gen?: { events?: number; runs?: number; xp?: number };
  raw_event?: string;
  raw_top?: string;
}
const data = payload<{ defaults: { event: Record<string, unknown>; run: Record<string, unknown> }; cases: Case[] }>("events-hostile.json");

const sub = (v: unknown): unknown => {
  if (typeof v === "string") {
    const m = /^\$A(\d+)$/.exec(v);
    if (m) return "a".repeat(Number(m[1]));
    if (v === "$ANSWERS20" || v === "$ANSWERS21") return Array.from({ length: Number(v.slice(8)) }, () => ({ node: "greet", input: "typed", scaffold: 0 }));
    if (v === "$RECASTS21") return Array.from({ length: 21 }, (_, i) => ({ pattern: `p${i}`, count: 1 }));
    if (v === "$WORDS31") return Array.from({ length: 31 }, (_, i) => `w${i}`);
    return v;
  }
  if (Array.isArray(v)) return v.map(sub);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]));
  return v;
};

function build(c: Case): string {
  const events: unknown[] = [];
  const runs: unknown[] = [];
  let n = 0;
  const fillEvent = (o: Record<string, unknown>) => {
    const { drop, ...rest } = o as { drop?: string[] } & Record<string, unknown>;
    const e: Record<string, unknown> = { id: `ev-${c.id}-${(n += 1)}`, ...data.defaults.event, ...(sub(rest) as object) };
    for (const k of drop ?? []) delete e[k];
    return e;
  };
  const fillRun = (o: Record<string, unknown>) => ({ id: `run-${c.id}-${(n += 1)}`, ...data.defaults.run, ...(sub(o) as object) });
  for (const o of c.events ?? []) events.push(fillEvent(o));
  for (const o of c.runs ?? []) runs.push(fillRun(o));
  if (c.gen?.events) for (let i = 0; i < c.gen.events; i += 1) events.push({ id: `g${i}`, ...data.defaults.event, xp: c.gen.xp ?? 1 });
  if (c.gen?.runs) for (let i = 0; i < c.gen.runs; i += 1) runs.push({ id: `gr${i}`, ...data.defaults.run });
  const evJson = c.raw_event ? `[${c.raw_event}]` : JSON.stringify(events);
  const top = c.raw_top ?? `"events":${evJson},"runs":${JSON.stringify(runs)}`;
  return `{${HEAD},"docs":[],${top}}`;
}

/** Nível pela curva v1: do nível L ao L+1 custa 50 × L, então o total para chegar ao nível L é 25·L·(L−1). */
const levelOf = (xp: number): number => {
  let l = 1;
  while (25 * (l + 1) * l <= xp) l += 1;
  return l;
};

for (const c of data.cases) {
  test(`importação hostil: ${c.id} (${c.expect})`, async ({ page }) => {
    test.setTimeout(c.gen ? 120_000 : 30_000);
    const problems = watch(page);
    await onboard(page, "Ana");
    const out = await importText(page, build(c));
    const events = await idbAll(page, "events");
    const runs = await idbAll(page, "runs");
    if (c.expect === "refuse") {
      expect(out.isAlert, `aceitou: ${out.text}`).toBe(true);
      expect(out.text.length).toBeGreaterThan(5);
      expect(events.length + runs.length, "recusou mas gravou").toBe(0);
    } else if (c.expect === "accept") {
      expect(out.isAlert, out.text).toBe(false);
    }
    if (!out.isAlert) {
      if (c.one) {
        const ids = [...events, ...runs].map((r) => r["id"]);
        expect(new Set(ids).size, "id repetido gravado").toBe(ids.length);
      }
      // pagamento único: importar o mesmo arquivo de novo não muda nada
      const again = await importText(page, build(c));
      expect(again.isAlert, again.text).toBe(false);
      expect((await idbAll(page, "events")).length).toBe(events.length);
      expect((await idbAll(page, "runs")).length).toBe(runs.length);
      // o nível mostrado bate com a soma gravada
      const total = events.reduce((s, e) => s + Math.max(0, Number(e["xp"])), 0);
      await page.goto("/");
      // o HUD mostra "Carregando…" até o livro-razão chegar (F-W2-13-06): espera o texto do nível, sem ler o HUD na hora.
      // O " ·" depois do número impede que "Level 6" case com "Level 632"; nível errado estoura o prazo e reprova.
      await expect(page.locator(".hud-level"), `soma ${total} XP`).toContainText(`Level ${levelOf(total)} ·`, { timeout: 15_000 });
    }
    // nada executa, nada quebra: as telas que leem events/runs abrem
    for (const route of ["/", "/profile", "/settings", "/place/bakery", `/report/${encodeURIComponent(String(runs[0]?.["id"] ?? "x"))}`]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 }), route).toBeVisible();
    }
    expect(problems).toEqual([]);
  });
}
