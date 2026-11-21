// Campo do apelido (texto puro, com limite). Usado na primeira visita e no perfil.
import { useId } from "react";
import { NICKNAME_INPUT_MAX, type NicknameCheck } from "../services/player";
import { useT } from "./useT";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Motivo da recusa, se houver; vira mensagem sob o campo. */
  problem: Extract<NicknameCheck, { ok: false }>["reason"] | null;
}

export function NicknameField({ label, value, onChange, problem }: Props) {
  const t = useT();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        // Trava larga (UTF-16): quem confere de verdade é o schema, por caractere.
        maxLength={NICKNAME_INPUT_MAX * 2}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={problem !== null}
        aria-describedby={problem ? `${hintId} ${errorId}` : hintId}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className="hint">
        {t("nickname.hint", { max: NICKNAME_INPUT_MAX })}
      </p>
      {problem && (
        <p id={errorId} className="field-error" role="alert">
          {problem === "long" ? t("nickname.error.long", { max: NICKNAME_INPUT_MAX }) : t("nickname.error.chars")}
        </p>
      )}
    </div>
  );
}
