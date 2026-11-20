// Interfaces de voz (W0-03 §2.5). Uma implementação hoje (Web Speech API); a do provedor (fase 6+) usa as mesmas.

export interface VoiceInfo {
  /** `voiceURI`: o que identifica a voz para o navegador. */
  id: string;
  name: string;
  lang: string;
  /** Voz do aparelho (funciona sem rede) ou de serviço. */
  local: boolean;
}

export type SpeakResult = "done" | "interrupted" | "unavailable";

export interface Tts {
  /** O navegador tem `speechSynthesis` (detecção por função). Pode ainda não haver voz para o idioma: veja `voicesFor`. */
  readonly supported: boolean;
  /** Vozes do idioma (`en`, `en-US`...). Assíncrono: as vozes chegam com `voiceschanged`. Vazio = sem voz para o idioma. */
  voicesFor(lang: string): Promise<VoiceInfo[]>;
  /** Fala o texto. `unavailable`: sem suporte, sem voz para o idioma ou o navegador barrou (nenhum toque ainda). */
  speak(text: string, options: { lang: string; rate?: number; pitch?: number }): Promise<SpeakResult>;
  cancel(): void;
}

export type SttFailReason = "no_speech" | "denied" | "network" | "lang" | "aborted" | "unsupported";

export interface SttAlternative {
  text: string;
  /** 0 a 1. Alguns navegadores devolvem 0 quando não sabem. */
  confidence: number;
}

export type SttResult = { ok: true; alternatives: SttAlternative[] } | { ok: false; reason: SttFailReason };

export interface Stt {
  /** O navegador tem `SpeechRecognition` ou `webkitSpeechRecognition` (detecção por função; Firefox não tem). */
  readonly supported: boolean;
  /**
   * Ouve uma frase. Só chame a partir de um toque, nunca automático. Até 5 alternativas, a melhor primeiro.
   * Cancelar o `signal` interrompe e devolve `aborted`.
   */
  listen(options: { lang: string; signal: AbortSignal; onInterim?: (text: string) => void }): Promise<SttResult>;
}

/** Número de alternativas pedidas ao reconhecedor: a tela tenta casar cada uma, na ordem. */
export const STT_MAX_ALTERNATIVES = 5;
