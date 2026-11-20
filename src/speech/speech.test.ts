// Voz com dublês de speechSynthesis e SpeechRecognition (o mesmo que o Revisor faz no e2e com addInitScript).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStt, createTts, createVoice, mapSttError } from "./index";

type Handler = (event?: unknown) => void;
const g = globalThis as Record<string, unknown>;

afterEach(() => {
  vi.useRealTimers();
  for (const key of ["speechSynthesis", "SpeechSynthesisUtterance", "SpeechRecognition", "webkitSpeechRecognition"]) delete g[key];
});

// ---------- fala ----------

interface FakeVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}
const VOICES: FakeVoice[] = [
  { voiceURI: "de", name: "Hans", lang: "de-DE", localService: true },
  { voiceURI: "gb-net", name: "Net GB", lang: "en-GB", localService: false },
  { voiceURI: "gb", name: "Daniel", lang: "en-GB", localService: true },
  { voiceURI: "us", name: "Samantha", lang: "en_US", localService: true },
];

function installSynth(options: { voices?: FakeVoice[]; lateVoices?: FakeVoice[]; behavior?: "end" | "silent" | "error:not-allowed" | "error:interrupted" } = {}) {
  const listeners = new Map<string, Set<Handler>>();
  let voices = options.voices ?? VOICES;
  const spoken: { text: string; lang: string; voice: unknown; rate: number }[] = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: (name: string, fn: Handler) => (listeners.get(name) ?? listeners.set(name, new Set()).get(name))?.add(fn),
    removeEventListener: (name: string, fn: Handler) => listeners.get(name)?.delete(fn),
    cancel: vi.fn(),
    speak: (u: { text: string; lang: string; voice: unknown; rate: number; onend?: Handler; onerror?: Handler }) => {
      spoken.push({ text: u.text, lang: u.lang, voice: u.voice, rate: u.rate });
      const b = options.behavior ?? "end";
      if (b === "end") queueMicrotask(() => u.onend?.());
      else if (b.startsWith("error:")) queueMicrotask(() => u.onerror?.({ error: b.slice(6) }));
    },
  };
  g["speechSynthesis"] = synth;
  g["SpeechSynthesisUtterance"] = class {
    onend?: Handler;
    onerror?: Handler;
    lang = "";
    voice: unknown = null;
    rate = 1;
    pitch = 1;
    constructor(readonly text: string) {}
  };
  const arrive = () => {
    voices = options.lateVoices ?? voices;
    for (const fn of listeners.get("voiceschanged") ?? []) fn();
  };
  return { synth, spoken, arrive };
}

