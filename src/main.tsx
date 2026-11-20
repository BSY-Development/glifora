import "./zod-config"; // sempre o primeiro import (ver o comentário nesse módulo)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initLocale } from "./i18n";
import { boot } from "./services/boot";
import { App } from "./ui/App";
import { StorageError } from "./ui/StorageError";

initLocale(); // lê o idioma salvo (síncrono) e põe <html lang> antes da primeira tela
const container = document.getElementById("root");
if (!container) throw new Error("#root não encontrado");
const root = createRoot(container);

// O banco abre antes da primeira tela. Se o navegador bloquear o armazenamento, a pessoa vê o motivo, não uma tela em branco.
boot().then(
  () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  () =>
    root.render(
      <StrictMode>
        <StorageError />
      </StrictMode>,
    ),
);
