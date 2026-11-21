// Partidas com respostas naturais (certas, com erro previsto e ambíguas) nas missões da fase 2.
// Protege as keywords: se uma mudança fizer uma fala cair na resposta errada, o teste mostra qual.
// null = não casa (a NPC pede para repetir). No fecho, 1 = aceita e 0 = recusa.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkClosingAnswer, closingModel, closingModels, closingTargets, matchReply, naturalWay, parseMission, type Mission } from "../../src/schemas/index.ts";
import { readContentDir } from "./lib.ts";

const contentDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content");
const { files } = readContentDir(contentDir);

function mission(id: string): Mission {
  const f = files.find((x) => x.path.endsWith(`/${id}.json`));
  if (!f) throw new Error(`missão ${id} não encontrada`);
  const res = parseMission(f.json);
  if (!res.ok) throw new Error(JSON.stringify(res.issues));
  return res.mission;
}

const TRIES: Record<string, Record<string, [string, number | null][]>> = {
  "bakery-01": {
    "order": [
      [
        "Can I have a honey roll, please?",
        0
      ],
      [
        "honey",
        0
      ],
      [
        "A cheese roll, please",
        1
      ],
      [
        "a roll of honey",
        2
      ],
      [
        "I roll of honey",
        2
      ],
      [
        "bread",
        3
      ],
      [
        "Bread, please",
        3
      ],
      [
        "Can I have some bread?",
        3
      ],
      [
        "A loaf of bread, please",
        3
      ],
      [
        "Two loaves, please",
        3
      ],
      [
        "two breads",
        3
      ],
      [
        "An apple pie, please",
        4
      ],
      [
        "pie",
        4
      ],
      [
        "Can I have a pie?",
        4
      ],
      [
        "Two apple pies",
        4
      ],
      [
        "bread and an apple pie",
        null
      ],
      [
        "cheese, please, and a honey roll",
        null
      ],
      [
        "sorry?",
        null
      ]
    ],
    "how-many": [
      [
        "Just one, please",
        0
      ],
      [
        "One loaf",
        0
      ],
      [
        "Two, please",
        1
      ],
      [
        "Two loaves",
        1
      ],
      [
        "two roll",
        2
      ]
    ],
    "anything-else": [
      [
        "Yes, a loaf of bread, please",
        0
      ],
      [
        "bread",
        0
      ],
      [
        "No, that's all, thanks",
        1
      ],
      [
        "Nothing",
        1
      ],
      [
        "two breads",
        2
      ],
      [
        "An apple pie, too",
        3
      ],
      [
        "No, an apple pie",
        3
      ],
      [
        "pie",
        3
      ],
      [
        "And a honey roll",
        4
      ],
      [
        "A cheese roll, too",
        5
      ],
      [
        "cheese",
        5
      ]
    ],
    "pay": [
      [
        "Here you go",
        0
      ],
      [
        "Thank you so much",
        1
      ],
      [
        "Thanks you",
        2
      ]
    ]
  },
  "bakery-02": {
    "usual": [
      [
        "Yes please",
        0
      ],
      [
        "Yeah, two honey rolls",
        0
      ],
      [
        "Can I have a cheese roll?",
        1
      ],
      [
        "two honey roll please",
        2
      ],
      [
        "No, a cheese roll today",
        1
      ],
      [
        "Not today. A loaf of bread, please",
        3
      ],
      [
        "Can I have some bread?",
        3
      ],
      [
        "Yes, a loaf of bread",
        3
      ],
      [
        "An apple pie today",
        4
      ],
      [
        "pie",
        4
      ]
    ],
    "name": [
      [
        "I'm Maria",
        0
      ],
      [
        "Im João",
        0
      ],
      [
        "My name's Ana",
        1
      ],
      [
        "My name is Pedro, nice to meet you",
        1
      ],
      [
        "Lucas",
        0
      ],
      [
        "Call me Bia",
        1
      ],
      [
        "Maria",
        0
      ],
      [
        "Ana Clara",
        0
      ],
      [
        "Maria Clara da Silva",
        null
      ]
    ],
    "from": [
      [
        "I'm from Brazil",
        0
      ],
      [
        "I'm from Portugal",
        0
      ],
      [
        "From Brazil",
        0
      ],
      [
        "I'm Brazilian",
        1
      ],
      [
        "I from Brazil",
        2
      ],
      [
        "I from Recife",
        0
      ]
    ],
    "like": [
      [
        "Yes, I like it",
        0
      ],
      [
        "I love it",
        0
      ],
      [
        "It's very nice here",
        1
      ],
      [
        "Yes, is very beautiful",
        2
      ],
      [
        "Yes, it's very beautiful",
        0
      ],
      [
        "Yes, is nice",
        1
      ],
      [
        "It's very beautiful",
        1
      ],
      [
        "Yes, is cold",
        0
      ]
    ],
    "bye": [
      [
        "See you tomorrow!",
        0
      ],
      [
        "Bye!",
        1
      ],
      [
        "Thanks, bye",
        1
      ],
      [
        "Thank you, see you tomorrow",
        0
      ]
    ],
    "closing": [
      [
        "Hi Rosa, I'm Ana",
        1
      ],
      [
        "Nice to meet you!",
        1
      ],
      [
        "I'm from Brazil",
        1
      ],
      [
        "Hello!",
        0
      ],
      [
        "Bye",
        0
      ],
      [
        "Hi Rosa, I'm Ana from Brazil",
        1
      ]
    ]
  },
  "tavern-01": {
    "greet": [
      [
        "Good evening",
        0
      ],
      [
        "Hi Bram",
        0
      ],
      [
        "Good night!",
        2
      ],
      [
        "It's so cozy",
        1
      ],
      [
        "Hello, good evening",
        0
      ],
      [
        "Good morning!",
        2
      ],
      [
        "Good afternoon",
        2
      ]
    ],
    "from": [
      [
        "I'm from Brazil",
        0
      ],
      [
        "I from Brazil",
        2
      ],
      [
        "I'm Brazilian",
        0
      ],
      [
        "I'm staying here for a while",
        1
      ],
      [
        "Brazil",
        0
      ]
    ],
    "drink": [
      [
        "Do you have orange juice?",
        0
      ],
      [
        "A hot chocolate, please",
        1
      ],
      [
        "a orange juice please",
        2
      ],
      [
        "An orange juice, please",
        0
      ],
      [
        "Can I have a juice?",
        0
      ],
      [
        "Do you have tea?",
        3
      ],
      [
        "Can I have tea?",
        3
      ],
      [
        "Do you have milk?",
        5
      ],
      [
        "Water, please",
        4
      ],
      [
        "I want a coffee",
        5
      ],
      [
        "Do you have apple juice?",
        0
      ],
      [
        "A cup of tea, please",
        3
      ],
      [
        "Just water, please",
        4
      ],
      [
        "Some lemonade?",
        5
      ],
      [
        "A hot chocolate with milk",
        1
      ],
      [
        "Orange juice",
        0
      ]
    ],
    "food": [
      [
        "Soup, please",
        0
      ],
      [
        "Do you have bread?",
        1
      ],
      [
        "Has bread?",
        2
      ],
      [
        "Have bread?",
        1
      ],
      [
        "Can I have some bread?",
        1
      ],
      [
        "Do you have any rolls?",
        1
      ],
      [
        "Can I have some pie?",
        3
      ],
      [
        "A piece of apple pie",
        3
      ]
    ],
    "pay": [
      [
        "No, that's all",
        0
      ],
      [
        "That's all, thank you",
        0
      ],
      [
        "A tea too, please",
        1
      ],
      [
        "A hot chocolate, too",
        2
      ],
      [
        "Some bread, too",
        3
      ],
      [
        "And some soup",
        4
      ],
      [
        "A piece of pie",
        5
      ],
      [
        "Nothing, thanks",
        0
      ]
    ],
    "closing": [
      [
        "Can I have a hot chocolate?",
        1
      ],
      [
        "Milk, please",
        1
      ],
      [
        "I'd like some soup",
        1
      ],
      [
        "Coffee",
        0
      ],
      [
        "Good night",
        0
      ]
    ]
  },
  "tavern-02": {
    "room": [
      [
        "Yes, please",
        0
      ],
      [
        "Can I have a room?",
        0
      ],
      [
        "A small one, please",
        1
      ],
      [
        "Do you have a cheap room?",
        1
      ],
      [
        "Something cheap, please",
        1
      ]
    ],
    "name": [
      [
        "I'm Ana",
        0
      ],
      [
        "My name is Carlos",
        0
      ],
      [
        "Call me Bia",
        1
      ],
      [
        "Carlos",
        0
      ],
      [
        "It's Bia",
        0
      ],
      [
        "My full name is Maria Clara",
        0
      ]
    ],
    "nights": [
      [
        "One night",
        0
      ],
      [
        "Two nights",
        1
      ],
      [
        "Three nights, please",
        1
      ],
      [
        "three night",
        2
      ],
      [
        "For a week",
        1
      ],
      [
        "2 nights",
        1
      ],
      [
        "I want to stay one night",
        0
      ],
      [
        "I would like to stay one night",
        0
      ],
      [
        "Too nights, please",
        1
      ]
    ],
    "questions": [
      [
        "How much is it?",
        0
      ],
      [
        "How much does it cost?",
        0
      ],
      [
        "How much cost?",
        2
      ],
      [
        "Is it quiet?",
        1
      ]
    ],
    "breakfast": [
      [
        "What time is breakfast?",
        0
      ],
      [
        "What hour is breakfast?",
        2
      ],
      [
        "I get up early",
        1
      ],
      [
        "Don't worry",
        1
      ]
    ],
    "wake": [
      [
        "Yes, at seven",
        0
      ],
      [
        "At eight o'clock, please",
        0
      ],
      [
        "In seven o'clock",
        2
      ],
      [
        "No thanks, I have an alarm",
        1
      ],
      [
        "No",
        1
      ],
      [
        "Yes, please",
        0
      ],
      [
        "Yes",
        0
      ],
      [
        "No, thanks, at six",
        1
      ],
      [
        "No, I'll get up at six",
        1
      ]
    ],
    "closing": [
      [
        "Pancakes, please!",
        1
      ],
      [
        "Two eggs and a juice",
        1
      ],
      [
        "A honey roll",
        1
      ],
      [
        "Nothing",
        0
      ]
    ]
  },
  "tavern-03": {
    "day": [
      [
        "It was great!",
        0
      ],
      [
        "It was a great day",
        0
      ],
      [
        "Oh, was a great day",
        2
      ],
      [
        "Busy but fun",
        1
      ],
      [
        "Good, thanks",
        0
      ],
      [
        "I'm tired",
        1
      ],
      [
        "Oh, was terrible",
        null
      ],
      [
        "Oh, it was great",
        0
      ],
      [
        "I was tired",
        1
      ],
      [
        "Oh, was great!",
        2
      ]
    ],
    "eat": [
      [
        "I had a honey roll",
        0
      ],
      [
        "I ate some soup",
        0
      ],
      [
        "I eat a honey roll",
        2
      ],
      [
        "Nothing yet",
        1
      ],
      [
        "I'm hungry",
        1
      ]
    ],
    "from": [
      [
        "I'm from Brazil",
        0
      ],
      [
        "I from Brazil",
        2
      ],
      [
        "I'm Brazilian",
        1
      ],
      [
        "It's far from here",
        0
      ]
    ],
    "drink": [
      [
        "A hot chocolate, please",
        0
      ],
      [
        "Do you have milk?",
        1
      ],
      [
        "Juice, please",
        3
      ],
      [
        "A cup of tea",
        2
      ],
      [
        "Tea, please",
        2
      ],
      [
        "An orange juice, please",
        3
      ],
      [
        "Just water",
        4
      ],
      [
        "Some soup, please",
        5
      ],
      [
        "Hot chocolate with milk",
        0
      ]
    ],
    "bread": [
      [
        "Yes please",
        0
      ],
      [
        "I love your bread",
        0
      ],
      [
        "Yes, two breads",
        2
      ],
      [
        "No thanks, I'm full",
        1
      ],
      [
        "Two pieces of bread, please",
        0
      ]
    ],
    "favorite": [
      [
        "The bakery",
        0
      ],
      [
        "I liked the tavern",
        1
      ],
      [
        "Everything!",
        2
      ],
      [
        "The hot chocolate",
        1
      ],
      [
        "The people",
        2
      ]
    ],
    "night": [
      [
        "What time is breakfast?",
        0
      ],
      [
        "What hour is breakfast?",
        2
      ],
      [
        "No, good night!",
        1
      ]
    ],
    "closing": [
      [
        "I had a honey roll and I liked the village",
        1
      ],
      [
        "It was fun",
        1
      ],
      [
        "I met Bram",
        1
      ],
      [
        "Good night",
        0
      ]
    ]
  }
};

