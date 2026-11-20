import { getAppInfo } from "../../services/about";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function About() {
  const t = useT();
  const { version, commit } = getAppInfo();
  return (
    <>
      <PageTitle>{t("about.title")}</PageTitle>
      <p>{t("about.text")}</p>
      <p>{t("about.version", { version })}</p>
      <p>{t("about.commit", { commit })}</p>
    </>
  );
}
