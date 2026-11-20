// Teste das frases (W2-16): a pessoa lê as frases de content/eval/stt/ e o app mede quanto o reconhecedor casa com a
// resposta esperada (a mesma conta do player). Nada é gravado: o resultado só vive nesta tela e no texto copiado.
import { useEffect, useRef, useState } from "react";
import { giveMicConsent, hasMicConsent, listen as realListen, tts, voiceSupport, type SttResult } from "../../services/voice";
import {
  createMissionLoader,
  formatResult,
  judge,
  loadPhraseSet,
  tally,
  type Attempt,
  type MissionLoader,
  type PhraseSetResult,
  type VoicePhrase,
} from "../../services/voiceTest";
import { MicConsentDialog } from "../MicConsentDialog";
import { useT } from "../useT";

const LANG = "en" as const;
const TAG = "en-US";

type ListenFn = (options: { lang: typeof LANG; signal: AbortSignal; onInterim?: (text: string) => void }) => Promise<SttResult>;

export interface PhraseTestDeps {
  loadPhrases?: () => Promise<PhraseSetResult>;
  mission?: MissionLoader;
  listen?: ListenFn;
  /** Sem suporte de escuta a seção só avisa. */
  canListen?: boolean;
  canSpeak?: boolean;
}

type Load = { state: "loading" } | { state: "error"; reason: "missing" | "invalid" } | { state: "ready"; phrases: readonly VoicePhrase[] };

export function PhraseTest({ loadPhrases = loadPhraseSet, mission, listen = realListen, canListen, canSpeak }: PhraseTestDeps) {
  const t = useT();
  const support = voiceSupport();
  const hearing = canListen ?? support.listen;
  const speaking = canSpeak ?? support.speak;
  const missions = useRef<MissionLoader | null>(null);
  missions.current ??= mission ?? createMissionLoader();

  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [summary, setSummary] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hearing) return;
    let current = true;
    void loadPhrases().then((result) => {
      if (current) setLoad(result.ok ? { state: "ready", phrases: result.phrases } : { state: "error", reason: result.reason });
    });
    return () => {
      current = false;
    };
  }, [hearing, loadPhrases]);

  useEffect(
    () => () => {
      abort.current?.abort();
      tts.cancel();
    },
    [],
  );

  const heading = <h2 id="phrase-test-title">{t("voice.test.title")}</h2>;

  if (!hearing) {
    return (
      <section aria-labelledby="phrase-test-title">
        {heading}
        <p className="notice">{t("voice.test.no_listen")}</p>
      </section>
    );
  }
  if (load.state === "loading") {
    return (
      <section aria-labelledby="phrase-test-title">
        {heading}
        <p role="status">{t("voice.test.loading")}</p>
      </section>
    );
  }
  if (load.state === "error") {
    return (
      <section aria-labelledby="phrase-test-title">
        {heading}
        <p className="notice notice-error" role="alert">
          {t(load.reason === "missing" ? "voice.test.error_missing" : "voice.test.error_invalid")}
        </p>
      </section>
    );
  }

  const { phrases } = load;
  const total = phrases.length;
  const phrase = phrases[index];
  const attempt = phrase === undefined ? undefined : attempts[phrase.id];
  const list = phrases.flatMap((p) => {
    const a = attempts[p.id];
    return a === undefined ? [] : [a];
  });

  function record(next: Attempt) {
    setAttempts((prev) => ({ ...prev, [next.phrase.id]: next }));
  }

  async function startListening() {
    if (phrase === undefined) return;
    const current = phrase;
    const controller = new AbortController();
    abort.current = controller;
    setInterim("");
    setListening(true);
    tts.cancel();
    const result = await listen({ lang: LANG, signal: controller.signal, onInterim: setInterim });
    if (abort.current === controller) abort.current = null;
    setListening(false);
    setInterim("");
    if (!result.ok) {
      if (result.reason !== "aborted") record({ phrase: current, heard: [], outcome: { kind: "failed", reason: result.reason } });
      return;
    }
    const outcome = await judge(current, result.alternatives, missions.current!);
    record({ phrase: current, heard: result.alternatives, outcome });
  }

  function onMic() {
    if (listening) return abort.current?.abort();
    if (!hasMicConsent()) return setAskConsent(true);
    void startListening();
  }

  function onConsent() {
    giveMicConsent();
    setAskConsent(false);
    void startListening();
  }

  function go(to: number) {
    abort.current?.abort();
    setIndex(to);
    if (to >= total) setSummary(true);
  }

  function skip() {
    if (phrase === undefined) return;
    record({ phrase, heard: [], outcome: { kind: "skipped" } });
    go(index + 1);
  }

  function again() {
    if (phrase === undefined) return;
    const id = phrase.id;
    setAttempts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatResult(total, list));
      setCopyNote(t("voice.test.copied"));
    } catch {
      setCopyNote(t("voice.test.copy_failed"));
    }
  }

  function restart() {
    abort.current?.abort();
    setAttempts({});
    setIndex(0);
    setSummary(false);
    setCopyNote(null);
  }

  const showSummary = summary || index >= total;
  const stats = tally(total, list);
  const answered = attempt !== undefined && attempt.outcome.kind !== "skipped";

  return (
    <section aria-labelledby="phrase-test-title">
      {heading}
      {showSummary ? (
        <Summary
          list={list}
          text={formatResult(total, list)}
          stats={stats}
          copyNote={copyNote}
          onCopy={() => void copy()}
          onRestart={restart}
          onBack={index >= total ? undefined : () => setSummary(false)}
        />
      ) : !started ? (
        <>
          <p>{t("voice.test.intro", { n: total })}</p>
          <p>{t("voice.test.privacy")}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setStarted(true)}>
              {t("voice.test.start")}
            </button>
          </div>
        </>
      ) : (
        phrase !== undefined && (
          <>
            <p className="hint">{t("voice.test.progress", { n: index + 1, total })}</p>
            <p lang={TAG} className="voice-phrase voice-test-phrase">
              {phrase.text}
            </p>
            {speaking && (
              <div className="actions">
                <button type="button" className="btn" onClick={() => void tts.speak(phrase.text, { lang: TAG })}>
                  {t("voice.test.hear")}
                </button>
              </div>
            )}
            {answered ? (
              <Result attempt={attempt} />
            ) : (
              <>
                <button type="button" className={listening ? "mic-btn mic-btn-on" : "mic-btn"} onClick={onMic} aria-pressed={listening}>
                  {listening ? t("voice.check.stop") : t("voice.test.mic")}
                </button>
                <p role="status" className="voice-interim" lang={TAG}>
                  {listening ? (interim === "" ? t("voice.check.listening") : interim) : null}
                </p>
              </>
            )}
            <div className="actions">
              {answered && (
                <button type="button" className="btn" onClick={again}>
                  {t("voice.test.again")}
                </button>
              )}
              <button type="button" className="btn" onClick={skip} disabled={listening}>
                {t("voice.test.skip")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => go(index + 1)} disabled={listening || !answered}>
                {t("voice.test.next")}
              </button>
              <button type="button" className="btn" onClick={() => {
                  abort.current?.abort();
                  setSummary(true);
                }}>
                {t("voice.test.summary")}
              </button>
            </div>
          </>
        )
      )}
      {askConsent && <MicConsentDialog onAccept={onConsent} onCancel={() => setAskConsent(false)} />}
    </section>
  );
}

