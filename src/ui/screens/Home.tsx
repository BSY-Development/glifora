// A vila (W1-11): mapa em DOM + CSS (sem canvas). Os locais vêm do catálogo; cada um é um link com rótulo.
// Primeira visita (sem perfil): leva para /welcome.
import { Link, Navigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_AVATAR, loadAvatar, loadProfile } from "../../services/player";
import { getLocations } from "../../services/world";
import { Avatar } from "../Avatar";
import { PixelArt } from "../art/PixelArt";
import { VILLAGE } from "../art/sprites";
import { IosInstallNotice } from "../IosInstallNotice";
import { Loading } from "../Loading";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";
import { PLACE_ART, PLACE_NAME } from "../world";

export function Home() {
  const t = useT();
  const profile = useLiveQuery(() => loadProfile());
  const avatar = useLiveQuery(() => loadAvatar()) ?? DEFAULT_AVATAR;

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
            {t("hud.level", { n: 1 })} · {t("hud.title.apprentice")}
          </p>
          {/* Enfeite por enquanto: o XP de verdade chega na fase 2. */}
          <div className="xp" aria-hidden="true">
            <div className="xp-fill" />
          </div>
        </div>
      </section>

      <IosInstallNotice />

      <p className="hint">{t("home.hint")}</p>

      <div className="village">
        <PixelArt rows={VILLAGE.rows} palette={VILLAGE.palette} className="village-art" />
        <ul className="places" aria-label={t("map.places")}>
          {getLocations().map((location) => (
            <li key={location.id} className={`spot spot-${location.id}`}>
              <Link to={`/place/${location.id}`} className="place-link">
                <PixelArt rows={PLACE_ART[location.id].rows} palette={PLACE_ART[location.id].palette} className="place-art" />
                <span className="place-label">{t(PLACE_NAME[location.id])}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
