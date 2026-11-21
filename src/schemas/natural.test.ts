// O jeito natural de cada fala e do fecho (D-54), com uma padaria resumida no formato das missões embutidas.
import { describe, expect, it } from "vitest";
import { parseMission } from "./mission.check";
import { Mission as MissionSchema, type Mission, type MissionInput } from "./mission";
import { closestModel, closingModel, closingModels, closingRecast, naturalWay } from "./natural";

const input: MissionInput = {
  schema: 1,
  id: "bakery-natural",
  base: "pt-BR",
  target: "en",
  level: "A1",
  title: "Pão quentinho",
  theme: "Comprar pão",
  location: "bakery",
  can_do: "Consigo pedir comida.",
  description: "Na padaria da Tilda.",
  characters: [{ id: "tilda", name: "Tilda", personality: "calorosa", npc: "tilda" }],
  listen: [
    { speaker: "tilda", text: "Good morning!", translation: "Bom dia!" },
    { speaker: "tilda", text: "Fresh rolls today.", translation: "Pãezinhos frescos hoje." },
  ],
  nodes: [
    {
      id: "order",
      speaker: "tilda",
      text: "What can I get you?",
      translation: "O que vai ser?",
      replies: [
        {
          text: "Can I have a honey roll, please?",
          translation: "Pode me dar um pãozinho de mel?",
          keywords: [["honey"]],
          chunk: "a honey roll",
          reaction: { text: "A honey roll! Lovely, those are new today.", translation: "Um pãozinho de mel! Que bom." },
        },
        {
          text: "I'd like a cheese roll, please.",
          translation: "Eu queria um pãozinho de queijo.",
          keywords: [["cheese"]],
          reaction: { text: "Sure! My favorite.", translation: "Claro! O meu preferido." },
        },
        {
          text: "A roll of honey, please.",
          translation: "Um pãozinho de mel, por favor.",
          flawed: true,
          keywords: [["roll of honey"], ["rolls of honey"]],
          recast: { original: "A roll of honey", corrected: "A honey roll" },
          reaction: { text: "A honey roll? Good choice!", translation: "Um pãozinho de mel? Boa escolha!" },
        },
      ],
    },
    {
      id: "from",
      speaker: "tilda",
      text: "Where are you from?",
      translation: "De onde você é?",
      replies: [
        {
          text: "I'm from Brazil.",
          translation: "Sou do Brasil.",
          keywords: [["i am from"], ["from"], ["brazil"]],
          chunk: "I'm from",
          echo: "you're from",
          reaction: { text: "So you're from far away!", translation: "Então você vem de longe!" },
        },
        {
          text: "I from Brazil.",
          translation: "Sou do Brasil.",
          flawed: true,
          keywords: [["i from brazil"]],
          recast: { original: "I from Brazil", corrected: "you're from Brazil", learner: "I'm from Brazil" },
          reaction: { text: "Oh, you're from Brazil? Welcome!", translation: "Ah, você é do Brasil? Bem-vindo(a)!" },
        },
      ],
    },
    {
      id: "name",
      speaker: "tilda",
      text: "What's your name?",
      translation: "Qual é o seu nome?",
      replies: [
        { text: "I'm Alex.", translation: "Sou o Alex.", keywords: [["i am"]], free: "name", reaction: { text: "Nice to meet you!", translation: "Prazer!" } },
        {
          text: "Good night!",
          translation: "Boa noite!",
          flawed: true,
          keywords: [["good night"]],
          recast: { original: "Good night", corrected: "good evening", local: true },
          reaction: { text: "Ha, good evening! It's not bedtime yet.", translation: "Rá, boa noite! Ainda não é hora de dormir." },
        },
      ],
    },
  ],
  closing: {
    question: { text: "What would you like tomorrow?", translation: "O que você vai querer amanhã?" },
    target_words: ["honey", "cheese", "roll", "bread", "loaf", "pie", "apple"],
    hint: "Diga algo da padaria.",
    model_answer: { text: "Can I have two cheese rolls, please?", translation: "Pode me dar dois pãezinhos de queijo?" },
    models: [
      { text: "Can I have a honey roll, please?", translation: "Pode me dar um pãozinho de mel?" },
      { text: "I'd like a loaf of bread, please.", translation: "Eu queria um pão inteiro." },
      { text: "Can I have an apple pie, please?", translation: "Pode me dar uma torta de maçã?" },
    ],
    success: { text: "See you tomorrow!", translation: "Até amanhã!" },
  },
};

