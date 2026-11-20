// O banco aberto uma vez só (boot.ts), antes da primeira tela. Os outros services pegam o banco por aqui.
import { ensureMeta, openDb, systemDeps, type Deps, type GliforaDb } from "../data";

let db: GliforaDb | null = null;
let deps: Deps = systemDeps();

/** Abre o Dexie e cria o id do aparelho. Falha se o navegador bloquear o armazenamento. */
export async function openStorage(): Promise<void> {
  if (db) return;
  const opened = await openDb();
  await ensureMeta(opened, deps);
  db = opened;
}

export function getDb(): GliforaDb {
  if (!db) throw new Error("O armazenamento ainda não foi aberto (openStorage).");
  return db;
}

export function getDeps(): Deps {
  return deps;
}

/** Só para testes: usa outro banco (e, se vier, outro relógio e gerador de id). */
export function setStorageForTest(testDb: GliforaDb | null, testDeps?: Deps): void {
  db = testDb;
  deps = testDeps ?? systemDeps();
}
