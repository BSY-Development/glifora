// @vitest-environment jsdom
// W2-06: tela /settings/voice (diagnóstico), aviso de privacidade do microfone e aviso de "não ouve" (uma vez só).
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { openDb, type GliforaDb } from "../data";
import { initLocale, t } from "../i18n";
import { MIC_CONSENT_KEY, NO_MIC_NOTICE_KEY } from "../services/voice";
import { setStorageForTest } from "../services/storage";
import { NoMicNotice } from "./NoMicNotice";
import { routes } from "./routes";

type Handler = (event?: unknown) => void;
const g = globalThis as Record<string, unknown>;
let db: GliforaDb;

beforeEach(async () => {
  localStorage.clear();
  initLocale(["en"]);
  db = await openDb("glifora-voice-test");
  setStorageForTest(db);
});

afterEach(async () => {
  cleanup();
  for (const key of ["speechSynthesis", "SpeechSynthesisUtterance", "SpeechRecognition", "webkitSpeechRecognition"]) delete g[key];
  setStorageForTest(null);
  db.close();
  await db.delete();
});

function installSynth(voices: unknown[] = [{ voiceURI: "us", name: "Samantha", lang: "en-US", localService: true }]) {
  g["speechSynthesis"] = {
    getVoices: () => voices,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: vi.fn(),
    speak: (u: { onend?: Handler }) => queueMicrotask(() => u.onend?.()),
  };
  g["SpeechSynthesisUtterance"] = class {
    onend?: Handler;
    constructor(readonly text: string) {}
  };
}

function installRecognition(script: (rec: { onresult: Handler | null; onerror: Handler | null; onend: Handler | null }) => void) {
  const started = vi.fn();
  g["SpeechRecognition"] = class {
    onresult: Handler | null = null;
    onerror: Handler | null = null;
    onend: Handler | null = null;
    start() {
      started();
      queueMicrotask(() => script(this));
    }
    abort() {}
  };
  return started;
}

const heard = (...alts: [string, number][]) => ({
  resultIndex: 0,
  results: [Object.assign(alts.map(([transcript, confidence]) => ({ transcript, confidence })), { isFinal: true })],
});

function renderVoice() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/settings/voice"] })} />);
}

describe("/settings/voice", () => {
  it("o primeiro toque no microfone mostra o aviso e só ouve depois de continuar; no segundo uso não pergunta mais", async () => {
    installSynth();
    const started = installRecognition((rec) => {
      rec.onresult?.(heard(["I would like a coffee", 0.92], ["I would like a copy", 0.41], ["hello", 0]));
      rec.onend?.();
    });
    renderVoice();
    await screen.findByRole("heading", { level: 1, name: t("voice.check.title") });

    fireEvent.click(screen.getByRole("button", { name: t("voice.check.mic") }));
    expect(await screen.findByText(t("voice.consent.text"), {}, { timeout: 2000 })).toBeTruthy();
    expect(started).not.toHaveBeenCalled(); // o aviso vem antes do microfone
    expect(localStorage.getItem(MIC_CONSENT_KEY)).toBeNull();

    fireEvent.click(screen.getByText(t("voice.consent.accept")));
    expect(await screen.findByText("I would like a coffee")).toBeTruthy();
    expect(started).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(MIC_CONSENT_KEY)).toBe("1");
    expect(screen.getByText(t("voice.check.confidence", { pct: 92 }))).toBeTruthy();
    expect(screen.getByText(t("voice.check.confidence", { pct: 41 }))).toBeTruthy();
    expect(screen.getByText(t("voice.check.confidence_unknown"))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t("voice.check.mic") }));
    await waitFor(() => expect(started).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(t("voice.consent.text"))).toBeNull();
  });

  it("Agora não: o microfone nunca abre", async () => {
    installSynth();
    const started = installRecognition((rec) => rec.onend?.());
    renderVoice();
    fireEvent.click(await screen.findByRole("button", { name: t("voice.check.mic") }));
    fireEvent.click(await screen.findByText(t("voice.consent.cancel")));
    await waitFor(() => expect(screen.queryByText(t("voice.consent.text"))).toBeNull());
    expect(started).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIC_CONSENT_KEY)).toBeNull();
  });

  it("cada motivo de falha tem a sua mensagem", async () => {
    installSynth();
    localStorage.setItem(MIC_CONSENT_KEY, "1");
    installRecognition((rec) => {
      rec.onerror?.({ error: "not-allowed" });
      rec.onend?.();
    });
    renderVoice();
    fireEvent.click(await screen.findByRole("button", { name: t("voice.check.mic") }));
    expect((await screen.findByRole("alert")).textContent).toBe(t("voice.fail.denied"));
  });

  it("lista as vozes e fala a frase de teste; sem voz, avisa", async () => {
    installSynth();
    renderVoice();
    expect(await screen.findByText(t("voice.status.voices", { n: 1, names: "Samantha (en-US)" }))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("voice.check.speak_button") }));
    await waitFor(() => expect(screen.queryByText(t("voice.check.no_voice"))).toBeNull());
    cleanup();

    installSynth([]);
    renderVoice();
    fireEvent.click(await screen.findByRole("button", { name: t("voice.check.speak_button") }));
    expect(await screen.findByText(t("voice.check.no_voice"), {}, { timeout: 4000 })).toBeTruthy();
  }, 10_000);

  it("sem suporte (Firefox): o microfone some, o texto avisa e o botão de falar fica desligado", async () => {
    renderVoice();
    await screen.findByRole("heading", { level: 1, name: t("voice.check.title") });
    expect(screen.queryByRole("button", { name: t("voice.check.mic") })).toBeNull();
    expect(screen.getByText(t("voice.status.listen_no"))).toBeTruthy();
    expect(screen.getByText(t("voice.nomic.notice"))).toBeTruthy();
    expect((screen.getByRole("button", { name: t("voice.check.speak_button") }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("aviso de que o navegador não ouve", () => {
  it("aparece uma vez, some ao dispensar e não volta", () => {
    const first = render(<NoMicNotice />);
    expect(screen.getByText(t("voice.nomic.notice"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("voice.nomic.dismiss") }));
    expect(screen.queryByText(t("voice.nomic.notice"))).toBeNull();
    expect(localStorage.getItem(NO_MIC_NOTICE_KEY)).toBe("1");
    first.unmount();
    render(<NoMicNotice />);
    expect(screen.queryByText(t("voice.nomic.notice"))).toBeNull();
  });

  it("com reconhecimento disponível, não aparece", () => {
    installRecognition(() => undefined);
    render(<NoMicNotice />);
    expect(screen.queryByText(t("voice.nomic.notice"))).toBeNull();
  });
});
