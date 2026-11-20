// Exportar e importar o progresso (formato `glifora-export`, W0-03 §4.1), mais "apagar os dados deste aparelho".
// Versão 1: `docs`, `events` e `runs`. Nunca leva `meta`, `session` nem key. Importar é mesclar (merge.ts):
// documentos pelo `updatedAt`; registros (events, runs) por união de id, o que já existe aqui fica como está.
// Os erros saem como códigos; quem mostra o texto (no idioma certo) é a interface.
import { z } from "zod";
import type { GliforaDb } from "./db";
import type { Deps } from "./deps";
import { mergeDocs } from "./merge";
import { ensureMeta, recordExport } from "./meta";
import { SyncDoc } from "./schema/docs";
import { DOC_KINDS, isDocKind } from "./schema/kinds";
import { EventFile, MAX_EVENTS, MAX_RUNS, RunFile } from "./schema/records";

export const EXPORT_FORMAT = "glifora-export";
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
/** Teto do `data` de cada documento em JSON (o mesmo da W0-03 para o Supabase). */
export const DOC_DATA_MAX_BYTES = 32 * 1024;
const MAX_DOCS = 10_000;
const MAX_ISSUES = 8;
const MAX_ISSUE_CHARS = 200;
/** Relógio no futuro além disso é recusado: um updatedAt absurdo venceria toda mescla e travaria o documento. */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

const short = (text: string): string => (text.length > MAX_ISSUE_CHARS ? `${text.slice(0, MAX_ISSUE_CHARS)}…` : text);

/** Tabelas que o formato prevê para as próximas fases. Chegam num arquivo v1, mas esta versão ainda não as lê. */
const FUTURE_TABLES = ["cards", "reviews", "missions"] as const;

const ExportFileV1 = z.strictObject({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  app: z.string().max(40),
  device: z.string().min(1).max(80),
  docs: z.array(SyncDoc).max(MAX_DOCS),
  // Cada item é conferido um a um em parseExport, para o erro dizer qual item e qual campo.
  events: z.array(z.unknown()).max(MAX_EVENTS).optional(),
  runs: z.array(z.unknown()).max(MAX_RUNS).optional(),
  cards: z.array(z.unknown()).optional(),
  reviews: z.array(z.unknown()).optional(),
  missions: z.array(z.unknown()).optional(),
});
export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  app: string;
  device: string;
  docs: SyncDoc[];
  events: EventFile[];
  runs: RunFile[];
}

// ---------- Exportar ----------

const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Tira a marca local `synced`: ela não viaja. */
function withoutSynced<T extends { synced: 0 | 1 }>(row: T): Omit<T, "synced"> {
  const copy: Partial<T> = { ...row };
  delete copy.synced;
  return copy as Omit<T, "synced">;
}

/** Monta o arquivo com os documentos, eventos e rodadas deste aparelho (inclui os documentos apagados: a mescla precisa deles). */
export async function buildExport(db: GliforaDb, deps: Deps, app: string): Promise<ExportFile> {
  const [device, rows, eventRows, runRows] = await Promise.all([ensureMeta(db, deps), db.docs.toArray(), db.events.toArray(), db.runs.toArray()]);
  const docs = rows
    .map(({ id, v, data, updatedAt, deleted }): SyncDoc => ({ id, v, data, updatedAt, deleted }))
    .sort(byId);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(deps.now()).toISOString(),
    app,
    device,
    docs,
    events: eventRows.map(withoutSynced).sort(byId),
    runs: runRows.map(withoutSynced).sort(byId),
  };
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

export async function markExported(db: GliforaDb, at: number): Promise<void> {
  await recordExport(db, at);
}

// ---------- Importar ----------

