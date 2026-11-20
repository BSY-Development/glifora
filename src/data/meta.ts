import type { GliforaDb } from "./db";
import type { Deps } from "./deps";

/** Cria, uma vez só, o id deste aparelho e a data de criação. Devolve o id. */
export async function ensureMeta(db: GliforaDb, deps: Deps): Promise<string> {
  return db.transaction("rw", db.meta, async () => {
    const existing = await db.meta.get("deviceId");
    if (existing && typeof existing.value === "string" && existing.value !== "") return existing.value;
    const deviceId = deps.uuid();
    await db.meta.put({ key: "deviceId", value: deviceId });
    if (!(await db.meta.get("createdAt"))) await db.meta.put({ key: "createdAt", value: deps.now() });
    return deviceId;
  });
}

export async function recordExport(db: GliforaDb, at: number): Promise<void> {
  await db.meta.put({ key: "lastExportAt", value: at });
}

export async function getLastExportAt(db: GliforaDb): Promise<number | null> {
  const row = await db.meta.get("lastExportAt");
  return typeof row?.value === "number" ? row.value : null;
}
