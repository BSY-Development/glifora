// Casca (W1-08). Apelido, avatar e idiomas chegam na W1-10.
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function Profile() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("profile.title")}</PageTitle>
      <p>{t("profile.text")}</p>
    </>
  );
}
