// Apelido da pessoa nas falas das NPCs (D-53). O marcador `{player}` só existe como vocativo com vírgula
// antes (", {player}"): com apelido, vira ", Maria"; sem apelido, o trecho inteiro some e a frase continua
// natural ("Good morning, {player}!" → "Good morning!"). Onde o marcador pode aparecer é conferido em
// mission.check.ts (conferência 8).

/** O marcador, como fica no texto da missão. */
export const PLAYER_MARKER = "{player}";

/** A única forma aceita: vírgula, um espaço e o marcador. */
export const PLAYER_VOCATIVE = ", {player}";

const VOCATIVE_RE = /, \{player\}/g;

/** Qualquer coisa que pareça o marcador, mesmo escrita errada ("{Player}", "{ player }"). */
const MARKER_LIKE_RE = /\{\s*player\s*\}/i;

/** O texto tem algo parecido com o marcador (certo ou errado)? */
export function hasPlayerMarker(s: string): boolean {
  return MARKER_LIKE_RE.test(s);
}

/** Quantos vocativos na forma certa (", {player}") o texto tem. */
export function countPlayerVocatives(s: string): number {
  return s.match(VOCATIVE_RE)?.length ?? 0;
}

/**
 * O texto só usa o marcador na forma certa? Tirando os ", {player}", não pode sobrar chave nenhuma
 * (pega "{player}" sem vírgula, "{Player}", "{nome}", chave solta).
 */
export function isPlayerMarkerWellFormed(s: string): boolean {
  return !/[{}]/.test(s.replace(VOCATIVE_RE, ""));
}

/** Teto de letras do nome falado (D-53). Hífen e apóstrofo não contam. */
export const SPOKEN_NAME_MAX_LETTERS = 10;

/** Só letras (acento vale, junto ou separado), com no máximo um hífen ou apóstrofo no meio. */
const SPOKEN_WORD_RE = /^(?:\p{L}\p{M}*)+(?:['’-](?:\p{L}\p{M}*)+)?$/u;

function asSpokenName(word: string): string | null {
  if (!SPOKEN_WORD_RE.test(word)) return null;
  return (word.match(/\p{L}/gu)?.length ?? 0) <= SPOKEN_NAME_MAX_LETTERS ? word : null;
}

/**
 * O nome que a NPC fala (D-53, "Nome falado"): o apelido inteiro, se tiver até 10 letras e só letras
 * (acentos valem; no máximo um hífen ou apóstrofo no meio); senão, a primeira palavra pela mesma regra;
 * senão, `null` (a NPC não usa nome). O apelido do perfil continua como está.
 */
export function spokenName(nickname: string | null | undefined): string | null {
  const nick = (nickname ?? "").normalize("NFC").trim();
  if (!nick) return null;
  return asSpokenName(nick) ?? asSpokenName(nick.split(/\s+/u)[0]!);
}

/**
 * Troca o marcador pelo nome falado do apelido (`spokenName`). Sem nome falado (sem apelido, ou apelido
 * que não passa na regra), tira o trecho ", {player}" inteiro. O nome entra como texto puro (nada de `$&`
 * do replace); o app mostra o resultado sempre como texto.
 */
export function fillPlayer(text: string, nickname: string | null | undefined): string {
  const name = spokenName(nickname);
  return text.replace(VOCATIVE_RE, () => (name ? `, ${name}` : ""));
}
