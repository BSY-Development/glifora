import { Link } from "react-router";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function NotFound() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("notfound.title")}</PageTitle>
      <p>{t("notfound.text")}</p>
      <p>
        <Link className="btn btn-primary" to="/">
          {t("notfound.home")}
        </Link>
      </p>
    </>
  );
}
