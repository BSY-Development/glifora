# src/ai — IA com a key do jogador (fase 6)

Dono: **App**. Cofre da key (`keyVault.ts`), adaptadores (`providers/`), JSON estruturado (`structured.ts`) e tarefas (`tasks/`).

- Só importa `schemas`. Sem React nem Dexie. A interface nunca importa `keyVault` nem `providers` (o lint barra).
- A key vai direto do navegador ao provedor e nunca aparece em log, URL, relatório, exportação nem no Supabase.
- Referência: D-41 e W0-03 §2.6 e §2.7.
