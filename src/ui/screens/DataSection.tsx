// "Seus dados": exportar, importar e apagar os dados deste aparelho (W1-09).
import { useRef, useState } from "react";
import { getAppInfo } from "../../services/about";
import { MAX_IMPORT_BYTES, exportData, importData, wipeThisDevice, type ImportError } from "../../services/transfer";
import { ConfirmDialog } from "../ConfirmDialog";
import { downloadText } from "../download";
import { useT } from "../useT";

type Notice = { tone: "ok" | "error"; text: string; details?: string };

const MB = MAX_IMPORT_BYTES / (1024 * 1024);

/** Texto para a pessoa copiar e mostrar a quem ajuda: o código do erro, os números e a versão do app. */
function detailsOf(error: ImportError | { code: "read" | "storage" }): string {
  const { version, commit } = getAppInfo();
  const lines = [`glifora ${version} (${commit})`, `error: ${error.code}`];
  if (error.code === "too_new") lines.push(`file format: ${error.fileVersion}`, `app format: ${error.appVersion}`);
  if (error.code === "invalid") lines.push(...error.issues);
  return lines.join("\n");
}

export function DataSection() {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  function fail(error: ImportError | { code: "read" | "storage" }) {
    const text =
      error.code === "too_large"
        ? t("data.error.too_large", { mb: MB })
        : error.code === "too_new"
          ? t("data.error.too_new", { file: error.fileVersion, app: error.appVersion })
          : t(`data.error.${error.code}`);
    setCopyNote(null);
    setNotice({ tone: "error", text, details: detailsOf(error) });
  }

  async function onExport() {
    setBusy(true);
    setNotice(null);
    try {
      const file = await exportData();
      downloadText(file.filename, file.text);
      setNotice({ tone: "ok", text: t("data.export.done", { n: file.count }) });
    } catch {
      setNotice({ tone: "error", text: t("data.export.failed") });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    if (file.size > MAX_IMPORT_BYTES) return fail({ code: "too_large", maxBytes: MAX_IMPORT_BYTES });
    setBusy(true);
    try {
      let text: string;
      try {
        text = await file.text();
      } catch {
        return fail({ code: "read" });
      }
      let result;
      try {
        result = await importData(text);
      } catch {
        return fail({ code: "storage" });
      }
      if (!result.ok) return fail(result.error);
      const changed = result.stats.inserted + result.stats.replaced;
      const skipped = result.stats.unknownDocs > 0 || result.stats.futureTables.length > 0;
      const main = changed === 0 ? t("data.import.nothing") : t("data.import.done", { n: changed });
      setNotice({ tone: "ok", text: skipped ? `${main} ${t("data.import.skipped")}` : main });
    } finally {
      setBusy(false);
    }
  }

  async function onWipe() {
    setBusy(true);
    try {
      await wipeThisDevice();
      window.location.replace("/"); // recomeça do zero: banco, idioma e telas
    } catch {
      setBusy(false);
      setConfirmWipe(false);
      setNotice({ tone: "error", text: t("data.wipe.failed") });
    }
  }

  async function onCopy(details: string) {
    try {
      await navigator.clipboard.writeText(details);
      setCopyNote(t("data.error.copied"));
    } catch {
      setCopyNote(t("data.error.copy_failed"));
    }
  }

  return (
    <section aria-labelledby="data-title">
      <h2 id="data-title">{t("data.title")}</h2>
      <p>{t("data.intro")}</p>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={busy}>
          {t("data.export.button")}
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
          {t("data.import.button")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = ""; // permite escolher o mesmo arquivo de novo
            void onFile(file);
          }}
        />
      </div>
      <p className="hint">{t("data.import.hint")}</p>

      {notice && (
        <div className={notice.tone === "error" ? "notice notice-error" : "notice"} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.tone === "error" && <strong>{t("data.error.heading")}: </strong>}
          {notice.text}
          {notice.details && (
            <>
              <label htmlFor="error-details">{t("data.error.details")}</label>
              <textarea id="error-details" className="details" readOnly value={notice.details} />
              <button type="button" className="btn" onClick={() => void onCopy(notice.details ?? "")}>
                {t("data.error.copy")}
              </button>
              {copyNote && <p role="status">{copyNote}</p>}
            </>
          )}
        </div>
      )}

      <h2>{t("data.wipe.heading")}</h2>
      <p>{t("data.wipe.hint")}</p>
      <button type="button" className="btn btn-danger" onClick={() => setConfirmWipe(true)} disabled={busy}>
        {t("data.wipe.button")}
      </button>

      {confirmWipe && (
        <ConfirmDialog
          title={t("data.wipe.confirm_title")}
          text={t("data.wipe.confirm_text")}
          confirmLabel={t("data.wipe.confirm")}
          cancelLabel={t("data.wipe.cancel")}
          busy={busy}
          onConfirm={() => void onWipe()}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </section>
  );
}
