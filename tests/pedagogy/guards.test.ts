// W2-11 — as 12 guardas pedagógicas (W0-03 §6 e W2-01 §7) contra o rules.v1 de verdade (src/engine).
// Por enumeração: toda combinação de entrada, degrau, repetição etc. Se alguém mexer nos números e quebrar um princípio, cai aqui.
// Dono: Revisor. Não duplica os números de src/engine/engine.test.ts: aqui só vale a PROPRIEDADE.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deriveProgress,
  helpOf,
  levelAt,
  masteryOf,
  planRun,
  rulesV1,
  runDegree,
  streak,
  xpFor,
  coinsFor,
  type Grade,
  type GradedBy,
  type InputMode,
  type RunAnswer,
  type RunSummary,
  type Scaffold,
  type XpSource,
} from "../../src/engine";
import { GameEvent } from "../../src/data";

const INPUTS: InputMode[] = ["voice", "typed", "tap"];
const SCAFFOLDS: Scaffold[] = [0, 1, 2, 3];
const REPEATS = [0, 1, 2, 3, 5, 9, 50];
const GRADES: Grade[] = ["again", "hard", "good", "easy"];
const GRADERS: GradedBy[] = ["local", "self", "ai"];
const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const KINDS = ["encounter", "boss"] as const;

/** Todas as fontes possíveis do motor, com todos os valores dos campos. */
function allSources(): XpSource[] {
  const out: XpSource[] = [];
  for (const input of INPUTS)
    for (const scaffold of SCAFFOLDS)
      for (const flawed of [false, true])
        for (const attempt of [1, 2, 3, 7])
          for (const repeat of REPEATS) out.push({ kind: "reply", input, scaffold, flawed, attempt, repeat });
  for (const input of INPUTS)
    for (const accepted of [false, true])
      for (const usedModelAnswer of [false, true])
        for (const repeat of REPEATS) out.push({ kind: "closing", input, accepted, usedModelAnswer, repeat });
  for (const missionKind of KINDS)
    for (const level of CEFR)
      for (const firstTime of [false, true])
        for (const mastery of [0, 1, 2, 3]) out.push({ kind: "mission", missionKind, level, firstTime, mastery });
  for (const input of INPUTS)
    for (const grade of GRADES)
      for (const gradedBy of GRADERS)
        for (const repeat of REPEATS) out.push({ kind: "spell", input, grade, gradedBy, repeat });
  out.push({ kind: "daily_complete" });
  for (const id of ["first_mission", "streak_7", "days_30", "desconhecida"]) out.push({ kind: "achievement", id });
  return out;
}
const SOURCES = allSources();
const reply = (input: InputMode, scaffold: Scaffold, repeat = 0, extra: Partial<{ flawed: boolean; attempt: number }> = {}): XpSource => ({
  kind: "reply",
  input,
  scaffold,
  flawed: false,
  attempt: 1,
  repeat,
  ...extra,
});

describe("guarda 1 · xpFor e coinsFor nunca negativos (nem NaN, nem fração)", () => {
  it("em todas as fontes e combinações", () => {
    expect(SOURCES.length).toBeGreaterThan(1000);
    for (const s of SOURCES) {
      for (const v of [xpFor(s), coinsFor(s)]) {
        expect(Number.isInteger(v) && v >= 0, JSON.stringify(s)).toBe(true);
      }
    }
  });
});

