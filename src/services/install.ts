// Aviso para iPhone (D-44, W2-10): no Safari do iOS sem instalação, o app convida a instalar e lembra de exportar, porque o
// Safari apaga os dados de site não instalado depois de 7 dias sem uso. Detecção por função, nunca pelo User-Agent.
export const IOS_NOTICE_KEY = "glifora.install.ios-notice";

export interface InstallEnv {
  /** `navigator.standalone`: só existe no Safari do iOS (boolean). Em outros navegadores é `undefined`. */
  navigatorStandalone: unknown;
  /** `matchMedia("(display-mode: standalone)").matches`: instalado em qualquer sistema. */
  displayStandalone: boolean;
  /** `"onbeforeinstallprompt" in window`: o Chrome do Android tem; o Safari do iOS não. */
  hasInstallPrompt: boolean;
}

/** Safari/iOS aberto na aba, sem instalação: `navigator.standalone` é `false`, sem modo standalone e sem `beforeinstallprompt`. */
export function isIosNotInstalled(env: InstallEnv): boolean {
  return env.navigatorStandalone === false && !env.displayStandalone && !env.hasInstallPrompt;
}

export function readInstallEnv(): InstallEnv {
  let displayStandalone = false;
  try {
    displayStandalone = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    // sem matchMedia: vale só o navigator.standalone
  }
  return {
    navigatorStandalone: (navigator as { standalone?: unknown }).standalone,
    displayStandalone,
    hasInstallPrompt: "onbeforeinstallprompt" in window,
  };
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // localStorage bloqueado: mostra de novo (o lado seguro; o aviso é dispensável)
  }
}

/** Mostra o aviso de iPhone? Só no Safari/iOS sem instalação e se a pessoa ainda não dispensou. */
export function shouldShowIosNotice(env: InstallEnv = readInstallEnv()): boolean {
  return isIosNotInstalled(env) && !read(IOS_NOTICE_KEY);
}

/** Dispensou: não volta. */
export function dismissIosNotice(): void {
  write(IOS_NOTICE_KEY);
}

function write(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // sem onde guardar: vale só até recarregar
  }
}
