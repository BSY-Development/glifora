// Leitor puro de `public/_headers` (formato do Cloudflare Pages). Sem I/O: recebe o texto, devolve os blocos.
// O vite.config.ts usa o bloco `/*` em `preview.headers`, para o preview ter a mesma CSP da produção (W0-03 §2.8).

/** Rota (ex.: "/*", "/assets/*") → cabeçalhos, na ordem do arquivo. */
export type HeaderBlocks = Record<string, Record<string, string>>;

export function parseHeadersFile(text: string): HeaderBlocks {
  const blocks: HeaderBlocks = {};
  let current: Record<string, string> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      // Linha sem recuo: início de um bloco (a rota). Rota repetida soma ao bloco existente.
      const route = raw.trim();
      current = blocks[route] ??= {};
      continue;
    }
    if (current === null) throw new Error(`_headers: cabeçalho sem rota antes: "${raw.trim()}"`);
    if (raw.trim().startsWith("!")) continue; // "! Nome": o Cloudflare tira esse cabeçalho (ver detachedHeaders)
    const colon = raw.indexOf(":");
    if (colon === -1) throw new Error(`_headers: linha sem ":": "${raw.trim()}"`);
    const name = raw.slice(0, colon).trim();
    const value = raw.slice(colon + 1).trim();
    if (name === "") throw new Error(`_headers: nome de cabeçalho vazio: "${raw.trim()}"`);
    // Mesmo nome repetido no bloco: o Cloudflare junta os valores com ", ".
    current[name] = name in current ? `${current[name]}, ${value}` : value;
  }
  return blocks;
}

/** Cabeçalhos que valem para todas as rotas: o bloco `/*`. Falha alto se não existir. */
export function previewHeaders(text: string): Record<string, string> {
  const all = parseHeadersFile(text)["/*"];
  if (all === undefined) throw new Error('_headers: bloco "/*" não encontrado');
  return all;
}

/** Cabeçalhos que o `_headers` manda o Cloudflare TIRAR (sintaxe "! Nome") no bloco da rota. Nomes em minúsculas. */
export function detachedHeaders(text: string, route = "/*"): string[] {
  const names: string[] = [];
  let inRoute = false;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      inRoute = raw.trim() === route;
      continue;
    }
    const line = raw.trim();
    if (inRoute && line.startsWith("!")) {
      const name = line.slice(1).trim().toLowerCase();
      if (name !== "") names.push(name);
    }
  }
  return names;
}
