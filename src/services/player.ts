// Perfil, preferências e avatar: o que a interface lê e grava sobre a pessoa. A tela lê com
// `useLiveQuery(() => loadProfile())` (dexie-react-hooks) e reage sozinha a qualquer escrita.
import {
  DEFAULT_AVATAR,
  DEFAULT_PREFS,
  NICKNAME_MAX,
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
export { AVATAR_FIGURES, DEFAULT_AVATAR, DEFAULT_PREFS, NICKNAME_MAX, REDUCE_MOTION, TEXT_SIZES, type Avatar, type Prefs, type Profile } from "../data";

/** `null` na primeira visita (ainda não há perfil). */
export function loadProfile(): Promise<Profile | null> {
  return profileRepo.get(getDb());
}

export type NicknameCheck = { ok: true; value: string } | { ok: false; reason: "long" | "chars" };

/** Confere o apelido pelo schema: sem espaços nas pontas, até NICKNAME_MAX caracteres, sem < > nem caracteres de controle. Vazio vale. */
export function checkNickname(raw: string): NicknameCheck {
  const value = raw.trim();
  if (Array.from(value).length > NICKNAME_MAX) return { ok: false, reason: "long" };
  return Nickname.safeParse(value).success ? { ok: true, value } : { ok: false, reason: "chars" };
}

/** Cria o perfil (primeira visita) ou troca o apelido. Apelido opcional: vazio vale. Recusa o que o schema recusa. */
export async function saveNickname(nickname: string): Promise<void> {
  const check = checkNickname(nickname);
  if (!check.ok) throw new Error(`Apelido inválido (${check.reason}).`);
  const db = getDb();
  const deps = getDeps();
  await db.transaction("rw", db.docs, async () => {
    const current = await profileRepo.get(db);
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
