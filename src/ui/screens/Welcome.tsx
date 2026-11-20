// Casca (W1-08). O conteúdo (idioma e apelido) é da W1-10.
import { Link } from "react-router";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function Welcome() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("welcome.title")}</PageTitle>
      <p>{t("welcome.text")}</p>
      <p>
        <Link className="btn btn-primary" to="/">
          {t("nav.home")}
        </Link>
      </p>
    </>
  );
}