function load(): Mission {
  const res = parseMission(input);
  if (!res.ok) throw new Error(JSON.stringify(res.issues));
  return res.mission;
}
const m = load();

describe("naturalWay: as falas da rodada", () => {
  it.each([
    // resposta boa sem o trecho-chave → o modelo (recast implícito no relatório)
    ["order", "honey", { kind: "model", text: "Can I have a honey roll, please?", translation: "Pode me dar um pãozinho de mel?" }],
    ["order", "me want honey", { kind: "model", text: "Can I have a honey roll, please?" }],
    // resposta boa com o trecho-chave → natural
    ["order", "A honey roll, please", { kind: "natural" }],
    ["order", "can i have a HONEY ROLL", { kind: "natural" }],
    // sem chunk, a fala precisa ter o texto inteiro da resposta
    ["order", "I'd like a cheese roll, please.", { kind: "natural" }],
    ["order", "cheese", { kind: "model", text: "I'd like a cheese roll, please." }],
    // erro previsto → recast, com ruído do reconhecedor em volta
    ["order", "I roll of honey", { kind: "recast", original: "A roll of honey", corrected: "A honey roll", node: "order", reply: 2 }],
    ["order", "can I have one roll of honey", { kind: "recast", corrected: "A honey roll" }],
    // learner: a forma certa na boca da pessoa, não na da NPC
    ["from", "I from Brazil", { kind: "recast", original: "I from Brazil", corrected: "I'm from Brazil" }],
    ["from", "Im from Argentina", { kind: "natural" }],
    ["from", "I from Argentina", { kind: "model", text: "I'm from Brazil." }],
    // resposta livre (nome): nada a corrigir
    ["name", "Maria", { kind: "natural" }],
  ] as const)("%s: %j", (node, said, want) => {
    expect(naturalWay(m, { node, said })).toMatchObject(want);
  });

  it("o índice da resposta casada vale mais que a fala", () => {
    expect(naturalWay(m, { node: "order", reply: 2, said: "honey" })).toMatchObject({ kind: "recast", corrected: "A honey roll" });
    expect(naturalWay(m, { node: "order", reply: 0, said: "honey" })).toMatchObject({ kind: "model" });
  });

  it("tocar na resposta (sem fala) é natural; tocar na resposta com erro mostra o recast", () => {
    expect(naturalWay(m, { node: "order", reply: 0 })).toEqual({ kind: "natural" });
    expect(naturalWay(m, { node: "order", reply: 0, said: "  " })).toEqual({ kind: "natural" });
    expect(naturalWay(m, { node: "order", reply: 2 })).toMatchObject({ kind: "recast" });
  });

  it("fala que não existe → null; fala que não casa ou índice inválido → modelo da primeira resposta boa", () => {
    expect(naturalWay(m, { node: "nowhere", said: "honey" })).toBeNull();
    expect(naturalWay(m, { node: "order", said: "xyz" })).toMatchObject({ kind: "model", text: "Can I have a honey roll, please?" });
    for (const reply of [-1, 9, 1.5, Number.NaN]) {
      expect(naturalWay(m, { node: "order", reply, said: "" })).toMatchObject({ kind: "model", text: "Can I have a honey roll, please?" });
    }
    // Na fala do nome, a primeira boa que não é livre não existe: vale a livre.
    expect(naturalWay(m, { node: "name", said: "Sorry, what?" })).toMatchObject({ kind: "model", text: "I'm Alex." });
  });

  it('nome de propriedade do Object.prototype como fala ou como nó não quebra (F-W2-13-01)', () => {
    for (const s of ["constructor", "__proto__", "toString"]) {
      expect(naturalWay(m, { node: s, said: s })).toBeNull();
      expect(naturalWay(m, { node: "order", said: s })).toMatchObject({ kind: "model" });
    }
  });
});

