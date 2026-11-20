// Como a pessoa responde: microfone grande (só por toque), campo de texto sempre disponível. Sem suporte de escuta
// o microfone some e o texto vira o caminho (aviso uma vez só). Falha do microfone nunca conta como erro da pessoa.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { giveMicConsent, hasMicConsent, listen, tts, voiceSupport, type SttFailReason, type VoiceLang } from "../../services/voice";
import { MicConsentDialog } from "../MicConsentDialog";
import { NoMicNotice } from "../NoMicNotice";
import { useT } from "../useT";

interface Props {
  /** Idioma que se fala, para o reconhecedor. `null`: sem reconhecimento para este idioma (só texto). */
  voiceLang: VoiceLang | null;
  /** Marca BCP 47 do que se escreve (atributo `lang` do campo). */
  textLang: string;
  onSay: (input: "voice" | "typed", utterances: readonly string[]) => void;
}

export function AnswerInput({ voiceLang, textLang, onSay }: Props) {
  const t = useT();
  const canListen = voiceLang !== null && voiceSupport().listen;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [failure, setFailure] = useState<SttFailReason | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [draft, setDraft] = useState("");
  const abort = useRef<AbortController | null>(null);

  // Ao sair da tela: para de ouvir.
  useEffect(() => () => abort.current?.abort(), []);

  async function startListening(lang: VoiceLang) {
    const controller = new AbortController();
    abort.current = controller;
    setFailure(null);
    setInterim("");
    setListening(true);
    tts.cancel(); // o microfone não ouve a fala da NPC
    const result = await listen({ lang, signal: controller.signal, onInterim: setInterim });
    if (abort.current === controller) abort.current = null;
    setListening(false);
    setInterim("");
    if (controller.signal.aborted && !result.ok) return; // a pessoa parou, ou saiu da tela
    if (result.ok) onSay("voice", result.alternatives.map((a) => a.text));
    else setFailure(result.reason);
  }

  function onMic() {
    if (voiceLang === null) return;
    if (listening) return abort.current?.abort();
    if (!hasMicConsent()) return setAskConsent(true);
    void startListening(voiceLang);
  }

  function onConsent() {
    giveMicConsent();
    setAskConsent(false);
    if (voiceLang !== null) void startListening(voiceLang); // ainda dentro do toque em "Continuar"
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text === "") return;
    setDraft("");
    setFailure(null);
    onSay("typed", [text]);
  }

  return (
    <div className="answer">
      {!canListen && <NoMicNotice />}
      {canListen && (
        <>
          <button type="button" autoFocus className={listening ? "mic-btn mic-btn-on" : "mic-btn"} onClick={onMic} aria-pressed={listening}>
            {listening ? t("play.mic.stop") : t("play.mic.start")}
          </button>
          <p className="voice-interim" role="status" lang={textLang}>
            {listening ? (interim === "" ? t("play.mic.listening") : interim) : null}
          </p>
        </>
      )}
      <div role="status">
        {failure !== null && failure !== "aborted" && <p className="notice notice-error">{t(`voice.fail.${failure}`)}</p>}
      </div>
      <form onSubmit={onSubmit} className="answer-form" noValidate>
        <label htmlFor="answer-text">{t("play.input.label")}</label>
        <div className="answer-row">
          <input
            id="answer-text"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            lang={textLang}
            maxLength={300}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            autoFocus={!canListen}
          />
          <button type="submit" className="btn btn-primary">
            {t("play.input.send")}
          </button>
        </div>
      </form>
      {askConsent && <MicConsentDialog onAccept={onConsent} onCancel={() => setAskConsent(false)} />}
    </div>
  );
}
