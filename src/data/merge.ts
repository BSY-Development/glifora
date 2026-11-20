// Mescla de documentos: a mesma função serve ao importar e, na fase 5, à sincronização (D-41).
// Pura: sem banco, sem relógio. Regras:
//  - vence o `updatedAt` mais novo;
//  - empate com conteúdo diferente: vence o JSON maior, igual em todo aparelho, então todos convergem;
//  - linha local de versão mais nova que o app: fica como está (não mexer, W0-03 §4.1);
//  - o que vem de fora e vence entra com `dirty: 1` (ainda não foi enviado); `updatedAt` não muda,
//    por isso importar duas vezes não muda nada.
import { stableStringify } from "./json";
import type { DocRow, SyncDoc } from "./schema/docs";
import { knownVersion } from "./schema/kinds";

export type MergeOutcome = "inserted" | "replaced" | "kept";

function content(doc: SyncDoc): string {
  return stableStringify([doc.v, doc.deleted, doc.data]);
}

function incomingWins(local: DocRow, incoming: SyncDoc): boolean {
  const known = knownVersion(local.id);
  if (known !== undefined && local.v > known) return false;
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt;
  return content(incoming) > content(local);
}

export function mergeDoc(local: DocRow | undefined, incoming: SyncDoc): { outcome: MergeOutcome; row: DocRow } {
  if (!local) return { outcome: "inserted", row: { ...incoming, dirty: 1 } };
  if (!incomingWins(local, incoming)) return { outcome: "kept", row: local };
  return { outcome: "replaced", row: { ...incoming, dirty: 1 } };
}

export interface MergeResult {
  /** Linhas a gravar (só as que mudaram). */
  writes: DocRow[];
  inserted: number;
  replaced: number;
  kept: number;
}

/** Mescla uma lista (na ordem) sobre o estado local. O mesmo id repetido na lista também se resolve. */
export function mergeDocs(local: readonly DocRow[], incoming: readonly SyncDoc[]): MergeResult {
  const state = new Map(local.map((row) => [row.id, row] as const));
  const written = new Map<string, DocRow>();
  const result: MergeResult = { writes: [], inserted: 0, replaced: 0, kept: 0 };
  for (const doc of incoming) {
    const { outcome, row } = mergeDoc(state.get(doc.id), doc);
    result[outcome] += 1;
    if (outcome !== "kept") {
      state.set(doc.id, row);
      written.set(doc.id, row);
    }
  }
  result.writes = [...written.values()];
  return result;
}