function Result({ attempt }: { attempt: Attempt }) {
  const t = useT();
  const { outcome } = attempt;
  return (
    <div role="status" className="voice-test-result">
      <p className={outcome.kind === "match" ? "voice-test-ok" : "voice-test-bad"}>
        <strong>{outcome.kind === "match" ? "✓ " : "✗ "}</strong>
        {outcome.kind === "match" && t("voice.test.res_match")}
        {outcome.kind === "other" && (
          <>
            {t("voice.test.res_other")} <q lang={TAG}>{outcome.text}</q>
          </>
        )}
        {outcome.kind === "none" && t("voice.test.res_none")}
        {outcome.kind === "failed" && t(`voice.fail.${outcome.reason}`)}
        {outcome.kind === "broken" && t("voice.test.res_broken")}
      </p>
      {attempt.heard.length > 0 && (
        <>
          <h3>{t("voice.check.alternatives")}</h3>
          <ol className="voice-alternatives" lang={TAG}>
            {attempt.heard.map((alt, i) => (
              <li key={`${i}-${alt.text}`}>
                <span>{alt.text}</span>{" "}
                <span className="hint">
                  {alt.confidence > 0 ? t("voice.check.confidence", { pct: Math.round(alt.confidence * 100) }) : t("voice.check.confidence_unknown")}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Summary(props: {
  list: readonly Attempt[];
  text: string;
  stats: ReturnType<typeof tally>;
  copyNote: string | null;
  onCopy: () => void;
  onRestart: () => void;
  onBack: (() => void) | undefined;
}) {
  const t = useT();
  const top = useRef<HTMLHeadingElement>(null);
  // O resumo abre no topo e com o foco nele, mesmo que a tela estivesse rolada (o botão de copiar fica logo abaixo da taxa).
  useEffect(() => {
    top.current?.scrollIntoView?.({ block: "start" });
    top.current?.focus({ preventScroll: true });
  }, []);
  const misses = props.list.filter((a) => a.outcome.kind !== "match" && a.outcome.kind !== "skipped");
  return (
    <div>
      <h3 ref={top} tabIndex={-1}>
        {t("voice.test.summary_title")}
      </h3>
      <p role="status" className="voice-phrase">
        {props.stats.done === 0 ? t("voice.test.summary_empty") : t("voice.test.rate", { ok: props.stats.ok, done: props.stats.done, pct: props.stats.pct })}
      </p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={props.onCopy} disabled={props.stats.done === 0}>
          {t("voice.test.copy")}
        </button>
        {props.onBack !== undefined && (
          <button type="button" className="btn" onClick={props.onBack}>
            {t("voice.test.continue")}
          </button>
        )}
        <button type="button" className="btn" onClick={props.onRestart}>
          {t("voice.test.restart")}
        </button>
      </div>
      <p role="status">{props.copyNote}</p>
      {props.stats.done > 0 && (
        <>
          <label htmlFor="voice-test-text">{t("voice.test.text_label")}</label>
          <textarea id="voice-test-text" className="voice-test-text" readOnly rows={8} value={props.text} onFocus={(event) => event.currentTarget.select()} />
        </>
      )}
      {misses.length > 0 && (
        <>
          <h4>{t("voice.test.misses")}</h4>
          <ul className="voice-test-misses">
            {misses.map((a) => (
              <li key={a.phrase.id}>
                <span lang={TAG}>{a.phrase.text}</span>
                {" — "}
                {a.heard.length > 0 ? <span lang={TAG}>{a.heard.map((h) => `"${h.text}"`).join(" | ")}</span> : <span>{t("voice.test.nothing_heard")}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
