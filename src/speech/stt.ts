// Reconhecimento de fala (SpeechRecognition / webkitSpeechRecognition). Detecção por função, procurada na hora de usar.
import { STT_MAX_ALTERNATIVES, type Stt, type SttAlternative, type SttFailReason, type SttResult } from "./types";

// O TypeScript ainda não traz os tipos do reconhecimento de fala: só o que este arquivo usa.
interface RecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecognitionAlternative | undefined;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult | undefined };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const g = globalThis as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  return typeof ctor === "function" ? ctor : undefined;
}

/** Códigos de erro do navegador → os motivos do Glifora. */
export function mapSttError(error: string): SttFailReason {
  switch (error) {
    case "no-speech":
      return "no_speech";
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "network":
      return "network";
    case "language-not-supported":
      return "lang";
    case "aborted":
      return "aborted";
    default:
      return "unsupported"; // `audio-capture` (sem microfone), `bad-grammar` e o que vier depois
  }
}

function alternativesOf(result: RecognitionResult): SttAlternative[] {
  const seen = new Set<string>();
  const list: SttAlternative[] = [];
  for (let i = 0; i < Math.min(result.length, STT_MAX_ALTERNATIVES); i += 1) {
    const alt = result[i];
    const text = alt?.transcript.trim() ?? "";
    if (!alt || text === "" || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    const c = Number.isFinite(alt.confidence) ? alt.confidence : 0;
    list.push({ text, confidence: Math.min(1, Math.max(0, c)) });
  }
  return list;
}

export interface SttOptions {
  /** Roda antes de abrir o microfone: o app cala a NPC aqui para o microfone não ouvir a própria fala. */
  beforeListen?: () => void;
}

export function createStt({ beforeListen }: SttOptions = {}): Stt {
  return {
    get supported() {
      return recognitionCtor() !== undefined;
    },

    listen({ lang, signal, onInterim }): Promise<SttResult> {
      const Ctor = recognitionCtor();
      if (!Ctor) return Promise.resolve({ ok: false, reason: "unsupported" });
      if (signal.aborted) return Promise.resolve({ ok: false, reason: "aborted" });
      beforeListen?.();

      return new Promise<SttResult>((resolve) => {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = onInterim !== undefined;
        recognition.maxAlternatives = STT_MAX_ALTERNATIVES;

        let settled = false;
        let failure: SttFailReason | null = null;
        let final: SttAlternative[] = [];

        const onAbort = (): void => {
          try {
            recognition.abort();
          } catch {
            // já terminou
          }
          finish({ ok: false, reason: "aborted" });
        };
        const finish = (result: SttResult): void => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", onAbort);
          resolve(result);
        };
        signal.addEventListener("abort", onAbort, { once: true });

        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            if (result.isFinal) {
              if (final.length === 0) final = alternativesOf(result);
            } else {
              interim += result[0]?.transcript ?? "";
            }
          }
          if (interim !== "") onInterim?.(interim.trim());
        };
        recognition.onerror = (event) => {
          failure = mapSttError(event.error);
        };
        recognition.onend = () => {
          if (final.length > 0) finish({ ok: true, alternatives: final });
          else finish({ ok: false, reason: failure ?? "no_speech" });
        };

        try {
          recognition.start();
        } catch {
          finish({ ok: false, reason: "unsupported" });
        }
      });
    },
  };
}
