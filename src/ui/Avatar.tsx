import { PixelArt } from "./art/PixelArt";
import { avatarArt, type Figure } from "./art/sprites";

/** A figura do avatar (decorativa: quem a nomeia é o texto ao lado). */
export function Avatar({ figure, className }: { figure: Figure; className?: string }) {
  const art = avatarArt(figure);
  return <PixelArt rows={art.rows} palette={art.palette} className={className} />;
}
