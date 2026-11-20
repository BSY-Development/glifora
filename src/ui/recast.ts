// Destaque do recast (D-43): `recast.corrected` aparece literal dentro de `reaction.text`. A string é separada em três
// pedaços de texto; quem desenha põe o do meio num <mark>. Nunca HTML.

export interface RecastParts {
  before: string;
  match: string;
  after: string;
}

/** Procura `corrected` em `text` sem diferenciar maiúsculas; sem achar, devolve o texto inteiro em `before`. */
export function splitRecast(text: string, corrected: string): RecastParts {
  const needle = corrected.trim();
  if (needle === "") return { before: text, match: "", after: "" };
  const at = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  // A caixa baixa pode mudar o comprimento (ex.: "İ"); se mudou, não arrisco cortar no lugar errado.
  if (at < 0 || text.toLocaleLowerCase().length !== text.length) return { before: text, match: "", after: "" };
  return { before: text.slice(0, at), match: text.slice(at, at + needle.length), after: text.slice(at + needle.length) };
}
