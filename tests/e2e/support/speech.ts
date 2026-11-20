// Dublês de SpeechRecognition e speechSynthesis para o e2e (W2-11). Entram por page.addInitScript: nada disso existe no bundle.
// "ok": ouve o que o teste enfileirou (`say`); "denied": o navegador nega o microfone; "none": sem a API (o microfone some).
import type { Page } from "@playwright/test";

export type SpeechMode = "ok" | "denied" | "none";

export async function installSpeech(page: Page, mode: SpeechMode = "ok", opts: { consent?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ({ mode, consent }) => {
      const w = window as unknown as Record<string, unknown>;
      if (consent) {
        try {
          localStorage.setItem("glifora.voice.mic-consent", "1");
        } catch {
          // ignora
        }
      }
      // ---- fala ----
      const spoken: string[] = [];
      w["__spoken"] = spoken;
      const voices = [{ voiceURI: "fake-en", name: "Fake English", lang: "en-US", localService: true, default: true }];
      const synth = {
        getVoices: () => voices,
        speak(u: { text: string; onend?: (e: unknown) => void }) {
          spoken.push(u.text);
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
      // ---- escuta ----
      const stt = { queue: [] as string[][], starts: 0 };
      w["__stt"] = stt;
      if (mode === "none") {
        Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
        Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
        return;
      }
      class FakeRecognition {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: unknown) => void) | null = null;
        onerror: ((e: { error: string }) => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          stt.starts += 1;
          setTimeout(() => {
            if (mode === "denied") {
              this.onerror?.({ error: "not-allowed" });
              this.onend?.();
              return;
            }
            const next = stt.queue.shift();
            if (!next) {
              this.onerror?.({ error: "no-speech" });
              this.onend?.();
              return;
            }
            const result = Object.assign(
              next.map((transcript, i) => ({ transcript, confidence: 0.9 - i * 0.1 })),
              { isFinal: true },
            );
            this.onresult?.({ resultIndex: 0, results: [result] });
            this.onend?.();
          }, 20);
        }
        abort() {
          this.onend?.();
        }
      }
      Object.defineProperty(window, "SpeechRecognition", { value: FakeRecognition, configurable: true });
      Object.defineProperty(window, "webkitSpeechRecognition", { value: FakeRecognition, configurable: true });
    },
    { mode, consent: opts.consent ?? false },
  );
}

/** O que o reconhecedor vai "ouvir" no próximo toque no microfone (alternativas, da mais provável para a menos). */
export async function queueSpeech(page: Page, ...alternatives: string[]): Promise<void> {
  await page.evaluate((alts) => (window as unknown as { __stt: { queue: string[][] } }).__stt.queue.push(alts), alternatives);
}

export const spokenLines = (page: Page): Promise<string[]> => page.evaluate(() => [...((window as unknown as { __spoken?: string[] }).__spoken ?? [])]);
