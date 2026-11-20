import { getAppInfo } from "../../services/about";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

/** Onde está o código (a AGPL-3.0, seção 13, pede que quem usa pela rede possa obtê-lo). */
const SOURCE_URL = "https://github.com/BSY-Development/glifora";

export function About() {
  const t = useT();
  const { version, commit } = getAppInfo();
  return (
    <>
      <PageTitle>{t("about.title")}</PageTitle>
      <p>{t("about.text")}</p>
      <p>{t("about.version", { version })}</p>
      <p>{t("about.commit", { commit })}</p>
      <h2>{t("about.license.title")}</h2>
      <p>{t("about.license.code")}</p>
      <p>{t("about.license.content")}</p>
      <p>{t("about.license.name")}</p>
      <p>
        <a href={SOURCE_URL} rel="noopener noreferrer">
          {t("about.source")}
        </a>
      </p>
    </>
  );
}
