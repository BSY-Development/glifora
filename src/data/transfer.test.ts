import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type GliforaDb } from "./db";
import type { Deps } from "./deps";
import { ensureMeta } from "./meta";
import { mergeDocs } from "./merge";
import { avatarRepo, prefsRepo, profileRepo } from "./repos";
import type { DocRow, SyncDoc } from "./schema/docs";
import { DOC_DATA_MAX_BYTES, EXPORT_VERSION, MAX_IMPORT_BYTES, buildExport, importExport, parseExport, serializeExport, wipeLocalData } from "./transfer";

let counter = 0;
const open: GliforaDb[] = [];
let clock = 1_700_000_000_000;
const deps = (id: string): Deps => ({ now: () => clock, uuid: () => id });

async function newDb(): Promise<GliforaDb> {
  const db = await openDb(`glifora-transfer-${(counter += 1)}`);
  open.push(db);
  return db;
}

beforeEach(() => {
  clock = 1_700_000_000_000;
});

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function exportText(db: GliforaDb): Promise<string> {
  return serializeExport(await buildExport(db, deps("dev-a"), "0.1.0"));
}

describe("exportar", () => {
  it("leva só docs e nunca meta, session nem key", async () => {
    const db = await newDb();
    await ensureMeta(db, deps("dev-a"));
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1 }, deps("dev-a"));
    const file = JSON.parse(await exportText(db)) as Record<string, unknown>;
    expect(Object.keys(file).sort()).toEqual(["app", "device", "docs", "events", "exportedAt", "format", "runs", "version"]);
    expect(file).toMatchObject({ format: "glifora-export", version: 1, device: "dev-a", app: "0.1.0", exportedAt: "2023-11-14T22:13:20.000Z" });
    const doc = (file["docs"] as Record<string, unknown>[])[0];
    expect(doc).toEqual({ id: "profile", v: 1, data: { nickname: "Ana", createdAt: 1 }, updatedAt: clock, deleted: 0 }); // sem dirty
  });
});

