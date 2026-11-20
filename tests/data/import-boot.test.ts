// @vitest-environment jsdom
// Revisão W1-07/09: o que o importar e o boot fazem diante de arquivos hostis ou de versão futura.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildExport, importExport, openDb, parseExport, serializeExport, type GliforaDb } from "../../src/data";
import { STORAGE_KEY, initLocale } from "../../src/i18n";
import { boot } from "../../src/services/boot";
import { setStorageForTest } from "../../src/services/storage";

const fixture = readFileSync("tests/fixtures/export-v1.json", "utf8");
const deps = { now: () => 1_800_000_000_000, uuid: () => "dev-test" };
let db: GliforaDb;
let n = 0;

beforeEach(async () => {
  localStorage.clear();
  initLocale(["en"]);
  db = await openDb(`glifora-rev-${(n += 1)}`);
  setStorageForTest(db);
});
afterEach(async () => {
  setStorageForTest(null);
  db.close();
  await db.delete();
});

const withDoc = (doc: object, extra: object = {}) => JSON.stringify({ ...JSON.parse(fixture), ...extra, docs: [doc] });

describe("arquivo de exemplo", () => {
  it("é aceito e importar duas vezes não muda nada", async () => {
    const first = await importExport(db, fixture);
    expect(first).toMatchObject({ ok: true, stats: { inserted: 2 } });
    const snap = JSON.stringify(await db.docs.toArray());
    const second = await importExport(db, fixture);
    expect(second).toMatchObject({ ok: true, stats: { inserted: 0, replaced: 0, kept: 2 } });
    expect(JSON.stringify(await db.docs.toArray())).toBe(snap);
  });

  it("exportar o resultado nunca leva dirty, meta, session nem key", async () => {
    await importExport(db, fixture);
    const text = serializeExport(await buildExport(db, deps, "0.1.0"));
    expect(text).not.toMatch(/"dirty"|"meta"|"session"|"key"|deviceId|lastExportAt/);
  });
});

describe("arquivos hostis", () => {
  it("__proto__ como chave no data é descartado e não polui", async () => {
    const text = withDoc({ id: "profile", v: 1, data: JSON.parse('{"__proto__":{"x":1},"nickname":"a","createdAt":1}'), updatedAt: 1, deleted: 0 });
    const r = parseExport(text);
    expect(r.ok).toBe(true); // a chave __proto__ é descartada pelo Zod (não vira protótipo)
    if (r.ok) expect(Object.keys(r.docs[0]?.data ?? {}).sort()).toEqual(["createdAt", "nickname"]);
    expect(({} as Record<string, unknown>)["x"]).toBeUndefined();
  });

  it("id __proto__/constructor/toString é id desconhecido (pulado), sem lançar", () => {
    for (const id of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const r = parseExport(withDoc({ id, v: 1, data: {}, updatedAt: 1, deleted: 0 }));
      expect(r, id).toMatchObject({ ok: true, unknownDocs: 1, docs: [] });
    }
  });

  it("nickname com HTML fica como texto e acima do limite é recusado", () => {
    const ok = parseExport(withDoc({ id: "profile", v: 1, data: { nickname: "<img src=x onerror=1>", createdAt: 1 }, updatedAt: 1, deleted: 0 }));
    expect(ok.ok).toBe(true);
    const big = parseExport(withDoc({ id: "profile", v: 1, data: { nickname: "x".repeat(31), createdAt: 1 }, updatedAt: 1, deleted: 0 }));
    expect(big.ok).toBe(false);
  });

  it("versão futura do arquivo é recusada sem gravar nada", async () => {
    const r = await importExport(db, JSON.stringify({ ...JSON.parse(fixture), version: 2 }));
    expect(r).toEqual({ ok: false, error: { code: "too_new", fileVersion: 2, appVersion: 1 } });
    expect(await db.docs.count()).toBe(0);
  });

  it("arquivo com um doc inválido não grava os válidos (tudo ou nada)", async () => {
    const doc = JSON.parse(fixture).docs;
    const bad = { ...doc[1], data: { ...doc[1].data, uiLang: "xx" } };
    const r = await importExport(db, JSON.stringify({ ...JSON.parse(fixture), docs: [doc[0], bad] }));
    expect(r.ok).toBe(false);
    expect(await db.docs.count()).toBe(0);
  });

  it("mensagens de erro curtas: chave extra gigante não vira texto gigante", () => {
    const huge = "k".repeat(200_000);
    const r = parseExport(JSON.stringify({ ...JSON.parse(fixture), [huge]: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.code === "invalid") expect(r.error.issues.join("\n").length).toBeLessThan(2_000);
  });

  it("updatedAt no futuro distante é recusado e nada é gravado", async () => {
    const r = await importExport(db, withDoc({ id: "profile", v: 1, data: { nickname: "Ana", createdAt: 1 }, updatedAt: Number.MAX_SAFE_INTEGER, deleted: 0 }), deps.now());
    expect(r.ok).toBe(false);
    expect(await db.docs.count()).toBe(0);
  });

  it("apelido de 16 emojis (pontos de código) é aceito e um de 31 é recusado", () => {
    const mk = (n: number) => parseExport(withDoc({ id: "profile", v: 1, data: { nickname: "😀".repeat(n), createdAt: 1 }, updatedAt: 1, deleted: 0 }), deps.now());
    expect(mk(16).ok).toBe(true);
    expect(mk(31).ok).toBe(false);
  });
});

describe("boot com documento de versão futura", () => {
  it("prefs v2 (de um app mais novo) não derruba o boot nem é sobrescrito", async () => {
    localStorage.setItem(STORAGE_KEY, "pt-BR"); // pessoa já escolheu um idioma aqui
    await db.docs.put({ id: "prefs", v: 2, data: { novo: true }, updatedAt: 5, deleted: 0, dirty: 0 });
    await expect(boot()).resolves.toBeUndefined();
    expect((await db.docs.get("prefs"))?.v).toBe(2);
    expect((await db.docs.get("prefs"))?.data).toEqual({ novo: true });
  });

  it("prefs estragado (dado inválido) não derruba o boot", async () => {
    localStorage.setItem(STORAGE_KEY, "pt-BR");
    await db.docs.put({ id: "prefs", v: 1, data: { lixo: 1 }, updatedAt: 5, deleted: 0, dirty: 0 });
    await expect(boot()).resolves.toBeUndefined();
  });
});
