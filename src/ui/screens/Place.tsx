// Um local da vila (W1-11): quem mora ali e "missões em breve". Id que não existe em content/world/locations.json → 404.
import { Link, useParams } from "react-router";
import { getLocation } from "../../services/world";
import { PixelArt } from "../art/PixelArt";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";
import { NotFound } from "./NotFound";
import { PLACE_ABOUT, PLACE_ART, PLACE_NAME, npcView } from "../world";

export function Place() {
  const t = useT();
  const { id = "" } = useParams();
  const location = getLocation(id);
  if (!location) return <NotFound />;

  const art = PLACE_ART[location.id];
  const npcs = location.npcs.flatMap((npcId) => npcView(npcId) ?? []);

  return (
    <>
      <PageTitle>{t(PLACE_NAME[location.id])}</PageTitle>
      <PixelArt rows={art.rows} palette={art.palette} className="place-hero" />
      <p>{t(PLACE_ABOUT[location.id])}</p>

      {npcs.length > 0 && (
        <section aria-labelledby="npcs-title">
          <h2 id="npcs-title">{t("place.npcs")}</h2>
          <ul className="npcs">
            {npcs.map((npc) => (
              <li key={npc.name} className="npc-card">
                <PixelArt rows={npc.art.rows} palette={npc.art.palette} className="npc-art" />
                <div>
                  <p className="npc-name">{t(npc.name)}</p>
                  <p className="hint">{t(npc.role)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="notice">{t("place.soon")}</p>
      <p>
        <Link className="btn" to="/">
          {t("place.back")}
        </Link>
      </p>
    </>
  );
}