for (const [id, nodes] of Object.entries(TRIES)) {
  describe(id, () => {
    const m = mission(id);
    for (const [node, list] of Object.entries(nodes)) {
      it.each(list)(`${node}: %j → %s`, (said, want) => {
        if (node === "closing") {
          expect(checkClosingAnswer(closingTargets(m), said, m.target).accepted).toBe(want === 1);
          return;
        }
        const n = m.nodes.find((x) => x.id === node);
        expect(n, node).toBeDefined();
        expect(matchReply(n!.replies, said, m.target)?.index ?? null).toBe(want);
      });
    }
  });
}

// ---------------------------------------------------------------- D-54 nas missões reais

const ALL = ["bakery-01", "bakery-02", "tavern-01", "tavern-02", "tavern-03"];

describe("D-54: a sessão 1 do dono na bakery-01", () => {
  const m = mission("bakery-01");
  const order = m.nodes.find((n) => n.id === "order")!;

  it.each([
    ["I roll of honey", 2], // a fala que o reconhecedor do Chrome devolveu
    ["a roll of honey", 2],
    ["one roll of honey", 2],
    ["can I have one roll of honey", 2],
    ["I role of honey", 2],
    ["a roll a honey please", 2],
    ["honey", 0],
    ["a honey roll", 0],
  ])("order: %j → %i", (said, want) => {
    expect(matchReply(order.replies, said, m.target)?.index).toBe(want);
  });

  it('o recast: "I roll of honey" → "A honey roll", e a Tilda diz a forma certa', () => {
    expect(naturalWay(m, { node: "order", said: "I roll of honey" })).toMatchObject({ kind: "recast", original: "A roll of honey", corrected: "A honey roll" });
    expect(order.replies[2]!.reaction!.text).toContain("A honey roll");
  });

  it('quem disse só "honey" ouve "A honey roll!" na reação e vê o modelo no relatório', () => {
    expect(order.replies[0]!.reaction!.text).toBe("A honey roll! Lovely, those are new today.");
    expect(naturalWay(m, { node: "order", said: "honey" })).toMatchObject({ kind: "model", text: "Can I have a honey roll, please?" });
  });

  it('fecho: "Can I have one roll of honey?" → recast "A honey roll"; sem o erro, o modelo do pãozinho de mel', () => {
    expect(closingModel(m, "Can I have one roll of honey?")).toMatchObject({ kind: "recast", corrected: "A honey roll" });
    expect(closingModel(m, "Can I have one honey roll?")).toMatchObject({ kind: "model", text: "Can I have a honey roll, please?" });
    expect(closingModel(m, "A loaf of bread")).toMatchObject({ kind: "model", text: "I'd like a loaf of bread, please." });
    expect(closingModel(m, "Two cheese rolls")).toMatchObject({ kind: "model", text: "Can I have two cheese rolls, please?" });
  });
});