describe("Tts", () => {
  it("sem speechSynthesis: não há suporte, nem vozes, e falar é `unavailable`", async () => {
    const tts = createTts();
    expect(tts.supported).toBe(false);
    expect(await tts.voicesFor("en")).toEqual([]);
    expect(await tts.speak("hi", { lang: "en-US" })).toBe("unavailable");
    expect(() => tts.cancel()).not.toThrow();
  });

  it("detecta por função, na hora de usar (dublê instalado depois de criar vale)", () => {
    const tts = createTts();
    expect(tts.supported).toBe(false);
    installSynth();
    expect(tts.supported).toBe(true);
  });

  it("voicesFor filtra pelo idioma, põe a região pedida e as vozes locais primeiro", async () => {
    installSynth();
    const tts = createTts();
    expect((await tts.voicesFor("en-US")).map((v) => v.id)).toEqual(["us", "gb", "gb-net"]);
    expect((await tts.voicesFor("en-GB")).map((v) => v.id)).toEqual(["gb", "gb-net", "us"]);
    expect(await tts.voicesFor("fr")).toEqual([]);
  });

  it("voicesFor espera o voiceschanged quando as vozes chegam depois", async () => {
    const fake = installSynth({ voices: [], lateVoices: VOICES });
    const tts = createTts();
    const pending = tts.voicesFor("en");
    fake.arrive();
    expect((await pending).length).toBe(3);
  });

  it("sem voz nenhuma, desiste depois da espera (não trava)", async () => {
    vi.useFakeTimers();
    installSynth({ voices: [] });
    const tts = createTts();
    const pending = tts.voicesFor("en");
    await vi.advanceTimersByTimeAsync(2500);
    expect(await pending).toEqual([]);
  });

  it("speak usa a melhor voz, o idioma e a velocidade; termina em `done`", async () => {
    const fake = installSynth();
    const result = await createTts().speak("Hello", { lang: "en-US", rate: 0.8 });
    expect(result).toBe("done");
    expect(fake.spoken).toEqual([{ text: "Hello", lang: "en-US", voice: VOICES[3], rate: 0.8 }]);
    expect(fake.synth.cancel).toHaveBeenCalled(); // uma fala por vez
  });

  it("sem voz para o idioma: `unavailable` e nada é falado", async () => {
    const fake = installSynth();
    expect(await createTts().speak("Bonjour", { lang: "fr-FR" })).toBe("unavailable");
    expect(fake.spoken).toEqual([]);
  });

  it("interrompida: `interrupted`; barrada pelo navegador: `unavailable`", async () => {
    installSynth({ behavior: "error:interrupted" });
    expect(await createTts().speak("Hello", { lang: "en" })).toBe("interrupted");
    installSynth({ behavior: "error:not-allowed" });
    expect(await createTts().speak("Hello", { lang: "en" })).toBe("unavailable");
  });

  it("antes de qualquer toque (userActivation) nem tenta falar", async () => {
    const fake = installSynth();
    Object.defineProperty(navigator, "userActivation", { value: { hasBeenActive: false }, configurable: true });
    try {
      expect(await createTts().speak("Hello", { lang: "en" })).toBe("unavailable");
      expect(fake.spoken).toEqual([]);
    } finally {
      Reflect.deleteProperty(navigator, "userActivation");
    }
  });

  it("se o `end` nunca chega, o relógio de segurança solta a tela", async () => {
    vi.useFakeTimers();
    const fake = installSynth({ behavior: "silent" });
    const pending = createTts().speak("Hello", { lang: "en" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toBe("done");
    expect(fake.synth.cancel).toHaveBeenCalledTimes(2);
  });

  it("texto vazio não fala", async () => {
    installSynth();
    expect(await createTts().speak("   ", { lang: "en" })).toBe("unavailable");
  });
});

// ---------- escuta ----------

type Script = (rec: FakeRecognition) => void;
class FakeRecognition {
  static last: FakeRecognition | null = null;
  static script: Script = () => undefined;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 1;
  onresult: Handler | null = null;
  onerror: Handler | null = null;
  onend: Handler | null = null;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    queueMicrotask(() => FakeRecognition.script(this));
  }
  abort() {
    this.aborted = true;
    queueMicrotask(() => {
      this.onerror?.({ error: "aborted" });
      this.onend?.();
    });
  }
}

const result = (alts: [string, number][], isFinal = true) => Object.assign(alts.map(([transcript, confidence]) => ({ transcript, confidence })), { isFinal });
const event = (...results: ReturnType<typeof result>[]) => ({ resultIndex: 0, results });

function install(script: Script, name: "SpeechRecognition" | "webkitSpeechRecognition" = "SpeechRecognition") {
  FakeRecognition.script = script;
  g[name] = FakeRecognition;
}

const listenOnce = (stt = createStt(), signal: AbortSignal = new AbortController().signal, onInterim?: (t: string) => void) =>
  stt.listen({ lang: "en-US", signal, onInterim });

describe("Stt", () => {
  it("sem SpeechRecognition (Firefox): sem suporte e `unsupported`", async () => {
    const stt = createStt();
    expect(stt.supported).toBe(false);
    expect(await listenOnce(stt)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("aceita o prefixo webkit", () => {
    install(() => undefined, "webkitSpeechRecognition");
    expect(createStt().supported).toBe(true);
  });

  it("pede 5 alternativas, idioma, frase única; devolve até 5, a melhor primeiro, sem repetidas e com confiança entre 0 e 1", async () => {
    install((rec) => {
      rec.onresult?.(event(result([["I would like a coffee", 0.92], ["i would like a coffee", 0.9], ["I would like a copy", 0.4], ["b", Number.NaN], ["a", 7], ["c", 0.1]])));
      rec.onend?.();
    });
    const out = await listenOnce();
    const rec = FakeRecognition.last;
    expect(rec).toMatchObject({ lang: "en-US", continuous: false, maxAlternatives: 5 });
    expect(out).toEqual({
      ok: true,
      alternatives: [
        { text: "I would like a coffee", confidence: 0.92 },
        { text: "I would like a copy", confidence: 0.4 },
        { text: "b", confidence: 0 },
        { text: "a", confidence: 1 },
      ],
    });
  });

  it("transcrição ao vivo só quando pedida", async () => {
    const seen: string[] = [];
    install((rec) => {
      rec.onresult?.(event(result([["I would", 0]], false)));
      rec.onresult?.(event(result([["I would like", 0]], false)));
      rec.onresult?.(event(result([["I would like a coffee", 0.9]])));
      rec.onend?.();
    });
    await listenOnce(createStt(), new AbortController().signal, (t) => seen.push(t));
    expect(seen).toEqual(["I would", "I would like"]);
    expect(FakeRecognition.last?.interimResults).toBe(true);
    await listenOnce();
    expect(FakeRecognition.last?.interimResults).toBe(false);
  });

  it.each([
    ["no-speech", "no_speech"],
    ["not-allowed", "denied"],
    ["service-not-allowed", "denied"],
    ["network", "network"],
    ["language-not-supported", "lang"],
    ["aborted", "aborted"],
    ["audio-capture", "unsupported"],
    ["algo-novo", "unsupported"],
  ])("erro %s vira o motivo %s", async (code, reason) => {
    expect(mapSttError(code)).toBe(reason);
    install((rec) => {
      rec.onerror?.({ error: code });
      rec.onend?.();
    });
    expect(await listenOnce()).toEqual({ ok: false, reason });
  });

  it("terminar sem ouvir nada é `no_speech`", async () => {
    install((rec) => rec.onend?.());
    expect(await listenOnce()).toEqual({ ok: false, reason: "no_speech" });
  });

  it("start() que lança vira `unsupported`", async () => {
    class Throws extends FakeRecognition {
      override start(): void {
        throw new Error("InvalidStateError");
      }
    }
    g["SpeechRecognition"] = Throws;
    expect(await listenOnce()).toEqual({ ok: false, reason: "unsupported" });
  });

  it("cancelar o signal para de ouvir e devolve `aborted`; signal já cancelado nem abre o microfone", async () => {
    install(() => undefined); // nunca responde
    const controller = new AbortController();
    const pending = listenOnce(createStt(), controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "aborted" });
    expect(FakeRecognition.last?.aborted).toBe(true);

    FakeRecognition.last = null;
    const done = new AbortController();
    done.abort();
    expect(await listenOnce(createStt(), done.signal)).toEqual({ ok: false, reason: "aborted" });
    expect(FakeRecognition.last).toBeNull();
  });

  it("antes de ouvir, a fala é cortada (createVoice liga os dois)", async () => {
    const fake = installSynth();
    install((rec) => rec.onend?.());
    const { stt } = createVoice();
    await stt.listen({ lang: "en-US", signal: new AbortController().signal });
    expect(fake.synth.cancel).toHaveBeenCalledTimes(1);
  });
});
