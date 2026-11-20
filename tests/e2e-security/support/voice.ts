// Dublê de voz do QA Tester (W2-13): reconhecedor roteirizado (lixo, erro, trava) e síntese que some, trava ou lança.
// Separado de tests/e2e/support/speech.ts (do Revisor) porque aqui o dublê é hostil. Dono: QA Tester.
import type { Page } from "@playwright/test";

export interface SttStep {
  /** Transcrições finais (alternativas). Texto montado no navegador a partir de `gen`, se houver. */
  alts?: string[];
  /** Gera uma transcrição de N letras "a" (para não pôr 1 MB no arquivo). */
  genLength?: number;
  confidence?: number[];
  interim?: string;
  /** Código de erro do navegador: not-allowed, audio-capture, network, no-speech... */
  error?: string;
  /** Nunca termina (só `abort()` encerra). */
  hang?: boolean;
  /** `start()` lança. */
  throwOnStart?: boolean;
}
export type TtsMode = "ok" | "absent" | "hang" | "throw" | "no-voices";

export async function installHostileVoice(page: Page, opts: { tts?: TtsMode; stt?: "ok" | "none"; consent?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ({ tts, stt, consent }) => {
      const w = window as unknown as Record<string, unknown>;
      if (consent) {
        try {
          localStorage.setItem("glifora.voice.mic-consent", "1");
        } catch {
          // ignora
        }
      }
      const spoken: string[] = [];
      w["__spoken"] = spoken;
      if (tts === "absent") {
        Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
        Object.defineProperty(window, "SpeechSynthesisUtterance", { value: undefined, configurable: true });
      } else {
        const voices = tts === "no-voices" ? [] : [{ voiceURI: "fake-en", name: "Fake English", lang: "en-US", localService: true, default: true }];
        const synth = {
          getVoices: () => voices,
          speak(u: { text: string; onend?: (e: unknown) => void }) {
            spoken.push(u.text);
            if (tts === "throw") throw new DOMException("speak falhou", "InvalidStateError");
            if (tts === "hang") return; // nunca termina nem erra
            setTimeout(() => u.onend?.({}), 5);
          },
          cancel() {},
          pause() {},
          resume() {},
          addEventListener() {},
          removeEventListener() {},
          speaking: false,
          pending: false,
          paused: false,
          onvoiceschanged: null,
        };
        Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
        w["SpeechSynthesisUtterance"] = class {
          text: string;
          lang = "";
          voice: unknown = null;
          rate = 1;
          pitch = 1;
          onend: ((e: unknown) => void) | null = null;
          onerror: ((e: unknown) => void) | null = null;
          constructor(text: string) {
            this.text = text;
          }
        };
      }
      const state = { script: [] as Record<string, unknown>[], starts: 0, aborts: 0, live: 0, maxLive: 0 };
      w["__stt"] = state;
      if (stt === "none") {
        Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
        Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
        return;
      }
      class Fake {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        private ended = false;
        private end() {
          if (this.ended) return;
          this.ended = true;
          state.live -= 1;
          this.onend?.();
        }
        start() {
          state.starts += 1;
          const step = (state.script.shift() ?? { error: "no-speech" }) as Record<string, unknown>;
          if (step["throwOnStart"]) throw new DOMException("já iniciado", "InvalidStateError");
          state.live += 1;
          state.maxLive = Math.max(state.maxLive, state.live);
          if (step["hang"]) return;
          setTimeout(() => {
            if (step["interim"] !== undefined) {
              const part = Object.assign([{ transcript: String(step["interim"]), confidence: 0.5 }], { isFinal: false });
              this.onresult?.({ resultIndex: 0, results: [part] });
            }
            if (step["error"]) {
              this.onerror?.({ error: String(step["error"]) });
              this.end();
              return;
            }
            let alts = (step["alts"] as string[] | undefined) ?? [];
            if (typeof step["genLength"] === "number") alts = [...alts, "a".repeat(step["genLength"])];
            const conf = (step["confidence"] as number[] | undefined) ?? [];
            const result = Object.assign(
              alts.map((transcript, i) => ({ transcript, confidence: conf[i] ?? 0.9 })),
              { isFinal: true },
            );
            this.onresult?.({ resultIndex: 0, results: [result] });
            this.end();
          }, 15);
        }
        abort() {
          state.aborts += 1;
          this.end();
        }
      }
      Object.defineProperty(window, "SpeechRecognition", { value: Fake, configurable: true });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: Fake, configurable: true });
    },
    { tts: opts.tts ?? "ok", stt: opts.stt ?? "ok", consent: opts.consent ?? true },
  );
}

export const script = async (page: Page, ...steps: SttStep[]): Promise<void> => {
  await page.evaluate((s) => void (window as unknown as { __stt: { script: unknown[] } }).__stt.script.push(...s), steps);
};

export const sttStats = (page: Page): Promise<{ starts: number; aborts: number; live: number; maxLive: number }> =>
  page.evaluate(() => {
    const s = (window as unknown as { __stt: { starts: number; aborts: number; live: number; maxLive: number } }).__stt;
    return { starts: s.starts, aborts: s.aborts, live: s.live, maxLive: s.maxLive };
  });
