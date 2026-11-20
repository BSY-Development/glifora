// Preferências de exibição: tamanho do texto e movimento. Viram atributos no <html>; o app.css faz o resto.
//  - texto: `html[data-text-size]` muda o tamanho-base (a tela inteira usa rem, então tudo escala junto);
//  - movimento: `html[data-motion]` = "on" (reduzir), "off" (não reduzir) ou ausente (segue o `prefers-reduced-motion` do sistema).
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { loadPrefs, type Prefs } from "../services/player";

export function applyDisplayPrefs(prefs: Pick<Prefs, "textSize" | "reduceMotion">, root: HTMLElement = document.documentElement): void {
  root.dataset["textSize"] = prefs.textSize;
  if (prefs.reduceMotion === "system") delete root.dataset["motion"];
  else root.dataset["motion"] = prefs.reduceMotion;
}

/** Mantém o <html> em dia com as preferências guardadas (muda na hora quando a pessoa troca em /settings). */
export function useDisplayPrefs(): void {
  const prefs = useLiveQuery(() => loadPrefs());
  useEffect(() => {
    if (prefs) applyDisplayPrefs(prefs);
  }, [prefs]);
}
