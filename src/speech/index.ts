// Voz: fala e escuta do navegador atrás de `Tts` e `Stt` (W0-03 §2.5). Quem usa (services/) importa só daqui.
import { createStt } from "./stt";
import { createTts } from "./tts";
import type { Stt, Tts } from "./types";

export { createStt, mapSttError, type SttOptions } from "./stt";
export { createTts } from "./tts";
export { STT_MAX_ALTERNATIVES } from "./types";
export type { SpeakResult, Stt, SttAlternative, SttFailReason, SttResult, Tts, VoiceInfo } from "./types";

/** Fala e escuta juntas: ouvir sempre cala a fala antes (o microfone não pode ouvir a própria NPC). */
export function createVoice(): { tts: Tts; stt: Stt } {
  const tts = createTts();
  return { tts, stt: createStt({ beforeListen: () => tts.cancel() }) };
}
