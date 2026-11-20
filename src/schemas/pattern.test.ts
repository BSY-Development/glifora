import { describe, expect, it } from "vitest";
import { PatternCatalog, PatternId } from "./pattern";
import { VocabItem } from "./vocab";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function catalog(): Loose {
  return {
    schema: 1,
    base: "pt-BR",
    target: "en",
    patterns: [
      {
        id: "en.uncountable_noun",
        cefr: "A1",
        title: '"Bread" não tem plural',
        explanation: 'Em inglês, "bread" não vai para o plural. Para contar, use "a loaf of bread" ou "two loaves of bread".',
        example: { wrong: "two breads", right: "two loaves of bread" },
      },
      { id: "other", cefr: "A1", title: "Outro ponto", explanation: "Um ponto que não está no catálogo." },
    ],
  };
}

describe("PatternId", () => {
  it.each(["en.plural_s", "es.ser_estar", "other"])("aceita %s", (id) => expect(PatternId.safeParse(id).success).toBe(true));
  it.each(["plural_s", "EN.plural", "en.plural-s", "en.", "outro"])("recusa %s", (id) => expect(PatternId.safeParse(id).success).toBe(false));
});

describe("PatternCatalog", () => {
  it("o catálogo válido passa", () => {
    expect(PatternCatalog.parse(catalog()).patterns).toHaveLength(2);
  });

  it("recusa padrão repetido, prefixo de outro idioma e falta de \"other\"", () => {
    const dup = catalog();
    dup.patterns.push(dup.patterns[0]);
    expect(PatternCatalog.safeParse(dup).success).toBe(false);
    const prefix = catalog();
    prefix.patterns[0].id = "es.ser_estar";
    expect(PatternCatalog.safeParse(prefix).success).toBe(false);
    const noOther = catalog();
    noOther.patterns.pop();
    expect(PatternCatalog.safeParse(noOther).success).toBe(false);
  });

  it("recusa campo desconhecido, base igual ao alvo e explicação longa", () => {
    const extra = catalog();
    extra.patterns[0].feedback = "x";
    expect(PatternCatalog.safeParse(extra).success).toBe(false);
    const same = catalog();
    same.target = "pt-BR";
    expect(PatternCatalog.safeParse(same).success).toBe(false);
    const long = catalog();
    long.patterns[0].explanation = "x".repeat(401);
    expect(PatternCatalog.safeParse(long).success).toBe(false);
  });
});

describe("VocabItem", () => {
  const item = { term: "a loaf of bread", translation: "um pão inteiro", example: "A loaf of bread, please." };
  it("aceita o item e recusa campo desconhecido ou texto longo", () => {
    expect(VocabItem.safeParse(item).success).toBe(true);
    expect(VocabItem.safeParse({ ...item, audio: "x.mp3" }).success).toBe(false);
    expect(VocabItem.safeParse({ ...item, term: "x".repeat(61) }).success).toBe(false);
    expect(VocabItem.safeParse({ ...item, example: "" }).success).toBe(false);
  });
});
