// /play/:id (W2-08): abre a missão (validada pelo catálogo) e entrega ao player. Missão que não abre: tela amigável, nunca branca.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { prepare, type PrepareResult } from "../../services/play";
import { Loading } from "../Loading";
import { PageTitle } from "../PageTitle";
import { Player } from "../play/Player";
import { useT } from "../useT";

export function Play() {
  const t = useT();
  const { id = "" } = useParams();
  const [loaded, setLoaded] = useState<{ id: string; result: PrepareResult } | null>(null);

  useEffect(() => {
    let current = true;
    void prepare(id).then(
      (result) => current && setLoaded({ id, result }),
      () => current && setLoaded({ id, result: { ok: false, reason: "missing" } }),
    );
    return () => {
      current = false;
    };
  }, [id]);

  const ready = loaded?.id === id ? loaded.result : null;
  if (ready === null) {
    return (
      <>
        <PageTitle>{t("common.loading")}</PageTitle>
        <Loading />
      </>
    );
  }
  if (!ready.ok) {
    return (
      <>
        <PageTitle>{t("play.error.title")}</PageTitle>
        <p>{t("play.error.text")}</p>
        <p>
          <Link className="btn" to="/">
            {t("place.back")}
          </Link>
        </p>
      </>
    );
  }
  return <Player key={id} prepared={ready.prepared} />;
}
