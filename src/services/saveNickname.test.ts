// D-55: salvar sem editar um apelido antigo (11 a 30 caracteres) tem de funcionar; editar vale a regra nova.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, profileRepo, type GliforaDb } from "../data";
import { saveNickname } from "./player";
import { getDeps, setStorageForTest } from "./storage";

let db: GliforaDb;

beforeEach(async () => {
  db = await openDb("glifora-save-nickname-test");
  setStorageForTest(db);
});

afterEach(async () => {
  setStorageForTest(null);
  db.close();
  await db.delete();
});

describe("saveNickname", () => {
  it("apelido antigo de 20 caracteres, sem editar, salva", async () => {
    const legacy = "Maria da Silva Souza";
    await profileRepo.save(db, { nickname: legacy, createdAt: 1 }, getDeps());
    await expect(saveNickname(legacy)).resolves.toBeUndefined();
    expect((await profileRepo.get(db))?.nickname).toBe(legacy);
  });

  it("editado para algo fora da regra nova, recusa e não grava", async () => {
    await profileRepo.save(db, { nickname: "Maria da Silva Souza", createdAt: 1 }, getDeps());
    await expect(saveNickname("Maria da Silva Souza 2")).rejects.toThrow();
    await expect(saveNickname("Ana1")).rejects.toThrow();
    expect((await profileRepo.get(db))?.nickname).toBe("Maria da Silva Souza");
    await expect(saveNickname("Ana")).resolves.toBeUndefined();
    expect((await profileRepo.get(db))?.nickname).toBe("Ana");
  });

  it("primeira visita: 11 letras recusa; 10 salva", async () => {
    await expect(saveNickname("a".repeat(11))).rejects.toThrow();
    expect(await profileRepo.get(db)).toBeNull();
    await saveNickname("a".repeat(10));
    expect((await profileRepo.get(db))?.nickname).toBe("a".repeat(10));
  });
});
