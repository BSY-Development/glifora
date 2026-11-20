// "Este navegador não ouve": aparece uma vez só, onde a pessoa ia usar o microfone (o player de missões, W2-08).
// O microfone some e digitar vira o caminho principal; o aviso só explica o porquê.
import { useState } from "react";
import { dismissNoMicNotice, shouldShowNoMicNotice } from "../services/voice";
import { useT } from "./useT";

export function NoMicNotice() {
  const t = useT();
  const [visible, setVisible] = useState(shouldShowNoMicNotice);
  if (!visible) return null;
  return (
    <div className="notice" role="status">
      <p>{t("voice.nomic.notice")}</p>
      <button
        type="button"
        className="btn"
        onClick={() => {
          dismissNoMicNotice();
          setVisible(false);
        }}
      >
        {t("voice.nomic.dismiss")}
      </button>
    </div>
  );
}
