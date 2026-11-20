// Registros (events, runs) e a sessão em andamento. Registro só se acrescenta: o mesmo id nunca é reescrito,
// então um prêmio de id determinístico ("ach:first_boss") gravado duas vezes vale uma só.
import type { GliforaDb } from "./db";
import type { Deps } from "./deps";
import { localDay } from "./day";
import { ensureMeta } from "./meta";
import { GameEvent, Run, SessionRow, SESSION_STATE_MAX_BYTES, type EventKind } from "./schema/records";

export class InvalidRecordError extends Error {
  constructor(readonly issues: string[]) {
    super(`Registro inválido: ${issues.join("; ")}`);
    this.name = "InvalidRecordError";
  }
}

function check<T>(parsed: { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }): T {
  if (parsed.success) return parsed.data;
  throw new InvalidRecordError(parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(registro)"}: ${i.message}`));
}

export interface EventInput {
  /** Só para prêmio único (determinístico); sem ele, vai um uuid. */
  id?: string;
  kind: EventKind;
  xp: number;
  coins: number;
  rules: number;
  target?: string;
  ref?: string;
  runId?: string;
}

/** Acrescenta ao livro-razão. Id já existente: devolve o que já estava lá, sem mudar nada. */
export async function appendEvent(db: GliforaDb, deps: Deps, input: EventInput): Promise<GameEvent> {
  const device = await ensureMeta(db, deps);
  const at = deps.now();
  const event = check(
    GameEvent.safeParse({ ...input, id: input.id ?? deps.uuid(), at, day: localDay(at), device, synced: 0 }),
  );
  return db.transaction("rw", db.events, async () => (await db.events.get(event.id)) ?? (await db.events.add(event).then(() => event)));
}

export type RunInput = Omit<Run, "id" | "at" | "day" | "device" | "synced"> & { id?: string };

/** Guarda o resumo de uma rodada concluída. Mesmo id: a primeira gravação fica. */
export async function appendRun(db: GliforaDb, deps: Deps, input: RunInput): Promise<Run> {
  const device = await ensureMeta(db, deps);
  const at = deps.now();
  const run = check(Run.safeParse({ ...input, id: input.id ?? deps.uuid(), at, day: localDay(at), device, synced: 0 }));
  return db.transaction("rw", db.runs, async () => (await db.runs.get(run.id)) ?? (await db.runs.add(run).then(() => run)));
}

/** Todos os eventos, do mais antigo ao mais novo. */
export function listEvents(db: GliforaDb): Promise<GameEvent[]> {
  return db.events.orderBy("at").toArray();
}

export function listRuns(db: GliforaDb): Promise<Run[]> {
  return db.runs.orderBy("day").toArray();
}

// ---------- Sessão em andamento (só local) ----------

export const SESSION_VERSION = 1;

export async function saveSession(
  db: GliforaDb,
  deps: Deps,
  input: { missionId: string; state: Record<string, unknown> },
): Promise<void> {
  if (new TextEncoder().encode(JSON.stringify(input.state)).length > SESSION_STATE_MAX_BYTES) {
    throw new InvalidRecordError([`state: maior que ${SESSION_STATE_MAX_BYTES / 1024} KB`]);
  }
  const row = check(SessionRow.safeParse({ id: "current", v: SESSION_VERSION, updatedAt: deps.now(), ...input }));
  await db.session.put(row);
}

/** A rodada em andamento, ou `null` (nada salvo, ou linha de um formato que este app não entende). */
export async function loadSession(db: GliforaDb): Promise<SessionRow | null> {
  const row = await db.session.get("current");
  if (!row) return null;
  const parsed = SessionRow.safeParse(row);
  return parsed.success && parsed.data.v <= SESSION_VERSION ? parsed.data : null;
}

export async function clearSession(db: GliforaDb): Promise<void> {
  await db.session.delete("current");
}
