// Antes de começar: o que é a missão, a escolha do modo (o sugerido é o próximo degrau a conquistar) ou, se havia uma
// rodada em andamento, continuar ou recomeçar. A primeira fala sai do toque em "Começar" (política de áudio).
import { Link } from "react-router";
import type { Mode, Prepared } from "../../services/play";
import { ChoiceGroup } from "../ChoiceGroup";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

interface Props {
  prepared: Prepared;
  mode: Mode;
  onMode: (mode: Mode) => void;
  resumable: boolean;
  onResume: () => void;
  onRestart: () => void;
  onStart: () => void;
}

const MODE_LABEL = { 1: "play.mode.1", 2: "play.mode.2", 3: "play.mode.3" } as const;
const MODE_HINT = { 1: "play.mode.1.hint", 2: "play.mode.2.hint", 3: "play.mode.3.hint" } as const;

export function Intro({ prepared, mode, onMode, resumable, onResume, onRestart, onStart }: Props) {
  const t = useT();
  const { mission, stars, suggested } = prepared;
  const boss = mission.kind === "boss";

  return (
    <>
      <PageTitle>{mission.title}</PageTitle>
      <p className="hint">
        <Link to={`/place/${mission.location}`}>{t("play.back")}</Link>
      </p>
      <p>{mission.description}</p>
      <section aria-labelledby="goal-title">
        <h2 id="goal-title">{t("play.goal")}</h2>
        <p>{mission.can_do}</p>
        <p className="hint">{t("place.mission.stars", { n: stars })}</p>
      </section>

      {resumable ? (
        <section aria-labelledby="resume-title" className="notice">
          <h2 id="resume-title">{t("play.resume.title")}</h2>
          <p>{t("play.resume.text")}</p>
          <div className="actions">
            <button type="button" autoFocus className="btn btn-primary btn-big" onClick={onResume}>
              {t("play.resume.continue")}
            </button>
            <button type="button" className="btn" onClick={onRestart}>
              {t("play.resume.restart")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {boss ? (
            <p className="notice">{t("play.mode.boss")}</p>
          ) : (
            <ChoiceGroup<"1" | "2" | "3">
              legend={t("play.mode.title")}
              name="play-mode"
              value={String(mode) as "1" | "2" | "3"}
              options={([1, 2, 3] as const).map((m) => ({
                value: String(m) as "1" | "2" | "3",
                label: m === suggested ? `${t(MODE_LABEL[m])} · ${t("play.mode.suggested")}` : t(MODE_LABEL[m]),
                hint: t(MODE_HINT[m]),
              }))}
              onChange={(value) => onMode(Number(value) as Mode)}
            />
          )}
          <p className="continue">
            <button type="button" autoFocus className="btn btn-primary btn-big" onClick={onStart}>
              {t("play.start")}
            </button>
          </p>
        </>
      )}
    </>
  );
}
