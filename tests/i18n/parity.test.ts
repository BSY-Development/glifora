// Paridade do i18n (D-37 e W0-03 §7): todo idioma tem as mesmas chaves e os mesmos marcadores {nome}.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "i18n");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const langs = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>]));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  it("tem pt-BR e en", () => {
    expect(files).toEqual(expect.arrayContaining(["pt-BR.json", "en.json"]));
  });

  it("todos os idiomas têm exatamente as mesmas chaves", () => {
    const base = Object.keys(langs["pt-BR.json"] ?? {}).sort();
    for (const [file, strings] of Object.entries(langs)) expect(Object.keys(strings).sort(), file).toEqual(base);
  });

  it("valores são texto não vazio e sem HTML", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        expect(typeof value, `${file}:${key}`).toBe("string");
        expect((value as string).trim(), `${file}:${key}`).not.toBe("");
        expect(value as string, `${file}:${key}`).not.toMatch(/<[a-z/!]/i);
      }
    }
  });

  it("marcadores {nome} iguais entre idiomas", () => {
    const base = langs["pt-BR.json"] ?? {};
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        expect(placeholders(String(value)), `${file}:${key}`).toEqual(placeholders(String(base[key] ?? "")));
      }
    }
  });
});
