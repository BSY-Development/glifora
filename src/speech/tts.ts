// Fala (speechSynthesis). Tudo é procurado na hora de usar, nunca na importação: assim um dublê instalado
// antes da página (addInitScript, nos testes) vale, e o bundle não tem gancho de teste.
import type { SpeakResult, Tts, VoiceInfo } from "./types";

/** Quanto esperar o `voiceschanged` antes de dizer "sem voz" (no Chrome do Android a lista chega tarde). */
const VOICES_WAIT_MS = 2000;

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined" ? undefined : speechSynthesis;
}

const normal = (lang: string): string => lang.toLowerCase().replace("_", "-");
const primary = (lang: string): string => normal(lang).split("-")[0] ?? "";

function matching(voices: readonly SpeechSynthesisVoice[], lang: string): VoiceInfo[] {
  const wanted = normal(lang);
  const base = primary(lang);
  return voices
    .filter((v) => primary(v.lang) === base)
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, local: v.localService }))
    .sort((a, b) => {
      // a região pedida primeiro (en-US antes de en-GB), depois as vozes do aparelho; o resto em ordem estável
      const score = (v: VoiceInfo): number => (normal(v.lang) === wanted ? 0 : 2) + (v.local ? 0 : 1);
      return score(a) - score(b);
    });
}

function loadVoices(s: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const now = s.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      s.removeEventListener("voiceschanged", done);
      resolve(s.getVoices());
    };
    const timer = setTimeout(done, VOICES_WAIT_MS);
    s.addEventListener("voiceschanged", done);
  });
}

/** O navegador só deixa falar depois de um toque. Sem a API de ativação, tentamos e o erro diz o resto. */
function blockedForNoGesture(): boolean {
  return typeof navigator !== "undefined" && navigator.userActivation !== undefined && !navigator.userActivation.hasBeenActive;
}

export function createTts(): Tts {
  return {
    get supported() {
      return synth() !== undefined;
    },

    async voicesFor(lang) {
      const s = synth();
      if (!s) return [];
      return matching(await loadVoices(s), lang);
    },

    async speak(text, { lang, rate = 1, pitch = 1 }): Promise<SpeakResult> {
      const s = synth();
      if (!s || text.trim() === "" || blockedForNoGesture()) return "unavailable";
      const voices = await loadVoices(s);
      const list = matching(voices, lang);
      if (list.length === 0) return "unavailable";
      const voice = voices.find((v) => v.voiceURI === list[0]?.id);

      s.cancel(); // uma fala por vez
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;

      return new Promise<SpeakResult>((resolve) => {
        let settled = false;
        const finish = (result: SpeakResult, cancel = false): void => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          if (cancel) s.cancel();
          resolve(result);
        };
        // Chrome às vezes nunca dispara `end` (texto longo, aba em segundo plano): um relógio de segurança evita travar a tela.
        const watchdog = setTimeout(() => finish("done", true), Math.max(8000, (text.length * 180) / Math.max(rate, 0.1) + 4000));
        utterance.onend = () => finish("done");
        utterance.onerror = (event) => {
          // `interrupted` e `canceled`: outra fala ou `cancel()` cortou esta. Os demais (`not-allowed`, `synthesis-failed`...): sem áudio.
          finish(event.error === "interrupted" || event.error === "canceled" ? "interrupted" : "unavailable");
        };
        s.speak(utterance);
      });
    },

    cancel() {
      synth()?.cancel();
    },
  };
}
