import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import fixtureV1 from "../../tests/fixtures/export-v1.json?raw";
import { openDb, type GliforaDb } from "./db";
import type { Deps } from "./deps";
import { appendEvent, appendRun, clearSession, InvalidRecordError, listEvents, listRuns, loadSession, saveSession, type RunInput } from "./records";
import { profileRepo } from "./repos";
import { EVENT_MAX_XP, MAX_EVENTS, MAX_RUNS, type EventFile, type RunFile } from "./schema/records";
import { buildExport, importExport, parseExport, serializeExport, wipeLocalData } from "./transfer";

let counter = 0;
const open: GliforaDb[] = [];
const NOW = Date.UTC(2026, 10, 20, 15, 0, 0);
const deps = (id: string, now: number = NOW): Deps => ({ now: () => now, uuid: () => id });
let seq = 0;
const seqDeps = (prefix: string): Deps => ({ now: () => NOW + seq, uuid: () => `${prefix}-${(seq += 1)}` });

async function newDb(): Promise<GliforaDb> {
  const db = await openDb(`glifora-records-${(counter += 1)}`);
  open.push(db);
  return db;
}

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

const run: RunInput = {
  missionId: "bakery-01",
  level: 1,
  xp: 40,
  rules: 1,
  canDo: true,
  replies: { good: 4, flawed: 1, retry: 0 },
  recasts: [{ pattern: "article-a-an", count: 1 }],
  words: ["bread", "please"],
  closing: { text: "I would like a bread, please.", accepted: true, usedModel: false },
};

