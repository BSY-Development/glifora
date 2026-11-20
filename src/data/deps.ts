// Relógio e gerador de id entram por parâmetro, para o teste ser determinístico.
export interface Deps {
  readonly now: () => number;
  readonly uuid: () => string;
}

export function systemDeps(): Deps {
  return { now: () => Date.now(), uuid: () => crypto.randomUUID() };
}
