import { describe, expect, it } from "vitest";
import {
  coinsFor,
  deriveProgress,
  levelAt,
  masteryOf,
  planRun,
  repeatOf,
  rulesV1,
  runDegree,
  streak,
  totalAt,
  unlocksAt,
  xpFor,
  type InputMode,
  type LedgerEvent,
  type PlanRunInput,
  type RunAnswer,
  type RunClosing,
  type RunSummary,
  type Scaffold,
  type XpSource,
} from "./index";
import { longestGapDays } from "./streak";

const reply = (input: InputMode, scaffold: Scaffold, repeat = 0, extra: Partial<Extract<XpSource, { kind: "reply" }>> = {}): XpSource => ({
  kind: "reply",
  input,
  scaffold,
  flawed: false,
  attempt: 1,
  repeat,
  ...extra,
});

describe("xpFor: resposta (W2-01 §2.1 e §2.2)", () => {
  it.each<[InputMode, Scaffold, number]>([
    ["voice", 0, 16], ["voice", 1, 12], ["voice", 2, 8], ["voice", 3, 8],
    ["typed", 0, 16], ["typed", 1, 12], ["typed", 2, 8], ["typed", 3, 8],
    ["tap", 0, 4], ["tap", 1, 4], ["tap", 2, 4], ["tap", 3, 4],
  ])("%s com degrau %i vale %i", (input, scaffold, xp) => {
    expect(xpFor(reply(input, scaffold))).toBe(xp);
  });

  it("repeat 1 paga ½ e repeat 2 ou mais paga ¼ (tabela da §2.2)", () => {
    expect([0, 1, 2, 3, 9].map((r) => xpFor(reply("voice", 0, r)))).toEqual([16, 8, 4, 4, 4]);
    expect([0, 1, 2].map((r) => xpFor(reply("voice", 1, r)))).toEqual([12, 6, 3]);
    expect([0, 1, 2].map((r) => xpFor(reply("voice", 2, r)))).toEqual([8, 4, 2]);
    expect([0, 1, 2].map((r) => xpFor(reply("tap", 3, r)))).toEqual([4, 2, 1]);
  });

  it("flawed e attempt não mudam o XP", () => {
    for (const flawed of [false, true]) for (const attempt of [1, 2, 7]) expect(xpFor(reply("voice", 1, 0, { flawed, attempt }))).toBe(12);
  });
});

describe("xpFor: fecho (§2.3)", () => {
  const closing = (input: InputMode, accepted: boolean, usedModelAnswer: boolean, repeat = 0): XpSource => ({ kind: "closing", input, accepted, usedModelAnswer, repeat });
  it("frase própria 24/12/6, resposta-modelo 12/6/3, toque 4/2/1, sem fecho 0", () => {
    expect([0, 1, 2].map((r) => xpFor(closing("typed", true, false, r)))).toEqual([24, 12, 6]);
    expect([0, 1, 2].map((r) => xpFor(closing("voice", true, true, r)))).toEqual([12, 6, 3]);
    expect([0, 1, 2].map((r) => xpFor(closing("tap", false, false, r)))).toEqual([4, 2, 1]);
    expect(xpFor(closing("voice", false, false))).toBe(0);
  });
});

