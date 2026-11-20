import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function Home() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("home.title")}</PageTitle>
      <p>{t("app.tagline")}</p>
      <p>{t("home.text")}</p>
    </>
  );
}
