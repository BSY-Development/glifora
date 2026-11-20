// "Nova versão disponível" (W1-12): uma store mínima. O sw-register.ts avisa quando há versão esperando com o app aberto;
// a interface mostra o aviso e chama `applyUpdate` no botão. Sem React aqui (a tela assina com useSyncExternalStore).
let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Chamado pelo registro do service worker: há uma versão nova esperando; `activate` ativa e recarrega. */
export function offerUpdate(activate: () => void): void {
  apply = activate;
  for (const listener of listeners) listener();
}

export function hasUpdate(): boolean {
  return apply !== null;
}

/** Ativa a versão nova (a página recarrega sozinha). Sem versão esperando, não faz nada. */
export function applyUpdate(): void {
  apply?.();
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------- Atualização automática na abertura (D-46, W2-10) ----------
// A pessoa abriu o app e a versão nova terminou de instalar logo depois: se ela ainda está na vila e nada está em andamento,
// ativa e recarrega sozinha. Fora disso continua o aviso com o botão "Atualizar". Recarregar tira a pessoa do lugar, então a
// janela é curta: 5 s cobre o caso típico (1ª abertura depois de um deploy, a versão nova baixa em 1–3 s numa rede de
// celular) e é pouco para a pessoa já ter começado alguma coisa; passou disso, ela já está usando o app e prefere avisar.
export const AUTO_UPDATE_WINDOW_MS = 5000;

let holds = 0;

/**
 * Trava a atualização automática enquanto algo não pode ser interrompido (missão aberta, importação, formulário com rascunho).
 * Devolve a função que solta a trava; chame-a sempre (ex.: no `finally` ou na limpeza do `useEffect`).
 */
export function holdUpdates(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

export interface AutoUpdateState {
  /** Milissegundos desde que a página abriu (`performance.now()`). */
  sinceOpenMs: number;
  /** Caminho atual; só "/" (a vila) deixa recarregar sozinho. */
  pathname: string;
  /** Quantas travas `holdUpdates` estão ativas. */
  holds: number;
}

/** A regra: dentro da janela, na vila e sem nenhuma trava. */
export function canAutoUpdate(state: AutoUpdateState): boolean {
  return state.sinceOpenMs <= AUTO_UPDATE_WINDOW_MS && state.pathname === "/" && state.holds === 0;
}

/** Chamado quando a versão nova termina de instalar com o app aberto: ativa já ou só avisa, conforme a regra. */
export function onUpdateReady(
  activate: () => void,
  state: AutoUpdateState = { sinceOpenMs: performance.now(), pathname: window.location.pathname, holds },
): void {
  if (canAutoUpdate(state)) activate();
  else offerUpdate(activate);
}
