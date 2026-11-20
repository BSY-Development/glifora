// Quais documentos existem, em que versão e com que formato. O id do documento é o nome do tipo.
import type { z } from "zod";
import { AvatarV1, PrefsV1, ProfileV1 } from "./docs";

export const DOC_KINDS = {
  profile: { version: 1, schema: ProfileV1 },
  prefs: { version: 1, schema: PrefsV1 },
  avatar: { version: 1, schema: AvatarV1 },
} as const satisfies Record<string, { version: number; schema: z.ZodType }>;

export type DocKind = keyof typeof DOC_KINDS;

export function isDocKind(id: string): id is DocKind {
  return Object.hasOwn(DOC_KINDS, id);
}

/** Versão que este app entende; `undefined` para um id que ele não conhece. */
export function knownVersion(id: string): number | undefined {
  return isDocKind(id) ? DOC_KINDS[id].version : undefined;
}
