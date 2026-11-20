// Repositório genérico de um documento (`docs`): ler, salvar e alterar, com validação Zod.
import type { z } from "zod";
import type { GliforaDb } from "./db";
import type { Deps } from "./deps";
import { stableStringify } from "./json";
import type { DocRow } from "./schema/docs";

/** O documento guardado é de uma versão mais nova que este app: não mexer, não sobrescrever (W0-03 §4.1). */
export class NewerDocError extends Error {
  constructor(
    readonly id: string,
    readonly found: number,
    readonly known: number,
  ) {
    super(`Documento "${id}" está na versão ${found}; este app entende até a ${known}.`);
    this.name = "NewerDocError";
  }
}

/** `update` num documento que ainda não existe e não tem valor padrão (o perfil). */
export class MissingDocError extends Error {
  constructor(readonly id: string) {
    super(`Documento "${id}" ainda não existe.`);
    this.name = "MissingDocError";
  }
}

export type DocRead<T> =
  | { status: "missing" }
  | { status: "ok"; data: T; row: DocRow }
  | { status: "newer"; row: DocRow }
  | { status: "invalid"; row: DocRow };

export interface DocRepo<T> {
  readonly id: string;
  read(db: GliforaDb): Promise<DocRead<T>>;
  /** O valor; o padrão do repositório se não existe; `null` se não há padrão, é de versão nova ou está estragado. */
  get(db: GliforaDb): Promise<T | null>;
  save(db: GliforaDb, data: T, deps: Deps): Promise<DocRow>;
  update(db: GliforaDb, patch: Partial<T>, deps: Deps): Promise<DocRow>;
}

export function defineDoc<T extends Record<string, unknown>>(
  id: string,
  version: number,
  schema: z.ZodType<T>,
  fallback: T | null,
): DocRepo<T> {
  async function read(db: GliforaDb): Promise<DocRead<T>> {
    const row = await db.docs.get(id);
    if (!row || row.deleted === 1) return { status: "missing" };
    if (row.v > version) return { status: "newer", row };
    const parsed = schema.safeParse(row.data);
    return parsed.success ? { status: "ok", data: parsed.data, row } : { status: "invalid", row };
  }

  async function get(db: GliforaDb): Promise<T | null> {
    const result = await read(db);
    if (result.status === "ok") return result.data;
    return result.status === "missing" ? fallback : null;
  }

  async function save(db: GliforaDb, data: T, deps: Deps): Promise<DocRow> {
    const valid = schema.parse(data);
    return db.transaction("rw", db.docs, async () => {
      const prev = await db.docs.get(id);
      if (prev && prev.v > version) throw new NewerDocError(id, prev.v, version);
      // Nada mudou: não gasta escrita nem marca para enviar (também evita laço com o espelho do idioma).
      if (prev && prev.deleted === 0 && stableStringify(prev.data) === stableStringify(valid)) return prev;
      const row: DocRow = {
        id,
        v: version,
        data: valid,
        // Sempre sobe, mesmo com o relógio parado ou atrasado.
        updatedAt: Math.max(deps.now(), (prev?.updatedAt ?? -1) + 1),
        deleted: 0,
        dirty: 1,
      };
      await db.docs.put(row);
      return row;
    });
  }

  async function update(db: GliforaDb, patch: Partial<T>, deps: Deps): Promise<DocRow> {
    return db.transaction("rw", db.docs, async () => {
      const result = await read(db);
      if (result.status === "newer") throw new NewerDocError(id, result.row.v, version);
      const current = result.status === "ok" ? result.data : fallback;
      if (current === null) throw new MissingDocError(id);
      return save(db, { ...current, ...patch }, deps);
    });
  }

  return { id, read, get, save, update };
}
