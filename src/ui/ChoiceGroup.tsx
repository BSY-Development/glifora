// Grupo de botões de rádio em formato de "cartões" (fáceis de tocar). O rádio nativo fica por baixo:
// teclado, leitor de tela e setas funcionam sem código extra.
import { useId, type ReactNode } from "react";

export interface Choice<V extends string> {
  value: V;
  label: string;
  hint?: string;
  /** Desenho decorativo (aria-hidden) ao lado do rótulo. */
  visual?: ReactNode;
}

interface Props<V extends string> {
  legend: string;
  name: string;
  value: V;
  options: readonly Choice<V>[];
  onChange: (value: V) => void;
  /** "row" põe os cartões lado a lado (avatares); o padrão empilha. */
  layout?: "stack" | "row";
  disabled?: boolean;
  /** Erro ao guardar a escolha deste grupo; aparece logo abaixo dos cartões. */
  error?: string | null;
}

export function ChoiceGroup<V extends string>({ legend, name, value, options, onChange, layout = "stack", disabled = false, error = null }: Props<V>) {
  const groupId = useId();
  return (
    <fieldset className="field" disabled={disabled}>
      <legend>{legend}</legend>
      <div className={layout === "row" ? "choices choices-row" : "choices"}>
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              aria-labelledby={`${groupId}-${option.value}-label`}
              aria-describedby={option.hint ? `${groupId}-${option.value}-hint` : undefined}
              onChange={() => onChange(option.value)}
            />
            <span className="choice-card">
              {option.visual}
              <span className="choice-text">
                <span className="choice-label" id={`${groupId}-${option.value}-label`}>
                  {option.label}
                </span>
                {option.hint && (
                  <span className="choice-hint" id={`${groupId}-${option.value}-hint`}>
                    {option.hint}
                  </span>
                )}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
