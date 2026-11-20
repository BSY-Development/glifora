# src/engine — regras do jogo

Dono: **App**. TypeScript puro: rodada de missão, XP, nível, ofensiva, desbloqueio, domínio, repetição espaçada, relatório.

- Só importa `../schemas`. Sem pacotes, sem DOM, sem `Date.now`/`Math.random` (relógio e sorteio entram por parâmetro). O lint barra.
- Máquina de estados: `step(estado, entrada) → { estado, efeitos[] }`. Quem grava, fala e toca som é `services/`.
- Referência: W0-03 §2.1 e §6.

## W2-07: o que já existe

- `rules.v1.ts`: `rulesV1` (D-49): `xpFor`, `coinsFor`, `levelAt`, `unlocksAt`, `masteryOf` e as 12 conquistas. Tudo é tabela.
- `streak.ts`: ofensiva com congelamento, derivada só dos dias com jogo.
- `run.ts`: `planRun` transforma uma rodada concluída nos eventos (rodada + `mission_first` + `mission_star`, ids determinísticos) e calcula o `repeat` por fala.
- `progress.ts`: `deriveProgress(eventos, rules, hoje)`: XP, moedas, nível, título, desbloqueios, ofensiva. Eventos com o mesmo id valem uma vez.
- O motor não lê a base: recebe o histórico (`history`) e os ids já gravados (`granted`) por parâmetro. Quem grava é `services/` (o player, W2-08).
- `unlocksAt` usa a ordem de `LocationId` como o `order` do local; o 3º local em diante só abre quando o Conteúdo o acrescentar ao enum.
