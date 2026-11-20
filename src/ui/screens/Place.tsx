// Casca (W1-08). A padaria e a Tilda chegam na W1-11.
import { useParams } from "react-router";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function Place() {
  const t = useT();
  const { id = "" } = useParams();
  return (
    <>
      <PageTitle>{t("place.title")}</PageTitle>
      <p>{t("place.name", { id })}</p>
      <p>{t("place.soon")}</p>
    </>
  );
}
