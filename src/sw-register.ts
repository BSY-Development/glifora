// Registro do service worker, escrito à mão (W0-03 §2.3). Por quê: com `require-trusted-types-for 'script'`, o navegador
// só aceita `serviceWorker.register()` com um TrustedScriptURL, e o `virtual:pwa-register` do plugin passa uma string
// (barrado). A única política permitida na CSP é `glifora-sw`: ela só aceita exatamente "/sw.js" e não existe política `default`.
import { offerUpdate } from "./services/appUpdate";

export const SW_URL = "/sw.js";

interface UrlPolicy {
  createScriptURL(input: string): unknown;
}

/** A política `glifora-sw`: qualquer URL que não seja exatamente "/sw.js" lança erro. */
export function createSwPolicy(factory: { createPolicy(name: string, rules: { createScriptURL(input: string): string }): UrlPolicy }): UrlPolicy {
  return factory.createPolicy("glifora-sw", {
    createScriptURL(input: string): string {
      if (input !== SW_URL) throw new TypeError(`glifora-sw só aceita ${SW_URL}.`);
      return input;
    },
  });
}

/** A URL pronta para `register()`: tipada (TrustedScriptURL) se o navegador tem Trusted Types; senão, a própria string. */
export function swScriptUrl(trustedTypes: Parameters<typeof createSwPolicy>[0] | undefined): string {
  if (!trustedTypes) return SW_URL;
  return createSwPolicy(trustedTypes).createScriptURL(SW_URL) as string;
}

let reloading = false;

/** Pede à versão que espera para assumir; quando ela assume, recarrega uma vez. */
function activate(worker: ServiceWorker): void {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    },
    { once: true },
  );
  worker.postMessage({ type: "SKIP_WAITING" });
}

async function start(): Promise<void> {
  const registration = await navigator.serviceWorker.register(swScriptUrl((window as { trustedTypes?: Parameters<typeof createSwPolicy>[0] }).trustedTypes));
  const hadController = navigator.serviceWorker.controller !== null; // false na primeira visita: nada para trocar

  // Abriu o app e já há versão nova esperando: ativa e recarrega sozinha.
  if (registration.waiting && hadController) {
    activate(registration.waiting);
    return;
  }

  // App aberto e uma versão nova termina de instalar: só avisa.
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(() => activate(installing));
    });
  });

  // PWA instalado fica aberto por dias: confere de novo quando a pessoa volta para o app.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") registration.update().catch(() => undefined);
  });
}

/** Registra depois do `load`, só em produção (nada de service worker no `npm run dev`). Falhar não derruba o app. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const run = () => void start().catch(() => undefined);
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}
