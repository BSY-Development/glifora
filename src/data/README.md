# src/data — dados locais (Dexie)

Dono: **App**. Banco IndexedDB, repositórios, migrações, mescla (`merge.ts`), exportar/importar; na fase 5, a sincronização.

- Pode importar `schemas`, `engine` (tipos) e `dexie`. Sem React, `ai` ou `ui`.
- Dois formatos: documentos (o último a escrever vence) e registros só de acréscimo. **A key nunca entra em tabela nenhuma.**
- Referência: D-41 e W0-03 §4.1.
