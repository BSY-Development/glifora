// Tela provisória do esqueleto (W1-01), já com i18n (W1-05). As telas de verdade chegam nas próximas tarefas.
import { LanguageSelector } from "./LanguageSelector";
import { useT } from "./useT";

export function App() {
  const t = useT();
  return (
    <>
      <main>
        <h1>{t("app.name")}</h1>
        <p>{t("app.tagline")}</p>
        <p>{t("app.under_construction")}</p>
      </main>
      <footer>
        <LanguageSelector />
      </footer>
    </>
  );
}