describe("closingModel: o fecho com o modelo mais próximo e os erros previstos", () => {
  it.each([
    // a fala real do dono: erro previsto da missão, com o recast
    ["Can I have one roll of honey?", { kind: "recast", original: "A roll of honey", corrected: "A honey roll", node: "order", reply: 2 }],
    ["I from Brazil and I want bread", { kind: "recast", corrected: "I'm from Brazil" }],
    // modelo mais próximo pelas palavras-alvo em comum
    ["Can I have one honey roll?", { kind: "model", text: "Can I have a honey roll, please?" }],
    ["Bread, please", { kind: "model", text: "I'd like a loaf of bread, please." }],
    ["apple", { kind: "model", text: "Can I have an apple pie, please?" }],
    ["cheese", { kind: "model", text: "Can I have two cheese rolls, please?" }],
    // "rolls" casa "roll" por tolerância; empate entre modelos fica com o que vem antes (o padrão)
    ["rolls", { kind: "model", text: "Can I have two cheese rolls, please?" }],
    // nada em comum → o padrão
    ["I don't know", { kind: "model", text: "Can I have two cheese rolls, please?" }],
    ["", { kind: "model", text: "Can I have two cheese rolls, please?" }],
    // a pessoa repetiu um modelo → natural
    ["Can I have a honey roll, please?", { kind: "natural" }],
    ["can i have an apple pie please", { kind: "natural" }],
    // erro marcado como local (só vale naquela fala) não entra no fecho
    ["Good night! A honey roll, please.", { kind: "model", text: "Can I have a honey roll, please?" }],
  ] as const)("%j", (said, want) => {
    expect(closingModel(m, said)).toMatchObject(want);
  });

  it("closingRecast: o erro de mais palavras vence; empate fica com o que vem antes na missão", () => {
    expect(closingRecast(m, "a roll of honey")).toMatchObject({ node: "order", reply: 2 });
    expect(closingRecast(m, "I from Brazil, a roll of honey")).toMatchObject({ node: "order", reply: 2 }); // 3 × 3 palavras
    expect(closingRecast(m, "a honey roll")).toBeNull();
    expect(closingRecast(m, "")).toBeNull();
  });

  it("closingRecast ignora resposta com erro sem keywords (fábrica): as palavras de conteúdo dariam recast falso", () => {
    const loose = structuredClone(input) as unknown as { nodes: { replies: { keywords?: unknown }[] }[] };
    delete loose.nodes[0]!.replies[2]!.keywords;
    // Só o Zod: o parseMission já recusa essa missão (o texto da boa casaria com a com erro).
    const generated = MissionSchema.parse(loose);
    expect(closingRecast(generated, "a honey roll, please")).toBeNull();
    expect(closingRecast(generated, "a roll of honey, please")).toBeNull();
  });

  it("closestModel e closingModels: o padrão primeiro; sem models, só o model_answer", () => {
    expect(closingModels(m).map((l) => l.text)[0]).toBe("Can I have two cheese rolls, please?");
    expect(closingModels(m)).toHaveLength(4);
    const res = parseMission({ ...input, closing: { ...input.closing, models: undefined } });
    if (!res.ok) throw new Error(JSON.stringify(res.issues));
    expect(closingModels(res.mission)).toHaveLength(1);
    expect(closestModel(res.mission, "honey").text).toBe("Can I have two cheese rolls, please?");
  });
});
