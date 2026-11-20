import { LOCALES, isLocale, setLocale, type Locale, type MessageKey } from "../i18n";
import { useLocale, useT } from "./useT";

const NAME_KEY = { "pt-BR": "lang.name.pt-BR", en: "lang.name.en" } as const satisfies Record<Locale, MessageKey>;

/** Seletor do idioma da interface. Sempre acessível: primeira tela, configurações e rodapé (SPEC). */
export function LanguageSelector() {
  const t = useT();
  const locale = useLocale();
  return (
    <label className="lang-select">
      {t("lang.label")}{" "}
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {t(NAME_KEY[code])}
          </option>
        ))}
      </select>
    </label>
  );
}