describe("importar", () => {
  it("ida e volta: o perfil de um aparelho aparece no outro", async () => {
    const a = await newDb();
    await profileRepo.save(a, { nickname: "Ana", createdAt: 1 }, deps("a"));
    await avatarRepo.save(a, { figure: "d" }, deps("a"));
    await prefsRepo.update(a, { uiLang: "en", sounds: false }, deps("a"));
    const text = await exportText(a);

    const b = await newDb();
    const result = await importExport(b, text);
    expect(result).toMatchObject({ ok: true, stats: { inserted: 3, replaced: 0, kept: 0 } });
    expect(await profileRepo.get(b)).toEqual({ nickname: "Ana", createdAt: 1 });
    expect(await avatarRepo.get(b)).toEqual({ figure: "d" });
    expect((await prefsRepo.get(b))?.uiLang).toBe("en");
    // O que chegou ainda não foi enviado à nuvem.
    expect((await b.docs.toArray()).every((row) => row.dirty === 1)).toBe(true);
    // ...e o arquivo do segundo aparelho é igual em conteúdo ao do primeiro.
    expect(JSON.parse(await exportText(b)).docs).toEqual(JSON.parse(text).docs);
  });

  it("importar duas vezes não muda nada", async () => {
    const a = await newDb();
    await profileRepo.save(a, { nickname: "Ana", createdAt: 1 }, deps("a"));
    const text = await exportText(a);
    const b = await newDb();
    await importExport(b, text);
    const before = await b.docs.toArray();
    await b.docs.update("profile", { dirty: 0 });
    const second = await importExport(b, text);
    expect(second).toMatchObject({ ok: true, stats: { inserted: 0, replaced: 0, kept: 1 } });
    expect(await b.docs.toArray()).toEqual(before.map((row) => ({ ...row, dirty: 0 })));
  });

  it("vence o updatedAt mais novo, nos dois sentidos", async () => {
    const a = await newDb();
    await profileRepo.save(a, { nickname: "Velho", createdAt: 1 }, deps("a"));
    const old = await exportText(a);
    clock += 60_000;
    await profileRepo.update(a, { nickname: "Novo" }, deps("a"));
    const recent = await exportText(a);

    const b = await newDb();
    await importExport(b, old);
    await importExport(b, recent);
    expect((await profileRepo.get(b))?.nickname).toBe("Novo");
    const again = await importExport(b, old); // arquivo velho não desfaz o novo
    expect(again).toMatchObject({ ok: true, stats: { replaced: 0, kept: 1 } });
    expect((await profileRepo.get(b))?.nickname).toBe("Novo");
  });

  it("não mexe em linha local de versão mais nova que o app", async () => {
    const a = await newDb();
    await profileRepo.save(a, { nickname: "Ana", createdAt: 1 }, deps("a"));
    const text = await exportText(a);
    const b = await newDb();
    await b.docs.put({ id: "profile", v: 2, data: { futuro: 1 }, updatedAt: 1, deleted: 0, dirty: 0 });
    await importExport(b, text);
    expect((await b.docs.get("profile"))?.data).toEqual({ futuro: 1 });
  });

  it("recusa arquivo de versão futura, com as duas versões na resposta", async () => {
    const db = await newDb();
    const future = JSON.stringify({ format: "glifora-export", version: EXPORT_VERSION + 1, docs: [], algo: "novo" });
    expect(await importExport(db, future)).toEqual({ ok: false, error: { code: "too_new", fileVersion: 2, appVersion: 1 } });
    expect(await db.docs.count()).toBe(0);
  });

  it.each([
    ["texto qualquer", "isto não é json", "not_json"],
    ["array", "[]", "wrong_format"],
    ["outro formato", JSON.stringify({ format: "outro", version: 1 }), "wrong_format"],
    ["versão inválida", JSON.stringify({ format: "glifora-export", version: "1" }), "wrong_format"],
    ["versão zero", JSON.stringify({ format: "glifora-export", version: 0 }), "wrong_format"],
  ])("recusa %s", (_name, text, code) => {
    expect(parseExport(text)).toMatchObject({ ok: false, error: { code } });
  });

  const base = { format: "glifora-export", version: 1, exportedAt: "2026-11-20T15:00:00Z", app: "0.1.0", device: "d", docs: [] };
  const doc = (over: Record<string, unknown>) => ({ id: "profile", v: 1, data: { nickname: "A", createdAt: 1 }, updatedAt: 1, deleted: 0, ...over });

  it("o arquivo mínimo válido passa", () => {
    expect(parseExport(JSON.stringify(base))).toEqual({ ok: true, docs: [], events: [], runs: [], unknownDocs: 0, futureTables: [] });
  });

  it("validação estrita: campo extra, tipo errado e dado do documento fora do schema dão erros copiáveis", () => {
    const cases: [string, unknown, string][] = [
      ["campo extra no topo", { ...base, extra: 1 }, "extra"],
      ["dirty no documento", { ...base, docs: [{ ...doc({}), dirty: 1 }] }, "docs[0]"],
      ["updatedAt não inteiro", { ...base, docs: [doc({ updatedAt: 1.5 })] }, "docs[0].updatedAt"],
      ["apelido grande demais", { ...base, docs: [doc({ data: { nickname: "x".repeat(99), createdAt: 1 } })] }, "docs[0].data.nickname"],
      ["campo extra no dado", { ...base, docs: [doc({ data: { nickname: "A", createdAt: 1, x: 1 } })] }, "docs[0].data"],
      ["data de exportação ruim", { ...base, exportedAt: "ontem" }, "exportedAt"],
    ];
    for (const [name, value, path] of cases) {
      const result = parseExport(JSON.stringify(value));
      expect(result, name).toMatchObject({ ok: false, error: { code: "invalid" } });
      if (!result.ok && result.error.code === "invalid") expect(result.error.issues.join("\n"), name).toContain(path);
    }
  });

  it("id desconhecido é pulado (e contado); tabelas futuras são avisadas", () => {
    const text = JSON.stringify({ ...base, cards: [{ qualquer: 1 }], docs: [doc({ id: "npc:en:tilda", data: { x: 1 } }), doc({})] });
    const result = parseExport(text);
    expect(result).toMatchObject({ ok: true, unknownDocs: 1, futureTables: ["cards"] });
    if (result.ok) expect(result.docs.map((d) => d.id)).toEqual(["profile"]);
  });

  it("F-W1-16-03: documento conhecido de versão mais nova recusa o arquivo todo, até apagado", async () => {
    for (const bad of [doc({ v: 2, data: { x: 1 } }), doc({ id: "prefs", v: 99, deleted: 1, data: {} })]) {
      const text = JSON.stringify({ ...base, docs: [doc({ id: "avatar", data: { figure: "a" } }), bad] });
      expect(parseExport(text)).toMatchObject({ ok: false, error: { code: "doc_too_new", docVersion: bad.v, appVersion: 1 } });
    }
    const db = await newDb();
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1 }, deps("a"));
    const text = JSON.stringify({ ...base, docs: [doc({ v: 2, data: { x: 1 }, updatedAt: clock + 1000 })] });
    expect(await importExport(db, text, clock)).toMatchObject({ ok: false, error: { code: "doc_too_new" } });
    expect((await profileRepo.get(db))?.nickname).toBe("Ana");
  });

  it("F-W1-16-04: lápide entra sem conteúdo; data acima de 32 KB recusa o arquivo, para todo documento", () => {
    const big = { x: "a".repeat(DOC_DATA_MAX_BYTES) };
    const tomb = parseExport(JSON.stringify({ ...base, docs: [doc({ deleted: 1, data: { x: [1, 2, 3] } })] }));
    expect(tomb).toMatchObject({ ok: true });
    if (tomb.ok) expect(tomb.docs[0]).toMatchObject({ deleted: 1, data: {} });
    for (const d of [doc({ deleted: 1, data: big }), doc({ data: big }), doc({ id: "npc:en:tilda", data: big })]) {
      const result = parseExport(JSON.stringify({ ...base, docs: [d] }));
      expect(result).toMatchObject({ ok: false, error: { code: "invalid" } });
      if (!result.ok && result.error.code === "invalid") expect(result.error.issues[0]).toContain("docs[0].data");
    }
  });

  it("a exportação de um estado no limite fica abaixo de 20 MB", async () => {
    const db = await newDb();
    const filler = { x: "a".repeat(DOC_DATA_MAX_BYTES - 10) };
    for (const id of ["profile", "prefs", "avatar"]) await db.docs.put({ id, v: 1, data: filler, updatedAt: 1, deleted: 0, dirty: 0 });
    expect((await exportText(db)).length).toBeLessThan(MAX_IMPORT_BYTES);
  });

  it("recusa arquivo acima do teto de 20 MB", () => {
    expect(parseExport("x".repeat(MAX_IMPORT_BYTES + 1))).toEqual({ ok: false, error: { code: "too_large", maxBytes: MAX_IMPORT_BYTES } });
  });

  it("um erro no meio não grava nada (tudo ou nada)", async () => {
    const db = await newDb();
    const text = JSON.stringify({ ...base, docs: [doc({}), doc({ id: "prefs", data: { uiLang: "xx" } })] });
    expect(await importExport(db, text)).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await db.docs.count()).toBe(0);
  });
});

