import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type GliforaDb } from "./db";
import type { Deps } from "./deps";
import { MissingDocError, NewerDocError } from "./docRepo";
import { ensureMeta } from "./meta";
import { avatarRepo, prefsRepo, profileRepo } from "./repos";
import { DEFAULT_AVATAR, DEFAULT_PREFS } from "./schema/docs";

let counter = 0;
let db: GliforaDb;
let name: string;
let clock: number;
const deps: Deps = { now: () => clock, uuid: () => "00000000-0000-4000-8000-000000000001" };

beforeEach(async () => {
  name = `glifora-test-${(counter += 1)}`;
  clock = 1_000;
  db = await openDb(name);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe("perfil", () => {
  it("não existe na primeira visita", async () => {
    expect(await profileRepo.get(db)).toBeNull();
    expect((await profileRepo.read(db)).status).toBe("missing");
  });

  it("cria e lê", async () => {
    const row = await profileRepo.save(db, { nickname: "Ana", createdAt: 1_000 }, deps);
    expect(row).toMatchObject({ id: "profile", v: 1, updatedAt: 1_000, deleted: 0, dirty: 1 });
    expect(await profileRepo.get(db)).toEqual({ nickname: "Ana", createdAt: 1_000 });
  });

  it("alterar sobe o updatedAt e deixa dirty em 1", async () => {
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1_000 }, deps);
    await db.docs.update("profile", { dirty: 0 }); // como se já tivesse sido enviado
    clock = 5_000;
    const row = await profileRepo.update(db, { nickname: "Bia" }, deps);
    expect(row.updatedAt).toBe(5_000);
    expect(row.dirty).toBe(1);
    expect((await profileRepo.get(db))?.nickname).toBe("Bia");
  });

  it("updatedAt sobe mesmo com o relógio parado ou atrasado", async () => {
    await profileRepo.save(db, { nickname: "A", createdAt: 0 }, deps);
    clock = 10; // atrasou
    const row = await profileRepo.update(db, { nickname: "B" }, deps);
    expect(row.updatedAt).toBe(1_001);
  });

  it("gravar o mesmo valor não escreve nem marca para enviar", async () => {
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1_000 }, deps);
    await db.docs.update("profile", { dirty: 0 });
    clock = 9_000;
    const row = await profileRepo.update(db, { nickname: "Ana" }, deps);
    expect(row).toMatchObject({ updatedAt: 1_000, dirty: 0 });
  });

  it("update sem perfil falha com erro claro", async () => {
    await expect(profileRepo.update(db, { nickname: "x" }, deps)).rejects.toBeInstanceOf(MissingDocError);
  });

  it("recusa dado fora do schema (apelido grande, campo extra)", async () => {
    await expect(profileRepo.save(db, { nickname: "x".repeat(31), createdAt: 0 }, deps)).rejects.toThrow();
    await expect(profileRepo.save(db, { nickname: "x", createdAt: 0, extra: 1 } as never, deps)).rejects.toThrow();
  });

  it("sobrevive a fechar e reabrir o banco", async () => {
    await profileRepo.save(db, { nickname: "Ana", createdAt: 1_000 }, deps);
    db.close();
    db = await openDb(name);
    expect(await profileRepo.get(db)).toEqual({ nickname: "Ana", createdAt: 1_000 });
  });
});

describe("preferências e avatar", () => {
  it("devolvem o padrão enquanto não existem", async () => {
    expect(await prefsRepo.get(db)).toEqual(DEFAULT_PREFS);
    expect(await avatarRepo.get(db)).toEqual(DEFAULT_AVATAR);
    expect(await db.docs.count()).toBe(0); // ler não grava
  });

  it("update parcial parte do padrão e preserva o resto", async () => {
    await prefsRepo.update(db, { uiLang: "en" }, deps);
    clock = 2_000;
    await prefsRepo.update(db, { sounds: false }, deps);
    expect(await prefsRepo.get(db)).toEqual({ ...DEFAULT_PREFS, uiLang: "en", sounds: false });
    await avatarRepo.update(db, { figure: "c" }, deps);
    expect(await avatarRepo.get(db)).toEqual({ figure: "c" });
  });
});

describe("versão de linha mais nova que o app", () => {
  it("não lê, não sobrescreve e avisa", async () => {
    await db.docs.put({ id: "prefs", v: 2, data: { novo: true }, updatedAt: 1, deleted: 0, dirty: 0 });
    expect((await prefsRepo.read(db)).status).toBe("newer");
    expect(await prefsRepo.get(db)).toBeNull();
    await expect(prefsRepo.update(db, { sounds: false }, deps)).rejects.toBeInstanceOf(NewerDocError);
    await expect(prefsRepo.save(db, DEFAULT_PREFS, deps)).rejects.toBeInstanceOf(NewerDocError);
    expect((await db.docs.get("prefs"))?.data).toEqual({ novo: true });
  });
});

describe("meta", () => {
  it("o deviceId nasce uma vez e não muda", async () => {
    const ids = ["id-um", "id-dois"];
    const own: Deps = { now: () => 7, uuid: () => ids.shift() ?? "?" };
    expect(await ensureMeta(db, own)).toBe("id-um");
    expect(await ensureMeta(db, own)).toBe("id-um");
    expect((await db.meta.get("createdAt"))?.value).toBe(7);
  });
});
