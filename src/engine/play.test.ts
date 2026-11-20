import { describe, expect, it } from "vitest";
import { parseMission, type Mission } from "../schemas";
import { answersOf, effectiveMode, nextNodeId, parseState, paysFullToday, replyXp, start, startHelp, step, suggestedMode, todayLevels, type Input, type PlayState } from "./play";
import { rulesV1 } from "./rules.v1";

const raw = {
  schema: 1,
  id: "demo-01",
  base: "pt-BR",
  target: "en",
  level: "A1",
  title: "Demo",
  theme: "Demo",
  can_do: "Consigo pedir pão.",
  description: "Uma padaria.",
  location: "bakery",
  characters: [{ id: "tilda", name: "Tilda", personality: "calorosa", npc: "tilda" }],
  listen: [
    { speaker: "tilda", text: "Good morning!", translation: "Bom dia!" },
    { speaker: "tilda", text: "Fresh bread.", translation: "Pão fresco." },
  ],
  nodes: [
    {
      id: "order",
      speaker: "tilda",
      text: "What would you like?",
      translation: "O que vai ser?",
      replies: [
        { text: "A honey roll, please.", translation: "Um pão de mel.", keywords: [["honey"]] },
        { text: "A cheese roll, please.", translation: "Um pão de queijo.", keywords: [["cheese"]] },
        {
          text: "A roll of honey.",
          translation: "Um pão de mel.",
          flawed: true,
          keywords: [["roll of honey"]],
          recast: { original: "roll of honey", corrected: "honey roll" },
          reaction: { text: "A honey roll? Sure!", translation: "Um pão de mel? Claro!" },
          pattern: "en.noun_modifier_order",
        },
      ],
    },
    {
      id: "pay",
      speaker: "tilda",
      text: "Three coins.",
      translation: "Três moedas.",
      replies: [{ text: "Here you go.", translation: "Aqui está.", keywords: [["here"]] }],
    },
  ],
  closing: {
    question: { text: "What tomorrow?", translation: "E amanhã?" },
    target_words: ["bread", "roll"],
    hint: "Diga algo do cardápio.",
    model_answer: { text: "I'd like a roll.", translation: "Eu queria um pão." },
    success: { text: "See you!", translation: "Até!" },
  },
  vocabulary: [{ term: "a roll", translation: "um pãozinho", example: "A roll, please." }],
};

function mission(over: Partial<typeof raw> = {}): Mission {
  const parsed = parseMission({ ...raw, ...over }, { origin: "builtin" });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.mission;
}

const m = mission();
const init = (mode: 1 | 2 | 3 = 3) => start(m, { runId: "run-1", day: "2026-11-20", mode });
const run = (state: PlayState, ...inputs: Input[]) => inputs.reduce((s, input) => step(m, s, input).state, state);
const say = (text: string): Input => ({ type: "say", input: "typed", utterances: [text] });

describe("começo da rodada", () => {
  it("o modo define o degrau de ajuda; o chefe começa sempre sem ajuda", () => {
    expect([1, 2, 3].map((mode) => startHelp(mode as 1 | 2 | 3, "encounter"))).toEqual([2, 1, 0]);
    expect([1, 2, 3].map((mode) => startHelp(mode as 1 | 2 | 3, "boss"))).toEqual([0, 0, 0]);
    expect(effectiveMode(1, "boss")).toBe(3);
  });
  it("o modo sugerido é o próximo degrau a conquistar", () => {
    expect([0, 1, 2, 3].map((stars) => suggestedMode(stars, "encounter"))).toEqual([1, 2, 3, 3]);
    expect(suggestedMode(0, "boss")).toBe(3);
  });
  it("começa pela escuta; sem escuta, pela primeira fala", () => {
    expect(init().phase).toBe("listen");
    const silent = start({ ...m, listen: [] }, { runId: "r", day: "2026-11-20", mode: 2 });
    expect(silent).toMatchObject({ phase: "ask", node: "order", help: 1 });
  });
});

