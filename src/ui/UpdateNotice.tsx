// Aviso "Nova versão disponível" (W1-12): aparece só com o app aberto e uma versão nova esperando.
import { useSyncExternalStore } from "react";
import { applyUpdate, hasUpdate, subscribeUpdate } from "../services/appUpdate";
import { useT } from "./useT";

export function UpdateNotice() {
  const t = useT();
  const available = useSyncExternalStore(subscribeUpdate, hasUpdate);
  if (!available) return null;
  return (
    <div className="update-notice" role="status">
      <span>{t("update.available")}</span>
      <button type="button" className="btn btn-primary" onClick={applyUpdate}>
        {t("update.apply")}
      </button>
    </div>
  );
}
