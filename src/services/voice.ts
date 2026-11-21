// Voz para a interface (W2-06). Junta `speech/` com o que é do app: o aviso de privacidade antes do 1º uso do
// microfone e o aviso (uma vez só) de que este navegador não ouve. A interface só fala com a voz por aqui.
import { createVoice, type SttResult, type Tts, type VoiceInfo } from "../speech";

export type { SpeakResult, SttAlternative, SttFailReason, SttResult, VoiceInfo } from "../speech";

/** Um par só por aba: o `Tts` e o `Stt` se conhecem (ouvir cala a fala). Criado no 1º uso. */
let voice: ReturnType<typeof createVoice> | null = null;
function get(): ReturnType<typeof createVoice> {
  return (voice ??= createVoice());
}

/** Idiomas que a tela de voz oferece. Só inglês por enquanto (D-40). */
export const VOICE_LANGS = ["en"] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];
/** Marca BCP 47 que vai para o navegador. */
const BCP47: Record<VoiceLang, string> = { en: "en-US" };
export const voiceTag = (lang: VoiceLang): string => BCP47[lang];

/**
 * Frase de teste, no idioma que se fala (conteúdo, não texto de interface: igual nas duas línguas da interface).
 * O teste das 44 frases (W2-16) lê as frases de content/eval/stt/; esta é só a do diagnóstico.
 */
const TEST_PHRASE: Record<VoiceLang, string> = { en: "Hello! I would like a coffee, please." };
export const testPhrase = (lang: VoiceLang): string => TEST_PHRASE[lang];

export const MIC_CONSENT_KEY = "glifora.voice.mic-consent";
export const NO_MIC_NOTICE_KEY = "glifora.voice.no-mic-notice";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // localStorage bloqueado: pergunta/avisa de novo, o que é o lado seguro
  }
}
function write(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // sem onde guardar: vale só nesta tela
  }
}

export interface VoiceSupport {
  /** Fala (`speechSynthesis`). */
  speak: boolean;
  /** Reconhecimento. Sem ele o microfone some e o texto é o caminho. */
  listen: boolean;
}

export function voiceSupport(): VoiceSupport {
  return { speak: get().tts.supported, listen: get().stt.supported };
}

// ---------- Privacidade: antes do 1º uso do microfone ----------

export const hasMicConsent = (): boolean => read(MIC_CONSENT_KEY);
export const giveMicConsent = (): void => write(MIC_CONSENT_KEY);

// ---------- "Este navegador não ouve": avisa uma vez ----------

/** Verdadeiro se o navegador não ouve e a pessoa ainda não viu o aviso. */
export const shouldShowNoMicNotice = (): boolean => !get().stt.supported && !read(NO_MIC_NOTICE_KEY);
export const dismissNoMicNotice = (): void => write(NO_MIC_NOTICE_KEY);

// ---------- Usar ----------

export const tts: Tts = {
  get supported() {
    return get().tts.supported;
  },
  voicesFor: (lang) => get().tts.voicesFor(lang),
  speak: (text, options) => get().tts.speak(text, options),
  cancel: () => get().tts.cancel(),
};

/** Vozes do idioma para a tela de diagnóstico. */
export const voicesFor = (lang: VoiceLang): Promise<VoiceInfo[]> => get().tts.voicesFor(voiceTag(lang));

/**
 * Ouve uma frase. Só abre o microfone depois do aviso de privacidade (`giveMicConsent`): sem ele devolve `denied`
 * sem tocar no microfone, então nenhum caminho de código ouve sem a pessoa saber para onde o áudio vai.
 */
export function listen(options: { lang: VoiceLang; signal: AbortSignal; stopSignal?: AbortSignal; onInterim?: (text: string) => void }): Promise<SttResult> {
  if (!hasMicConsent()) return Promise.resolve({ ok: false, reason: "denied" });
  const { lang, ...rest } = options;
  return get().stt.listen({ lang: voiceTag(lang), ...rest });
}
