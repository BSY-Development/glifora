// /report/:runId (W2-09): o que a pessoa conseguiu na rodada. Tudo sai do que foi gravado (rodada, eventos, missão e catálogo
// de erros), então o relatório abre igual depois de recarregar. Todo texto de conteúdo é texto puro.
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { loadReport } from "../../services/play";
import { Loading } from "../Loading";
import { PageTitle } from "../PageTitle";
import { useQuoted } from "../Quoted";
import { reportText } from "../reportText";
import { useT } from "../useT";

const AGAIN = {
  1: { label: "report.next.again.1", hint: "report.next.again.1.hint" },
  2: { label: "report.next.again.2", hint: "report.next.again.2.hint" },
  3: { label: "report.next.again.3", hint: "report.next.again.3.hint" },
} as const;

function langName(t: ReturnType<typeof useT>, lang: string): string {
  return lang === "pt-BR" ? t("lang.name.pt-BR") : lang === "en" ? t("lang.name.en") : lang;
}

export function Report() {
  const t = useT();
  const quoted = useQuoted();
  const { runId = "" } = useParams();
  const location = useLocation();
  const fresh = (location.state as { fresh?: unknown } | null)?.fresh === true;
  const report = useLiveQuery(() => loadReport(runId), [runId]);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  if (report === undefined) {
    return (
      <>
        <PageTitle>{t("report.title")}</PageTitle>
        <Loading />
      </>
    );
  }
  if (report === null) {
    return (
      <>
        <PageTitle>{t("report.title")}</PageTitle>
        <p>{t("report.missing")}</p>
        <p>
          <Link className="btn" to="/">
            {t("report.next.village")}
          </Link>
        </p>
      </>
    );
  }

  const { run, lines, closingWay, mission, stars, starsBefore, conversationXp, prizeXp, patterns, words, before, after, next } = report;
  const leveledUp = after.level > before.level;
  const newTitle = after.title !== before.title;
  const closing = run.closing;
  const text = reportText(report, t);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopyNote(t("report.copy.done"));
    } catch {
      setCopyFailed(true);
      setCopyNote(t("report.copy.failed"));
    }
  }

  return (
    <>
      <PageTitle>{t("report.title")}</PageTitle>
      <p className="hint">{mission.title}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => void copy()}>
          {t("report.copy")}
        </button>
      </div>
      <p role="status">{copyNote}</p>
      {copyFailed && (
        <>
          <label htmlFor="report-copy-text">{t("report.copy.label")}</label>
          <textarea id="report-copy-text" className="voice-test-text" readOnly rows={8} value={text} onFocus={(event) => event.currentTarget.select()} />
        </>
      )}

      {leveledUp && (
        <div className={fresh ? "levelup levelup-fresh" : "levelup"} role="status">
          <p className="levelup-main">{t("report.levelup", { n: after.level })}</p>
          {newTitle && <p>{t("report.levelup.title", { title: t(`hud.title.${after.title}`) })}</p>}
        </div>
      )}

      <section aria-labelledby="cando-title">
        <h2 id="cando-title">{run.canDo ? t("report.cando.yes") : t("report.cando.no")}</h2>
        <p className="cando-text">{mission.can_do}</p>
        {!run.canDo && <p className="hint">{t("report.cando.no_hint")}</p>}
        <p>
          <span className="stars" aria-hidden="true">
            {"★".repeat(stars)}
            {"☆".repeat(3 - stars)}
          </span>{" "}
          <span>{t("report.stars", { n: stars })}</span>
          {stars > starsBefore && <strong className="badge">{t("report.stars.new")}</strong>}
        </p>
      </section>

      <section aria-labelledby="xp-title">
        <h2 id="xp-title">{t("report.xp.title")}</h2>
        <ul className="plain-list">
          <li>{t("report.xp.conversation", { n: conversationXp })}</li>
          <li>{t("report.xp.prizes", { n: prizeXp })}</li>
          <li>
            <strong>{t("report.xp.total", { n: conversationXp + prizeXp })}</strong>
          </li>
        </ul>
        <p className="hint">{t("report.level", { n: after.level, title: t(`hud.title.${after.title}`) })}</p>
      </section>

      {lines.length > 0 && (
        <section aria-labelledby="said-title">
          <h2 id="said-title">{t("report.said.title")}</h2>
          <ol className="plain-list">
            {lines.map((line, i) => (
              <li key={`${line.node}-${i}`} className="report-item">
                <p className="report-item-title">{t("report.said.turn", { n: i + 1 })}</p>
                <p>{quoted("report.said.you", { said: line.said ?? "" }, mission.target)}</p>
                {line.way.kind === "recast" && <p>{quoted("report.said.recast", { text: line.way.text }, mission.target)}</p>}
                {line.way.kind === "model" && (
                  <>
                    <p>{quoted("report.said.model", { text: line.way.text }, mission.target)}</p>
                    <p className="hint" lang={mission.base}>{line.way.translation}</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="recasts-title">
        <h2 id="recasts-title">{t("report.recasts.title")}</h2>
        {patterns.length === 0 ? (
          <p>{t("report.recasts.none")}</p>
        ) : (
          <ul className="plain-list">
            {patterns.map((pattern) => (
              <li key={pattern.id} className="report-item">
                {pattern.title !== undefined && <p className="report-item-title">{pattern.title}</p>}
                {pattern.recast && <p>{quoted("report.recasts.said", { original: pattern.recast.original, corrected: pattern.recast.corrected }, mission.target)}</p>}
                {pattern.explanation !== undefined && <p>{pattern.explanation}</p>}
                {pattern.example && (
                  <p className="hint">
                    {quoted("report.recasts.wrong", { text: pattern.example.wrong }, mission.target)} → {quoted("report.recasts.right", { text: pattern.example.right }, mission.target)}
                  </p>
                )}
                <p className="hint">{t("report.recasts.times", { n: pattern.count })}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {words.length > 0 && (
        <section aria-labelledby="words-title">
          <h2 id="words-title">{t("report.words.title")}</h2>
          <ul className="plain-list">
            {words.map((word) => (
              <li key={word.term} className="report-item">
                <p>
                  <strong lang={mission.target}>{word.term}</strong> — {word.translation}
                </p>
                {word.example !== undefined && (
                  <p className="hint" lang={mission.target}>
                    {word.example}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {closing && (
        <section aria-labelledby="closing-title">
          <h2 id="closing-title">{t("report.closing.title")}</h2>
          {closing.input === "tap" ? (
            <>
              <p>{t("report.closing.tap")}</p>
              <p>{quoted("report.said.model", { text: mission.closing.model_answer.text }, mission.target)}</p>
              <p className="hint" lang={mission.base}>{mission.closing.model_answer.translation}</p>
            </>
          ) : (
            <>
              <p>{quoted("report.said.you", { said: closing.text }, mission.target)}</p>
              {closingWay?.kind === "recast" && <p>{quoted("report.said.recast", { text: closingWay.text }, mission.target)}</p>}
              {closingWay?.kind === "model" && (
                <>
                  <p>{quoted("report.said.model", { text: closingWay.text }, mission.target)}</p>
                  <p className="hint" lang={mission.base}>{closingWay.translation}</p>
                </>
              )}
            </>
          )}
        </section>
      )}

      <section aria-labelledby="next-title">
        <h2 id="next-title">{t("report.next.title")}</h2>
        {next?.kind === "again" && (
          <>
            <p>
              <Link className="btn btn-primary btn-big" to={`/play/${mission.id}`} aria-describedby="again-hint">
                {t(AGAIN[next.mode].label)}
              </Link>
            </p>
            <p id="again-hint" className="hint">
              {t(AGAIN[next.mode].hint, { base: langName(t, mission.base), target: langName(t, mission.target) })}
            </p>
          </>
        )}
        {next?.kind === "mission" && (
          <p>
            <Link className="btn btn-primary btn-big" to={`/play/${next.id}`}>
              {t("report.next.mission", { title: next.title })}
            </Link>
          </p>
        )}
        {next?.kind !== "again" && (
          <>
            <p>
              <Link className="btn" to={`/play/${mission.id}`} aria-describedby="replay-hint">
                {t("report.next.replay")}
              </Link>
            </p>
            <p id="replay-hint" className="hint">
              {t("report.next.replay.hint")}
            </p>
          </>
        )}
        <p>
          <Link className="btn" to="/">
            {t("report.next.village")}
          </Link>
        </p>
      </section>
    </>
  );
}
