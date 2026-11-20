// @vitest-environment jsdom
// W2-16: teste das frases em /settings/voice, com um reconhecedor falso e uma missão mínima.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initLocale, t } from "../i18n";
import type { Mission } from "../schemas";
import { MIC_CONSENT_KEY, type SttAlternative, type SttResult } from "../services/voice";
import { formatResult, tally, type VoicePhrase } from "../services/voiceTest";
import { PhraseTest } from "./screens/VoicePhraseTest";

const mission = {
  id: "bakery-01",
  target: "en",
  nodes: [
    {
      id: "order",
      replies: [
        { text: "Can I have a honey roll, please?", keywords: [["honey"]] },
        { text: "I'd like a cheese roll.", keywords: [["cheese"]] },
      ],
    },
  ],
} as unknown as Mission;

const phrase = (id: string, text: string, reply: number): VoicePhrase => ({ id, text, expect: { mission: "bakery-01", node: "order", reply } });
const phrases = [phrase("p-honey", "Can I have a honey roll, please?", 0), phrase("p-cheese", "I'd like a cheese roll.", 1), phrase("p-last", "A honey roll.", 0)];

const alts = (...a: [string, number][]): SttResult => ({ ok: true, alternatives: a.map(([text, confidence]): SttAlternative => ({ text, confidence })) });

function setup(results: SttResult[], extra: { canListen?: boolean } = {}) {
  const queue = [...results];
  const listen = vi.fn(async () => queue.shift() ?? ({ ok: false, reason: "no_speech" } as SttResult));
  render(
    <PhraseTest
      loadPhrases={async () => ({ ok: true, phrases })}
      mission={async (id) => (id === "bakery-01" ? mission : undefined)}
      listen={listen}
      canSpeak={false}
      canListen={extra.canListen ?? true}
    />,
  );
  return listen;
}

const start = async () => fireEvent.click(await screen.findByRole("button", { name: t("voice.test.start") }));
const mic = async () => fireEvent.click(await screen.findByRole("button", { name: t("voice.test.mic") }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(MIC_CONSENT_KEY, "1");
  initLocale(["en"]);
});
afterEach(cleanup);

describe("teste das frases", () => {
  it("mostra a frase 1 de N em inglês, com lang=en, e ✓ quando casou com a esperada", async () => {
    setup([alts(["can I have a honey roll please", 0.9])]);
    await start();
    expect(screen.getByText(t("voice.test.progress", { n: 1, total: 3 }))).toBeTruthy();
    expect(screen.getByText("Can I have a honey roll, please?").getAttribute("lang")).toBe("en-US");
    await mic();
    expect(await screen.findByText(t("voice.test.res_match"))).toBeTruthy();
    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.getByText(t("voice.check.confidence", { pct: 90 }))).toBeTruthy();
  });

  it("casou com outra resposta: ✗ e mostra qual; as alternativas aparecem com a confiança", async () => {
    setup([alts(["i would like a cheese roll", 0.8], ["honey", 0])]);
    await start();
    await mic();
    expect(await screen.findByText(t("voice.test.res_other"), { exact: false })).toBeTruthy();
    expect(screen.getByText("I'd like a cheese roll.")).toBeTruthy();
    expect(screen.getByText("✗")).toBeTruthy();
    expect(screen.getByText(t("voice.check.confidence_unknown"))).toBeTruthy();
  });

  it("não casou: ✗; repetir a frase volta ao microfone; a nova tentativa vale", async () => {
    const listen = setup([alts(["banana", 0.5]), alts(["honey roll", 0.7])]);
    await start();
    await mic();
    expect(await screen.findByText(t("voice.test.res_none"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t("voice.test.again") }));
    await mic();
    expect(await screen.findByText(t("voice.test.res_match"))).toBeTruthy();
    expect(listen).toHaveBeenCalledTimes(2);
  });

  it("pular não conta na taxa; o resumo mostra a taxa, os ✗ e copia o resultado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup([alts(["honey", 0.9]), alts(["pizza", 0.4])]);
    await start();
    await mic(); // frase 1: ✓
    fireEvent.click(await screen.findByRole("button", { name: t("voice.test.next") }));
    await mic(); // frase 2: ✗ (pizza)
    fireEvent.click(await screen.findByRole("button", { name: t("voice.test.next") }));
    fireEvent.click(await screen.findByRole("button", { name: t("voice.test.skip") })); // frase 3 pulada → resumo
    expect(await screen.findByText(t("voice.test.rate", { ok: 1, done: 2, pct: 50 }))).toBeTruthy();
    expect(screen.getByText("I'd like a cheese roll.")).toBeTruthy(); // lista dos ✗
    fireEvent.click(screen.getByRole("button", { name: t("voice.test.copy") }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain("1/2 = 50%");
    expect(text).toContain("p-cheese | expected bakery-01/order/1 | matched none | heard \"pizza\" (40%)");
    expect(text).not.toContain("p-last");
  });

  it("falha do reconhecedor aparece com a mensagem e não trava; sem suporte, a seção só avisa", async () => {
    setup([{ ok: false, reason: "denied" }]);
    await start();
    await mic();
    expect(await screen.findByText(t("voice.fail.denied"))).toBeTruthy();
    cleanup();
    setup([], { canListen: false });
    expect(screen.getByText(t("voice.test.no_listen"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("voice.test.start") })).toBeNull();
  });
});

describe("resumo", () => {
  it("o Copiar resultado vem logo abaixo da taxa, antes da lista dos ✗, e o texto fica selecionável", async () => {
    setup([alts(["pizza", 0.4])]);
    await start();
    await mic();
    fireEvent.click(await screen.findByRole("button", { name: t("voice.test.summary") }));
    const copy = await screen.findByRole("button", { name: t("voice.test.copy" ) });
    const misses = screen.getByText(t("voice.test.misses"));
    expect(copy.compareDocumentPosition(misses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const box = screen.getByLabelText(t("voice.test.text_label")) as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.value).toContain("0/1 = 0%");
  });

  it("sem nenhuma tentada o botão fica desligado e não há caixa de texto", async () => {
    setup([]);
    await start();
    fireEvent.click(await screen.findByRole("button", { name: t("voice.test.summary") }));
    expect((await screen.findByRole("button", { name: t("voice.test.copy") }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText(t("voice.test.text_label"))).toBeNull();
  });
});

describe("tally e formatResult", () => {
  it("taxa 0 quando nada foi tentado", () => {
    expect(tally(44, [])).toEqual({ total: 44, done: 0, ok: 0, pct: 0 });
    expect(formatResult(44, [])).toContain("0/0 = 0%");
  });
});