export type ImportError =
  | { code: "too_large"; maxBytes: number }
  | { code: "not_json" }
  | { code: "wrong_format" }
  | { code: "too_new"; fileVersion: number; appVersion: number }
  /** Documento de um tipo que o app conhece, mas num formato mais novo que o dele: o arquivo todo é recusado. */
  | { code: "doc_too_new"; id: string; docVersion: number; appVersion: number }
  /** `issues` são linhas "caminho: problema", para a pessoa copiar e mostrar a quem ajuda. */
  | { code: "invalid"; issues: string[] };

export type ParseResult =
  | { ok: true; docs: SyncDoc[]; events: EventFile[]; runs: RunFile[]; unknownDocs: number; futureTables: string[] }
  | { ok: false; error: ImportError };

const fail = (error: ImportError): ParseResult => ({ ok: false, error });

function pathOf(path: PropertyKey[]): string {
  return path.map((part, i) => (typeof part === "number" ? `[${part}]` : i === 0 ? String(part) : `.${String(part)}`)).join("") || "(arquivo)";
}

/** Valida o texto de um arquivo exportado, estrito. Não grava nada. */
export function parseExport(text: string, now: number = Date.now()): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return fail({ code: "too_large", maxBytes: MAX_IMPORT_BYTES });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail({ code: "not_json" });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail({ code: "wrong_format" });
  const head = raw as Record<string, unknown>;
  if (head["format"] !== EXPORT_FORMAT) return fail({ code: "wrong_format" });
  const version = head["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return fail({ code: "wrong_format" });
  if (version > EXPORT_VERSION) return fail({ code: "too_new", fileVersion: version, appVersion: EXPORT_VERSION });

  const parsed = ExportFileV1.safeParse(raw);
  if (!parsed.success) {
    return fail({ code: "invalid", issues: parsed.error.issues.slice(0, MAX_ISSUES).map((i) => short(`${pathOf(i.path)}: ${i.message}`)) });
  }

  const docs: SyncDoc[] = [];
  const issues: string[] = [];
  let unknownDocs = 0;
  const encoder = new TextEncoder();
  for (const [index, source] of parsed.data.docs.entries()) {
    if (encoder.encode(JSON.stringify(source.data)).length > DOC_DATA_MAX_BYTES) {
      issues.push(short(`${pathOf(["docs", index, "data"])}: maior que ${DOC_DATA_MAX_BYTES / 1024} KB`));
      continue;
    }
    if (!isDocKind(source.id)) {
      unknownDocs += 1; // de uma versão mais nova do app: não sabemos ler, não guardamos
      continue;
    }
    const kind = DOC_KINDS[source.id];
    // Formato mais novo que o do app: recusa o arquivo todo (uma versão ilegível venceria a mescla e inutilizaria o perfil).
    if (source.v > kind.version) return fail({ code: "doc_too_new", id: source.id, docVersion: source.v, appVersion: kind.version });
    if (source.updatedAt > now + MAX_FUTURE_MS) {
      issues.push(short(`${pathOf(["docs", index, "updatedAt"])}: data no futuro (relógio do aparelho que exportou está errado)`));
      continue;
    }
    if (source.deleted === 1) {
      docs.push({ ...source, data: {} }); // lápide entra sem conteúdo
      continue;
    }
    const check = kind.schema.safeParse(source.data);
    if (!check.success) {
      for (const issue of check.error.issues) issues.push(short(`${pathOf(["docs", index, "data", ...issue.path])}: ${issue.message}`));
      continue;
    }
    docs.push(source);
  }

  const events = checkRecords("events", parsed.data.events ?? [], EventFile, now, issues);
  const runs = checkRecords("runs", parsed.data.runs ?? [], RunFile, now, issues);
  if (issues.length > 0) return fail({ code: "invalid", issues: issues.slice(0, MAX_ISSUES) });

  const futureTables = FUTURE_TABLES.filter((name) => parsed.data[name] !== undefined && parsed.data[name].length > 0);
  return { ok: true, docs, events, runs, unknownDocs, futureTables };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Confere cada registro (Zod estrito, `at` fora do futuro, `day` coerente com `at`). Os erros vão para `issues`. */
function checkRecords<T extends { at: number; day: string }>(
  table: "events" | "runs",
  items: readonly unknown[],
  schema: z.ZodType<T>,
  now: number,
  issues: string[],
): T[] {
  const valid: T[] = [];
  for (const [index, item] of items.entries()) {
    if (issues.length >= MAX_ISSUES) break; // arquivo cheio de erro: já dá para mostrar, sem varrer o resto
    const check = schema.safeParse(item);
    if (!check.success) {
      for (const issue of check.error.issues) issues.push(short(`${pathOf([table, index, ...issue.path])}: ${issue.message}`));
      continue;
    }
    const record = check.data;
    if (record.at > now + MAX_FUTURE_MS) {
      issues.push(short(`${pathOf([table, index, "at"])}: data no futuro (relógio do aparelho que exportou está errado)`));
      continue;
    }
    // O dia local de quem jogou difere do dia UTC por no máximo 14 h: mais de um dia de diferença é dado forjado.
    if (Math.abs(Date.parse(`${record.day}T00:00:00Z`) - Math.floor(record.at / DAY_MS) * DAY_MS) > DAY_MS) {
      issues.push(short(`${pathOf([table, index, "day"])}: o dia não combina com a hora do registro`));
      continue;
    }
    valid.push(record);
  }
  return valid;
}

export interface ImportStats {
  /** Documentos. */
  inserted: number;
  replaced: number;
  kept: number;
  /** Registros novos (events e runs): o que já existia aqui por id não conta. */
  recordsAdded: number;
  unknownDocs: number;
  futureTables: string[];
}

export type ImportResult = { ok: true; stats: ImportStats } | { ok: false; error: ImportError };

/** Registros do arquivo cujo id ainda não existe aqui (união de id; id repetido no arquivo vale o primeiro). Entram não enviados. */
async function newRecords<T extends { id: string }>(
  table: { bulkGet(ids: string[]): Promise<(unknown | undefined)[]> },
  incoming: readonly T[],
): Promise<(T & { synced: 0 })[]> {
  const unique = [...new Map([...incoming].reverse().map((r) => [r.id, r] as const)).values()].reverse();
  const have = await table.bulkGet(unique.map((r) => r.id));
  return unique.filter((_, i) => have[i] === undefined).map((r) => ({ ...r, synced: 0 as const }));
}

/** Valida e mescla. Tudo ou nada: a gravação é uma transação só. */
export async function importExport(db: GliforaDb, text: string, now: number = Date.now()): Promise<ImportResult> {
  const parsed = parseExport(text, now);
  if (!parsed.ok) return parsed;
  const merged = await db.transaction("rw", db.docs, db.events, db.runs, async () => {
    const result = mergeDocs(await db.docs.toArray(), parsed.docs);
    if (result.writes.length > 0) await db.docs.bulkPut(result.writes);
    const newEvents = await newRecords(db.events, parsed.events);
    const newRuns = await newRecords(db.runs, parsed.runs);
    if (newEvents.length > 0) await db.events.bulkAdd(newEvents);
    if (newRuns.length > 0) await db.runs.bulkAdd(newRuns);
    return { ...result, recordsAdded: newEvents.length + newRuns.length };
  });
  return {
    ok: true,
    stats: {
      inserted: merged.inserted,
      replaced: merged.replaced,
      kept: merged.kept,
      recordsAdded: merged.recordsAdded,
      unknownDocs: parsed.unknownDocs,
      futureTables: parsed.futureTables,
    },
  };
}

// ---------- Apagar ----------

/** "Apagar os dados deste aparelho": esvazia `docs`, `events`, `runs`, `session` e `meta` (o aparelho ganha outro id na próxima abertura). */
export async function wipeLocalData(db: GliforaDb): Promise<void> {
  await db.transaction("rw", [db.docs, db.meta, db.events, db.runs, db.session], async () => {
    await Promise.all([db.docs.clear(), db.meta.clear(), db.events.clear(), db.runs.clear(), db.session.clear()]);
  });
}