describe("guarda 2 · falar ou digitar vale mais que tocar; menos ajuda nunca vale menos", () => {
  it("no mesmo degrau e repetição, voz = digitado > toque", () => {
    for (const sc of SCAFFOLDS)
      for (const r of REPEATS) {
        expect(xpFor(reply("voice", sc, r))).toBe(xpFor(reply("typed", sc, r)));
        expect(xpFor(reply("voice", sc, r))).toBeGreaterThan(xpFor(reply("tap", sc, r)));
      }
  });
  it("o XP da resposta nunca cresce com o degrau de ajuda", () => {
    for (const input of INPUTS)
      for (const r of REPEATS)
        for (let sc = 1; sc < 4; sc++) expect(xpFor(reply(input, sc as Scaffold, r))).toBeLessThanOrEqual(xpFor(reply(input, (sc - 1) as Scaffold, r)));
  });
  it("fecho: frase própria ≥ resposta-modelo > toque, em toda repetição", () => {
    for (const r of REPEATS) {
      const own = xpFor({ kind: "closing", input: "typed", accepted: true, usedModelAnswer: false, repeat: r });
      const model = xpFor({ kind: "closing", input: "typed", accepted: false, usedModelAnswer: true, repeat: r });
      const tap = xpFor({ kind: "closing", input: "tap", accepted: true, usedModelAnswer: false, repeat: r });
      expect(own).toBeGreaterThanOrEqual(model);
      expect(model).toBeGreaterThan(tap);
    }
  });
  it("missão: estrela maior nunca vale menos, em nível e tipo algum", () => {
    for (const missionKind of KINDS)
      for (const level of CEFR)
        for (const firstTime of [false, true])
          for (let m = 1; m <= 3; m++) {
            const at = (mastery: number) => xpFor({ kind: "mission", missionKind, level, firstTime, mastery });
            expect(at(m)).toBeGreaterThanOrEqual(at(m - 1));
          }
  });
  it("feitiço: voz e digitado valem mais que toque, com qualquer avaliador e nota", () => {
    for (const gradedBy of GRADERS)
      for (const grade of GRADES)
        expect(xpFor({ kind: "spell", input: "voice", grade, gradedBy, repeat: 0 })).toBeGreaterThan(xpFor({ kind: "spell", input: "tap", grade, gradedBy, repeat: 0 }));
  });
});

describe("guarda 3 · flawed avança e não tira nada", () => {
  it("o XP da resposta com erro é idêntico ao sem erro, em todo caso", () => {
    for (const input of INPUTS)
      for (const sc of SCAFFOLDS)
        for (const r of REPEATS) expect(xpFor(reply(input, sc, r, { flawed: true }))).toBe(xpFor(reply(input, sc, r, { flawed: false })));
  });
  it("a rodada inteira paga o mesmo e dá a mesma estrela, aconteça o erro que acontecer (o motor nem recebe esse dado)", () => {
    const answers: RunAnswer[] = ["n1", "n2", "n3", "n4", "n5"].map((node) => ({ node, input: "voice", scaffold: 0 }));
    const plan = planRun({
      rules: rulesV1,
      runId: "r",
      missionId: "m",
      mission: { kind: "encounter", level: "A1" },
      day: "2026-11-20",
      answers,
      closing: { input: "typed", accepted: true, usedModel: false },
      history: [],
      granted: new Set(),
    });
    expect(plan.degree).toBe(3);
    // Nada em RunAnswer/RunClosing carrega "flawed": o erro não chega à conta.
    expect(Object.keys(answers[0]!).sort()).toEqual(["input", "node", "scaffold"]);
  });
});

