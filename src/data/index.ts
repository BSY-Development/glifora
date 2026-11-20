// Porta de entrada da camada de dados. Quem usa (services/) importa só daqui.
export { DB_NAME, GliforaDb, openDb } from "./db";
export { systemDeps, type Deps } from "./deps";
export { MissingDocError, NewerDocError, type DocRead, type DocRepo } from "./docRepo";
export { mergeDoc, mergeDocs, type MergeResult } from "./merge";
export { ensureMeta, getLastExportAt } from "./meta";
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
