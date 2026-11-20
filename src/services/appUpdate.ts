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
