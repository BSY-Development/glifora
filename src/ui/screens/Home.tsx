// A vila (W1-11): mapa em DOM + CSS (sem canvas). Os locais vêm do catálogo; cada um é um link com rótulo.
// Primeira visita (sem perfil): leva para /welcome.
import { Link, Navigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_AVATAR, loadAvatar, loadProfile } from "../../services/player";
import { loadInProgress } from "../../services/play";
import { loadProgress } from "../../services/progress";
import { getLocations } from "../../services/world";
import { Avatar } from "../Avatar";
import { IosInstallNotice } from "../IosInstallNotice";
import { Loading } from "../Loading";
import { PageTitle } from "../PageTitle";
import { Street } from "../Street";
import { useT } from "../useT";
import { PLACE_ART, PLACE_NAME } from "../world";

export function Home() {
  const t = useT();
  const profile = useLiveQuery(() => loadProfile());
  const avatar = useLiveQuery(() => loadAvatar()) ?? DEFAULT_AVATAR;
  // Até ter a soma do livro-razão não há número: nada de "Nível 1" falso para quem já está bem acima.
  const progress = useLiveQuery(() => loadProgress());
  // A rodada guardada em `session` (W2-20): o cartão leva de volta para ela. `null` = nenhuma.
  const mission = useLiveQuery(() => loadInProgress());

  // Mesmo enquanto o perfil carrega, o título já existe: o Layout põe o foco nele ao trocar de rota.
  if (profile === undefined) {
    return (
      <>
        <PageTitle>{t("home.title")}</PageTitle>
        <Loading />
      </>
    );
  }
  if (profile === null) return <Navigate to="/welcome" replace />;

  const greeting = profile.nickname === "" ? t("home.greeting_anon") : t("home.greeting", { name: profile.nickname });

  return (
    <>
      <PageTitle>{t("home.title")}</PageTitle>

      <section className="hud" aria-label={t("hud.label")}>
        <Avatar figure={avatar.figure} className="hud-avatar" />
        <div className="hud-info">
          <p className="hud-name">{greeting}</p>
          <p className="hud-level">
            {progress === undefined ? t("common.loading") : `${t("hud.level", { n: progress.level })} · ${t(`hud.title.${progress.title}`)}`}
          </p>
          {/* A barra é só o desenho; o número vai em texto logo abaixo, para o leitor de tela e para quem aumenta a letra. */}
          {progress !== undefined && (
            <>
              <progress className="xp" aria-hidden="true" value={progress.into} max={progress.into + progress.toNext} />
              <p className="hud-xp">{t("hud.xp", { into: progress.into, total: progress.into + progress.toNext })}</p>
            </>
          )}
        </div>
      </section>

      <IosInstallNotice />

      {mission && (
        <section className="resume-card" aria-labelledby="resume-card-title">
          <p id="resume-card-title" className="resume-card-title">
            {t("home.resume.title")}
          </p>
          <p className="resume-card-mission">{mission.title}</p>
          <Link className="btn btn-primary" to={`/play/${mission.id}`}>
            {t("home.resume.continue")}
          </Link>
        </section>
      )}

      <p className="hint">{t(getLocations().length > 2 ? "home.hint_swipe" : "home.hint")}</p>

      <Street places={getLocations().map((location) => ({ id: location.id, name: PLACE_NAME[location.id], art: PLACE_ART[location.id] }))} />
    </>
  );
}
