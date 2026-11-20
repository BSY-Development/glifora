// Mensagem de interface com trechos em outro idioma: cada trecho vira <span lang=...> para o leitor de tela trocar de voz.
// Os trechos entram na mensagem como marcadores e saem como texto puro (nunca HTML).
import type { ReactNode } from "react";
import type { MessageKey } from "../i18n";
import { useT } from "./useT";

const MARK = "\u0001";

export function useQuoted(): (key: MessageKey, quotes: Readonly<Record<string, string>>, lang: string) => ReactNode[] {
  const t = useT();
  return (key, quotes, lang) => {
    const names = Object.keys(quotes);
    const params = Object.fromEntries(names.map((name) => [name, `${MARK}${name}${MARK}`]));
    return t(key, params)
      .split(MARK)
      .map((piece, i) => (i % 2 === 1 ? <span key={i} lang={lang}>{quotes[piece] ?? piece}</span> : piece));
  };
}
