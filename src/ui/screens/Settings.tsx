// Ajustes (W1-10): tamanho do texto, movimento e sons. Valem na hora (ui/display.ts aplica no <html>) e ficam guardados.
// Sons: só guarda; ainda não há som no jogo. Depois, "Seus dados" (exportar, importar, apagar: W1-09).
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_PREFS, loadPrefs, updatePrefs, type Prefs } from "../../services/player";
import { ChoiceGroup } from "../ChoiceGroup";
import { PageTitle } from "../PageTitle";
import { useT } from "../useT";
import { DataSection } from "./DataSection";

export function Settings() {
  const t = useT();
  const prefs = useLiveQuery(() => loadPrefs()) ?? DEFAULT_PREFS;
  const [failed, setFailed] = useState<"textSize" | "reduceMotion" | "sounds" | null>(null);

  function change(group: "textSize" | "reduceMotion" | "sounds", patch: Partial<Prefs>) {
    setFailed(null);
    updatePrefs(patch).catch(() => setFailed(group));
  }

  return (
    <>
      <PageTitle>{t("settings.title")}</PageTitle>
      <p>{t("settings.text")}</p>

      <ChoiceGroup
        legend={t("settings.textsize")}
        name="text-size"
        value={prefs.textSize}
        options={[
          { value: "normal", label: t("settings.textsize.normal") },
          { value: "large", label: t("settings.textsize.large") },
          { value: "xlarge", label: t("settings.textsize.xlarge") },
        ]}
        error={failed === "textSize" ? t("common.save_failed") : null}
        onChange={(textSize) => change("textSize", { textSize })}
      />

      <ChoiceGroup
        legend={t("settings.motion")}
        name="reduce-motion"
        value={prefs.reduceMotion}
        options={[
          { value: "system", label: t("settings.motion.system"), hint: t("settings.motion.system_hint") },
          { value: "on", label: t("settings.motion.on") },
          { value: "off", label: t("settings.motion.off") },
        ]}
        error={failed === "reduceMotion" ? t("common.save_failed") : null}
        onChange={(reduceMotion) => change("reduceMotion", { reduceMotion })}
      />

      <div className="field">
        <label className="choice">
          <input
            type="checkbox"
            checked={prefs.sounds}
            aria-labelledby="sounds-label"
            aria-describedby="sounds-hint"
            onChange={(event) => change("sounds", { sounds: event.target.checked })}
          />
          <span className="choice-card">
            <span className="choice-text">
              <span className="choice-label" id="sounds-label">
                {t("settings.sounds")}
              </span>
              <span className="choice-hint" id="sounds-hint">
                {t("settings.sounds.hint")}
              </span>
            </span>
          </span>
        </label>
        {failed === "sounds" && (
          <p className="notice notice-error" role="alert">
            {t("common.save_failed")}
          </p>
        )}
      </div>

      <DataSection />
    </>
  );
}
