// /settings/voice: diagnóstico da voz (W2-06). Mostra o que este aparelho fala e entende:
// as vozes do idioma, uma frase de teste e as alternativas que o reconhecedor devolve, com a confiança de cada uma.
// Serve ao teste da taxa de casamento (W2-12). Nada daqui é guardado.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  VOICE_LANGS,
  giveMicConsent,
  hasMicConsent,
  listen,
  testPhrase,
  tts,
  voiceSupport,
  voiceTag,
  voicesFor,
  type SttAlternative,
  type SttFailReason,
  type VoiceInfo,
  type VoiceLang,
} from "../../services/voice";
import { MicConsentDialog } from "../MicConsentDialog";
import { PageTitle } from "../PageTitle";
import { PhraseTest } from "./VoicePhraseTest";
import { useT } from "../useT";

type Heard = { kind: "ok"; alternatives: SttAlternative[] } | { kind: "fail"; reason: SttFailReason };
type Spoken = "playing" | "done" | "unavailable" | null;

const isVoiceLang = (value: string): value is VoiceLang => (VOICE_LANGS as readonly string[]).includes(value);

export function VoiceCheck() {
  const t = useT();
  const support = voiceSupport();
  const [lang, setLang] = useState<VoiceLang>("en");
  const [found, setFound] = useState<{ lang: VoiceLang; list: VoiceInfo[] } | null>(null);
  const voices = found?.lang === lang ? found.list : null; // null = ainda procurando as vozes deste idioma
  const [spoken, setSpoken] = useState<Spoken>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let current = true;
    void voicesFor(lang).then((list) => {
      if (current) setFound({ lang, list });
    });
    return () => {
      current = false;
    };
  }, [lang]);

  // Ao sair da tela: para de ouvir e de falar.
  useEffect(
    () => () => {
      abort.current?.abort();
      tts.cancel();
    },
    [],
  );

  async function onSpeak() {
    setSpoken("playing");
    const result = await tts.speak(testPhrase(lang), { lang: voiceTag(lang) });
    setSpoken(result === "unavailable" ? "unavailable" : "done");
  }

  async function startListening() {
    const controller = new AbortController();
    abort.current = controller;
    setHeard(null);
    setInterim("");
    setListening(true);
    tts.cancel(); // o microfone não ouve a fala do teste
    const result = await listen({ lang, signal: controller.signal, onInterim: setInterim });
    if (abort.current === controller) abort.current = null;
    setListening(false);
    setInterim("");
    setHeard(result.ok ? { kind: "ok", alternatives: result.alternatives } : { kind: "fail", reason: result.reason });
  }

  function onMic() {
    if (listening) return abort.current?.abort();
    if (!hasMicConsent()) return setAskConsent(true);
    void startListening();
  }

  function onConsent() {
    giveMicConsent();
    setAskConsent(false);
    void startListening(); // ainda dentro do toque em "Continuar"
  }

  return (
    <>
      <PageTitle>{t("voice.check.title")}</PageTitle>
      <p>{t("voice.check.intro")}</p>
      <p>
        <Link to="/settings">{t("voice.check.back")}</Link>
      </p>

      <div className="field">
        <label htmlFor="voice-lang">{t("voice.check.lang")}</label>
        <select id="voice-lang" value={lang} onChange={(event) => isVoiceLang(event.target.value) && setLang(event.target.value)}>
          {VOICE_LANGS.map((code) => (
            <option key={code} value={code}>
              {t(`voice.lang.${code}`)}
            </option>
          ))}
        </select>
      </div>

      <section aria-labelledby="voice-status-title">
        <h2 id="voice-status-title">{t("voice.check.status")}</h2>
        <ul className="voice-status">
          <li>{support.speak ? t("voice.status.speak_yes") : t("voice.status.speak_no")}</li>
          <li>
            {voices === null
              ? t("voice.status.voices_loading")
              : voices.length === 0
                ? t("voice.status.voices_none")
                : t("voice.status.voices", { n: voices.length, names: voices.map((v) => `${v.name} (${v.lang})`).join(", ") })}
          </li>
          <li>{support.listen ? t("voice.status.listen_yes") : t("voice.status.listen_no")}</li>
        </ul>
        {!support.listen && <p className="notice">{t("voice.nomic.notice")}</p>}
      </section>

      <section aria-labelledby="voice-speak-title">
        <h2 id="voice-speak-title">{t("voice.check.speak_title")}</h2>
        <p lang={voiceTag(lang)} className="voice-phrase">
          {testPhrase(lang)}
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={onSpeak} disabled={!support.speak || spoken === "playing"}>
            {t("voice.check.speak_button")}
          </button>
        </div>
        <p role="status">
          {spoken === "playing" && t("voice.check.playing")}
          {spoken === "unavailable" && t("voice.check.no_voice")}
        </p>
      </section>

      {support.listen && (
        <section aria-labelledby="voice-listen-title">
          <h2 id="voice-listen-title">{t("voice.check.listen_title")}</h2>
          <p>{t("voice.check.listen_hint")}</p>
          <button type="button" className={listening ? "mic-btn mic-btn-on" : "mic-btn"} onClick={onMic} aria-pressed={listening}>
            {listening ? t("voice.check.stop") : t("voice.check.mic")}
          </button>
          <p role="status" className="voice-interim" lang={voiceTag(lang)}>
            {listening ? (interim === "" ? t("voice.check.listening") : interim) : null}
          </p>
          {heard?.kind === "fail" && heard.reason !== "aborted" && (
            <p className="notice notice-error" role="alert">
              {t(`voice.fail.${heard.reason}`)}
            </p>
          )}
          {heard?.kind === "ok" && (
            <div role="status">
              <h3>{t("voice.check.alternatives")}</h3>
              <ol className="voice-alternatives" lang={voiceTag(lang)}>
                {heard.alternatives.map((alt, index) => (
                  <li key={`${index}-${alt.text}`}>
                    <span>{alt.text}</span>{" "}
                    <span className="hint">
                      {alt.confidence > 0 ? t("voice.check.confidence", { pct: Math.round(alt.confidence * 100) }) : t("voice.check.confidence_unknown")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      <PhraseTest />

      {askConsent && <MicConsentDialog onAccept={onConsent} onCancel={() => setAskConsent(false)} />}
    </>
  );
}
