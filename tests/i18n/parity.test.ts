// Guardas de i18n (W1-06; D-37 e W0-03 §7): mesmas chaves, mesmos marcadores, nenhum valor vazio, plural completo.
// Apagar uma chave de um idioma derruba este teste (e o typecheck do src/i18n).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Plural = Record<string, unknown>;
type Value = string | Plural;

const dir = join(process.cwd(), "i18n");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const langs = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, Value>]));
const base = langs["pt-BR.json"] ?? {};
const CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

const isPlural = (v: unknown): v is Plural => typeof v === "object" && v !== null && !Array.isArray(v);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
/** Todas as strings de um valor (texto simples ou cada forma do plural). */
const texts = (v: Value): string[] => (typeof v === "string" ? [v] : Object.values(v).map(String));

describe("i18n: arquivos e chaves", () => {
  it("tem pt-BR e en", () => {
    expect(files).toEqual(expect.arrayContaining(["pt-BR.json", "en.json"]));
  });

  it("todos os idiomas têm exatamente as mesmas chaves", () => {
    const keys = Object.keys(base).sort();
    for (const [file, strings] of Object.entries(langs)) expect(Object.keys(strings).sort(), file).toEqual(keys);
  });

  it("chaves no formato area.nome (minúsculas; hífen permitido; maiúscula só em códigos de idioma)", () => {
    for (const key of Object.keys(base)) expect(key, key).toMatch(/^[a-z][a-z0-9_]*(\.[a-zA-Z0-9_-]+)+$/);
  });
});

describe("i18n: valores", () => {
  it("nenhum valor vazio ou só espaço, nem forma de plural vazia", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        for (const text of texts(value)) {
          expect(typeof text, `${file}:${key}`).toBe("string");
          expect(text.trim(), `${file}:${key}`).not.toBe("");
        }
      }
    }
  });

  it("nenhum HTML nas traduções (a interface renderiza só texto)", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        for (const text of texts(value)) expect(text, `${file}:${key}`).not.toMatch(/<[a-z/!]|&[a-z#0-9]+;|javascript:/i);
      }
    }
  });

  it("texto não copiado entre idiomas (fora o que é igual por natureza)", () => {
    const SAME_OK = new Set(["app.name", "lang.name.en", "lang.name.pt-BR"]);
    for (const key of Object.keys(base)) {
      if (SAME_OK.has(key)) continue;
      expect(JSON.stringify(langs["en.json"]?.[key]), `${key} igual nos dois idiomas (esqueceu de traduzir?)`).not.toBe(JSON.stringify(base[key]));
    }
  });
});

describe("i18n: marcadores {nome}", () => {
  it("os mesmos marcadores por chave em todos os idiomas", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        const expected = new Set(texts(base[key] ?? "").flatMap(placeholders));
        for (const text of texts(value)) expect(new Set(placeholders(text)), `${file}:${key}`).toEqual(expected);
      }
    }
  });

  it("nome de marcador sem nomes herdados de Object (constructor, __proto__...)", () => {
    const BAD = /^(constructor|prototype|__proto__|toString|valueOf|hasOwnProperty)$/;
    for (const [file, strings] of Object.entries(langs)) {
      for (const [key, value] of Object.entries(strings)) {
        for (const text of texts(value)) for (const name of placeholders(text)) expect(name, `${file}:${key}`).not.toMatch(BAD);
      }
    }
  });
});

describe("i18n: plural", () => {
  const pluralKeys = Object.keys(base).filter((k) => isPlural(base[k]));

  it("se a chave é plural num idioma, é plural em todos (e vice-versa)", () => {
    for (const [file, strings] of Object.entries(langs)) for (const key of Object.keys(base)) expect(isPlural(strings[key]), `${file}:${key}`).toBe(isPlural(base[key]));
  });

  it("só categorias do Intl.PluralRules, com 'other' obrigatório", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const key of pluralKeys) {
        const forms = strings[key] as Plural;
        for (const category of Object.keys(forms)) expect(CATEGORIES.has(category), `${file}:${key}:${category}`).toBe(true);
        expect(typeof forms["other"], `${file}:${key}: falta 'other'`).toBe("string");
      }
    }
  });

  it("plural com 'one' e 'other' (W0-03 §7)", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const key of pluralKeys) for (const c of ["one", "other"]) expect(typeof (strings[key] as Plural)[c], `${file}:${key}: falta '${c}'`).toBe("string");
    }
  });

  it("toda forma de plural usa {n} (é ele que escolhe a forma)", () => {
    for (const [file, strings] of Object.entries(langs)) {
      for (const key of pluralKeys) for (const text of texts(strings[key] as Plural)) expect(placeholders(text), `${file}:${key}`).toContain("n");
    }
  });
});
