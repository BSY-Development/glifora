import "./app.css";
import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

export function App() {
  // Criado uma vez só. O histórico do navegador cuida do botão Voltar (inclusive no Android).
  const [router] = useState(() => createBrowserRouter(routes));
  return <RouterProvider router={router} />;
}
