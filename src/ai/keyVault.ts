// Cofre da key (D-56; W0-03 §2.7): o ÚNICO lugar que guarda e lê a key.
// Padrão: só na memória (some ao recarregar). Com "lembrar neste aparelho": localStorage, entrada `glifora.key.v1.<provedor>`.
// Fora do Dexie de propósito: exportar, importar e sincronizar não passam por aqui.
// A key nunca vai para log, URL, mensagem de erro, relatório nem exportação. Só ai/providers/* e ai/structured.ts leem a key (withKey).
import { AiError } from "./errors";

export type ProviderId = "gemini";
export const PROVIDERS: readonly ProviderId[] = ["gemini"];

const PREFIX = "glifora.key.v1.";
const memory = new Map<ProviderId, string>();

/**
 * Chaves de API de verdade: letras, números, ".", "-" e "_" (as keys novas do AI Studio têm ponto, como "AQ.…";
 * sem o ponto, a key do dono era recusada em 2026-11-20). O limite barra lixo e cabeçalho forjado (":" e quebra de linha não passam).
 */
const SHAPE = /^[A-Za-z0-9._-]{20,200}$/;

/** Tira todo espaço, quebra de linha e caractere invisível que o celular cola junto (a key não tem nenhum). */
export function cleanKey(key: string): string {
  return key.replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, "");
}

export function storageName(provider: ProviderId): string {
  return `${PREFIX}${provider}`;
}

function readStored(provider: ProviderId): string | null {
  try {
    const value = localStorage.getItem(storageName(provider));
    return value !== null && SHAPE.test(value) ? value : null;
  } catch {
    return null;
  }
}

function current(provider: ProviderId): string | null {
  return memory.get(provider) ?? readStored(provider);
}

export function isValidKeyShape(key: string): boolean {
  return SHAPE.test(cleanKey(key));
}

/**
 * Guarda a key. `remember: false` → só memória (e apaga uma cópia antiga do aparelho);
 * `remember: true` → localStorage. Devolve `false` se a key tem formato impossível ou se o aparelho não deixou guardar.
 */
export function setKey(provider: ProviderId, key: string, remember: boolean): boolean {
  const clean = cleanKey(key);
  if (!SHAPE.test(clean)) return false;
  memory.set(provider, clean);
  try {
    if (remember) localStorage.setItem(storageName(provider), clean);
    else localStorage.removeItem(storageName(provider));
  } catch {
    if (remember) {
      memory.delete(provider);
      return false;
    }
  }
  return true;
}

export function hasKey(provider: ProviderId): boolean {
  return current(provider) !== null;
}

/** Está guardada no aparelho (localStorage), e não só na memória? */
export function isRemembered(provider: ProviderId): boolean {
  return readStored(provider) !== null;
}

/** Só os 4 últimos caracteres, para a pessoa reconhecer a key. */
export function maskedKey(provider: ProviderId): string | null {
  const key = current(provider);
  return key === null ? null : `••••${key.slice(-4)}`;
}

export function clearKey(provider: ProviderId): void {
  memory.delete(provider);
  try {
    localStorage.removeItem(storageName(provider));
  } catch {
    // sem localStorage não há o que apagar lá
  }
}

/** Entrega a key a `fn` (só providers/ e structured.ts chamam; o lint barra o resto). Sem key: erro `no_key`. */
export async function withKey<T>(provider: ProviderId, fn: (key: string) => Promise<T>): Promise<T> {
  const key = current(provider);
  if (key === null) throw new AiError("no_key");
  return fn(key);
}
