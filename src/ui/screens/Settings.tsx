// Casca (W1-08) com a seção "Seus dados" (exportar, importar e apagar: W1-09). Movimento, sons e texto chegam na W1-10.
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";
import { DataSection } from "./DataSection";

export function Settings() {
  const t = useT();
  return (
    <>
      <PageTitle>{t("settings.title")}</PageTitle>
      <p>{t("settings.text")}</p>
      <DataSection />
    </>
  );
}
