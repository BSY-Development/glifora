// Tela de erro amigável (rota que quebrou, pedaço de código que não carregou offline). Sem detalhe técnico na tela.
import { Link } from "react-router";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";

export function ErrorScreen() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("error.title")}</PageTitle>
      <p>{t("error.text")}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t("error.reload")}
        </button>
        <Link className="btn" to="/">
          {t("notfound.home")}
        </Link>
      </div>
    </>
  );
}

/** Erro fora da casca: sem o Layout, esta tela precisa do próprio landmark main. */
export function RootErrorScreen() {
  return (
    <main className="page">
      <ErrorScreen />
    </main>
  );
}
