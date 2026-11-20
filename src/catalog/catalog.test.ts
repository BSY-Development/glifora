import { describe, expect, it } from "vitest";
import { createMissionCatalog, loadVoicePhrasesFrom, type CatalogEntry } from "./index";

/** Missão embutida mínima e válida (fixture; as de verdade chegam pelo build-index da W2-04). */
const mission = (id: string, location: "bakery" | "tavern" = "bakery") => ({
  schema: 1,
  id,
  base: "pt-BR",
  target: "en",
  level: "A1",
  kind: "encounter",
  title: "Pão quentinho",
  theme: "Comprar pão na padaria",
  location,
  can_do: "Consigo pedir comida.",
  description: "De manhã cedo, na padaria da Tilda.",
  characters: [{ id: "tilda", name: "Tilda", personality: "calorosa", npc: "tilda" }],
  listen: [
    { speaker: "tilda", text: "Two rolls. Here you go!", translation: "Dois pãezinhos. Aqui está!" },
    { speaker: "tilda", text: "Anything else?", translation: "Mais alguma coisa?" },
  ],
  nodes: [
    {
      id: "order",
      speaker: "tilda",
      text: "Good morning! What would you like?",
      translation: "Bom dia! O que vai querer?",
      replies: [{ text: "A honey roll, please.", translation: "Um pão de mel, por favor.", keywords: [["honey"]] }],
    },
    {
      id: "how-many",
      speaker: "tilda",
      text: "How many?",
      translation: "Quantos?",
      replies: [{ text: "Just one, please.", translation: "Só um, por favor.", keywords: [["one"]] }],
    },
  ],
  closing: {
    question: { text: "What would you like tomorrow?", translation: "O que vai querer amanhã?" },
    target_words: ["honey", "bread"],
    hint: "Diga algo do cardápio.",
    model_answer: { text: "I'd like honey bread, please.", translation: "Eu queria pão de mel, por favor." },
    success: { text: "Lovely! See you!", translation: "Que bom! Até amanhã!" },
  },
});

const entry = (id: string, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  base: "pt-BR",
  target: "en",
  level: "A1",
  kind: "encounter",
  title: "Pão quentinho",
  location: "bakery",
  can_do: "Consigo pedir comida.",
  file: `missions/pt-BR_en/A1/${id}.json`,
  ...over,
});

function build(entries: unknown[], files: Record<string, unknown> = {}) {
  return createMissionCatalog({
    readIndex: async () => ({ schema: 1, missions: entries }),
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [`/content/${k}`, async () => v])),
  });
}

describe("catalog.list", () => {
  const entries = [entry("bakery-01"), entry("tavern-01", { location: "tavern" }), entry("tavern-02", { location: "tavern", level: "A2" }), entry("padaria-01", { base: "en", target: "pt-BR" })];
  it("filtra por par, nível e local, mantendo a ordem do índice", async () => {
    const catalog = build(entries);
    expect((await catalog.list({ base: "pt-BR", target: "en" })).map((e) => e.id)).toEqual(["bakery-01", "tavern-01", "tavern-02"]);
    expect((await catalog.list({ base: "pt-BR", target: "en", level: "A2" })).map((e) => e.id)).toEqual(["tavern-02"]);
    expect((await catalog.list({ base: "pt-BR", target: "en", location: "tavern" })).map((e) => e.id)).toEqual(["tavern-01", "tavern-02"]);
    expect(await catalog.list({ base: "pt-BR", target: "es" })).toEqual([]);
  });
  it("sem índice, índice quebrado ou com linha inválida: lista vazia, sem exceção", async () => {
    for (const raw of [undefined, null, "x", { schema: 2, missions: [] }, { schema: 1, missions: [{ id: "x" }] }]) {
      expect(await createMissionCatalog({ readIndex: async () => raw, files: {} }).list({ base: "pt-BR", target: "en" })).toEqual([]);
    }
    const broken = createMissionCatalog({ readIndex: async () => Promise.reject(new Error("falhou")), files: {} });
    expect(await broken.list({ base: "pt-BR", target: "en" })).toEqual([]);
  });
});

describe("catalog.load", () => {
  const file = "missions/pt-BR_en/A1/bakery-01.json";
  it("abre e valida a missão pelo caminho do índice", async () => {
    const result = await build([entry("bakery-01")], { [file]: mission("bakery-01") }).load("bakery-01");
    expect(result).toMatchObject({ ok: true, mission: { id: "bakery-01", nodes: [{ id: "order" }, { id: "how-many" }] } });
  });
  it("id fora do índice: unknown; arquivo ausente: missing", async () => {
    const catalog = build([entry("bakery-01")]);
    expect(await catalog.load("nao-existe")).toMatchObject({ ok: false, reason: "unknown" });
    expect(await catalog.load("bakery-01")).toMatchObject({ ok: false, reason: "missing" });
  });
  it("missão que não passa no schema vira resultado com os erros, não exceção", async () => {
    const bad = { ...mission("bakery-01"), nodes: [] };
    const result = await build([entry("bakery-01")], { [file]: bad }).load("bakery-01");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
  it("o id do arquivo precisa bater com o do índice", async () => {
    const result = await build([entry("bakery-01")], { [file]: mission("bakery-02") }).load("bakery-01");
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("arquivo que falha ao abrir vira missing e a segunda abertura vem do cache", async () => {
    let opens = 0;
    const catalog = createMissionCatalog({
      readIndex: async () => ({ schema: 1, missions: [entry("bakery-01")] }),
      files: { [`/content/${file}`]: async () => (opens++, mission("bakery-01")) },
    });
    await catalog.load("bakery-01");
    await catalog.load("bakery-01");
    expect(opens).toBe(1);
    const broken = createMissionCatalog({
      readIndex: async () => ({ schema: 1, missions: [entry("bakery-01")] }),
      files: { [`/content/${file}`]: () => Promise.reject(new Error("rede")) },
    });
    expect(await broken.load("bakery-01")).toMatchObject({ ok: false, reason: "missing" });
  });
});

describe("loadVoicePhrasesFrom (D-48)", () => {
  const pair = { base: "pt-BR", target: "en" } as const;
  const set = { schema: 1, base: "pt-BR", target: "en", phrases: [{ id: "p1", text: "Hello!", expect: { mission: "bakery-01", node: "order", reply: 0 } }] };
  it("lê só content/eval/stt/<par>.json", async () => {
    expect(await loadVoicePhrasesFrom({ "/content/eval/stt/pt-BR_en.json": async () => set }, pair)).toMatchObject({ ok: true, phrases: [{ id: "p1", text: "Hello!" }] });
    expect(await loadVoicePhrasesFrom({ "/content/eval/gold/pt-BR_en.json": async () => set }, pair)).toEqual({ ok: false, reason: "missing" });
  });
  it("arquivo inválido ou que falha ao abrir não derruba a tela", async () => {
    expect(await loadVoicePhrasesFrom({ "/content/eval/stt/pt-BR_en.json": async () => ({ schema: 1, phrases: [] }) }, pair)).toEqual({ ok: false, reason: "invalid" });
    expect(await loadVoicePhrasesFrom({ "/content/eval/stt/pt-BR_en.json": () => Promise.reject(new Error("x")) }, pair)).toEqual({ ok: false, reason: "missing" });
  });
});
