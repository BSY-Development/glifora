// Primeira visita (W1-10): idioma da interface (já detectado, dá para trocar) e apelido opcional.
// Concluir cria o perfil; a partir daí esta tela leva sempre para a vila.
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { LOCALES, isLocale, setLocale, type Locale, type MessageKey } from "../../i18n";
import { checkNickname, loadProfile, saveNickname, type NicknameCheck } from "../../services/player";
import { ChoiceGroup } from "../ChoiceGroup";
import { Loading } from "../Loading";
import { NicknameField } from "../NicknameField";
import { PageTitle } from "../PageTitle";
import { useLocale, useT } from "../useT";

const NAME_KEY = { "pt-BR": "lang.name.pt-BR", en: "lang.name.en" } as const satisfies Record<Locale, MessageKey>;

export function Welcome() {
  const t = useT();
  const locale = useLocale();
  const profile = useLiveQuery(() => loadProfile());
  const [nickname, setNickname] = useState("");
  const [problem, setProblem] = useState<Extract<NicknameCheck, { ok: false }>["reason"] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (profile === undefined) return <Loading />;
  if (profile !== null) return <Navigate to="/" replace />; // já concluiu: nunca mais

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkNickname(nickname);
    setProblem(check.ok ? null : check.reason);
    setFailed(false);
    if (!check.ok) return;
    setBusy(true);
    try {
      await saveNickname(check.value); // o perfil passa a existir e a tela acima redireciona sozinha
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t("welcome.title")}</PageTitle>
      <p>{t("welcome.text")}</p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <ChoiceGroup
          legend={t("lang.label")}
          name="ui-lang"
          value={locale}
          options={LOCALES.map((code) => ({ value: code, label: t(NAME_KEY[code]) }))}
          onChange={(value) => {
            if (isLocale(value)) setLocale(value);
          }}
        />
        <NicknameField label={t("welcome.nickname")} value={nickname} onChange={setNickname} problem={problem} />
        {failed && (
          <p className="field-error" role="alert">
            {t("common.save_failed")}
          </p>
        )}
        <p>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t("welcome.start")}
          </button>
        </p>
      </form>
    </>
  );
}