describe("D-54 nas 5 missões", () => {
  for (const id of ALL) {
    const m = mission(id);
    it(`${id}: dizer o texto de cada resposta boa é natural; o da resposta com erro dá o recast na boca da pessoa`, () => {
      for (const node of m.nodes) {
        node.replies.forEach((r, j) => {
          const way = naturalWay(m, { node: node.id, said: r.text });
          if (r.flawed) expect(way, r.text).toEqual({ kind: "recast", original: r.recast!.original, corrected: r.recast!.learner ?? r.recast!.corrected, node: node.id, reply: j });
          else expect(way, r.text).toEqual({ kind: "natural" });
        });
      }
    });

    it(`${id}: o fecho tem de 2 a 4 modelos, e repetir cada um é natural`, () => {
      const models = closingModels(m);
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models.length).toBeLessThanOrEqual(4);
      for (const model of models) expect(closingModel(m, model.text), model.text).toEqual({ kind: "natural" });
    });
  }

  it("erros que dependem da pergunta (local) não viram recast no fecho; os outros viram, na boca da pessoa", () => {
    expect(closingModel(mission("tavern-03"), "I eat honey rolls every day.")).toMatchObject({ kind: "model" });
    expect(closingModel(mission("tavern-01"), "Good night! Some soup, please.")).toMatchObject({ kind: "model" });
    expect(closingModel(mission("tavern-03"), "I from Brazil and I liked the soup.")).toMatchObject({ kind: "recast", corrected: "I'm from Brazil" });
    expect(closingModel(mission("bakery-02"), "Hi Rosa, I from Brazil.")).toMatchObject({ kind: "recast", corrected: "I'm from Brazil" });
    expect(closingModel(mission("tavern-02"), "How much cost the pancakes?")).toMatchObject({ kind: "recast", corrected: "How much is it" });
  });
});

