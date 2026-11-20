# src/schemas — contrato de dados do conteúdo

Dono: **Conteúdo** (até a fase 2, o Arquiteto). Schemas Zod, tipos e funções puras que dizem o que o conteúdo é e significa: idiomas, vila, missão, casamento de respostas, contrato do turno, extração do JSON colado.

- Só importa `zod`. Sem React, Dexie, DOM, relógio ou sorteio (o lint barra).
- O App importa só de `index.ts`, nunca de arquivo interno. Mudança de formato sobe `schema` e é combinada antes.
- Testes de unidade ao lado do código (`x.test.ts`), em ambiente `node`.
- Referência: D-41, D-43 e `docs/propostas/W0-03-arquitetura.md` §3 e §5.
