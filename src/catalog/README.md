# src/catalog — conteúdo embutido

Dono: **App**. Carrega e indexa o conteúdo de `content/` (`import.meta.glob`); `catalog.list(...)` e `catalog.load(id)`.

- Só importa `schemas`. O índice gerado (`generated/`) fica fora do git (fase 2).
- Referência: W0-03 §5.3.
