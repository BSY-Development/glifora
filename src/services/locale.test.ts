// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, prefsRepo, type GliforaDb } from "../data";
import { getLocale, initLocale, setLocale, STORAGE_KEY } from "../i18n";
import { startLocaleMirror, syncLocaleOnBoot } from "./locale";
import { setStorageForTest } from "./storage";

let db: GliforaDb;
let counter = 0;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(async () => {
  localStorage.clear();
  initLocale(["en"]);
  db = await openDb(`glifora-locale-${(counter += 1)}`);
  setStorageForTest(db);
});

afterEach(async () => {
  setStorageForTest(null);
  db.close();
  await db.delete();
});

describe("idioma da interface espelhado em prefs", () => {
  it("escolher o idioma grava em localStorage e no doc prefs", async () => {
    startLocaleMirror();
    setLocale("pt-BR");
    await settle();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("pt-BR");
    expect((await prefsRepo.get(db))?.uiLang).toBe("pt-BR");
  });

  it("no boot, sem escolha local, vale o idioma das prefs (aparelho novo ou dados importados)", async () => {
    await prefsRepo.update(db, { uiLang: "pt-BR" }, { now: () => 1, uuid: () => "x" });
    await syncLocaleOnBoot();
    expect(getLocale()).toBe("pt-BR");
  });

  it("no boot, com escolha local diferente das prefs, vale a local e o espelho é corrigido", async () => {
    await prefsRepo.update(db, { uiLang: "pt-BR" }, { now: () => 1, uuid: () => "x" });
    setLocale("en");
    await syncLocaleOnBoot();
    expect(getLocale()).toBe("en");
    expect((await prefsRepo.get(db))?.uiLang).toBe("en");
  });

  it("sem escolha em lugar nenhum, o boot não grava nada", async () => {
    await syncLocaleOnBoot();
    expect(await db.docs.count()).toBe(0);
  });
});
