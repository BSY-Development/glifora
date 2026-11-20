// Rotas (W0-03 §2.2). Cada tela é carregada sob demanda; o `import()` leva caminho literal (o lint confere a fronteira).
// Toda rota nova entra também em ROUTES de tests/e2e/csp.spec.ts (Revisor).
import type { RouteObject } from "react-router";
import { ErrorScreen, RootErrorScreen } from "./screens/ErrorScreen";
import { Loading } from "./Loading";
import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    // Erro fora da casca (a própria casca quebrou): tela própria. HydrateFallback: o que aparece até a 1ª rota carregar.
    ErrorBoundary: RootErrorScreen,
    HydrateFallback: Loading,
    children: [
      {
        Component: Layout,
        children: [
          {
            // Erro numa tela (ou pedaço que não carregou offline): a casca e a navegação continuam de pé.
            ErrorBoundary: ErrorScreen,
            children: [
              { index: true, lazy: () => import("./screens/Home").then((m) => ({ Component: m.Home })) },
              { path: "welcome", lazy: () => import("./screens/Welcome").then((m) => ({ Component: m.Welcome })) },
              { path: "place/:id", lazy: () => import("./screens/Place").then((m) => ({ Component: m.Place })) },
              { path: "profile", lazy: () => import("./screens/Profile").then((m) => ({ Component: m.Profile })) },
              { path: "settings", lazy: () => import("./screens/Settings").then((m) => ({ Component: m.Settings })) },
              { path: "about", lazy: () => import("./screens/About").then((m) => ({ Component: m.About })) },
              { path: "*", lazy: () => import("./screens/NotFound").then((m) => ({ Component: m.NotFound })) },
            ],
          },
        ],
      },
    ],
  },
];