describe("D-57: o pedido aberto aceita os itens do local, e a reação repete o item", () => {
  const m = mission("bakery-01");
  const order = m.nodes.find((n) => n.id === "order")!;

  it('"bread" no pedido da Tilda casa com o pão inteiro, a Tilda diz "A loaf of bread!" e o relatório mostra o jeito natural', () => {
    const hit = matchReply(order.replies, "bread", m.target);
    expect(hit?.index).toBe(3);
    expect(hit?.pass).toBe("exact");
    expect(order.replies[3]!.reaction!.text).toMatch(/^A loaf of bread!/);
    expect(naturalWay(m, { node: "order", said: "bread" })).toMatchObject({ kind: "model", text: "Can I have a loaf of bread, please?" });
    expect(naturalWay(m, { node: "order", said: "A loaf of bread, please" })).toEqual({ kind: "natural" });
  });

  it("depois de pedir pão ou torta, as falas seguintes não falam de pãezinhos", () => {
    const after = ["how-many", "anything-else", "pay"].map((id) => m.nodes.find((n) => n.id === id)!);
    for (const node of after) {
      expect(node.text, node.id).not.toMatch(/\brolls?\b/i);
      node.replies.filter((r) => !r.flawed && !/roll/i.test(r.text)).forEach((r) => expect(r.reaction?.text ?? "", r.text).not.toMatch(/\brolls?\b/i));
    }
  });

  it.each([
    ["bakery-01", "order"],
    ["bakery-01", "anything-else"],
    ["bakery-02", "usual"],
    ["tavern-01", "drink"],
    ["tavern-01", "food"],
    ["tavern-01", "pay"],
    ["tavern-03", "drink"],
  ])("%s/%s: cada resposta boa com item repete o trecho-chave na reação", (id, nodeId) => {
    const node = mission(id).nodes.find((n) => n.id === nodeId)!;
    for (const r of node.replies.filter((x) => !x.flawed)) {
      expect(r.chunk, r.text).toBeDefined();
      expect(r.reaction!.text.toLowerCase(), r.text).toContain((r.echo ?? r.chunk)!.toLowerCase());
    }
  });
});
