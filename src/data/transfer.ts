// Exportar e importar o progresso (formato `glifora-export`, W0-03 §4.1), mais "apagar os dados deste aparelho".
// Versão 1: só `docs`. Nunca leva `meta`, `session` nem key. Importar é mesclar (merge.ts).
// Os erros saem como códigos; quem mostra o texto (no idioma certo) é a interface.
import { z } from "zod";
import type { GliforaDb } from "./db";
import type { Deps } from "./deps";
import { mergeDocs } from "./merge";
import { ensureMeta, recordExport } from "./meta";
import { SyncDoc } from "./schema/docs";
import { DOC_KINDS, isDocKind } from "./schema/kinds";

export const EXPORT_FORMAT = "glifora-export";
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_DOCS = 10_000;
const MAX_ISSUES = 8;
const MAX_ISSUE_CHARS = 200;
/** Relógio no futuro além disso é recusado: um updatedAt absurdo venceria toda mescla e travaria o documento. */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

const short = (text: string): string => (text.length > MAX_ISSUE_CHARS ? `${text.slice(0, MAX_ISSUE_CHARS)}…` : text);

/** Tabelas que o formato prevê para as próximas fases. Chegam num arquivo v1, mas esta versão ainda não as lê. */
const FUTURE_TABLES = ["events", "runs", "cards", "reviews", "missions"] as const;

const ExportFileV1 = z.strictObject({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  app: z.string().max(40),
  device: z.string().min(1).max(80),
  docs: z.array(SyncDoc).max(MAX_DOCS),
  events: z.array(z.unknown()).optional(),
  runs: z.array(z.unknown()).optional(),
  cards: z.array(z.unknown()).optional(),
  reviews: z.array(z.unknown()).optional(),
  missions: z.array(z.unknown()).optional(),
});
export type ExportFile = z.infer<typeof ExportFileV1>;

// ---------- Exportar ----------

/** Monta o arquivo com os documentos deste aparelho (inclui os apagados: a mescla precisa deles). */
export async function buildExport(db: GliforaDb, deps: Deps, app: string): Promise<ExportFile> {
  const [device, rows] = await Promise.all([ensureMeta(db, deps), db.docs.toArray()]);
  const docs = rows
    .map(({ id, v, data, updatedAt, deleted }): SyncDoc => ({ id, v, data, updatedAt, deleted }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(deps.now()).toISOString(),
    app,
    device,
    docs,
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
  /** `issues` são linhas "caminho: problema", para a pessoa copiar e mostrar a quem ajuda. */
  | { code: "invalid"; issues: string[] };

export type ParseResult =
  | { ok: true; docs: SyncDoc[]; unknownDocs: number; futureTables: string[] }
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
  parsed.data.docs.forEach((doc, index) => {
    if (!isDocKind(doc.id)) {
      unknownDocs += 1; // de uma versão mais nova do app: não sabemos ler, não guardamos
      return;
    }
    if (doc.updatedAt > now + MAX_FUTURE_MS) {
      issues.push(short(`${pathOf(["docs", index, "updatedAt"])}: data no futuro (relógio do aparelho que exportou está errado)`));
      return;
    }
    const kind = DOC_KINDS[doc.id];
    // Versão mais nova que a conhecida: entra como está (o repositório avisa na hora de ler). Apagado: sem conteúdo a conferir.
    if (doc.deleted === 0 && doc.v <= kind.version) {
      const check = kind.schema.safeParse(doc.data);
      if (!check.success) {
        for (const issue of check.error.issues) issues.push(short(`${pathOf(["docs", index, "data", ...issue.path])}: ${issue.message}`));
        return;
      }
    }
    docs.push(doc);
  });
  if (issues.length > 0) return fail({ code: "invalid", issues: issues.slice(0, MAX_ISSUES) });

  const futureTables = FUTURE_TABLES.filter((name) => parsed.data[name] !== undefined && parsed.data[name].length > 0);
  return { ok: true, docs, unknownDocs, futureTables };
}

export interface ImportStats {
  inserted: number;
  replaced: number;
  kept: number;
  unknownDocs: number;
  futureTables: string[];
}

export type ImportResult = { ok: true; stats: ImportStats } | { ok: false; error: ImportError };

/** Valida e mescla. Tudo ou nada: a gravação é uma transação só. */
export async function importExport(db: GliforaDb, text: string, now: number = Date.now()): Promise<ImportResult> {
  const parsed = parseExport(text, now);
  if (!parsed.ok) return parsed;
  const merged = await db.transaction("rw", db.docs, async () => {
    const result = mergeDocs(await db.docs.toArray(), parsed.docs);
    if (result.writes.length > 0) await db.docs.bulkPut(result.writes);
    return result;
  });
  return {
    ok: true,
    stats: {
      inserted: merged.inserted,
      replaced: merged.replaced,
      kept: merged.kept,
      unknownDocs: parsed.unknownDocs,
      futureTables: parsed.futureTables,
    },
  };
}

// ---------- Apagar ----------

/** "Apagar os dados deste aparelho": esvazia `docs` e `meta` (o aparelho ganha outro id na próxima abertura). */
export async function wipeLocalData(db: GliforaDb): Promise<void> {
  await db.transaction("rw", db.docs, db.meta, async () => {
    await Promise.all([db.docs.clear(), db.meta.clear()]);
  });
}
