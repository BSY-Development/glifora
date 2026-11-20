// Banco local (IndexedDB via Dexie). Versão 1: `meta` e `docs`. Versão 2: `events`, `runs` e `session` (W0-03 §4.1).
// A key nunca entra em tabela nenhuma.
import Dexie, { type EntityTable } from "dexie";
import type { DocRow, MetaRow } from "./schema/docs";
import type { GameEvent, Run, SessionRow } from "./schema/records";

export const DB_NAME = "glifora";

export class GliforaDb extends Dexie {
  meta!: EntityTable<MetaRow, "key">;
  docs!: EntityTable<DocRow, "id">;
  events!: EntityTable<GameEvent, "id">;
  runs!: EntityTable<Run, "id">;
  session!: EntityTable<SessionRow, "id">;

  constructor(name: string = DB_NAME) {
    super(name);
    // Índices e tabelas: db.version(n).stores(...). `upgrade()` só quando precisar mexer em dado.
    // Cada versão repete só o que muda; o Dexie mantém as tabelas das versões anteriores como estavam.
    this.version(1).stores({ meta: "key", docs: "id, dirty" });
    // v2 só acrescenta tabelas: nada do que a v1 guardou é tocado (sem `upgrade`).
    this.version(2).stores({
      events: "id, at, day, kind, synced",
      runs: "id, missionId, day, synced",
      session: "id",
    });
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