describe("xpFor e coinsFor: prêmios da missão (§2.4, uma chamada por prêmio)", () => {
  const prize = (level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2", missionKind: "encounter" | "boss", firstTime: boolean, mastery: number): XpSource => ({ kind: "mission", missionKind, level, firstTime, mastery });
  const row = (level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2", kind: "encounter" | "boss") => [prize(level, kind, true, 0), prize(level, kind, false, 1), prize(level, kind, false, 2), prize(level, kind, false, 3)].map(xpFor);

  it.each([
    ["A1", "encounter", [24, 40, 56, 80]], ["A1", "boss", [36, 60, 84, 120]],
    ["A2", "encounter", [30, 50, 70, 100]], ["A2", "boss", [45, 75, 105, 150]],
    ["B1", "encounter", [36, 60, 84, 120]], ["B1", "boss", [54, 90, 126, 180]],
    ["B2", "encounter", [42, 70, 98, 140]], ["B2", "boss", [63, 105, 147, 210]],
    ["C1", "encounter", [48, 80, 112, 160]], ["C1", "boss", [72, 120, 168, 240]],
    ["C2", "encounter", [54, 90, 126, 180]], ["C2", "boss", [81, 135, 189, 270]],
  ] as const)("%s %s", (level, kind, expected) => {
    expect(row(level, kind)).toEqual(expected);
  });

  it("mastery 0 sem firstTime não paga; mastery é a estrela daquela chamada, não acumulada", () => {
    expect(xpFor(prize("A1", "encounter", false, 0))).toBe(0);
    expect(xpFor(prize("A1", "encounter", true, 2))).toBe(24 + 56);
    expect(xpFor(prize("A1", "encounter", false, 7))).toBe(80);
  });

  it("moedas: 5 na 1ª conclusão, 5/10/15 por estrela, o dobro no chefe", () => {
    expect([prize("A1", "encounter", true, 0), prize("A1", "encounter", false, 1), prize("A1", "encounter", false, 2), prize("A1", "encounter", false, 3)].map(coinsFor)).toEqual([5, 5, 10, 15]);
    expect([prize("B2", "boss", true, 0), prize("B2", "boss", false, 1), prize("B2", "boss", false, 3)].map(coinsFor)).toEqual([10, 10, 30]);
  });

  it("resposta, fecho e feitiço não dão moeda; missão do dia e conquistas dão", () => {
    expect(coinsFor(reply("voice", 0))).toBe(0);
    expect(coinsFor({ kind: "spell", input: "voice", grade: "good", gradedBy: "ai", repeat: 0 })).toBe(0);
    expect(coinsFor({ kind: "daily_complete" })).toBe(10);
    expect([xpFor, coinsFor].map((f) => [f({ kind: "achievement", id: "recast_10" }), f({ kind: "achievement", id: "first_boss" }), f({ kind: "achievement", id: "days_30" })])).toEqual([
      [20, 50, 100],
      [10, 25, 50],
    ]);
  });
});

describe("xpFor: feitiço e missão do dia (§2.5 e §2.6)", () => {
  const spell = (gradedBy: "ai" | "local" | "self", grade: "again" | "hard" | "good" | "easy", input: InputMode = "typed", repeat = 0): XpSource => ({ kind: "spell", input, grade, gradedBy, repeat });
  it("hard = good = easy; again paga metade (menos no self); toque vale 2", () => {
    expect(["hard", "good", "easy"].map((g) => xpFor(spell("ai", g as "good")))).toEqual([16, 16, 16]);
    expect(["hard", "good", "easy", "again"].map((g) => xpFor(spell("local", g as "good")))).toEqual([12, 12, 12, 6]);
    expect(["hard", "good", "easy", "again"].map((g) => xpFor(spell("self", g as "good")))).toEqual([8, 8, 8, 8]);
    expect(xpFor(spell("ai", "good", "tap"))).toBe(2);
    expect([0, 1, 2].map((r) => xpFor(spell("ai", "good", "voice", r)))).toEqual([16, 8, 4]);
    expect(xpFor(spell("ai", "again", "voice", 2))).toBe(2);
  });
  it("missão do dia: 40 XP e 10 moedas", () => {
    expect([xpFor({ kind: "daily_complete" }), coinsFor({ kind: "daily_complete" })]).toEqual([40, 10]);
  });
});

describe("levelAt: curva e títulos (§3)", () => {
  it.each([
    [2, 50], [3, 150], [4, 300], [5, 500], [6, 750], [8, 1400], [10, 2250], [12, 3300], [16, 6000],
    [20, 9500], [23, 12650], [27, 17550], [31, 23250], [40, 39000], [50, 61250], [60, 88500],
  ])("o nível %i começa em %i XP", (level, xp) => {
    expect(totalAt(level)).toBe(xp);
    expect(levelAt(xp)).toMatchObject({ level, into: 0 });
    expect(levelAt(xp - 1).level).toBe(level - 1);
  });

  it("zero XP: nível 1, barra vazia, faltam 50", () => {
    expect(levelAt(0)).toEqual({ level: 1, into: 0, toNext: 50, title: "apprentice" });
  });
  it("into + toNext = 50 × nível, em toda a faixa", () => {
    for (let xp = 0; xp <= 100_000; xp += 37) {
      const { level, into, toNext } = levelAt(xp);
      expect(into + toNext).toBe(50 * level);
      expect(into).toBeGreaterThanOrEqual(0);
      expect(toNext).toBeGreaterThan(0);
    }
  });
  it("entrada estranha vira 0 (negativo, NaN, fração)", () => {
    expect(levelAt(-5).level).toBe(1);
    expect(levelAt(Number.NaN).level).toBe(1);
    expect(levelAt(149.9).level).toBe(2);
  });
  it.each([
    [1, "apprentice"], [4, "apprentice"], [5, "traveler"], [9, "traveler"], [10, "merchant"], [15, "merchant"], [16, "diplomat"],
    [22, "diplomat"], [23, "ambassador"], [30, "ambassador"], [31, "scholar"], [39, "scholar"], [40, "sage"], [49, "sage"], [50, "legend"], [200, "legend"],
  ])("o nível %i tem o título %s", (level, title) => {
    expect(levelAt(totalAt(level)).title).toBe(title);
  });
});

describe("unlocksAt (§5.1)", () => {
  it("padaria no 1, taverna no 3; os outros níveis só têm título (os locais 3 a 6 não existem ainda)", () => {
    expect(unlocksAt(1)).toEqual([
      { type: "location", id: "bakery" },
      { type: "title", id: "apprentice" },
    ]);
    expect(unlocksAt(3)).toEqual([{ type: "location", id: "tavern" }]);
    expect(unlocksAt(2)).toEqual([]);
    expect(unlocksAt(5)).toEqual([{ type: "title", id: "traveler" }]);
    expect(unlocksAt(50)).toEqual([{ type: "title", id: "legend" }]);
    expect(unlocksAt(8)).toEqual([]);
  });
});

const ans = (input: InputMode, scaffold: Scaffold, node = "n"): RunAnswer => ({ node, input, scaffold });
const six = (input: InputMode, scaffold: Scaffold): RunAnswer[] => Array.from({ length: 6 }, (_, i) => ans(input, scaffold, `f${i}`));
const own: RunClosing = { input: "voice", accepted: true, usedModel: false };
const modelClosing: RunClosing = { input: "voice", accepted: true, usedModel: true };
const tapClosing: RunClosing = { input: "tap", accepted: false, usedModel: false };

describe("runDegree e masteryOf (§4)", () => {
  const run = (answers: RunAnswer[], closing?: RunClosing): RunSummary => ({ missionId: "m", day: "2026-11-20", answers, closing });
  it("estrela pelo degrau de ajuda, com fecho próprio", () => {
    expect(runDegree(run(six("voice", 2), own))).toBe(1);
    expect(runDegree(run(six("voice", 1), own))).toBe(2);
    expect(runDegree(run(six("typed", 0), own))).toBe(3);
  });
  it("folga de 1 fala em 6 (e nenhuma em 4)", () => {
    expect(runDegree(run([...six("voice", 0).slice(0, 5), ans("voice", 1, "x")], own))).toBe(3);
    expect(runDegree(run([...six("voice", 0).slice(0, 4), ans("voice", 1, "x"), ans("voice", 1, "y")], own))).toBe(2);
    expect(runDegree(run([ans("voice", 0), ans("voice", 0), ans("voice", 0), ans("voice", 1)], own))).toBe(2);
  });
  it("resposta-modelo no fecho limita a ★; fecho tocado ou ausente não dá estrela", () => {
    expect(runDegree(run(six("voice", 0), modelClosing))).toBe(1);
    expect(runDegree(run(six("voice", 0), tapClosing))).toBe(0);
    expect(runDegree(run(six("voice", 0)))).toBe(0);
  });
  it("fecho que não houve (digitado, não aceito, sem modelo) não prova estrela; rodada sem falas também não", () => {
    expect(runDegree(run(six("voice", 2), { input: "typed", accepted: false, usedModel: false }))).toBe(0);
    expect(runDegree(run([], own))).toBe(0);
  });
  it("só toque nunca dá estrela, nem com fecho próprio", () => {
    expect(runDegree(run(six("tap", 3), own))).toBe(0);
    expect(runDegree(run(six("tap", 0), own))).toBe(0);
  });
  it("degrau 3 com voz vale como o 2 (ler em voz alta)", () => {
    expect(runDegree(run(six("voice", 3), own))).toBe(1);
  });
  it("o domínio é o maior entre as rodadas: uma rodada pior depois não tira estrela", () => {
    const best = run(six("voice", 0), own);
    const worse = run(six("tap", 3), tapClosing);
    expect(masteryOf([])).toBe(0);
    expect(masteryOf([best])).toBe(3);
    expect(masteryOf([best, worse])).toBe(3);
    expect(masteryOf([worse, best])).toBe(3);
  });
});

describe("repeatOf (§2.2)", () => {
  it("conta o que hoje foi feito com a mesma ajuda ou menos", () => {
    expect(repeatOf([], 0)).toBe(0);
    expect(repeatOf([3], 2)).toBe(0);
    expect(repeatOf([3, 2, 1, 0], 0)).toBe(1);
    expect(repeatOf([3, 2, 1, 0, 0, 0], 2)).toBe(5);
  });
});

const baseInput = (over: Partial<PlanRunInput> = {}): PlanRunInput => ({
  rules: rulesV1,
  runId: "run-1",
  missionId: "bakery-01",
  mission: { kind: "encounter", level: "A1" },
  day: "2026-11-20",
  answers: six("voice", 2),
  closing: own,
  history: [],
  granted: new Set(),
  ...over,
});
const sum = (events: { xp: number }[]) => events.reduce((n, e) => n + e.xp, 0);

describe("planRun: os números da proposta para a A1 de 6 falas (§4)", () => {
  it("modo 1, 1ª vez: 72 de conversa + 24 + 40 = 136", () => {
    const plan = planRun(baseInput());
    expect(plan.xp).toBe(72);
    expect(plan.degree).toBe(1);
    expect(plan.events.map((e) => [e.id, e.kind, e.xp, e.coins])).toEqual([
      ["run:run-1", "mission_completed", 72, 0],
      ["first:bakery-01", "mission_first", 24, 5],
      ["star:bakery-01:1", "mission_star", 40, 5],
    ]);
    expect(sum(plan.events)).toBe(136);
  });

  it("modo 2 depois do 1, ganha ★★: 96 + 56 = 152", () => {
    const first = planRun(baseInput());
    const plan = planRun(baseInput({ runId: "run-2", day: "2026-11-21", answers: six("voice", 1), history: [{ missionId: "bakery-01", day: "2026-11-20", answers: six("voice", 2), closing: own }], granted: new Set(first.events.map((e) => e.id!)) }));
    expect(plan.xp).toBe(96);
    expect(sum(plan.events)).toBe(152);
    expect(plan.events.map((e) => e.id)).toEqual(["run:run-2", "star:bakery-01:2"]);
  });

  it("modo 3 depois do 2, ganha ★★★: 120 + 80 = 200; já com ★★★: só 120", () => {
    const granted = new Set(["first:bakery-01", "star:bakery-01:1", "star:bakery-01:2"]);
    const plan = planRun(baseInput({ runId: "run-3", day: "2026-11-22", answers: six("voice", 0), granted }));
    expect(sum(plan.events)).toBe(200);
    const again = planRun(baseInput({ runId: "run-4", day: "2026-11-23", answers: six("voice", 0), granted: new Set([...granted, "star:bakery-01:3", "run:run-3"]) }));
    expect(sum(again.events)).toBe(120);
    expect(again.events).toHaveLength(1);
  });

  it("só toque: 28 de conversa + 24 da 1ª conclusão = 52; outro dia, só 28", () => {
    const plan = planRun(baseInput({ answers: six("tap", 3), closing: tapClosing }));
    expect(plan.degree).toBe(0);
    expect(plan.xp).toBe(28);
    expect(sum(plan.events)).toBe(52);
    const next = planRun(baseInput({ runId: "run-2", day: "2026-11-21", answers: six("tap", 3), closing: tapClosing, granted: new Set(plan.events.map((e) => e.id!)) }));
    expect(sum(next.events)).toBe(28);
  });

  it("pular degraus nunca perde prêmio: sem nada pago, ★★★ de primeira paga as três estrelas", () => {
    const plan = planRun(baseInput({ answers: six("voice", 0) }));
    expect(plan.degree).toBe(3);
    expect(plan.events.map((e) => e.id)).toEqual(["run:run-1", "first:bakery-01", "star:bakery-01:1", "star:bakery-01:2", "star:bakery-01:3"]);
    expect(sum(plan.events)).toBe(120 + 24 + 40 + 56 + 80);
  });

  it("o chefe grava boss_defeated e paga ×1,5 no nível dele", () => {
    const plan = planRun(baseInput({ mission: { kind: "boss", level: "A2" }, answers: six("voice", 0), missionId: "tavern-03" }));
    expect(plan.events[0]).toMatchObject({ kind: "boss_defeated" });
    expect(plan.events.slice(1).map((e) => [e.xp, e.coins])).toEqual([[45, 10], [75, 10], [105, 20], [150, 30]]);
  });

  it("nenhum evento passa dos tetos da importação (400 XP, 100 moedas), nem a rodada de 20 falas no chefe C2", () => {
    const plan = planRun(baseInput({ mission: { kind: "boss", level: "C2" }, answers: Array.from({ length: 20 }, (_, i) => ans("voice", 0, `f${i}`)) }));
    for (const e of plan.events) {
      expect(e.xp).toBeLessThanOrEqual(400);
      expect(e.coins).toBeLessThanOrEqual(100);
    }
    expect(plan.xp).toBe(20 * 16 + 24);
  });
});

describe("planRun: repeat por fala, pela ajuda usada (§2.2)", () => {
  /** Uma rodada de uma fala só, para reproduzir o exemplo da proposta, passo a passo no mesmo dia. */
  const steps: [InputMode, Scaffold, number][] = [["tap", 3, 4], ["voice", 2, 8], ["voice", 1, 12], ["voice", 0, 16], ["voice", 0, 8], ["voice", 0, 4], ["voice", 2, 2]];
  it("o exemplo da proposta: 4 → 8 → 12 → 16 → 8 → 4 → 2", () => {
    const history: RunSummary[] = [];
    const got: number[] = [];
    steps.forEach(([input, scaffold], i) => {
      const answers = [ans(input, scaffold, "greet")];
      const plan = planRun(baseInput({ runId: `r${i}`, answers, closing: undefined, history: [...history] }));
      got.push(plan.answerXp[0]!);
      history.push({ missionId: "bakery-01", day: "2026-11-20", answers, closing: undefined });
    });
    expect(got).toEqual(steps.map(([, , xp]) => xp));
  });

  it("outro dia, outra missão ou outra fala começam do cheio", () => {
    const history: RunSummary[] = [{ missionId: "bakery-01", day: "2026-11-20", answers: [ans("voice", 0, "greet")], closing: own }];
    const xp = (over: Partial<PlanRunInput>) => planRun(baseInput({ answers: [ans("voice", 0, "greet")], closing: undefined, history, ...over })).answerXp[0];
    expect(xp({})).toBe(8);
    expect(xp({ day: "2026-11-21" })).toBe(16);
    expect(xp({ missionId: "bakery-02" })).toBe(16);
    expect(xp({ answers: [ans("voice", 0, "order")] })).toBe(16);
  });

  it("fecho: 24 → 12 → 6; modelo e toque pagam cheio quando é o primeiro daquele nível hoje", () => {
    const closingXp = (history: RunSummary[], closing: RunClosing) => planRun(baseInput({ answers: [], closing, history })).closingXp;
    const day = "2026-11-20";
    const h1: RunSummary = { missionId: "bakery-01", day, answers: [], closing: own };
    const h2: RunSummary = { missionId: "bakery-01", day, answers: [], closing: own };
    expect([closingXp([], own), closingXp([h1], own), closingXp([h1, h2], own)]).toEqual([24, 12, 6]);
    expect(closingXp([], modelClosing)).toBe(12);
    expect(closingXp([h1], modelClosing)).toBe(6); // já fez melhor (frase própria) hoje
    expect(closingXp([{ ...h1, closing: tapClosing }], own)).toBe(24);
    expect(closingXp([{ ...h1, closing: tapClosing }], tapClosing)).toBe(2);
  });

  it("replanejar uma rodada já gravada (ela no histórico, com o mesmo id) não a conta como repetição", () => {
    const input = baseInput({ runId: "r1" });
    const first = planRun(input);
    const saved: RunSummary = { id: "r1", missionId: "bakery-01", day: "2026-11-20", answers: input.answers, closing: own };
    expect(planRun({ ...input, history: [saved] }).xp).toBe(first.xp);
    expect(planRun({ ...input, runId: "r2", history: [saved] }).xp).toBeLessThan(first.xp);
  });

  it("a rodada de agora não conta para o próprio repeat (a mesma fala só vale uma vez dentro da rodada)", () => {
    expect(planRun(baseInput({ answers: [ans("voice", 0, "g"), ans("voice", 0, "g")], closing: undefined })).answerXp).toEqual([16, 16]);
  });
});

describe("planRun: prêmio único e importação (§2.7)", () => {
  it("planejar a mesma rodada de novo, com o que já foi gravado, não paga nada", () => {
    const input = baseInput({ answers: six("voice", 0) });
    const first = planRun(input);
    const again = planRun({ ...input, granted: new Set(first.events.map((e) => e.id!)) });
    expect(again.events).toEqual([]);
  });

  it("dois aparelhos que ganham a mesma estrela geram o mesmo id; o livro-razão derivado conta uma vez", () => {
    const a = planRun(baseInput({ runId: "ra", answers: six("voice", 0) }));
    const b = planRun(baseInput({ runId: "rb", answers: six("voice", 0) }));
    const prizeIds = (events: { id?: string; kind: string }[]) => events.filter((e) => e.kind.startsWith("mission_f") || e.kind === "mission_star").map((e) => e.id);
    expect(prizeIds(a.events)).toEqual(prizeIds(b.events));
    const ledger = (plan: typeof a): LedgerEvent[] => plan.events.map((e, i) => ({ id: e.id!, at: i, day: e.day, kind: e.kind, xp: e.xp, coins: e.coins, ref: e.ref }));
    const merged = [...ledger(a), ...ledger(b), ...ledger(a)];
    const once = deriveProgress(ledger(a), rulesV1, "2026-11-20");
    const together = deriveProgress(merged, rulesV1, "2026-11-20");
    expect(together.xp).toBe(once.xp + b.xp); // só a conversa da rodada b é nova
    expect(deriveProgress(merged, rulesV1, "2026-11-20")).toEqual(together);
  });

  it("deriveProgress: o mesmo evento duas vezes (importar duas vezes) não paga em dobro", () => {
    const e: LedgerEvent = { id: "run:x", at: 1, day: "2026-11-20", kind: "mission_completed", xp: 72, coins: 0, ref: "bakery-01" };
    expect(deriveProgress([e, e], rulesV1, "2026-11-20").xp).toBe(72);
  });
});

describe("deriveProgress", () => {
  const ev = (id: string, xp: number, kind = "mission_completed", day = "2026-11-20", coins = 0): LedgerEvent => ({ id, at: 1, day, kind, xp, coins });
  it("sem eventos: nível 1, barra vazia, ofensiva 0", () => {
    expect(deriveProgress([], rulesV1, "2026-11-20")).toEqual({
      xp: 0, coins: 0, level: 1, into: 0, toNext: 50, title: "apprentice",
      unlocks: [{ type: "location", id: "bakery" }, { type: "title", id: "apprentice" }],
      streak: { current: 0, best: 0, freezesLeft: 0, frozenDays: [] },
      activeDays: 0, achievements: [],
    });
  });
  it("soma XP e moedas; a primeira missão de quem só toca (52 XP) já sobe ao nível 2", () => {
    const p = deriveProgress([ev("a", 28), ev("b", 24, "mission_first", "2026-11-20", 5)], rulesV1, "2026-11-20");
    expect(p).toMatchObject({ xp: 52, coins: 5, level: 2, into: 2, toNext: 98 });
  });
  it("nível 3 abre a taverna; nível 5 dá o título Viajante", () => {
    expect(deriveProgress([ev("a", 150)], rulesV1, "2026-11-20").unlocks).toContainEqual({ type: "location", id: "tavern" });
    expect(deriveProgress([ev("a", 500)], rulesV1, "2026-11-20")).toMatchObject({ level: 5, title: "traveler" });
  });
  it("moeda gasta nunca deixa o saldo abaixo de zero", () => {
    expect(deriveProgress([ev("a", 0, "purchase", "2026-11-20", -40)], rulesV1, "2026-11-20").coins).toBe(0);
  });
  it("só missão e feitiço contam como dia jogado; prêmio e conquista não", () => {
    const p = deriveProgress([ev("a", 10, "mission_first", "2026-11-18"), ev("b", 20, "achievement", "2026-11-19"), ev("ach:x", 20, "achievement", "2026-11-19"), ev("c", 5, "spell_cast", "2026-11-20")], rulesV1, "2026-11-20");
    expect(p.activeDays).toBe(1);
    expect(p.achievements).toEqual(["x"]);
  });
});

describe("streak (§5.3)", () => {
  const d = (n: number) => `2026-11-${String(n).padStart(2, "0")}`;
  const run = (days: number[], today: number) => streak(days.map(d), [], d(today));

  it("sem dias: tudo zero", () => {
    expect(run([], 20)).toEqual({ current: 0, best: 0, freezesLeft: 0, frozenDays: [] });
  });
  it("dias seguidos somam; hoje ainda sem jogar não conta como pausa", () => {
    expect(run([17, 18, 19], 20)).toMatchObject({ current: 3, best: 3 });
    expect(run([18, 19, 20], 20)).toMatchObject({ current: 3, best: 3 });
  });
  it("1 congelamento a cada 2 dias jogados; um dia de pausa gasta um e a ofensiva segue", () => {
    expect(run([10, 11, 13], 13)).toEqual({ current: 3, best: 3, freezesLeft: 0, frozenDays: [d(12)] });
  });
  it("aguenta um fim de semana: segunda a sexta ganha 2 e gasta 2 (a ofensiva segue indefinidamente)", () => {
    // 2026-11-02 é segunda. Jogou seg a sex por 8 semanas.
    const days: string[] = [];
    for (let week = 0; week < 8; week++) for (let i = 0; i < 5; i++) {
      const date = new Date(Date.UTC(2026, 10, 2 + week * 7 + i));
      days.push(date.toISOString().slice(0, 10));
    }
    const last = days[days.length - 1]!;
    const result = streak(days, [], last);
    expect(result.current).toBe(40);
    expect(result.best).toBe(40);
  });
  it("três dias parados sem estoque recomeçam em 1, e o melhor fica", () => {
    expect(run([10, 11, 12, 16], 16)).toMatchObject({ current: 1, best: 3 });
    expect(run([10, 15], 15)).toMatchObject({ current: 1, best: 1 });
  });
  it("pausa maior que o estoque não gasta o estoque", () => {
    expect(run([10, 11, 17], 17)).toMatchObject({ current: 1, freezesLeft: 1 });
  });
  it("o estoque tem teto de 2", () => {
    expect(run([1, 2, 3, 4, 5, 6, 7, 8], 8).freezesLeft).toBe(2);
  });
  it("dias parados até hoje: usa o estoque ou zera", () => {
    expect(run([10, 11, 12, 13], 15)).toMatchObject({ current: 4, freezesLeft: 1, frozenDays: [d(14)] });
    expect(run([10], 14)).toMatchObject({ current: 0, best: 1 });
  });
  it("mesmo resultado em qualquer ordem e com repetições; dia futuro é ignorado", () => {
    const base = run([10, 11, 13, 14, 16], 17);
    expect(run([16, 10, 14, 11, 13, 13, 10], 17)).toEqual(base);
    expect(run([10, 11, 13, 14, 16, 25], 17)).toEqual(base);
  });
  it("atravessa mês e ano certo", () => {
    expect(streak(["2026-12-30", "2026-12-31", "2027-01-01"], [], "2027-01-01")).toMatchObject({ current: 3 });
    expect(streak(["2028-02-26", "2028-02-27", "2028-02-28", "2028-03-01"], [], "2028-03-01")).toMatchObject({ current: 4, frozenDays: ["2028-02-29"] });
  });
  it("longestGapDays: dias inteiros entre dois dias jogados", () => {
    expect(longestGapDays([d(1), d(2), d(10)])).toBe(7);
    expect(longestGapDays([d(1)])).toBe(0);
  });
});

describe("conquistas (§5.4)", () => {
  const stats = { missionsCompleted: 0, missionsWithStar3: 0, bossesCompleted: 0, voiceReplies: 0, ownClosings: 0, recasts: 0, spellsCast: 0, npcsMet: 0, npcsTotal: 2, canDo: 0, bestStreak: 0, activeDays: 0, longestGapDays: 0 };
  const earned = (s: Partial<typeof stats>) => rulesV1.achievements.filter((a) => a.check({ ...stats, ...s })).map((a) => a.id);
  it("são 12, e nenhuma vale com tudo zerado", () => {
    expect(rulesV1.achievements).toHaveLength(12);
    expect(earned({})).toEqual([]);
  });
  it("cada condição no limite", () => {
    expect(earned({ missionsCompleted: 1 })).toEqual(["first_mission"]);
    expect(earned({ voiceReplies: 49 })).toEqual([]);
    expect(earned({ voiceReplies: 50 })).toEqual(["voice_50"]);
    expect(earned({ npcsMet: 2 })).toEqual(["all_npcs"]);
    expect(earned({ npcsMet: 1 })).toEqual([]);
    expect(earned({ activeDays: 30 })).toEqual(["days_30"]);
    expect(earned({ longestGapDays: 7 })).toEqual(["comeback"]);
    expect(earned({ bestStreak: 7 })).toEqual(["streak_7"]);
  });
});
