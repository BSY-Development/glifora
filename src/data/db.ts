// Banco local (IndexedDB via Dexie). Versão 1: `meta` e `docs` (W0-03 §4.1). A key nunca entra em tabela nenhuma.
import Dexie, { type EntityTable } from "dexie";
import type { DocRow, MetaRow } from "./schema/docs";

export const DB_NAME = "glifora";

export class GliforaDb extends Dexie {
  meta!: EntityTable<MetaRow, "key">;
  docs!: EntityTable<DocRow, "id">;

  constructor(name: string = DB_NAME) {
    super(name);
    // Índices e tabelas: db.version(n).stores(...). `upgrade()` só quando precisar mexer em dado.
    this.version(1).stores({ meta: "key", docs: "id, dirty" });
  }
}

/** Abre o banco ou falha (modo privativo, armazenamento bloqueado). */
export async function openDb(name: string = DB_NAME): Promise<GliforaDb> {
  const db = new GliforaDb(name);
  try {
    await db.open();
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}
