// /report/:runId (W2-09): o que a pessoa conseguiu na rodada. Tudo sai do que foi gravado (rodada, eventos, missão e catálogo
// de erros), então o relatório abre igual depois de recarregar. Todo texto de conteúdo é texto puro.
import { Link, useLocation, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { loadReport } from "../../services/play";
import { Loading } from "../Loading";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

const MODE_LABEL = { 1: "play.mode.1", 2: "play.mode.2", 3: "play.mode.3" } as const;

export function Report() {
  const t = useT();
  const { runId = "" } = useParams();
  const location = useLocation();
  const fresh = (location.state as { fresh?: unknown } | null)?.fresh === true;
  const report = useLiveQuery(() => loadReport(runId), [runId]);

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

  const { run, mission, stars, starsBefore, conversationXp, prizeXp, patterns, words, before, after, next } = report;
  const leveledUp = after.level > before.level;
  const newTitle = after.title !== before.title;
  const closing = run.closing;

  return (
    <>
      <PageTitle>{t("report.title")}</PageTitle>
      <p className="hint">{mission.title}</p>

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
        <p className="hint">
          {t("report.level", { n: after.level })} · {t(`hud.title.${after.title}`)}
        </p>
      </section>

      <section aria-labelledby="recasts-title">
        <h2 id="recasts-title">{t("report.recasts.title")}</h2>
        {patterns.length === 0 ? (
          <p>{t("report.recasts.none")}</p>
        ) : (
          <ul className="plain-list">
            {patterns.map((pattern) => (
              <li key={pattern.id} className="report-item">
                {pattern.title !== undefined && <p className="report-item-title">{pattern.title}</p>}
                {pattern.recast && <p>{t("report.recasts.said", { original: pattern.recast.original, corrected: pattern.recast.corrected })}</p>}
                {pattern.explanation !== undefined && <p>{pattern.explanation}</p>}
                {pattern.example && (
                  <p className="hint">
                    {t("report.recasts.wrong", { text: pattern.example.wrong })} → {t("report.recasts.right", { text: pattern.example.right })}
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
            <p>{t("report.closing.tap")}</p>
          ) : (
            <p>
              <span className="hint">{t("report.closing.yours")}</span>
              <br />
              <span lang={mission.target} className="closing-said">
                {closing.text}
              </span>
            </p>
          )}
          <p>
            <span className="hint">{t("report.closing.model")}</span>
            <br />
            <span lang={mission.target} className="closing-said">
              {mission.closing.model_answer.text}
            </span>
            <br />
            <span className="hint">{mission.closing.model_answer.translation}</span>
          </p>
        </section>
      )}

      <section aria-labelledby="next-title">
        <h2 id="next-title">{t("report.next.title")}</h2>
        {next?.kind === "again" && (
          <>
            <p className="hint">{t("report.next.again_hint")}</p>
            <p>
              <Link className="btn btn-primary btn-big" to={`/play/${mission.id}`}>
                {t("report.next.again", { mode: t(MODE_LABEL[next.mode]) })}
              </Link>
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
        <p>
          <Link className="btn" to="/">
            {t("report.next.village")}
          </Link>
        </p>
      </section>
    </>
  );
}
