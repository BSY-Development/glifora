import { useSyncExternalStore } from "react";
import { getLocale, subscribe, translate, type Locale, type MessageKey, type Params } from "../i18n";

/** Idioma atual da interface; re-renderiza na troca. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}

/** `const t = useT(); t('app.name')`. A função muda quando o idioma muda, então a tela inteira atualiza. */
export function useT(): (key: MessageKey, params?: Params) => string {
  const locale = useLocale();
  return (key, params) => translate(locale, key, params);
}
