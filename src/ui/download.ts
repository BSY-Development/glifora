/** Entrega um texto como arquivo para baixar. Sem rede: é um blob local. */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Dá tempo de o navegador começar o download antes de soltar o blob.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