describe("guarda 4 · a ofensiva nunca cai por erro", () => {
  it("streak só recebe dias: a assinatura não tem como receber acerto, erro ou XP", () => {
    expect(streak.length).toBe(3); // (dias, presentes, hoje)
    const src = readFileSync("src/engine/streak.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/\b(xp|flawed|error|wrong|accepted|grade|score)\b/i);
  });
  it("o histórico não reduz: acrescentar um dia jogado nunca baixa a atual nem a melhor (dias consecutivos)", () => {
    let days: string[] = [];
    let prev = streak(days, [], "2026-01-01");
    for (let d = 1; d <= 60; d++) {
      const day = `2026-${d <= 31 ? "01" : "02"}-${String(d <= 31 ? d : d - 31).padStart(2, "0")}`;
      days = [...days, day];
      const cur = streak(days, [], day);
      expect(cur.best).toBeGreaterThanOrEqual(prev.best);
      expect(cur.current).toBeGreaterThanOrEqual(1);
      prev = cur;
    }
  });
  it("a ofensiva não olha para o XP: eventos com XP 0 (rodada sem acerto) contam o dia do mesmo jeito", () => {
    const ev = (day: string, xp: number) => ({ id: `e${day}${xp}`, at: 1, day, kind: "mission_completed", xp, coins: 0 });
    const a = deriveProgress([ev("2026-11-19", 0), ev("2026-11-20", 0)], rulesV1, "2026-11-20");
    const b = deriveProgress([ev("2026-11-19", 500), ev("2026-11-20", 500)], rulesV1, "2026-11-20");
    expect(a.streak.current).toBe(b.streak.current);
  });
});

describe("guarda 5 · só purchase tem moeda negativa", () => {
  it("coinsFor é ≥ 0 em tudo; o saldo derivado nunca fica abaixo de zero", () => {
    for (const s of SOURCES) expect(coinsFor(s)).toBeGreaterThanOrEqual(0);
    const p = deriveProgress([{ id: "x", at: 1, day: "2026-11-20", kind: "purchase", xp: 0, coins: -999 }], rulesV1, "2026-11-20");
    expect(p.coins).toBe(0);
  });
  it("o schema do livro-razão recusa moeda negativa fora de purchase (importação hostil)", () => {
    const base = { id: "e1", at: 1, day: "2026-11-20", xp: 0, rules: 1, device: "d", synced: 0 };
    for (const kind of ["mission_completed", "boss_defeated", "mission_first", "mission_star", "achievement", "daily_completed", "spell_cast"]) {
      expect(GameEvent.safeParse({ ...base, kind, coins: -1 }).success, kind).toBe(false);
    }
    expect(GameEvent.safeParse({ ...base, kind: "purchase", coins: -5 }).success).toBe(true);
    expect(GameEvent.safeParse({ ...base, kind: "purchase", coins: 5 }).success).toBe(false);
  });
});

describe("guarda 6 · nenhuma fonte depende de tempo de resposta", () => {
  it("nenhuma fonte, resumo de rodada ou resposta tem campo de duração", () => {
    const timing = /\b(ms|millis|duration|elapsed|latency|speed|seconds?|timeTaken|responseTime|startedAt|endedAt)\b/i;
    const types = readFileSync("src/engine/types.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/**"))
      .join("\n");
    expect(types).not.toMatch(timing);
  });
  it("o motor (fora dos testes) não lê relógio: sem Date, performance, setTimeout", () => {
    const files = readdirSync("src/engine").filter((f) => /\.ts$/.test(f) && !/\.test\./.test(f));
    for (const f of files) {
      const code = readFileSync(`src/engine/${f}`, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, f).not.toMatch(/\b(Date\.now|new Date|performance\.now|setTimeout|setInterval)\b/);
    }
  });
  it("hard = good = easy em qualquer feitiço", () => {
    for (const input of INPUTS)
      for (const gradedBy of GRADERS)
        for (const r of REPEATS) {
          const x = (grade: Grade) => xpFor({ kind: "spell", input, grade, gradedBy, repeat: r });
          expect(x("hard")).toBe(x("good"));
          expect(x("good")).toBe(x("easy"));
        }
  });
});

describe("guarda 7 · repeat maior nunca dá mais XP, e nunca zera o que valia algo", () => {
  it("resposta, fecho e feitiço", () => {
    const rs = [0, 1, 2, 3, 4, 5, 9, 50];
    const fam = SOURCES.filter((s) => "repeat" in s && s.repeat === 0);
    expect(fam.length).toBeGreaterThan(100);
    for (const s of fam) {
      let prev = xpFor(s);
      for (const r of rs.slice(1)) {
        const cur = xpFor({ ...s, repeat: r } as XpSource);
        expect(cur, JSON.stringify(s) + " repeat " + r).toBeLessThanOrEqual(prev);
        if (xpFor(s) > 0) expect(cur, JSON.stringify(s) + " repeat " + r).toBeGreaterThan(0);
        prev = cur;
      }
    }
  });
  it("repetir hoje paga menos de verdade (cheio > ½ > ¼) numa resposta de voz sem ajuda", () => {
    expect(xpFor(reply("voice", 0, 0))).toBeGreaterThan(xpFor(reply("voice", 0, 1)));
    expect(xpFor(reply("voice", 0, 1))).toBeGreaterThan(xpFor(reply("voice", 0, 2)));
  });
});

describe("guarda 8 · attempt não muda o XP de reply", () => {
  it("1ª, 2ª ou 7ª tentativa pagam igual", () => {
    for (const input of INPUTS)
      for (const sc of SCAFFOLDS)
        for (const r of REPEATS) for (const attempt of [2, 3, 7, 100]) expect(xpFor(reply(input, sc, r, { attempt }))).toBe(xpFor(reply(input, sc, r, { attempt: 1 })));
  });
});