describe("escuta e falas", () => {
  it("a escuta avança até a primeira fala", () => {
    const s = run(init(), { type: "next" }, { type: "next" });
    expect(s).toMatchObject({ phase: "ask", node: "order" });
  });

  it("casa a fala, guarda a resposta com o degrau em vigor e segue na reação", () => {
    const asked = run(init(2), { type: "next" }, { type: "next" });
    const { state, outcome } = step(m, asked, say("a cheese roll please"));
    expect(outcome).toEqual({ kind: "matched", reply: 1, alternative: 0 });
    expect(state.phase).toBe("react");
    expect(state.steps).toEqual([{ node: "order", reply: 1, input: "typed", scaffold: 1 }]);
    const after = run(state, { type: "next" });
    expect(after).toMatchObject({ phase: "ask", node: "pay", help: 1, fails: 0 });
  });

  it("testa as alternativas do reconhecedor em ordem", () => {
    const asked = run(init(), { type: "next" }, { type: "next" });
    const { outcome } = step(m, asked, { type: "say", input: "voice", utterances: ["a chess roll", "a cheese roll"] });
    expect(outcome).toMatchObject({ kind: "matched", reply: 1, alternative: 1 });
  });

  it("a resposta com erro casa só quando a pessoa a produz", () => {
    const asked = run(init(), { type: "next" }, { type: "next" });
    expect(step(m, asked, say("a roll of honey")).outcome).toMatchObject({ kind: "matched", reply: 2 });
  });

  it("não casou: conta, não tira nada; na 2ª falha a ajuda sobe sozinha", () => {
    const asked = run(init(), { type: "next" }, { type: "next" });
    const first = step(m, asked, say("banana"));
    expect(first.outcome).toEqual({ kind: "retry", raised: false });
    expect(first.state).toMatchObject({ phase: "ask", fails: 1, retries: 1, help: 0 });
    const second = step(m, first.state, say("potato"));
    expect(second.outcome).toEqual({ kind: "retry", raised: true });
    expect(second.state).toMatchObject({ fails: 2, retries: 2, help: 1 });
    // nunca trava: sobe até o degrau 3 (tocar) e para aí
    const many = Array.from({ length: 10 }).reduce<PlayState>((s) => step(m, s, say("zzz")).state, second.state);
    expect(many.help).toBe(3);
    expect(many.phase).toBe("ask");
  });

  it("pedir ajuda é livre e para no degrau 3; tocar só vale com as opções na tela", () => {
    const asked = run(init(), { type: "next" }, { type: "next" });
    expect(step(m, asked, { type: "tap", reply: 0 }).outcome).toEqual({ kind: "none" });
    const helped = run(asked, { type: "help" }, { type: "help" }, { type: "help" }, { type: "help" });
    expect(helped.help).toBe(3);
    const tapped = step(m, helped, { type: "tap", reply: 1 });
    expect(tapped.state.steps[0]).toEqual({ node: "order", reply: 1, input: "tap", scaffold: 3 });
    expect(step(m, helped, { type: "tap", reply: 9 }).outcome).toEqual({ kind: "none" });
  });

  it("entrada fora de hora é ignorada", () => {
    const s = init();
    for (const input of [{ type: "help" }, { type: "skip" }, say("hello"), { type: "tap", reply: 0 }] as Input[]) {
      expect(step(m, s, input)).toEqual({ state: s, outcome: { kind: "none" } });
    }
    expect(step(m, run(init(), { type: "next" }, { type: "next" }), say("   ")).outcome).toEqual({ kind: "none" });
  });

  it("a próxima fala segue `next` da resposta, senão a lista", () => {
    expect(nextNodeId(m, "order", 0)).toBe("pay");
    expect(nextNodeId(m, "pay", 0)).toBeNull();
  });
});

