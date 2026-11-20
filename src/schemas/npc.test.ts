import { describe, expect, it } from "vitest";
import { Npc } from "./npc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function tilda(): Loose {
  return {
    schema: 1,
    id: "tilda",
    name: "Tilda",
    location: "bakery",
    role: "the village baker",
    persona: {
      summary: "Tilda is the village baker: warm, quick, always with flour on her apron.",
      personality: ["Warm and kind.", "Proud of her bread."],
      speaking_style: ["Short, simple sentences.", "Repeats the order back to confirm it."],
      world_details: ["Her old cat, Crumb, sleeps on the flour sacks."],
    },
    voice: { lang: "en-US", rate: 0.9, pitch: 1 },
    lines: {
      en: {
        retry: { text: "Sorry, dear? Can you say that again?", translation: { "pt-BR": "Como, meu bem? Pode repetir?" } },
        contingency: { text: "Oh, the oven is so loud! Can you say that again, dear?" },
      },
    },
  };
}

describe("Npc", () => {
  it("a ficha válida passa", () => {
    expect(Npc.parse(tilda()).lines.en?.retry.text).toContain("again");
  });

  it("recusa campo desconhecido (inclusive a voz Azure antiga)", () => {
    const a = tilda();
    a.extra = 1;
    expect(Npc.safeParse(a).success).toBe(false);
    const b = tilda();
    b.voice.azure = { voice_id: "en-US-JennyNeural" };
    expect(Npc.safeParse(b).success).toBe(false);
  });

  it("recusa NPC, local e versão fora da lista", () => {
    for (const spoil of [(n: Loose) => (n.id = "gandalf"), (n: Loose) => (n.location = "castle"), (n: Loose) => (n.schema = 2)]) {
      const n = tilda();
      spoil(n);
      expect(Npc.safeParse(n).success).toBe(false);
    }
  });

  it("voz: região obrigatória, rate e pitch entre 0,5 e 1,5", () => {
    for (const voice of [{ lang: "en", rate: 1, pitch: 1 }, { lang: "en-US", rate: 2, pitch: 1 }, { lang: "en-US", rate: 1, pitch: 0.2 }]) {
      const n = tilda();
      n.voice = voice;
      expect(Npc.safeParse(n).success, JSON.stringify(voice)).toBe(false);
    }
  });

  it("precisa das falas de pelo menos um idioma-alvo, com retry e contingency", () => {
    const none = tilda();
    none.lines = {};
    expect(Npc.safeParse(none).success).toBe(false);
    const noRetry = tilda();
    delete noRetry.lines.en.retry;
    expect(Npc.safeParse(noRetry).success).toBe(false);
    const badLang = tilda();
    badLang.lines.fr = badLang.lines.en;
    expect(Npc.safeParse(badLang).success).toBe(false);
  });

  it("limites de tamanho", () => {
    const n = tilda();
    n.persona.summary = "x".repeat(601);
    expect(Npc.safeParse(n).success).toBe(false);
    const m = tilda();
    m.persona.personality = Array.from({ length: 9 }, () => "x");
    expect(Npc.safeParse(m).success).toBe(false);
  });
});
