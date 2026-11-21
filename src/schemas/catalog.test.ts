import { describe, expect, it } from "vitest";
import { CatalogIndex, parseVoiceEvalSet } from "./catalog";

const entry = {
  id: "bakery-01",
  base: "pt-BR",
  target: "en",
  level: "A1",
  kind: "encounter",
  title: "Pão quentinho",
  location: "bakery",
  can_do: "Consigo pedir comida e dizer quantos quero.",
  file: "missions/pt-BR_en/A1/bakery-01.json",
};

describe("CatalogIndex", () => {
  it("aceita o índice e recusa campo desconhecido", () => {
    expect(CatalogIndex.safeParse({ schema: 1, missions: [entry] }).success).toBe(true);
    expect(CatalogIndex.safeParse({ schema: 1, missions: [{ ...entry, unit: "a1-01" }] }).success).toBe(false);
  });

  it.each(["../secret.json", "/content/missions/pt-BR_en/A1/bakery-01.json", "missions/pt-BR_en/A3/x.json", "missions/pt-BR_en/A1/Bakery.json", "missions/pt-BR_en/A1/x.js"])(
    "recusa o caminho %s",
    (file) => expect(CatalogIndex.safeParse({ schema: 1, missions: [{ ...entry, file }] }).success).toBe(false),
  );
});

describe("parseVoiceEvalSet", () => {
  const phrase = { id: "bakery-01-order-honey", text: "A honey roll, please.", expect: { mission: "bakery-01", node: "order", reply: 0 } };
  const set = { schema: 1, base: "pt-BR", target: "en", phrases: [phrase] };

  it("aceita o conjunto", () => {
    const res = parseVoiceEvalSet(set);
    expect(res.ok && res.set.phrases[0]!.expect.reply).toBe(0);
  });

  it("D-57: a frase pode apontar até a 6ª resposta (índice 5), como o pão da bakery-01", () => {
    const res = parseVoiceEvalSet({ ...set, phrases: [{ ...phrase, expect: { ...phrase.expect, reply: 5 } }] });
    expect(res.ok && res.set.phrases[0]!.expect.reply).toBe(5);
  });

  it("recusa frase repetida, resposta fora de 0–5 (D-57), campo desconhecido, base igual ao alvo", () => {
    const cases: [unknown, string][] = [
      [{ ...set, phrases: [phrase, phrase] }, "phrases[1].id"],
      [{ ...set, phrases: [{ ...phrase, expect: { ...phrase.expect, reply: 6 } }] }, "phrases[0].expect.reply"],
      [{ ...set, phrases: [{ ...phrase, audio: "x.mp3" }] }, "phrases[0]"],
      [{ ...set, target: "pt-BR" }, "target"],
    ];
    for (const [input, path] of cases) {
      const res = parseVoiceEvalSet(input);
      expect(res.ok, path).toBe(false);
      if (!res.ok) expect(res.issues.map((i) => i.path), path).toContain(path);
    }
  });
});
