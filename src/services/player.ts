// Perfil, preferências e avatar: o que a interface lê e grava sobre a pessoa. A tela lê com
// `useLiveQuery(() => loadProfile())` (dexie-react-hooks) e reage sozinha a qualquer escrita.
import {
  DEFAULT_AVATAR,
  DEFAULT_PREFS,
  Nickname,
  avatarRepo,
  prefsRepo,
  profileRepo,
  type Avatar,
  type Prefs,
  type Profile,
} from "../data";
import { getDb, getDeps } from "./storage";

// A interface importa estes valores e tipos daqui, não de data/.
export { AVATAR_FIGURES, DEFAULT_AVATAR, DEFAULT_PREFS, REDUCE_MOTION, TEXT_SIZES, type Avatar, type Prefs, type Profile } from "../data";

/** `null` na primeira visita (ainda não há perfil). */
export function loadProfile(): Promise<Profile | null> {
  return profileRepo.get(getDb());
}

export type NicknameCheck = { ok: true; value: string } | { ok: false; reason: "long" | "chars" };

/** Teto do que a pessoa digita (D-55). O schema de leitura continua aceitando NICKNAME_MAX (perfis e arquivos antigos). */
export const NICKNAME_INPUT_MAX = 10;

/** Só letras (com acento), espaço, hífen e apóstrofo (reto ou curvo). */
const NICKNAME_INPUT_RE = /^[\p{L}\p{M}' ’-]+$/u;

/**
 * Confere o apelido digitado (D-55): até NICKNAME_INPUT_MAX caracteres, só letras, espaço, hífen e apóstrofo.
 * Vazio vale. `stored` é o apelido já salvo: se a pessoa não mexeu nele, vale a regra antiga do schema
 * (um apelido de até 30 caracteres continua até ser editado).
 */
export function checkNickname(raw: string, stored?: string | null): NicknameCheck {
  const value = raw.normalize("NFC").trim();
  if (stored != null && value !== "" && value === stored.normalize("NFC").trim()) {
    return Nickname.safeParse(value).success ? { ok: true, value } : { ok: false, reason: "chars" };
  }
  if (Array.from(value).length > NICKNAME_INPUT_MAX) return { ok: false, reason: "long" };
  if (value !== "" && !NICKNAME_INPUT_RE.test(value)) return { ok: false, reason: "chars" };
  return Nickname.safeParse(value).success ? { ok: true, value } : { ok: false, reason: "chars" };
}

/**
 * Cria o perfil (primeira visita) ou troca o apelido. Apelido opcional: vazio vale. Recusa o que a regra do campo recusa,
 * conferindo com o apelido já salvo: salvar sem editar um apelido antigo (até 30) continua valendo.
 */
export async function saveNickname(nickname: string): Promise<void> {
  const db = getDb();
  const deps = getDeps();
  await db.transaction("rw", db.docs, async () => {
    const current = await profileRepo.get(db);
    const check = checkNickname(nickname, current?.nickname);
    if (!check.ok) throw new Error(`Apelido inválido (${check.reason}).`);
    await profileRepo.save(db, { createdAt: current?.createdAt ?? deps.now(), nickname: check.value }, deps);
  });
}

/** Sempre devolve valores: os padrões se nada foi salvo (ou se o documento é de uma versão mais nova). */
export async function loadPrefs(): Promise<Prefs> {
  return (await prefsRepo.get(getDb())) ?? DEFAULT_PREFS;
}

/** As preferências guardadas, ou os padrões se ainda não existem; `null` se são de versão mais nova ou estão estragadas (não mexer). */
export async function readPrefsState(): Promise<Prefs | null> {
  const result = await prefsRepo.read(getDb());
  if (result.status === "ok") return result.data;
  return result.status === "missing" ? DEFAULT_PREFS : null;
}

export async function updatePrefs(patch: Partial<Prefs>): Promise<void> {
  await prefsRepo.update(getDb(), patch, getDeps());
}

export async function loadAvatar(): Promise<Avatar> {
  return (await avatarRepo.get(getDb())) ?? DEFAULT_AVATAR;
}

export async function updateAvatar(patch: Partial<Avatar>): Promise<void> {
  await avatarRepo.update(getDb(), patch, getDeps());
}