describe("fecho", () => {
  const atClosing = () => run(init(), { type: "next" }, { type: "next" }, say("honey"), { type: "next" }, say("here you go"), { type: "next" });

  it("chega ao fecho depois da última fala", () => {
    expect(atClosing().phase).toBe("closing");
  });
  it("aceita a frase própria com uma palavra-alvo", () => {
    const { state, outcome } = step(m, atClosing(), say("I want bread"));
    expect(outcome.kind).toBe("closing_ok");
    expect(state).toMatchObject({ phase: "done", closing: { input: "typed", accepted: true, usedModel: false, text: "I want bread" } });
  });
  it("duas tentativas, depois a resposta-modelo; repetir ou tocar fecha sem travar", () => {
    const first = step(m, atClosing(), say("hmm"));
    expect(first.outcome.kind).toBe("closing_retry");
    expect(first.state).toMatchObject({ phase: "closing", fails: 1 });
    const second = step(m, first.state, say("hmm hmm"));
    expect(second.outcome.kind).toBe("closing_model");
    expect(second.state.phase).toBe("model");
    const repeated = step(m, second.state, say("I'd like a roll"));
    expect(repeated.state.closing).toEqual({ input: "typed", accepted: false, usedModel: true, text: "I'd like a roll" });
    const skipped = step(m, second.state, { type: "skip" });
    expect(skipped.state.closing).toEqual({ input: "tap", accepted: false, usedModel: true, text: "I'd like a roll." });
    expect(skipped.state.phase).toBe("done");
  });
  it("tocar para seguir só existe depois da resposta-modelo", () => {
    expect(step(m, atClosing(), { type: "skip" }).outcome.kind).toBe("none");
  });
});

describe("XP na hora e na rodada", () => {
  it("o XP da resposta segue o degrau e o repeat de hoje", () => {
    const none = todayLevels([], "demo-01", "2026-11-20");
    expect(replyXp(rulesV1, { node: "order", reply: 0, input: "typed", scaffold: 0 }, none)).toBe(16);
    expect(replyXp(rulesV1, { node: "order", reply: 0, input: "voice", scaffold: 2 }, none)).toBe(8);
    expect(replyXp(rulesV1, { node: "order", reply: 0, input: "tap", scaffold: 3 }, none)).toBe(4);
    const before = [{ id: "r0", missionId: "demo-01", day: "2026-11-20", answers: [{ node: "order", input: "typed" as const, scaffold: 0 as const }] }];
    const today = todayLevels(before, "demo-01", "2026-11-20");
    expect(replyXp(rulesV1, { node: "order", reply: 0, input: "typed", scaffold: 0 }, today)).toBe(8); // mesma ajuda: metade
    expect(replyXp(rulesV1, { node: "order", reply: 0, input: "typed", scaffold: 2 }, today)).toBe(4); // com mais ajuda do que já usou hoje: 8 × ½
  });
  it("a missão paga cheio hoje enquanto não houve rodada dela hoje", () => {
    const runs = [{ id: "r0", missionId: "demo-01", day: "2026-11-19", answers: [] }];
    expect(paysFullToday(runs, "demo-01", "2026-11-20")).toBe(true);
    expect(paysFullToday([...runs, { id: "r1", missionId: "demo-01", day: "2026-11-20", answers: [] }], "demo-01", "2026-11-20")).toBe(false);
  });
  it("as respostas viram o que o motor grava", () => {
    const s = run(init(), { type: "next" }, { type: "next" }, say("honey"));
    expect(answersOf(s)).toEqual([{ node: "order", input: "typed", scaffold: 0 }]);
  });
});

describe("sessão guardada", () => {
  it("volta igual depois de ir e vir pelo JSON", () => {
    const s = run(init(), { type: "next" }, { type: "next" }, say("honey"), { type: "next" });
    expect(parseState(m, JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("recusa o que não bate com a missão ou está estragado", () => {
    const s = init();
    expect(parseState(m, null)).toBeNull();
    expect(parseState(m, { ...s, v: 2 })).toBeNull();
    expect(parseState(m, { ...s, missionId: "outra" })).toBeNull();
    expect(parseState(m, { ...s, node: "nao-existe" })).toBeNull();
    expect(parseState(m, { ...s, mode: 4 })).toBeNull();
    expect(parseState(m, { ...s, help: 9 })).toBeNull();
    expect(parseState(m, { ...s, steps: [{ node: "order", reply: 7, input: "typed", scaffold: 0 }] })).toBeNull();
    expect(parseState(m, { ...s, phase: "done" })).toBeNull(); // done sem fecho
    expect(parseState(m, { ...s, steps: "x" })).toBeNull();
  });
});
