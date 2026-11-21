import { describe, expect, it } from "vitest";
import { Mission, type MissionInput } from "./mission";
import { checkMission, formatPath, parseMission, type MissionIssue } from "./mission.check";

/** Missão embutida válida, no formato da SPEC (padaria resumida). Cada teste estraga uma cópia. */
function valid(): MissionInput {
  return {
    schema: 1,
    id: "bakery-test",
    base: "pt-BR",
    target: "en",
    level: "A1",
    kind: "encounter",
    title: "Pão quentinho",
    theme: "Comprar pão na padaria",
    location: "bakery",
    can_do: "Consigo pedir comida e dizer quantos quero.",
    description: "De manhã cedo, na padaria da Tilda. O pão acabou de sair do forno.",
    characters: [
      { id: "tilda", name: "Tilda", personality: "calorosa, rápida", npc: "tilda" },
      { id: "ben", name: "Ben", personality: "freguês apressado" },
    ],
    listen: [
      { speaker: "ben", text: "Can I have two rolls, please?", translation: "Pode me dar dois pãezinhos, por favor?" },
      { speaker: "tilda", text: "Two rolls. Here you go!", translation: "Dois pãezinhos. Aqui está!" },
    ],
    nodes: [
      {
        id: "order",
        speaker: "tilda",
        emotion: "happy",
        text: "Good morning! Fresh bread today. What would you like?",
        translation: "Bom dia! Pão fresquinho hoje. O que você vai querer?",
        replies: [
          {
            text: "A honey roll, please.",
            translation: "Um pão de mel, por favor.",
            keywords: [["honey"]],
            reaction: { text: "Lovely! My new honey rolls.", translation: "Que bom! Meus pães de mel novos." },
          },
          {
            text: "I want two breads.",
            translation: "Quero dois pães.",
            flawed: true,
            keywords: [["breads"]],
            recast: { original: "two breads", corrected: "Two loaves of bread" },
            reaction: { text: "Two loaves of bread? Sure!", translation: "Dois pães? Claro!" },
            pattern: "en.uncountable_noun",
          },
        ],
      },
      {
        id: "how-many",
        speaker: "tilda",
        text: "How many?",
        translation: "Quantos?",
        replies: [
          { text: "Just one, please.", translation: "Só um, por favor.", keywords: [["one"]] },
          { text: "Two, please.", translation: "Dois, por favor.", keywords: [["two"], ["to"], ["too"]] },
        ],
      },
    ],
    closing: {
      question: { text: "Oh, one more thing, dear! What would you like tomorrow?", translation: "Ah, mais uma coisa! O que você vai querer amanhã?" },
      target_words: ["honey", "cheese", "roll", "bread", "loaf", "pie"],
      hint: 'Diga algo do cardápio, por exemplo com "I\'d like...".',
      model_answer: { text: "I'd like two cheese rolls, please.", translation: "Eu queria dois pães de queijo, por favor." },
      success: { text: "Lovely! See you tomorrow, dear!", translation: "Que bom! Até amanhã!" },
    },
    vocabulary: [{ term: "a loaf of bread", translation: "um pão inteiro", example: "A loaf of bread, please." }],
  };
}