describe("guarda 9 · feitiço: a nota não muda o XP com gradedBy 'self'", () => {
  it("as quatro notas pagam igual no self", () => {
    for (const input of INPUTS)
      for (const r of REPEATS) {
        const v = GRADES.map((grade) => xpFor({ kind: "spell", input, grade, gradedBy: "self", repeat: r }));
        expect(new Set(v).size).toBe(1);
      }
  });
});

describe("guarda 10 · masteryOf nunca diminui quando se acrescenta uma rodada", () => {
  const A = (n: number, input: InputMode, scaffold: Scaffold): RunAnswer[] => Array.from({ length: n }, (_, i) => ({ node: `n${i}`, input, scaffold }));
  const closings = [
    undefined,
    { input: "tap", accepted: true, usedModel: false },
    { input: "typed", accepted: false, usedModel: false },
    { input: "typed", accepted: false, usedModel: true },
    { input: "voice", accepted: true, usedModel: false },
  ] as const;
  const runs: RunSummary[] = [];
  for (const n of [0, 1, 4, 5, 6, 10])
    for (const input of INPUTS)
      for (const sc of SCAFFOLDS)
        for (const closing of closings) runs.push({ missionId: "m", day: "2026-11-20", answers: A(n, input, sc), closing });
  it("qualquer rodada acrescentada, em qualquer ordem", () => {
    expect(runs.length).toBeGreaterThan(300);
    // Sequência de todas as rodadas: o domínio só sobe.
    let prev = 0;
    for (let i = 1; i <= runs.length; i++) {
      const cur = masteryOf(runs.slice(0, i));
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
    // E acrescentar uma rodada ruim a um histórico bom não o reduz.
    const best = runs.find((r) => runDegree(r) === 3)!;
    for (const r of runs) expect(masteryOf([best, r])).toBe(3);
  });
  it("o domínio é sempre 0 a 3", () => {
    for (const r of runs) expect([0, 1, 2, 3]).toContain(runDegree(r));
  });
});

describe("guarda 11 · rodada só de toque nunca ganha estrela", () => {
  it("em nenhum tamanho de rodada nem fecho, nem pelo planRun", () => {
    const closings = [undefined, { input: "tap", accepted: true, usedModel: false }, { input: "voice", accepted: true, usedModel: false }, { input: "typed", accepted: true, usedModel: false }] as const;
    for (const n of [1, 4, 5, 6, 10, 20])
      for (const sc of SCAFFOLDS)
        for (const closing of closings) {
          const answers: RunAnswer[] = Array.from({ length: n }, (_, i) => ({ node: `n${i}`, input: "tap", scaffold: sc }));
          expect(runDegree({ answers, closing })).toBe(0);
          const plan = planRun({ rules: rulesV1, runId: "r", missionId: "m", mission: { kind: "boss", level: "C2" }, day: "2026-11-20", answers, closing, history: [], granted: new Set() });
          expect(plan.events.filter((e) => e.kind === "mission_star")).toEqual([]);
        }
  });
  it("tocar não prova ajuda 'baixa': helpOf do toque é sempre 3", () => {
    for (const sc of SCAFFOLDS) expect(helpOf({ input: "tap", scaffold: sc })).toBe(3);
  });
});

describe("guarda 12 · streak dá o mesmo resultado para os mesmos dias, em qualquer ordem e com repetições", () => {
  it("embaralhando e repetindo", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-18", "2026-11-20"];
    const base = streak(days, [], "2026-11-20");
    const orders = [[...days].reverse(), [...days].sort(() => 0), [...days.slice(5), ...days.slice(0, 5)], [...days, ...days], [...days, days[3]!, days[0]!, days[9]!]];
    for (const o of orders) expect(streak(o, [], "2026-11-20")).toEqual(base);
    // permutação pseudo-aleatória fixa
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 25; i++) {
      const shuffled = [...days, ...days.filter(() => rnd() > 0.5)].sort(() => rnd() - 0.5);
      expect(streak(shuffled, [], "2026-11-20")).toEqual(base);
    }
  });
});

describe("extras · curva e unlocks nunca punem", () => {
  it("levelAt nunca desce com mais XP", () => {
    let prev = 1;
    for (let xp = 0; xp < 6000; xp += 7) {
      const l = levelAt(xp).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
});