describe("mescla (pura)", () => {
  const row = (over: Partial<DocRow>): DocRow => ({ id: "prefs", v: 1, data: { a: 1 }, updatedAt: 10, deleted: 0, dirty: 0, ...over });
  const sync = (over: Partial<SyncDoc>): SyncDoc => ({ id: "prefs", v: 1, data: { a: 1 }, updatedAt: 10, deleted: 0, ...over });

  it("empate de updatedAt com conteúdo diferente converge nos dois sentidos", () => {
    const x = { data: { a: 1 } };
    const y = { data: { a: 2 } };
    const first = mergeDocs([row(x)], [sync(y)]).writes[0] ?? row(x);
    const second = mergeDocs([row(y)], [sync(x)]).writes[0] ?? row(y);
    expect(first.data).toEqual(second.data);
  });

  it("apagado (lápide) mais novo vence e sobe como dirty", () => {
    const result = mergeDocs([row({})], [sync({ updatedAt: 20, deleted: 1, data: {} })]);
    expect(result.writes).toEqual([{ id: "prefs", v: 1, data: {}, updatedAt: 20, deleted: 1, dirty: 1 }]);
  });

  it("o mesmo id repetido na lista fica com o mais novo", () => {
    const result = mergeDocs([], [sync({ updatedAt: 5, data: { a: 5 } }), sync({ updatedAt: 9, data: { a: 9 } }), sync({ updatedAt: 7, data: { a: 7 } })]);
    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]?.data).toEqual({ a: 9 });
  });
});

describe("apagar os dados deste aparelho", () => {
  it("esvazia docs e meta", async () => {
    const db = await newDb();
    await ensureMeta(db, deps("dev-a"));
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1 }, deps("dev-a"));
    await wipeLocalData(db);
    expect(await db.docs.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
    expect(await ensureMeta(db, deps("dev-novo"))).toBe("dev-novo");
  });
});