/** Atalho para mexer no JSON cru sem brigar com os tipos. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const loose = (m: MissionInput): Loose => m;

function issuesOf(input: unknown, options?: Parameters<typeof parseMission>[1]): readonly MissionIssue[] {
  const res = parseMission(input, options);
  return res.ok ? [] : res.issues;
}
const hasIssue = (issues: readonly MissionIssue[], path: string, piece = "") =>
  issues.some((i) => i.path === path && i.message.includes(piece));

describe("Mission (Zod)", () => {
  it("a missão do exemplo é válida e ganha os valores padrão", () => {
    const res = parseMission(valid());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.mission.nodes[1]!.emotion).toBe("neutral");
    expect(res.mission.nodes[1]!.replies[0]!.flawed).toBe(false);
    const minimal = valid();
    delete minimal.kind;
    expect(Mission.parse(minimal).kind).toBe("encounter");
  });

  it("recusa campo desconhecido em qualquer nível", () => {
    const top = loose(valid());
    top.extra = 1;
    expect(hasIssue(issuesOf(top), "", "")).toBe(true);
    const deep = loose(valid());
    deep.nodes[0].replies[0].reaction.html = "<b>x</b>";
    expect(issuesOf(deep).some((i) => i.path === "nodes[0].replies[0].reaction")).toBe(true);
    const closing = loose(valid());
    closing.closing.accept = { all_of: [["roll"]], min_words: 2 }; // formato antigo (D-43 trocou por target_words)
    expect(issuesOf(closing).some((i) => i.path === "closing")).toBe(true);
  });

  it("recusa versão de schema, idioma, nível, tipo, local, NPC e emoção fora da lista", () => {
    const cases: [string, (m: Loose) => void][] = [
      ["schema", (m) => (m.schema = 2)],
      ["target", (m) => (m.target = "fr")],
      ["level", (m) => (m.level = "A3")],
      ["kind", (m) => (m.kind = "tutorial")],
      ["location", (m) => (m.location = "castle")],
      ["characters[0].npc", (m) => (m.characters[0].npc = "gandalf")],
      ["nodes[0].emotion", (m) => (m.nodes[0].emotion = "angry")],
    ];
    for (const [path, spoil] of cases) {
      const m = loose(valid());
      spoil(m);
      expect(issuesOf(m).map((i) => i.path), path).toContain(path);
    }
  });

  it("recusa base igual ao alvo", () => {
    const m = loose(valid());
    m.target = "pt-BR";
    expect(hasIssue(issuesOf(m), "target", "diferentes")).toBe(true);
  });

  it("aplica os limites de tamanho", () => {
    const cases: [string, (m: Loose) => void][] = [
      ["title", (m) => (m.title = "x".repeat(81))],
      ["theme", (m) => (m.theme = "x".repeat(121))],
      ["can_do", (m) => (m.can_do = "x".repeat(161))],
      ["description", (m) => (m.description = "x".repeat(301))],
      ["nodes[0].text", (m) => (m.nodes[0].text = "x".repeat(301))],
      ["nodes[0].replies[1].recast.original", (m) => (m.nodes[0].replies[1].recast.original = "x".repeat(201))],
      ["nodes[0].replies[0].note", (m) => (m.nodes[0].replies[0].note = "x".repeat(201))],
      ["closing.hint", (m) => (m.closing.hint = "x".repeat(161))],
      ["vocabulary[0].term", (m) => (m.vocabulary[0].term = "x".repeat(61))],
      ["vocabulary[0].translation", (m) => (m.vocabulary[0].translation = "x".repeat(81))],
      ["vocabulary[0].example", (m) => (m.vocabulary[0].example = "x".repeat(161))],
    ];
    for (const [path, spoil] of cases) {
      const m = loose(valid());
      spoil(m);
      expect(issuesOf(m).map((i) => i.path), path).toContain(path);
    }
  });

  it("aplica os limites de quantidade", () => {
    const cases: [string, (m: Loose) => void][] = [
      ["characters", (m) => (m.characters = [])],
      ["characters", (m) => (m.characters = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: "X", personality: "y" })))],
      ["listen", (m) => (m.listen = Array.from({ length: 7 }, () => m.listen[0]))],
      ["nodes", (m) => (m.nodes = [m.nodes[0]])],
      ["nodes", (m) => (m.nodes = Array.from({ length: 21 }, (_, i) => ({ ...m.nodes[1], id: `n${i}` })))],
      ["nodes[0].replies", (m) => (m.nodes[0].replies = [])],
      ["nodes[0].replies", (m) => m.nodes[0].replies.push(m.nodes[1].replies[0], m.nodes[1].replies[1])],
      ["vocabulary", (m) => (m.vocabulary = Array.from({ length: 21 }, () => m.vocabulary[0]))],
    ];
    for (const [path, spoil] of cases) {
      const m = loose(valid());
      spoil(m);
      expect(issuesOf(m).map((i) => i.path), path).toContain(path);
    }
  });

  it("apara espaços nas pontas e recusa texto vazio ou com caractere de controle", () => {
    const m = loose(valid());
    m.title = "  Pão quentinho  ";
    const res = parseMission(m);
    expect(res.ok && res.mission.title).toBe("Pão quentinho");
    for (const bad of ["   ", "linha\nnova", "tab\taqui", "nulo\u0000", "sep\u2028arador"]) {
      const b = loose(valid());
      b.title = bad;
      expect(issuesOf(b).map((i) => i.path), JSON.stringify(bad)).toContain("title");
    }
  });

  it("keyword com caractere de controle é recusada", () => {
    const m = loose(valid());
    m.nodes[0].replies[0].keywords = [["hon\u0000ey"]];
    expect(issuesOf(m).map((i) => i.path)).toContain("nodes[0].replies[0].keywords[0][0]");
  });

  it("resposta com erro precisa de reaction e recast; recast só com flawed; pelo menos uma resposta boa", () => {
    const noReaction = loose(valid());
    delete noReaction.nodes[0].replies[1].reaction;
    expect(hasIssue(issuesOf(noReaction), "nodes[0].replies[1].reaction")).toBe(true);
    const noRecast = loose(valid());
    delete noRecast.nodes[0].replies[1].recast;
    expect(hasIssue(issuesOf(noRecast), "nodes[0].replies[1].recast")).toBe(true);
    const recastOnGood = loose(valid());
    recastOnGood.nodes[0].replies[0].recast = { original: "a", corrected: "b" };
    expect(hasIssue(issuesOf(recastOnGood), "nodes[0].replies[0].recast", "flawed")).toBe(true);
    const allFlawed = loose(valid());
    allFlawed.nodes[0].replies = [allFlawed.nodes[0].replies[1]];
    expect(hasIssue(issuesOf(allFlawed), "nodes[0].replies", "sem erro")).toBe(true);
  });

  it("toda resposta precisa de translation (a ideia no idioma base, 2º degrau de ajuda)", () => {
    const m = loose(valid());
    delete m.nodes[0].replies[1].translation;
    expect(issuesOf(m).map((i) => i.path)).toContain("nodes[0].replies[1].translation");
  });

  it("recusa personagem repetido, id fora do formato, pattern fora do formato", () => {
    const dup = loose(valid());
    dup.characters[1].id = "tilda";
    expect(hasIssue(issuesOf(dup), "characters[1].id", "repetido")).toBe(true);
    const badId = loose(valid());
    badId.id = "Bakery 01";
    expect(issuesOf(badId).map((i) => i.path)).toContain("id");
    const badPattern = loose(valid());
    badPattern.nodes[0].replies[1].pattern = "uncountable noun";
    expect(issuesOf(badPattern).map((i) => i.path)).toContain("nodes[0].replies[1].pattern");
  });

  it("não aceita o que não é objeto", () => {
    for (const bad of [null, undefined, 42, "missão", [], [valid()]]) expect(parseMission(bad).ok).toBe(false);
  });
});

describe("checkMission: as 8 conferências (W0-03 §5.1, D-43)", () => {
  it("1. fala repetida; next inexistente; next para trás ou para a mesma fala", () => {
    const dup = loose(valid());
    dup.nodes[1].id = "order";
    expect(hasIssue(issuesOf(dup), "nodes[1].id", "repetida")).toBe(true);
    const missing = loose(valid());
    missing.nodes[0].replies[0].next = "nowhere";
    expect(hasIssue(issuesOf(missing), "nodes[0].replies[0].next", "não existe")).toBe(true);
    const back = loose(valid());
    back.nodes[1].replies[0].next = "order";
    expect(hasIssue(issuesOf(back), "nodes[1].replies[0].next", "posterior")).toBe(true);
    const self = loose(valid());
    self.nodes[1].replies[0].next = "how-many";
    expect(hasIssue(issuesOf(self), "nodes[1].replies[0].next", "posterior")).toBe(true);
  });

  it("1. next para a frente é aceito (ramificar)", () => {
    const m = loose(valid());
    m.nodes.push({ ...m.nodes[1], id: "extra" });
    m.nodes[0].replies[0].next = "extra";
    expect(issuesOf(m)).toEqual([]);
  });

  it("2. fala que nenhum caminho alcança", () => {
    const m = loose(valid());
    m.nodes.push({ ...m.nodes[1], id: "third" });
    m.nodes[0].replies.forEach((r: Loose) => (r.next = "third")); // todos pulam how-many
    expect(hasIssue(issuesOf(m), "nodes[1]", "não é alcançada")).toBe(true);
  });

  it("3. resposta que não casa com o próprio texto, ou casa com a irmã", () => {
    const none = loose(valid());
    none.nodes[0].replies[0].keywords = [["butter"]];
    expect(hasIssue(issuesOf(none), "nodes[0].replies[0].keywords", "não casa")).toBe(true);
    const sister = loose(valid());
    sister.nodes[1].replies[0].keywords = [["please"]]; // "Two, please." empata entre as boas
    expect(issuesOf(sister).some((i) => i.path.startsWith("nodes[1].replies[") && i.path.endsWith(".keywords"))).toBe(true);
    const flawedLosesToGood = loose(valid());
    flawedLosesToGood.nodes[0].replies[0].keywords = [["two"]];
    flawedLosesToGood.nodes[0].replies[1].keywords = [["two"]]; // empate boa × com erro → a boa; a com erro nunca casa
    expect(hasIssue(issuesOf(flawedLosesToGood), "nodes[0].replies[1].keywords", "casa com a resposta 0")).toBe(true);
  });

  it("3. sem keywords (gerada), o texto casa por 60% das palavras de conteúdo", () => {
    const m = loose(valid());
    m.nodes.forEach((n: Loose) => n.replies.forEach((r: Loose) => delete r.keywords));
    expect(issuesOf(m, { origin: "generated" })).toEqual([]);
  });

  it("4. recast.original fora do texto da resposta; recast.corrected fora da reação", () => {
    const orig = loose(valid());
    orig.nodes[0].replies[1].recast.original = "three breads";
    expect(hasIssue(issuesOf(orig), "nodes[0].replies[1].recast.original", "texto da resposta")).toBe(true);
    const corr = loose(valid());
    corr.nodes[0].replies[1].reaction.text = "Sure! Here you go.";
    expect(hasIssue(issuesOf(corr), "nodes[0].replies[1].recast.corrected", "reação")).toBe(true);
  });

  it("4. a comparação do recast usa a normalização (maiúsculas, pontuação)", () => {
    const m = loose(valid());
    m.nodes[0].replies[1].recast.corrected = "two LOAVES of bread!";
    expect(issuesOf(m)).toEqual([]);
  });

  it("5. resposta-modelo sem nenhuma palavra-alvo; fecho sem palavras-alvo nem vocabulário", () => {
    const model = loose(valid());
    model.closing.model_answer.text = "Good morning!";
    expect(hasIssue(issuesOf(model), "closing.model_answer.text", "palavras-alvo")).toBe(true);
    const empty = loose(valid());
    delete empty.closing.target_words;
    empty.vocabulary = [];
    expect(hasIssue(issuesOf(empty), "closing.target_words")).toBe(true);
  });

  it("5. sem target_words, valem as palavras do vocabulário", () => {
    const m = loose(valid());
    delete m.closing.target_words;
    m.closing.model_answer.text = "A loaf, please.";
    expect(issuesOf(m)).toEqual([]);
    m.closing.model_answer.text = "Some honey, please.";
    expect(hasIssue(issuesOf(m), "closing.model_answer.text")).toBe(true);
  });

  it("6. quem fala na escuta e nas falas existe em characters", () => {
    const listen = loose(valid());
    listen.listen[0].speaker = "ghost";
    expect(hasIssue(issuesOf(listen), "listen[0].speaker", "characters")).toBe(true);
    const node = loose(valid());
    node.nodes[1].speaker = "ghost";
    expect(hasIssue(issuesOf(node), "nodes[1].speaker", "characters")).toBe(true);
  });

  it("7. resposta livre (D-51): aceita uma por fala; recusa duas e recusa com flawed", () => {
    const ok = loose(valid());
    ok.nodes[1].replies[0].free = "name";
    expect(issuesOf(ok)).toEqual([]);
    const two = loose(valid());
    two.nodes[1].replies[0].free = "name";
    two.nodes[1].replies[1].free = "name";
    expect(hasIssue(issuesOf(two), "nodes[1].replies[1].free", "no máximo uma")).toBe(true);
    const flawed = loose(valid());
    flawed.nodes[0].replies[1].free = "name";
    expect(hasIssue(issuesOf(flawed), "nodes[0].replies[1].free", "flawed")).toBe(true);
    const other = loose(valid());
    other.nodes[1].replies[0].free = "anything";
    expect(issuesOf(other).map((i) => i.path)).toContain("nodes[1].replies[0].free");
  });

  describe("8. apelido (D-53): onde o marcador {player} pode aparecer", () => {
    type Put = (m: Loose, v: string) => void;
    // [caminho no JSON, como pôr o texto de teste nesse campo]
    const allowed: [string, Put][] = [
      ["nodes[0].text", (m, v) => (m.nodes[0].text = v)],
      ["nodes[0].replies[0].reaction.text", (m, v) => (m.nodes[0].replies[0].reaction.text = v)],
      ["closing.question.text", (m, v) => (m.closing.question.text = v)],
      ["closing.success.text", (m, v) => (m.closing.success.text = v)],
    ];
    const forbidden: [string, Put][] = [
      ["nodes[0].replies[0].text", (m, v) => (m.nodes[0].replies[0].text = v)],
      ["nodes[0].replies[0].translation", (m, v) => (m.nodes[0].replies[0].translation = v)],
      ["nodes[0].replies[0].keywords[0][0]", (m, v) => (m.nodes[0].replies[0].keywords[0][0] = v)],
      ["nodes[0].replies[1].recast.original", (m, v) => (m.nodes[0].replies[1].recast.original = v)],
      ["nodes[0].replies[1].recast.corrected", (m, v) => (m.nodes[0].replies[1].recast.corrected = v)],
      ["closing.model_answer.text", (m, v) => (m.closing.model_answer.text = v)],
      ["closing.model_answer.translation", (m, v) => (m.closing.model_answer.translation = v)],
      ["closing.hint", (m, v) => (m.closing.hint = v)],
      ["closing.target_words[0]", (m, v) => (m.closing.target_words[0] = v)],
      ["listen[0].text", (m, v) => (m.listen[0].text = v)],
      ["listen[0].translation", (m, v) => (m.listen[0].translation = v)],
      ["title", (m, v) => (m.title = v)],
      ["characters[0].name", (m, v) => (m.characters[0].name = v)],
      ["vocabulary[0].example", (m, v) => (m.vocabulary[0].example = v)],
    ];

    it.each(allowed)("pode em %s (com a tradução também)", (path, put) => {
      const m = loose(valid());
      put(m, "Good morning, {player}!");
      // Põe o mesmo vocativo na tradução da mesma fala.
      const obj = path.startsWith("nodes[0].replies")
        ? m.nodes[0].replies[0].reaction
        : path.startsWith("nodes[0]")
          ? m.nodes[0]
          : m.closing[path.split(".")[1]!];
      obj.translation = "Bom dia, {player}!";
      expect(issuesOf(m)).toEqual([]);
    });

    it.each(allowed)("em %s, a tradução precisa ter o mesmo número de vocativos", (path, put) => {
      const m = loose(valid());
      put(m, "Good morning, {player}!");
      expect(hasIssue(issuesOf(m), path.replace(/text$/, "translation"), "mesmo número")).toBe(true);
    });

    it.each(forbidden)("não pode em %s", (path, put) => {
      const m = loose(valid());
      put(m, "Hi, {player}!");
      expect(hasIssue(issuesOf(m), path, "só pode aparecer nas falas das NPCs")).toBe(true);
    });

    it.each(["Good morning {player}!", "Good morning,{player}!", "Good morning, {Player}!", "Good morning, { player }!", "Good morning, {name}!"])(
      "forma errada é recusada: %j",
      (v) => {
        const m = loose(valid());
        m.nodes[0].text = v;
        expect(hasIssue(issuesOf(m), "nodes[0].text", "vírgula, espaço")).toBe(true);
      },
    );

    it("o vocativo precisa vir depois de algum texto", () => {
      const m = loose(valid());
      m.nodes[0].text = ", {player}! Good morning!";
      m.nodes[0].translation = ", {player}! Bom dia!";
      expect(hasIssue(issuesOf(m), "nodes[0].text", "depois de algum texto")).toBe(true);
    });

    it("4. o recast continua literal na reação com e sem apelido", () => {
      const ok = loose(valid());
      ok.nodes[0].replies[1].reaction = { text: "Two loaves of bread, {player}? Sure!", translation: "Dois pães, {player}? Claro!" };
      expect(issuesOf(ok)).toEqual([]);
      // O vocativo no meio da forma certa: sem apelido ela aparece, com apelido não.
      const split = loose(valid());
      split.nodes[0].replies[1].reaction = { text: "Two loaves, {player}, of bread? Sure!", translation: "Dois pães, {player}? Claro!" };
      split.nodes[0].replies[1].recast.corrected = "two loaves of bread";
      expect(hasIssue(issuesOf(split), "nodes[0].replies[1].recast.corrected", "reação")).toBe(true);
    });
  });

  it("pattern fora do catálogo, quando o catálogo vem junto", () => {
    expect(issuesOf(valid(), { patterns: new Set(["en.uncountable_noun", "other"]) })).toEqual([]);
    expect(hasIssue(issuesOf(valid(), { patterns: new Set(["other"]) }), "nodes[0].replies[1].pattern", "catálogo")).toBe(true);
  });

  it("devolve a lista vazia para a missão válida", () => {
    expect(checkMission(Mission.parse(valid()))).toEqual([]);
  });
});

describe("regras da missão embutida × gerada", () => {
  it("embutida: toda resposta com keywords", () => {
    const m = loose(valid());
    delete m.nodes[1].replies[0].keywords;
    expect(hasIssue(issuesOf(m), "nodes[1].replies[0].keywords", "embutida")).toBe(true);
    expect(issuesOf(m, { origin: "generated" })).toEqual([]);
  });

  it("embutida de A1–A2: pelo menos 2 falas de escuta; B1 e a gerada não exigem", () => {
    const m = loose(valid());
    m.listen = [m.listen[0]];
    expect(hasIssue(issuesOf(m), "listen", "escuta")).toBe(true);
    expect(issuesOf(m, { origin: "generated" })).toEqual([]);
    m.level = "B1";
    expect(issuesOf(m)).toEqual([]);
  });

  it("gerada: o id do app substitui o da IA; embutida não aceita id local", () => {
    const id = "local:0f8fad5b-d9cb-469f-a165-70867728950e";
    const fromAi = loose(valid());
    fromAi.id = "<script>alert(1)</script>";
    const res = parseMission(fromAi, { origin: "generated", id });
    expect(res.ok && res.mission.id).toBe(id);
    expect(hasIssue(issuesOf({ ...valid(), id }), "id", "slug")).toBe(true);
    expect(issuesOf(fromAi, { origin: "generated" }).map((i) => i.path)).toContain("id");
  });
});

describe("formatPath", () => {
  it("monta o caminho como no JSON", () => {
    expect(formatPath(["nodes", 3, "replies", 1, "text"])).toBe("nodes[3].replies[1].text");
    expect(formatPath([])).toBe("");
    expect(formatPath(["closing"])).toBe("closing");
  });
});

describe("D-54: trecho-chave (chunk/echo), recast na boca da pessoa (learner/local) e modelos do fecho", () => {
  const withChunk = () => {
    const m = loose(valid());
    m.nodes[0].replies[0].chunk = "a honey roll";
    m.nodes[0].replies[0].reaction.text = "A honey roll! Lovely, those are new today.";
    return m;
  };

  it("campos novos são opcionais e válidos juntos", () => {
    const m = withChunk();
    m.nodes[0].replies[1].recast.learner = "two loaves of bread";
    m.nodes[0].replies[1].recast.local = true;
    m.closing.models = [{ text: "Can I have a honey roll, please?", translation: "Pode me dar um pão de mel?" }];
    expect(issuesOf(m)).toEqual([]);
    expect(issuesOf(valid())).toEqual([]);
  });

  it("chunk tem de estar no texto da resposta", () => {
    const m = withChunk();
    m.nodes[0].replies[0].chunk = "a cheese roll";
    expect(hasIssue(issuesOf(m), "nodes[0].replies[0].chunk", "não está no texto da resposta")).toBe(true);
  });

  it("a reação repete o chunk (conferência 9), também com e sem apelido", () => {
    const m = withChunk();
    m.nodes[0].replies[0].reaction.text = "Lovely! Those are new today.";
    expect(hasIssue(issuesOf(m), "nodes[0].replies[0].chunk", "não está na reação")).toBe(true);
    const n = withChunk();
    n.nodes[0].replies[0].reaction.text = "A honey, {player}, roll! Lovely.";
    n.nodes[0].replies[0].reaction.translation = "Um pão, {player}, de mel! Que bom.";
    expect(hasIssue(issuesOf(n), "nodes[0].replies[0].chunk", "não está na reação")).toBe(true);
  });

  it("echo: a reação repete o echo, e não o chunk, quando a NPC muda a pessoa do verbo", () => {
    const m = loose(valid());
    m.nodes[0].replies[0] = {
      text: "I'm from Brazil.",
      translation: "Sou do Brasil.",
      keywords: [["from"]],
      chunk: "I'm from",
      echo: "you're from",
      reaction: { text: "So you're from far away! Welcome.", translation: "Então você vem de longe! Bem-vindo(a)." },
    };
    expect(issuesOf(m)).toEqual([]);
    m.nodes[0].replies[0].echo = "you are here";
    expect(hasIssue(issuesOf(m), "nodes[0].replies[0].echo", "não está na reação")).toBe(true);
  });

  it("chunk não vale em resposta com erro nem livre; echo sem chunk e chunk sem reação não valem", () => {
    const flawed = loose(valid());
    flawed.nodes[0].replies[1].chunk = "two breads";
    expect(hasIssue(issuesOf(flawed), "nodes[0].replies[1].chunk", "só vale em resposta boa")).toBe(true);
    const free = loose(valid());
    Object.assign(free.nodes[1].replies[0], { free: "name", chunk: "one", reaction: { text: "One. Here.", translation: "Um." } });
    expect(hasIssue(issuesOf(free), "nodes[1].replies[0].chunk", "só vale em resposta boa")).toBe(true);
    const echo = loose(valid());
    echo.nodes[0].replies[0].echo = "honey";
    expect(hasIssue(issuesOf(echo), "nodes[0].replies[0].echo", "só vale junto com chunk")).toBe(true);
    const noReaction = loose(valid());
    noReaction.nodes[1].replies[0].chunk = "Just one";
    expect(hasIssue(issuesOf(noReaction), "nodes[1].replies[0].reaction", "precisa de reaction")).toBe(true);
  });

  it("chunk e echo têm teto de 80 caracteres; learner, de 200; campo desconhecido no recast é recusado", () => {
    const m = withChunk();
    m.nodes[0].replies[0].chunk = "x".repeat(81);
    expect(issuesOf(m).some((i) => i.path === "nodes[0].replies[0].chunk")).toBe(true);
    const n = loose(valid());
    n.nodes[0].replies[1].recast.learner = "x".repeat(201);
    expect(issuesOf(n).some((i) => i.path === "nodes[0].replies[1].recast.learner")).toBe(true);
    const o = loose(valid());
    o.nodes[0].replies[1].recast.anywhere = true;
    expect(issuesOf(o).some((i) => i.path.startsWith("nodes[0].replies[1].recast"))).toBe(true);
  });

  it("closing.models: de 1 a 3, cada um com uma palavra-alvo (conferência 5), sem {player}", () => {
    const line = (text: string) => ({ text, translation: "tradução" });
    const m = loose(valid());
    m.closing.models = [line("Can I have a cup of tea?")];
    expect(hasIssue(issuesOf(m), "closing.models[0].text", "nenhuma das palavras-alvo")).toBe(true);
    m.closing.models = [];
    expect(issuesOf(m).some((i) => i.path === "closing.models")).toBe(true);
    m.closing.models = [line("A honey roll."), line("A cheese roll."), line("A loaf of bread."), line("An apple pie.")];
    expect(issuesOf(m).some((i) => i.path === "closing.models")).toBe(true);
    m.closing.models = [{ text: "A honey roll, {player}.", translation: "Um pão de mel, {player}." }];
    expect(hasIssue(issuesOf(m), "closing.models[0].text", "{player} só pode aparecer")).toBe(true);
  });
});
