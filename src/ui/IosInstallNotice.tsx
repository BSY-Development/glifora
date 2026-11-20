// Aviso discreto para iPhone na vila (D-44): instalar na Tela de Início e exportar os dados. Dispensou, não volta.
import { useState } from "react";
import { Link } from "react-router";
import { dismissIosNotice, shouldShowIosNotice } from "../services/install";
import { useT } from "./useT";

export function IosInstallNotice() {
  const t = useT();
  const [visible, setVisible] = useState(() => shouldShowIosNotice());
  if (!visible) return null;
  return (
    <aside className="notice" aria-label={t("install.ios.title")}>
      <p>
        <strong>{t("install.ios.title")}</strong>
      </p>
      <p>{t("install.ios.steps")}</p>
      <p>{t("install.ios.export")}</p>
      <div className="notice-actions">
        <Link to="/settings" className="btn">
          {t("install.ios.settings")}
        </Link>
        <button
          type="button"
          className="btn"
          onClick={() => {
            dismissIosNotice();
            setVisible(false);
          }}
        >
          {t("install.ios.dismiss")}
        </button>
      </div>
    </aside>
  );
}
