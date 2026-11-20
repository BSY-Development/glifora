// Porta de entrada da camada de dados. Quem usa (services/) importa só daqui.
export { DB_NAME, GliforaDb, openDb } from "./db";
export { systemDeps, type Deps } from "./deps";
export { MissingDocError, NewerDocError, type DocRead, type DocRepo } from "./docRepo";
export { mergeDoc, mergeDocs, type MergeResult } from "./merge";
export { localDay } from "./day";
export { ensureMeta, getLastExportAt } from "./meta";
export {
  InvalidRecordError,
  SESSION_VERSION,
  appendEvent,
  appendRun,
  clearSession,
  listEvents,
  listRuns,
  loadSession,
  saveSession,
  type EventInput,
  type RunInput,
} from "./records";
export { avatarRepo, prefsRepo, profileRepo } from "./repos";
export {
  AVATAR_FIGURES,
  DEFAULT_AVATAR,
  DEFAULT_PREFS,
  NICKNAME_MAX,
  Nickname,
  REDUCE_MOTION,
  TEXT_SIZES,
  type Avatar,
  type DocRow,
  type Prefs,
  type Profile,
  type SyncDoc,
} from "./schema/docs";
export {
  EVENT_KINDS,
  EVENT_MAX_COINS,
  EVENT_MAX_XP,
  GameEvent,
  MAX_EVENTS,
  MAX_RUNS,
  RUN_LEVELS,
  Run,
  SessionRow,
  type EventKind,
} from "./schema/records";
export {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  MAX_IMPORT_BYTES,
  buildExport,
  importExport,
  markExported,
  parseExport,
  serializeExport,
  wipeLocalData,
  type ExportFile,
  type ImportError,
  type ImportResult,
  type ImportStats,
  type ParseResult,
} from "./transfer";
