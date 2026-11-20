// Aviso antes do 1º uso do microfone (W2-06, W0-03 §2.5): o áudio vai para o serviço de voz do navegador, não para o Glifora.
// Monte só quando for perguntar. Confirmar vem de um toque, então o navegador ainda aceita abrir o microfone logo em seguida.
import { ConfirmDialog } from "./ConfirmDialog";
import { useT } from "./useT";

interface Props {
  onAccept: () => void;
  onCancel: () => void;
}

export function MicConsentDialog({ onAccept, onCancel }: Props) {
  const t = useT();
  return (
    <ConfirmDialog
      variant="primary"
      title={t("voice.consent.title")}
      text={t("voice.consent.text")}
      confirmLabel={t("voice.consent.accept")}
      cancelLabel={t("voice.consent.cancel")}
      onConfirm={onAccept}
      onCancel={onCancel}
    />
  );
}
