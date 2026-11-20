// W2-07: da rodada concluída aos eventos gravados, exportados e importados (D-49). Prêmio único não paga em dobro.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deriveProgress, planRun, rulesV1, type RunAnswer } from "../engine";
import { openDb, type GliforaDb } from "./db";
import type { Deps } from "./deps";
import { appendEvent, appendRun, listEvents, listRuns } from "./records";
import { buildExport, importExport, serializeExport } from "./transfer";

let counter = 0;
const open: GliforaDb[] = [];
const NOW = Date.UTC(2026, 10, 20, 15, 0, 0);
const deps = (id: string): Deps => ({ now: () => NOW, uuid: () => id });
const newDb = async (): Promise<GliforaDb> => {
  const db = await openDb(`glifora-rewards-${(counter += 1)}`);
  open.push(db);
  return db;
};
afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

const answers = (scaffold: 0 | 1 | 2): RunAnswer[] => Array.from({ length: 6 }, (_, i) => ({ node: `fala-${i}`, input: "voice" as const, scaffold }));
const closing = { input: "voice" as const, accepted: true, usedModel: false };

/** O que o player (W2-08) fará: planejar, gravar os eventos e a rodada. */
async function finishRun(db: GliforaDb, runId: string, day: string, scaffold: 0 | 1 | 2) {
  const history = (await listRuns(db)).map((r) => ({ id: r.id, missionId: r.missionId, day: r.day, answers: r.answers, closing: r.closing }));
  const granted = new Set((await listEvents(db)).map((e) => e.id));
  const plan = planRun({ rules: rulesV1, runId, missionId: "bakery-01", mission: { kind: "encounter", level: "A1" }, day, answers: answers(scaffold), closing, history, granted });
  for (const e of plan.events) await appendEvent(db, deps("dev"), { ...e, target: "en" });
  await appendRun(db, deps(runId), {
    id: runId, day, missionId: "bakery-01", level: (3 - scaffold) as 1 | 2 | 3, xp: plan.xp, rules: rulesV1.version, canDo: true,
    replies: { good: 6, flawed: 0, retry: 0 }, recasts: [], words: [], answers: answers(scaffold), closing: { text: "I'd like honey bread.", ...closing },
  });
  return plan;
}

const total = async (db: GliforaDb) => deriveProgress(await listEvents(db), rulesV1, "2026-11-22");

describe("rodada → livro-razão (W2-07)", () => {
  it("os três degraus em três dias pagam 136, 152 e 200 (e o evento da rodada leva o dia de início)", async () => {
    const db = await newDb();
    await finishRun(db, "r1", "2026-11-20", 2);
    expect((await total(db)).xp).toBe(136);
    await finishRun(db, "r2", "2026-11-21", 1);
    expect((await total(db)).xp).toBe(136 + 152);
    await finishRun(db, "r3", "2026-11-22", 0);
    expect((await total(db)).xp).toBe(136 + 152 + 200);
    expect((await listEvents(db)).find((e) => e.id === "run:r2")).toMatchObject({ day: "2026-11-21", kind: "mission_completed", ref: "bakery-01", runId: "r2" });
  });

  it("repetir no mesmo dia rende menos, e o prêmio único não volta", async () => {
    const db = await newDb();
    await finishRun(db, "r1", "2026-11-20", 2); // 136
    await finishRun(db, "r2", "2026-11-20", 2); // 6 × 4 + 12 = 36, sem prêmio
    expect((await total(db)).xp).toBe(136 + 36);
  });

  it("finalizar a mesma rodada duas vezes (mesmo runId) não paga em dobro", async () => {
    const db = await newDb();
    await finishRun(db, "r1", "2026-11-20", 2);
    await finishRun(db, "r1", "2026-11-20", 2);
    expect((await total(db)).xp).toBe(136);
    expect(await db.events.count()).toBe(3);
    expect(await db.runs.count()).toBe(1);
  });

  it("exportar e importar duas vezes a mesma rodada não paga em dobro; dois aparelhos que ganham a mesma estrela contam uma", async () => {
    const a = await newDb();
    const b = await newDb();
    await finishRun(a, "ra", "2026-11-20", 0); // ★★★ de primeira: first + 3 estrelas
    await finishRun(b, "rb", "2026-11-20", 0);
    const fromA = serializeExport(await buildExport(a, deps("dev-a"), "0.1.0"));
    const fromB = serializeExport(await buildExport(b, deps("dev-b"), "0.1.0"));

    const merged = await newDb();
    for (const text of [fromA, fromA, fromB, fromB]) expect(await importExport(merged, text)).toMatchObject({ ok: true });
    const ids = (await listEvents(merged)).map((e) => e.id).sort();
    expect(ids).toEqual(["first:bakery-01", "run:ra", "run:rb", "star:bakery-01:1", "star:bakery-01:2", "star:bakery-01:3"]);
    // 120 de conversa de cada rodada + 24 + 40 + 56 + 80 uma vez só
    expect((await total(merged)).xp).toBe(120 + 120 + 24 + 40 + 56 + 80);
  });

  it("um evento de rodada nunca passa dos tetos da importação (o arquivo exportado importa de volta)", async () => {
    const a = await newDb();
    await finishRun(a, "r1", "2026-11-20", 0);
    const b = await newDb();
    expect(await importExport(b, serializeExport(await buildExport(a, deps("dev-a"), "0.1.0")))).toMatchObject({ ok: true, stats: { recordsAdded: 6 } });
  });
});