describe("migração v1 → v2", () => {
  it("não perde nada: docs e meta seguem, tabelas novas nascem vazias", async () => {
    const name = `glifora-migr-${(counter += 1)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ meta: "key", docs: "id, dirty" });
    await v1.open();
    await v1.table("meta").put({ key: "deviceId", value: "dev-old" });
    await v1.table("docs").put({ id: "profile", v: 1, data: { nickname: "Ana", createdAt: 5 }, updatedAt: 7, deleted: 0, dirty: 1 });
    v1.close();

    const db = await openDb(name);
    open.push(db);
    expect(db.verno).toBe(2);
    expect(await db.meta.get("deviceId")).toEqual({ key: "deviceId", value: "dev-old" });
    expect(await db.docs.get("profile")).toEqual({ id: "profile", v: 1, data: { nickname: "Ana", createdAt: 5 }, updatedAt: 7, deleted: 0, dirty: 1 });
    expect(await db.docs.where("dirty").equals(1).count()).toBe(1); // o índice antigo continua
    expect(await db.events.count()).toBe(0);
    expect(await db.runs.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
  });

  it("o arquivo de exemplo v1 (Revisor) continua importando", async () => {
    const db = await newDb();
    expect(await importExport(db, fixtureV1)).toMatchObject({ ok: true, stats: { inserted: 2, recordsAdded: 0 } });
    expect((await profileRepo.get(db))?.nickname).toBe("Ana");
  });
});

describe("registros", () => {
  it("appendEvent grava com dia local, aparelho e synced 0; id repetido não reescreve", async () => {
    const db = await newDb();
    const first = await appendEvent(db, deps("dev-a"), { id: "ach:first_boss", kind: "achievement", xp: 50, coins: 5, rules: 1 });
    expect(first).toMatchObject({ id: "ach:first_boss", device: "dev-a", synced: 0, at: NOW });
    expect(first.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await appendEvent(db, deps("dev-a", NOW + 1000), { id: "ach:first_boss", kind: "achievement", xp: 999, coins: 0, rules: 1 });
    const all = await listEvents(db);
    expect(all).toHaveLength(1);
    expect(all[0]?.xp).toBe(50);
  });

  it("recusa XP negativo, moeda negativa fora de purchase e XP acima do teto", async () => {
    const db = await newDb();
    const d = seqDeps("e");
    await expect(appendEvent(db, d, { kind: "mission_completed", xp: -1, coins: 0, rules: 1 })).rejects.toBeInstanceOf(InvalidRecordError);
    await expect(appendEvent(db, d, { kind: "mission_completed", xp: 1, coins: -1, rules: 1 })).rejects.toBeInstanceOf(InvalidRecordError);
    await expect(appendEvent(db, d, { kind: "mission_completed", xp: EVENT_MAX_XP + 1, coins: 0, rules: 1 })).rejects.toBeInstanceOf(InvalidRecordError);
    await expect(appendEvent(db, d, { kind: "purchase", xp: 0, coins: -20, rules: 1 })).resolves.toMatchObject({ coins: -20 });
    expect(await db.events.count()).toBe(1);
  });

  it("appendRun e listRuns", async () => {
    const db = await newDb();
    await appendRun(db, deps("r1"), run);
    expect(await listRuns(db)).toHaveLength(1);
    await expect(appendRun(db, deps("r2"), { ...run, words: ["<b>x</b>"] })).rejects.toBeInstanceOf(InvalidRecordError);
  });
});

describe("sessão", () => {
  it("salva, lê, limpa; formato futuro e estado enorme não valem", async () => {
    const db = await newDb();
    expect(await loadSession(db)).toBeNull();
    await saveSession(db, deps("x"), { missionId: "bakery-01", state: { node: "n2" } });
    expect(await loadSession(db)).toMatchObject({ id: "current", missionId: "bakery-01", state: { node: "n2" } });
    await expect(saveSession(db, deps("x"), { missionId: "bakery-01", state: { big: "a".repeat(40_000) } })).rejects.toBeInstanceOf(InvalidRecordError);
    await db.session.put({ id: "current", v: 9, missionId: "bakery-01", updatedAt: 1, state: {} });
    expect(await loadSession(db)).toBeNull();
    await clearSession(db);
    expect(await db.session.count()).toBe(0);
  });

  it("nunca vai na exportação; apagar os dados também a limpa", async () => {
    const db = await newDb();
    await saveSession(db, deps("x"), { missionId: "bakery-01", state: { secret: "x" } });
    await appendEvent(db, deps("dev-a"), { kind: "mission_completed", xp: 10, coins: 1, rules: 1 });
    expect(serializeExport(await buildExport(db, deps("dev-a"), "0.1.0"))).not.toContain("secret");
    await wipeLocalData(db);
    expect(await db.session.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
    expect(await db.runs.count()).toBe(0);
  });
});

describe("exportar e importar events e runs", () => {
  it("ida e volta, sem `synced` no arquivo e com synced 0 no destino", async () => {
    const a = await newDb();
    const da = seqDeps("a");
    const ev = await appendEvent(a, da, { kind: "mission_completed", xp: 40, coins: 3, rules: 1, target: "en", ref: "bakery-01" });
    await appendEvent(a, da, { kind: "purchase", xp: 0, coins: -10, rules: 1 });
    await a.events.update(ev.id, { synced: 1 });
    await appendRun(a, da, run);
    const text = serializeExport(await buildExport(a, da, "0.1.0"));
    expect(text).not.toContain("synced");

    const b = await newDb();
    expect(await importExport(b, text)).toMatchObject({ ok: true, stats: { recordsAdded: 3 } });
    expect(await listEvents(b)).toEqual((await listEvents(a)).map((e) => ({ ...e, synced: 0 })));
    expect(await listRuns(b)).toHaveLength(1);
    expect((await b.runs.toArray())[0]).toMatchObject({ synced: 0, missionId: "bakery-01", closing: run.closing });
  });

  it("importar duas vezes não muda nada; o que já existe aqui não é reescrito", async () => {
    const a = await newDb();
    await appendEvent(a, seqDeps("a"), { id: "ach:x", kind: "achievement", xp: 10, coins: 0, rules: 1 });
    const text = serializeExport(await buildExport(a, deps("dev-a"), "0.1.0"));
    const b = await newDb();
    await b.events.add({ id: "ach:x", at: 1, day: "1970-01-01", kind: "achievement", xp: 99, coins: 0, rules: 1, device: "b", synced: 1 });
    expect(await importExport(b, text)).toMatchObject({ ok: true, stats: { recordsAdded: 0 } });
    expect(await b.events.get("ach:x")).toMatchObject({ xp: 99, synced: 1 });
    const c = await newDb();
    await importExport(c, text);
    const snapshot = JSON.stringify(await c.events.toArray());
    expect(await importExport(c, text)).toMatchObject({ ok: true, stats: { recordsAdded: 0 } });
    expect(JSON.stringify(await c.events.toArray())).toBe(snapshot);
  });

  it("união: aparelhos diferentes somam os registros, id repetido no arquivo vale o primeiro", async () => {
    const a = await newDb();
    const b = await newDb();
    await appendEvent(a, deps("dev-a"), { id: "e-a", kind: "mission_completed", xp: 10, coins: 1, rules: 1 });
    await appendEvent(b, deps("dev-b"), { id: "e-b", kind: "mission_completed", xp: 20, coins: 1, rules: 1 });
    await importExport(a, serializeExport(await buildExport(b, deps("dev-b"), "0.1.0")));
    expect((await listEvents(a)).map((e) => e.id).sort()).toEqual(["e-a", "e-b"]);

    const dup = { ...(await buildExport(b, deps("dev-b"), "0.1.0")) };
    const first = dup.events[0] as EventFile;
    dup.events = [first, { ...first, xp: 7_000 }];
    const c = await newDb();
    await importExport(c, serializeExport(dup));
    expect(await c.events.toArray()).toMatchObject([{ id: "e-b", xp: 20 }]);
  });
});

describe("importação hostil de events e runs", () => {
  const base = { format: "glifora-export", version: 1, exportedAt: "2026-11-20T15:00:00Z", app: "0.1.0", device: "d", docs: [] };
  const ev = (over: Record<string, unknown> = {}) => ({
    id: "e1", at: NOW, day: "2026-11-20", kind: "mission_completed", xp: 10, coins: 1, rules: 1, device: "d", ...over,
  });
  const rn = (over: Record<string, unknown> = {}): RunFile =>
    ({
      id: "r1", missionId: "bakery-01", at: NOW, day: "2026-11-20", level: 1, xp: 10, rules: 1, canDo: true,
      replies: { good: 1, flawed: 0, retry: 0 }, recasts: [], words: [], device: "d", ...over,
    }) as RunFile;

  it("um item bom passa", () => {
    expect(parseExport(JSON.stringify({ ...base, events: [ev()], runs: [rn()] }), NOW)).toMatchObject({ ok: true });
  });

  it.each<[string, unknown, string]>([
    ["xp negativo", ev({ xp: -5 }), "events[0].xp"],
    ["xp acima do teto", ev({ xp: EVENT_MAX_XP + 1 }), "events[0].xp"],
    ["xp fracionado", ev({ xp: 1.5 }), "events[0].xp"],
    ["moeda negativa fora de purchase", ev({ coins: -1 }), "events[0].coins"],
    ["purchase que ganha moeda", ev({ kind: "purchase", coins: 5 }), "events[0].coins"],
    ["rules fracionado", ev({ rules: 1.5 }), "events[0].rules"],
    ["rules zero", ev({ rules: 0 }), "events[0].rules"],
    ["kind desconhecido", ev({ kind: "free_money" }), "events[0].kind"],
    ["campo extra", ev({ extra: 1 }), "events[0]"],
    ["synced no arquivo", ev({ synced: 1 }), "events[0]"],
    ["id com HTML", ev({ id: "<img src=x>" }), "events[0].id"],
    ["dia que não existe", ev({ day: "2026-02-31" }), "events[0].day"],
    ["dia que não combina com a hora", ev({ day: "2026-11-10" }), "events[0].day"],
    ["hora no futuro", ev({ at: NOW + 3 * 86_400_000, day: "2026-11-23" }), "events[0].at"],
    ["não é objeto", "xp: 99999", "events[0]"],
  ])("recusa evento com %s", (_name, item, path) => {
    const result = parseExport(JSON.stringify({ ...base, events: [item] }), NOW);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
    if (!result.ok && result.error.code === "invalid") expect(result.error.issues.join("\n")).toContain(path);
  });

  it.each<[string, unknown, string]>([
    ["nível de domínio 4", rn({ level: 4 }), "runs[0].level"],
    ["xp negativo", rn({ xp: -1 }), "runs[0].xp"],
    ["palavra com HTML", rn({ words: ["<script>"] }), "runs[0].words[0]"],
    ["frase do fecho com HTML", rn({ closing: { text: "<b>oi</b>", accepted: true, usedModel: false } }), "runs[0].closing.text"],
    ["frase do fecho enorme", rn({ closing: { text: "a".repeat(301), accepted: true, usedModel: false } }), "runs[0].closing.text"],
    ["lista de recasts enorme", rn({ recasts: Array.from({ length: 21 }, (_, i) => ({ pattern: `p${i}`, count: 1 })) }), "runs[0].recasts"],
    ["campo extra", { ...rn(), extra: 1 }, "runs[0]"],
  ])("recusa rodada com %s", (_name, item, path) => {
    const result = parseExport(JSON.stringify({ ...base, runs: [item] }), NOW);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
    if (!result.ok && result.error.code === "invalid") expect(result.error.issues.join("\n")).toContain(path);
  });

  it("lista acima do teto recusa o arquivo todo", () => {
    const result = parseExport(JSON.stringify({ ...base, events: Array.from({ length: MAX_EVENTS + 1 }, () => 0) }), NOW);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("tudo ou nada: um evento ruim no meio não grava os bons nem os documentos", async () => {
    const db = await newDb();
    const doc = { id: "avatar", v: 1, data: { figure: "b" }, updatedAt: 5, deleted: 0 };
    const text = JSON.stringify({ ...base, docs: [doc], events: [ev(), ev({ id: "e2", xp: -1 })], runs: [rn()] });
    expect(await importExport(db, text, NOW)).toMatchObject({ ok: false });
    expect(await db.docs.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
    expect(await db.runs.count()).toBe(0);
  });

  it("muitos erros param cedo e o relatório fica curto", () => {
    const events = Array.from({ length: 5000 }, (_, i) => ev({ id: `e${i}`, xp: -1 }));
    const result = parseExport(JSON.stringify({ ...base, events }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "invalid") expect(result.error.issues.length).toBeLessThanOrEqual(8);
  });
});

describe("limites", () => {
  it("o estado realista no limite de itens cabe em 20 MB", async () => {
    const db = await newDb();
    const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const event = (i: number) => ({
      id: uuid(i),
      at: NOW,
      day: "2026-11-20",
      kind: "mission_completed" as const,
      xp: EVENT_MAX_XP,
      coins: 10_000,
      rules: 10_000,
      target: "en",
      ref: "bakery-01",
      runId: uuid(i),
      device: uuid(0),
      synced: 0 as const,
    });
    const fullRun = (i: number) => ({
      ...run,
      id: uuid(i),
      at: NOW,
      day: "2026-11-20",
      device: uuid(0),
      synced: 0 as const,
      recasts: Array.from({ length: 20 }, (_, n) => ({ pattern: `article-a-an-${n}`, count: 3 })),
      words: Array.from({ length: 30 }, (_, n) => `palavra${n}`),
      closing: { text: "a".repeat(300), accepted: true, usedModel: true },
    });
    await db.events.bulkAdd(Array.from({ length: MAX_EVENTS }, (_, i) => event(i)));
    await db.runs.bulkAdd(Array.from({ length: MAX_RUNS }, (_, i) => fullRun(i)));
    expect(serializeExport(await buildExport(db, deps("dev-a"), "0.1.0")).length).toBeLessThan(20 * 1024 * 1024);
  });
});
