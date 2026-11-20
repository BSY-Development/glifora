// Fala de alguém na conversa: nome, texto (sempre à vista, nada depende só de som), ouvir de novo e tradução sob demanda.
// O texto é sempre texto puro. `children` troca o texto (o recast destacado da reação).
import { useId, useState, type ReactNode } from "react";
import { PixelArt } from "../art/PixelArt";
import type { Art } from "../art/sprites";
import { useT } from "../useT";

interface Props {
  name: string;
  text: string;
  /** Idioma do texto (marca BCP 47 ou código), para o leitor de tela pronunciar certo. */
  lang?: string;
  translation?: string | undefined;
  tone?: "npc" | "me" | "model";
  art?: Art | undefined;
  onReplay?: (() => void) | undefined;
  children?: ReactNode;
}

export function Bubble({ name, text, lang, translation, tone = "npc", art, onReplay, children }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const translationId = useId();
  return (
    <div className={`bubble bubble-${tone}`}>
      {art && <PixelArt rows={art.rows} palette={art.palette} className="bubble-art" />}
      <div className="bubble-body">
        <p className="bubble-name">{name}</p>
        <p className="bubble-text" lang={lang}>
          {children ?? text}
        </p>
        {open && translation !== undefined && (
          <p className="bubble-translation" id={translationId}>
            {translation}
          </p>
        )}
        {(translation !== undefined || onReplay) && (
          <div className="bubble-actions">
            {onReplay && (
              <button type="button" className="btn btn-small" onClick={onReplay}>
                {t("play.replay")}
              </button>
            )}
            {translation !== undefined && (
              <button type="button" className="btn btn-small" aria-expanded={open} aria-controls={open ? translationId : undefined} onClick={() => setOpen(!open)}>
                {open ? t("play.translation.hide") : t("play.translation.show")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
