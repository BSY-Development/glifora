import "./zod-config"; // sempre o primeiro import (ver o comentário nesse módulo)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initLocale } from "./i18n";
import { App } from "./ui/App";

initLocale(); // lê o idioma salvo (síncrono) e põe <html lang> antes da primeira tela
const root = document.getElementById("root");
if (!root) throw new Error("#root não encontrado");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
