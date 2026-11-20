// Revisão W2-07: casos de borda do motor v1 (D-49) que a proposta W2-01 define e o código precisa honrar.
import { describe, expect, it } from "vitest";
import { deriveProgress, planRun, rulesV1, runDegree, streak, xpFor, type RunSummary } from "../../src/engine";

const own = { input: "typed", accepted: true, usedModel: false } as const;
const a = (node: string, input: "voice" | "typed" | "tap" = "typed", scaffold: 0 | 1 | 2 | 3 = 0) => ({ node, input, scaffold });

describe("runDegree · bordas", () => {
  it("fecho 'não houve' (accepted:false, sem modelo) não prova estrela (§2.3: paga 0)", () => {
    const closing = { input: "typed", accepted: false, usedModel: false } as const;
    expect(runDegree({ answers: [a("n1", "typed", 2), a("n2", "typed", 2)], closing })).toBe(0);
  });
  it("rodada sem nenhuma resposta não vale ★★★", () => {
    expect(runDegree({ answers: [], closing: own })).toBe(0);
  });
  it("só toque nas respostas nunca dá estrela", () => {
    expect(runDegree({ answers: [a("n1", "tap"), a("n2", "tap")], closing: own })).toBe(0);
  });
});

describe("planRun · idempotência", () => {
  const base = { rules: rulesV1, runId: "r1", missionId: "bakery-01", mission: { kind: "encounter", level: "A1" }, day: "2026-11-20", answers: [a("n1"), a("n2")], closing: own, granted: new Set<string>() } as const;
  it("replanejar a mesma rodada com ela já no histórico não a conta como repetição", () => {
    const run = { id: "r1", missionId: "bakery-01", day: "2026-11-20", answers: base.answers, closing: own };
    const first = planRun({ ...base, history: [] });
    const again = planRun({ ...base, history: [run as RunSummary] });
    expect(again.xp).toBe(first.xp);
  });
});

describe("streak e progresso", () => {
  it("dia futuro (relógio do outro aparelho) não derruba a ofensiva de hoje", () => {
    expect(streak(["2026-11-19", "2026-11-20", "2030-01-01"], [], "2026-11-20").current).toBe(2);
  });
  it("evento com xp negativo (arquivo editado) não tira XP", () => {
    const p = deriveProgress([{ id: "x", at: 1, day: "2026-11-20", kind: "mission_completed", xp: -500, coins: 0 }], rulesV1, "2026-11-20");
    expect(p.xp).toBe(0);
  });
  it("toque no fecho + resposta-modelo não pagam mais que a frase própria", () => {
    const o = xpFor({ kind: "closing", input: "typed", accepted: true, usedModelAnswer: false, repeat: 0 });
    expect(xpFor({ kind: "closing", input: "typed", accepted: true, usedModelAnswer: true, repeat: 0 })).toBeLessThan(o);
  });
});
