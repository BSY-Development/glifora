// Exportar, importar e apagar os dados deste aparelho (W1-09). A interface só chama estas funções.
import {
  MAX_IMPORT_BYTES,
  buildExport,
  importExport,
  markExported,
  serializeExport,
  wipeLocalData,
  type ImportResult,
} from "../data";
import { applyPrefsLocale } from "./locale";
import { getDb, getDeps } from "./storage";

export { MAX_IMPORT_BYTES };
export type { ImportError, ImportResult, ImportStats } from "../data";

export interface ExportedFile {
  filename: string;
  text: string;
  /** Quantos itens foram (documentos, eventos e rodadas). */
  count: number;
}

/** Gera o JSON para a pessoa baixar. Anota `lastExportAt` (só local). */
export async function exportData(): Promise<ExportedFile> {
  const db = getDb();
  const deps = getDeps();
  const file = await buildExport(db, deps, __APP_VERSION__);
  await markExported(db, deps.now());
  return {
    filename: `glifora-${file.exportedAt.slice(0, 10)}.json`,
    text: serializeExport(file),
    count: file.docs.length + file.events.length + file.runs.length,
  };
}

/** Valida e mescla. O arquivo grande demais é recusado pelo tamanho, antes de ler o texto. */
export async function importData(text: string): Promise<ImportResult> {
  const result = await importExport(getDb(), text);
  if (result.ok) await applyPrefsLocale();
  return result;
}

/** "Apagar os dados deste aparelho": banco, idioma escolhido e qualquer outra chave `glifora.*` do localStorage. */
export async function wipeThisDevice(): Promise<void> {
  await wipeLocalData(getDb());
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("glifora.")) localStorage.removeItem(key);
    }
  } catch {
    // localStorage bloqueado: não há o que apagar
  }
}
