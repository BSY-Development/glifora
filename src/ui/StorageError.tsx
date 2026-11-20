// Mostrada no lugar do app quando o banco local não abre (main.tsx).
import { LanguageSelector } from "./LanguageSelector";
import { PageTitle } from "./PageTitle";
import { useT } from "./useT";

export function StorageError() {
  const t = useT();
  return (
    <div className="centered">
      <LanguageSelector />
      <PageTitle>{t("storage_error.title")}</PageTitle>
      <p>{t("storage_error.text")}</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t("error.reload")}
      </button>
    </div>
  );
}
