// A vila como rua com rolagem lateral (D-52, W2-17): os locais lado a lado, cerca de 2 por vez em 360 px, com
// scroll-snap, pontinhos de posição, setas e teclado. Para o leitor de tela é uma lista de links; setas e pontinhos
// são só ajuda de quem enxerga e desliza. Lembra a última posição (conveniência local, com try/catch).
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import type { MessageKey } from "../i18n";
import type { LocationId } from "../schemas";
import { PixelArt } from "./art/PixelArt";
import type { Art } from "./art/sprites";
import { useT } from "./useT";

export interface StreetPlace {
  id: LocationId;
  name: MessageKey;
  art: Art;
}

export const STREET_POS_KEY = "glifora.street.pos";

function readPos(key = STREET_POS_KEY): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePos(n: number, key = STREET_POS_KEY): void {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // sem onde guardar: a rua volta ao começo na próxima visita
  }
}

const reduced = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `locked`: silhuetas dos locais que a fase 3 vai abrir. Só o visual: não são links nem entram na lista. */
export function Street({ places, locked = [] }: { places: readonly StreetPlace[]; locked?: readonly Art[] }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const slots = places.length + locked.length;

  const slotWidth = useCallback((): number => {
    const first = track.current?.querySelector("li");
    return first instanceof HTMLElement ? first.offsetWidth : 0;
  }, []);

  // Volta à última posição (sem animar).
  useEffect(() => {
    const el = track.current;
    const w = slotWidth();
    const saved = Math.min(readPos(), Math.max(0, slots - 1));
    if (el && w > 0 && saved > 0) {
      el.scrollLeft = saved * w;
      setPos(saved);
    }
  }, [slots, slotWidth]);

  function onScroll() {
    const el = track.current;
    const w = slotWidth();
    if (!el || w === 0) return;
    const next = Math.min(Math.max(0, Math.round(el.scrollLeft / w)), Math.max(0, slots - 1));
    setPos(next);
    writePos(next);
  }

  function go(to: number) {
    const el = track.current;
    const w = slotWidth();
    if (!el || w === 0) return;
    const clamped = Math.min(Math.max(0, to), Math.max(0, slots - 1));
    el.scrollTo({ left: clamped * w, behavior: reduced() ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") go(pos + 1);
    else if (event.key === "ArrowLeft") go(pos - 1);
    else return;
    event.preventDefault();
  }

  return (
    <section className="street" aria-label={t("street.label")}>
      <div className="street-track" ref={track} onScroll={onScroll} onKeyDown={onKeyDown}>
        <ul className="street-list" aria-label={t("map.places")}>
          {places.map((location) => (
            <li key={location.id} className="street-slot">
              <Link to={`/place/${location.id}`} className="place-link">
                <PixelArt rows={location.art.rows} palette={location.art.palette} className="place-art" />
                <span className="place-label">{t(location.name)}</span>
              </Link>
            </li>
          ))}
          {locked.map((art, i) => (
            <li key={`locked-${i}`} className="street-slot street-locked" aria-hidden="true">
              <PixelArt rows={art.rows} palette={art.palette} className="place-art" />
            </li>
          ))}
        </ul>
      </div>
      {slots > 2 && (
        <div className="street-nav">
          <button type="button" className="street-arrow" onClick={() => go(pos - 1)} disabled={pos <= 0} aria-label={t("street.prev")}>
            ‹
          </button>
          <span className="street-dots" aria-hidden="true">
            {Array.from({ length: slots }, (_, i) => (
              <span key={i} className={i === pos ? "street-dot street-dot-on" : "street-dot"} />
            ))}
          </span>
          <button type="button" className="street-arrow" onClick={() => go(pos + 1)} disabled={pos >= slots - 2} aria-label={t("street.next")}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}
