import { useT } from "./useT";

/** Aparece enquanto o código da primeira rota carrega (HydrateFallback do React Router). */
export function Loading() {
  const t = useT();
  return (
    <p className="centered" role="status">
      {t("common.loading")}
    </p>
  );
}
