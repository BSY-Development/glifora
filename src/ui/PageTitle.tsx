import { useEffect } from "react";
import { useT } from "./useT";

/**
 * O título (h1) de cada tela. O Layout põe o foco aqui ao trocar de rota, para o leitor de tela
 * anunciar a tela nova, e o título da aba acompanha.
 */
export function PageTitle({ children }: { children: string }) {
  const t = useT();
  const appName = t("app.name");
  useEffect(() => {
    document.title = children === appName ? appName : `${children} · ${appName}`;
  }, [children, appName]);
  return (
    <h1 id="page-title" tabIndex={-1}>
      {children}
    </h1>
  );
}
