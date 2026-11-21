// Ajustes › IA (opcional) (D-56): guia para pegar a key grátis do Gemini, onde a key fica, salvar, testar e apagar.
// O campo é de senha, não controlado e limpo ao salvar: a key nunca entra no estado do React nem em nenhum texto da tela.
import { useRef, useState, type FormEvent } from "react";
import { clearLastProblem, eraseKey, keyInfo, keyLooksValid, loadLastProblem, saveKey, testKey, type AiProblem } from "../../services/ai";
import { AiProblemNotice } from "../AiProblemNotice";
import { ChoiceGroup } from "../ChoiceGroup";
import { PageTitle } from "../PageTitle";
import { useQuoted } from "../Quoted";
import { useLocale, useT } from "../useT";

type Where = "session" | "device";
type Note = { tone: "ok" | "error"; key: "ai.save.done" | "ai.save.invalid" | "ai.save.failed" | "ai.test.ok" | "ai.erase.done" };

export function AiSettings() {
  const t = useT();
  const quoted = useQuoted();
  const locale = useLocale();
  const field = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState(keyInfo);
  const [where, setWhere] = useState<Where>("session");
  const [note, setNote] = useState<Note | null>(null);
  const [testing, setTesting] = useState(false);
  const [problem, setProblem] = useState<{ kind: AiProblem; detail?: string | undefined } | null>(null);
  const [last, setLast] = useState(loadLastProblem);

  function onSave(event: FormEvent) {
    event.preventDefault();
    const input = field.current;
    if (!input) return;
    const value = input.value;
    input.value = ""; // limpo já ao salvar, com sucesso ou não
    setProblem(null);
    if (value.trim() === "") return;
    // Formato primeiro: "não deu para guardar" só quando a key é válida e o aparelho recusou (antes, key de formato novo caía aqui).
    const ok = keyLooksValid(value) && saveKey(value, where === "device");
    setNote(ok ? { tone: "ok", key: "ai.save.done" } : { tone: "error", key: keyLooksValid(value) ? "ai.save.failed" : "ai.save.invalid" });
    setInfo(keyInfo());
    setLast(loadLastProblem());
  }

  async function onTest() {
    setTesting(true);
    setNote(null);
    setProblem(null);
    const result = await testKey();
    setTesting(false);
    if (result.ok) setNote({ tone: "ok", key: "ai.test.ok" });
    else setProblem({ kind: result.problem, detail: result.detail });
    setLast(loadLastProblem());
  }

  function onErase() {
    eraseKey();
    setInfo(keyInfo());
    setProblem(null);
    setNote({ tone: "ok", key: "ai.erase.done" });
  }

  function hideLast() {
    clearLastProblem();
    setLast(null);
  }

  const when = last ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(last.at)) : "";

  return (
    <>
      <PageTitle>{t("ai.title")}</PageTitle>
      <p>{t("ai.intro")}</p>

      <section aria-labelledby="ai-privacy-title">
        <h2 id="ai-privacy-title">{t("ai.privacy.title")}</h2>
        <p className="notice">{t("ai.privacy.text")}</p>
      </section>

      <section aria-labelledby="ai-guide-title">
        <h2 id="ai-guide-title">{t("ai.guide.title")}</h2>
        <ol>
          <li>{t("ai.guide.step1")}</li>
          <li>{t("ai.guide.step2")}</li>
          <li>{t("ai.guide.step3")}</li>
          <li>{t("ai.guide.step4")}</li>
          <li>{t("ai.guide.step5")}</li>
        </ol>
        <p className="hint">{t("ai.guide.tip")}</p>
      </section>

      <section aria-labelledby="ai-where-title">
        <h2 id="ai-where-title">{t("ai.where.title")}</h2>
        <p>{t("ai.where.text")}</p>
      </section>

      <section aria-labelledby="ai-key-title">
        <h2 id="ai-key-title">{t("ai.saved.title")}</h2>
        <form onSubmit={onSave} noValidate>
          <div className="field">
            <label htmlFor="ai-key-field">{t("ai.field.label")}</label>
            <input
              ref={field}
              id="ai-key-field"
              className="input"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={300}
              aria-describedby="ai-key-hint"
            />
            <p id="ai-key-hint" className="hint">
              {t("ai.field.hint")}
            </p>
          </div>
          <ChoiceGroup
            legend={t("ai.save.legend")}
            name="ai-where"
            value={where}
            options={[
              { value: "session", label: t("ai.save.session"), hint: t("ai.save.session.hint") },
              { value: "device", label: t("ai.save.device"), hint: t("ai.save.device.hint") },
            ]}
            onChange={setWhere}
          />
          <button type="submit" className="btn btn-primary">
            {t("ai.save.button")}
          </button>
        </form>

        <p role="status" className={note?.tone === "error" ? "field-error" : undefined}>
          {note ? t(note.key) : ""}
        </p>
        {problem && <AiProblemNotice problem={problem.kind} detail={problem.detail} />}

        {info.has && (
          <div className="field">
            <p>
              <strong>{t("ai.saved.masked", { masked: info.masked ?? "" })}</strong>
            </p>
            <p className="hint">{info.remembered ? t("ai.saved.where.device") : t("ai.saved.where.session")}</p>
            <div className="actions">
              <button type="button" className="btn" disabled={testing} onClick={() => void onTest()}>
                {testing ? t("ai.test.running") : t("ai.test")}
              </button>
              <button type="button" className="btn" onClick={onErase}>
                {t("ai.erase")}
              </button>
            </div>
          </div>
        )}
      </section>

      {last && (
        <section aria-labelledby="ai-last-title">
          <h2 id="ai-last-title">{t("ai.last.title")}</h2>
          <p>{t("ai.last.text", { problem: t(`ai.problem.${last.kind}`), when })}</p>
          <p className="hint">{t(`ai.problem.${last.kind}.fix`)}</p>
          {last.detail !== undefined && <p className="hint">{quoted("ai.problem.detail", { text: last.detail }, "en")}</p>}
          <button type="button" className="btn" onClick={hideLast}>
            {t("ai.last.clear")}
          </button>
        </section>
      )}
    </>
  );
}
