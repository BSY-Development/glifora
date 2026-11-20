# src/engine — regras do jogo

Dono: **App**. TypeScript puro: rodada de missão, XP, nível, ofensiva, desbloqueio, domínio, repetição espaçada, relatório.

- Só importa `../schemas`. Sem pacotes, sem DOM, sem `Date.now`/`Math.random` (relógio e sorteio entram por parâmetro). O lint barra.
- Máquina de estados: `step(estado, entrada) → { estado, efeitos[] }`. Quem grava, fala e toca som é `services/`.
- Referência: W0-03 §2.1 e §6.
