// Perfil (W1-10): apelido, avatar, idioma da interface e idioma base. Tudo vai para o IndexedDB.
// As escolhas (avatar, idiomas) valem na hora; o apelido é texto livre e tem o botão "Salvar".
import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { LOCALES, isLocale, setLocale, type Locale, type MessageKey } from "../../i18n";
import {
  AVATAR_FIGURES,
  DEFAULT_AVATAR,
  DEFAULT_PREFS,
  checkNickname,
  loadAvatar,
  loadPrefs,
  loadProfile,
  saveNickname,
  updateAvatar,
  updatePrefs,
  type NicknameCheck,
} from "../../services/player";
import { Avatar } from "../Avatar";
import { ChoiceGroup } from "../ChoiceGroup";
import { NicknameField } from "../NicknameField";
import { PageTitle } from "../PageTitle";
import { useLocale, useT } from "../useT";

const NAME_KEY = { "pt-BR": "lang.name.pt-BR", en: "lang.name.en" } as const satisfies Record<Locale, MessageKey>;
const FIGURE_KEY = {
  a: "avatar.a",
  b: "avatar.b",
  c: "avatar.c",
  d: "avatar.d",
} as const satisfies Record<(typeof AVATAR_FIGURES)[number], MessageKey>;

type BaseChoice = "same" | Locale;

export function Profile() {
  const t = useT();
  const locale = useLocale();
  const profile = useLiveQuery(() => loadProfile());
  const prefs = useLiveQuery(() => loadPrefs()) ?? DEFAULT_PREFS;
  const avatar = useLiveQuery(() => loadAvatar()) ?? DEFAULT_AVATAR;
  const [draft, setDraft] = useState<string | null>(null); // null = ainda não editou: vale o apelido guardado
  const [problem, setProblem] = useState<Extract<NicknameCheck, { ok: false }>["reason"] | null>(null);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);

  const nickname = draft ?? profile?.nickname ?? "";

  async function guarded(action: () => Promise<void>) {
    try {
      await action();
      setStatus(null);
    } catch {
      setStatus("failed");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkNickname(nickname);
    setProblem(check.ok ? null : check.reason);
    if (!check.ok) return;
    try {
      await saveNickname(check.value);
      setDraft(null);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  const baseValue: BaseChoice = prefs.baseLang === "pt-BR" || prefs.baseLang === "en" ? prefs.baseLang : "same";

  return (
    <>
      <PageTitle>{t("profile.title")}</PageTitle>

      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <NicknameField
          label={t("profile.nickname")}
          value={nickname}
          onChange={(value) => {
            setDraft(value);
            setStatus(null);
          }}
          problem={problem}
        />
        <p>
          <button type="submit" className="btn btn-primary">
            {t("profile.save")}
          </button>
        </p>
      </form>

      <ChoiceGroup
        legend={t("profile.avatar")}
        name="avatar"
        layout="row"
        value={avatar.figure}
        options={AVATAR_FIGURES.map((figure) => ({
          value: figure,
          label: t(FIGURE_KEY[figure]),
          visual: <Avatar figure={figure} className="avatar-art" />,
        }))}
        onChange={(figure) => void guarded(() => updateAvatar({ figure }))}
      />

      <ChoiceGroup
        legend={t("lang.label")}
        name="ui-lang"
        value={locale}
        options={LOCALES.map((code) => ({ value: code, label: t(NAME_KEY[code]) }))}
        onChange={(value) => {
          if (isLocale(value)) setLocale(value); // o espelho no doc `prefs` é do services/locale
        }}
      />

      <ChoiceGroup<BaseChoice>
        legend={t("profile.base")}
        name="base-lang"
        value={baseValue}
        options={[
          { value: "same", label: t("profile.base.same") },
          ...LOCALES.map((code) => ({ value: code, label: t(NAME_KEY[code]) })),
        ]}
        onChange={(value) => void guarded(() => updatePrefs({ baseLang: value === "same" ? null : value }))}
      />
      <p className="hint">{t("profile.base.hint")}</p>

      <div aria-live="polite">
        {status === "saved" && <p className="notice">{t("profile.saved")}</p>}
        {status === "failed" && (
          <p className="notice notice-error" role="alert">
            {t("common.save_failed")}
          </p>
        )}
      </div>
    </>
  );
}
