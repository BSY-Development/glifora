import "./zod-config"; // sempre o primeiro import (ver o comentário nesse módulo)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initLocale } from "./i18n";
import { boot } from "./services/boot";
import { registerServiceWorker } from "./sw-register";
import { loadPrefs } from "./services/player";
import { App } from "./ui/App";
import { applyDisplayPrefs } from "./ui/display";
import { StorageError } from "./ui/StorageError";

registerServiceWorker(); // espera o `load` e só roda em produção
initLocale(); // lê o idioma salvo (síncrono) e põe <html lang> antes da primeira tela
const container = document.getElementById("root");
if (!container) throw new Error("#root não encontrado");
const root = createRoot(container);

// O banco abre antes da primeira tela. Se o navegador bloquear o armazenamento, a pessoa vê o motivo, não uma tela em branco.
boot().then(
  async () => {
    // Texto e movimento já valem na primeira tela, sem piscar no tamanho errado.
    try {
      applyDisplayPrefs(await loadPrefs());
    } catch {
      // sem preferências legíveis: valem os padrões do CSS
    }
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  },
  () =>
    root.render(
      <StrictMode>
        <StorageError />
      </StrictMode>,
    ),
);
