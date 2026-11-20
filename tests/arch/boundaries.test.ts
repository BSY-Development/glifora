// Guarda da arquitetura (D-41, W0-03 §2.1): o lint tem de barrar importação entre camadas e os atalhos inseguros.
// Os arquivos abaixo não existem: o ESLint confere o texto como se estivesse naquele caminho.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function rulesFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe("fronteiras entre camadas", () => {
  it("engine/ não importa React nem outra camada", async () => {
    expect(await rulesFor("src/engine/example.ts", 'import { useState } from "react";\nexport const x = useState;\n')).toContain("no-restricted-imports");
    expect(await rulesFor("src/engine/example.ts", 'import { db } from "../data/db";\nexport const x = db;\n')).toContain("no-restricted-imports");
  });

  it("engine/ pode importar schemas/", async () => {
    expect(await rulesFor("src/engine/example.ts", 'import { Cefr } from "../schemas";\nexport const x = Cefr;\n')).toEqual([]);
  });

  it("schemas/ só usa zod", async () => {
    expect(await rulesFor("src/schemas/example.ts", 'import Dexie from "dexie";\nexport const x = Dexie;\n')).toContain("no-restricted-imports");
    expect(await rulesFor("src/schemas/example.ts", 'import { step } from "../engine/step";\nexport const x = step;\n')).toContain("no-restricted-imports");
    expect(await rulesFor("src/schemas/example.ts", 'import { z } from "zod";\nexport const x = z.string();\n')).toEqual([]);
  });

  it("ui/ não toca na key nem nos provedores", async () => {
    expect(await rulesFor("src/ui/example.ts", 'import { withKey } from "../ai/keyVault";\nexport const x = withKey;\n')).toContain("no-restricted-imports");
    expect(await rulesFor("src/ui/example.ts", 'import { openrouter } from "../ai/providers/openrouter";\nexport const x = openrouter;\n')).toContain("no-restricted-imports");
  });

  it("engine/ não lê relógio nem sorteio direto", async () => {
    expect(await rulesFor("src/engine/example.ts", "export const t = Date.now();\n")).toContain("no-restricted-properties");
    expect(await rulesFor("src/engine/example.ts", "export const r = Math.random();\n")).toContain("no-restricted-properties");
  });
});

describe("atalhos inseguros e texto fora do i18n", () => {
  it("barra dangerouslySetInnerHTML e innerHTML", async () => {
    expect(await rulesFor("src/ui/Example.tsx", "export const E = (p: { h: string }) => <div dangerouslySetInnerHTML={{ __html: p.h }} />;\n")).toContain("no-restricted-syntax");
    expect(await rulesFor("src/ui/example.ts", "export function f(el: HTMLElement, h: string) { el.innerHTML = h; }\n")).toContain("no-restricted-syntax");
  });

  it("barra eval e new Function", async () => {
    expect(await rulesFor("src/ui/example.ts", 'export const x = eval("1");\n')).toContain("no-eval");
    expect(await rulesFor("src/ui/example.ts", 'export const f = new Function("return 1");\n')).toContain("no-new-func");
  });

  it("barra texto solto no JSX", async () => {
    expect(await rulesFor("src/ui/Example.tsx", "export const E = () => <p>Olá, vila</p>;\n")).toContain("no-restricted-syntax");
    expect(await rulesFor("src/ui/Example.tsx", 'export const E = () => <p>{"Olá"}</p>;\n')).toContain("no-restricted-syntax");
    expect(await rulesFor("src/ui/Example.tsx", "export const E = (p: { t: string }) => <p>{p.t}</p>;\n")).toEqual([]);
  });
});

// Buracos fechados na revisão da W1-01 (regressão).
describe("buracos fechados (regressão)", () => {
  it("importação dinâmica cruza fronteira", async () => {
    expect(await rulesFor("src/engine/example.ts", 'export const x = () => import("../data/db");\n')).not.toEqual([]);
    expect(await rulesFor("src/ui/example.ts", 'export const x = () => import("../ai/keyVault");\n')).not.toEqual([]);
  });

  it("caminho absoluto ou via src/ cruza fronteira", async () => {
    expect(await rulesFor("src/engine/example.ts", 'import { db } from "/src/data/db";\nexport const x = db;\n')).not.toEqual([]);
    expect(await rulesFor("src/engine/example.ts", 'import { db } from "../../src/data/db";\nexport const x = db;\n')).not.toEqual([]);
    expect(await rulesFor("src/engine/example.ts", 'import { db } from "./../data/db";\nexport const x = db;\n')).not.toEqual([]);
  });

  it("engine/ e schemas/ não leem relógio nem rede por globalThis ou performance", async () => {
    expect(await rulesFor("src/engine/example.ts", "export const x = performance.now();\n")).not.toEqual([]);
    expect(await rulesFor("src/engine/example.ts", "export const x = globalThis.crypto.randomUUID();\n")).not.toEqual([]);
    expect(await rulesFor("src/schemas/example.ts", "export const x = globalThis.fetch;\n")).not.toEqual([]);
  });

  it("atalhos de HTML além de innerHTML", async () => {
    expect(await rulesFor("src/ui/example.ts", 'export function f(e: HTMLElement, h: string) { e["innerHTML"] = h; }\n')).not.toEqual([]);
    expect(await rulesFor("src/ui/example.ts", "export function f(e: HTMLElement, h: string) { e.setHTMLUnsafe(h); }\n")).not.toEqual([]);
    expect(await rulesFor("src/ui/example.ts", "export function f(r: Range, h: string) { return r.createContextualFragment(h); }\n")).not.toEqual([]);
  });

  it("texto de interface em atributo, ternário ou alfabeto não latino", async () => {
    expect(await rulesFor("src/ui/Example.tsx", 'export const E = () => <button aria-label="Fechar" />;\n')).not.toEqual([]);
    expect(await rulesFor("src/ui/Example.tsx", 'export const E = (p: { a: boolean }) => <p>{p.a ? "Sim" : "Não"}</p>;\n')).not.toEqual([]);
    expect(await rulesFor("src/ui/Example.tsx", "export const E = () => <p>こんにちは</p>;\n")).not.toEqual([]);
  });
});
