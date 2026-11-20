# src/catalog — conteúdo embutido

Dono: **App**. Carrega e indexa o conteúdo de `content/` (`import.meta.glob`); `catalog.list(...)` e `catalog.load(id)`.

- Só importa `schemas`. O índice gerado (`generated/`) fica fora do git (fase 2).
- Hoje: `listLocations()` e `findLocation(id)` (mapa da vila, `content/world/locations.json`, validado por `World`).
- Referência: W0-03 §5.3.

## W2-07: missões e teste de voz

- `list({ base, target, level?, location? })` lê `generated/index.json` (build-index, W2-04); sem o arquivo, devolve lista vazia.
- `load(id)` abre o pedaço (`import.meta.glob` preguiçoso, chave `/content/<file>`) e valida com `parseMission`. Erro vira resultado (`unknown`, `missing`, `invalid`), não exceção.
- `loadVoicePhrases(pair)` lê só `content/eval/stt/<par>.json` (D-48), num pedaço próprio.
- Esta camada não usa pacotes: o índice e as frases são conferidos à mão até o Conteúdo exportar `CatalogIndex` e `parseVoiceEvalSet` em `schemas/`.
