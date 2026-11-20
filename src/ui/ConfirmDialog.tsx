// Confirmação própria (sem window.confirm): <dialog> nativo, que já prende o foco, fecha com Esc e some o resto para o leitor de tela.
// Monte só quando for perguntar; o foco inicial vai para "Cancelar", o lado seguro.
import { useEffect, useId, useRef } from "react";

interface Props {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  /** "danger" (padrão) para apagar; "primary" para uma pergunta sem risco, como o aviso do microfone. */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, text, confirmLabel, cancelLabel, busy = false, variant = "danger", onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={variant === "danger" ? "confirm" : "confirm confirm-calm"}
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(event) => {
        event.preventDefault(); // Esc: quem fecha é o estado, não o navegador
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={textId}>{text}</p>
      <div className="actions">
        <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className={variant === "danger" ? "btn btn-danger btn-primary" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
