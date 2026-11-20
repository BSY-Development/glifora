// Sondagens do Arquiteto (W1-01) e do Revisor: o que o lint TEM de barrar e o legítimo que NÃO pode ser barrado.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

const bad: [string, string][] = [
  ["src/ui/x.ts", 'import { db } from "../data/db"; export const a = db;'],
  ["src/ui/x.ts", 'export const a = () => import("../ai");'],
  ["src/ui/x.ts", 'import * as ai from "../ai"; export const a = ai;'],
  ["src/ui/x.ts", 'import Dexie from "dexie"; export const a = Dexie;'],
  ["src/engine/x.ts", 'export const a = import.meta.glob("/content/**");'],
  ["src/ui/x.ts", 'export const a = () => fetch("https://x");'],
  ["src/ui/x.ts", 'export const a = () => window.fetch("https://x");'],
  ["src/ui/x.ts", 'export const a = () => navigator.sendBeacon("https://x", "k");'],
  ["src/services/x.ts", 'export const a = () => new WebSocket("wss://x");'],
  ["src/engine/x.ts", "export const a = Date();"],
  ["src/engine/x.ts", "export const a = () => setTimeout(() => 0, 1);"],
  ["src/engine/x.ts", "export const a = (p: string) => import(p);"],
  ["src/engine/x.ts", 'import { db } from "../engine/../data/db"; export const a = db;'],
  ["src/engine/x.ts", 'import w from "../../content/world/locations.json"; export const a = w;'],
  ["src/ui/X.tsx", 'export const E = () => <img alt="Padaria" />;'],
  ["src/ui/X.tsx", "export const E = () => <input placeholder={`Nome`} />;"],
  ["src/ui/X.tsx", "export const E = () => <p>{`Olá`}</p>;"],
  ["src/ui/X.tsx", 'export const E = (p: { a: boolean }) => <p>{p.a && "Oi"}</p>;'],
  ["src/ui/X.tsx", "export const E = (p: { h: string }) => <iframe srcDoc={p.h} />;"],
  ["src/ui/x.ts", 'export const a = (h: string) => new DOMParser().parseFromString(h, "text/html");'],
  ["src/ui/x.ts", 'export function f(e: Element, h: string) { e["setHTMLUnsafe"](h); }'],
  ["src/ui/X.tsx", "export const E = () => <p>Привет</p>;"],
  // Revisor
  ["src/engine/x.ts", 'export * from "../data/db";'],
  ["src/engine/x.ts", "export const a = (p: string) => import(`../data/${p}`);"],
  ["src/engine/x.ts", 'export const a = () => new Worker("w.js");'],
  ["src/engine/x.ts", "export const a = () => performance.now();"],
  ["src/engine/x.ts", "export const a = () => globalThis.crypto.randomUUID();"],
  ["src/schemas/x.ts", "export const a = globalThis.fetch;"],
  ["src/ui/x.ts", 'export const a = () => import("../ai/keyVault");'],
  ["src/ui/x.ts", 'export const a = () => import("../ai/providers/openrouter");'],
  ["src/ui/x.ts", 'import { k } from "../services/../ai/keyVault"; export const a = k;'],
  ["src/ui/x.ts", 'export const a = () => import("/src/data/db");'],
  ["src/ui/X.tsx", 'export const E = () => <button aria-label="Fechar" />;'],
  ["src/ui/X.tsx", 'export const E = (p: { a: boolean }) => <p>{p.a ? "Sim" : "Não"}</p>;'],
  ["src/ui/X.tsx", "export const E = () => <p>こんにちは</p>;"],
  ["src/ui/x.ts", 'export function f(e: HTMLElement, h: string) { e["innerHTML"] = h; }'],
  ["src/ui/x.ts", "export function f(r: Range, h: string) { return r.createContextualFragment(h); }"],
  ["src/ui/X.test.tsx", "export const f = (e: HTMLElement, h: string) => { e.innerHTML = h; };"],
];

const good: [string, string][] = [
  ["src/ui/X.tsx", 'declare const t: (k: string) => string; export const E = () => <p>{t("app.name")}</p>;'],
  ["src/ui/X.tsx", 'declare const t: (k: string) => string; export const E = (p: { a: boolean }) => <p>{t(p.a ? "x.a" : "x.b")}</p>;'],
  ["src/ui/X.tsx", 'export const E = (p: { a: boolean }) => <div className={p.a ? "big" : "small"} />;'],
  ["src/ui/X.tsx", 'declare const t: (k: string) => string; export const E = () => <img alt={t("x")} src="/a.png" />;'],
  ["src/ui/X.tsx", 'export const E = (p: { n: number }) => <p>{p.n}{" · "}</p>;'],
  ["src/ai/x.ts", 'export const a = () => fetch("https://openrouter.ai/api/v1/x");'],
  ["src/data/x.ts", 'export const a = () => fetch("https://x.supabase.co");'],
  ["src/catalog/x.ts", 'export const a = import.meta.glob("../../content/missions/**/*.json");'],
  ["src/catalog/x.ts", 'import w from "../../content/world/locations.json"; export const a = w;'],
  ["src/main.tsx", 'export const a = () => import("./ui/App");'],
  [
    "src/ui/x.ts",
    'import { s } from "../services/s"; import { i } from "../i18n"; import { Cefr } from "../schemas"; import { xp } from "../engine/xp"; import { useLiveQuery } from "dexie-react-hooks"; import { Link } from "react-router"; export const a = [s, i, Cefr, xp, useLiveQuery, Link];',
  ],
  ["src/ui/X.test.tsx", "export const E = () => <p>Olá</p>;"],
  ["src/schemas/x.ts", 'import { z } from "zod"; export const a = (n: number) => [z.string(), new Date(n)];'],
  ["src/engine/x.ts", 'import { Cefr } from "../schemas"; export const a = () => import("../schemas/lang").then(() => Cefr);'],
];

describe("lint barra (sondagens)", () => {
  it.each(bad)("%s: %s", async (file, code) => {
    const [r] = await eslint.lintText(code + "\n", { filePath: file });
    expect(r?.messages.length).toBeGreaterThan(0);
  });
});

describe("lint não barra o legítimo (falsos positivos)", () => {
  it.each(good)("%s: %s", async (file, code) => {
    const [r] = await eslint.lintText(code + "\n", { filePath: file });
    expect((r?.messages ?? []).filter((m) => m.ruleId !== "@typescript-eslint/no-unused-vars").map((m) => m.ruleId)).toEqual([]);
  });
});
