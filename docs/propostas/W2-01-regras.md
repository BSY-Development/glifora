# W2-01 — Regras de jogo v1 (Fable, 2026-11-20)

Proposta para o Arquiteto decidir (D-48). Traz os números de `rules.v1` para as interfaces de [W0-03 §6]: XP por fonte, curva de nível e títulos, níveis de domínio, e já a fase 3 (desbloqueios, moedas, ofensiva, conquistas). No fim: simulação, conformidade com as 6 guardas e os pontos para decidir.

Li: `docs/SPEC.md`, D-41, D-43, W0-03 §4.1 e §6, `docs/PLAN.md` (fase 2) e `tests/pedagogy/principles.test.ts`.

Todos os números da seção 6 saíram de um script que implementa exatamente as tabelas daqui (400 jogadores sorteados por perfil; mostro a mediana). O que depende de hipótese minha está marcado com **[hipótese]**. O que só o teste do dono resolve está marcado com **[provar no portão]**.

**Resumo das escolhas**

| Tema | Escolha |
| --- | --- |
| Resposta | 16 / 12 / 8 XP por falar ou digitar sem ajuda / com a ideia / com a frase à vista. Tocar vale 4. Voz e digitado valem igual |
| Erro e tentativa | `flawed` e `attempt` **não mudam** o XP. O que muda o XP é a ajuda usada na resposta que casou |
| Fecho | 24 (frase própria), 12 (repetiu a resposta-modelo), 4 (tocou para seguir) |
| Missão | Prêmios **únicos**: 24 pela 1ª conclusão e 40 / 56 / 80 por estrela (A1, encontro: 200 no total). Chefe ×1,5. Nível CEFR: +25% por nível |
| Domínio | 3 estrelas. A rodada prova uma estrela quando as respostas ficam no degrau de ajuda dela, com folga de 1 fala a cada 5. Nunca desce |
| Replay sem farm | Cada fala paga cheio **uma vez por dia em cada degrau de ajuda**. Repetir no mesmo dia com a mesma ajuda (ou mais) paga ½, depois ¼. Nunca zero, sem teto |
| Curva | Do nível L ao L+1 custa `50 × L`. Total até o nível L: `25 × L × (L − 1)`. Sem nível máximo |
| Títulos | 8 faixas: Aprendiz (1), Viajante (5), Mercador (10), Diplomata (16), Embaixador (23), Erudito (31), Sábio (40), Lenda da Vila (50) |
| Locais | Padaria no nível 1; os outros cinco nos níveis 5, 9, 14, 20 e 27 |
| Moedas | Só por marcos: estrelas, missão do dia e conquistas. Resposta não dá moeda |
| Ofensiva | 1 congelamento a cada 2 dias jogados, guarda até 2. Aguenta um fim de semana. Não dá XP |
| Conquistas | 12 iniciais, em três tamanhos (20 / 50 / 100 XP) |

---

## 1. As cinco ideias por trás dos números

1. **O XP paga a ajuda que a pessoa dispensou, não o acerto.** Falar sem ajuda vale 4× tocar. Errar do jeito previsto (`flawed`) vale o mesmo que acertar: o recast é o retorno, e um número menor na tela seria uma tela de erro disfarçada (princípios 5 e 6).
2. **Prêmio grande é único; XP que se repete é pequeno e diminui no mesmo dia.** A 1ª conclusão e cada estrela pagam uma vez por missão. O XP de conversa pode ser ganho todo dia, mas repetir a mesma coisa no mesmo dia rende cada vez menos.
3. **Nada entra na conta além de ajuda, modo de entrada e dia.** Sem bônus de velocidade, sem combo, sem multiplicador de ofensiva, sem nota "fácil" valendo mais.
4. **Nada desce.** XP, moedas, estrelas e melhor ofensiva só sobem. Quando a ofensiva volta a contar do começo, nada mais muda.
5. **O número que a pessoa mesma informa não vale XP.** No feitiço com autoavaliação, a nota não muda o XP. Se mudasse, a pessoa marcaria "fácil" e estragaria a repetição espaçada.

---

## 2. XP por fonte

### 2.1 Resposta (`kind: 'reply'`)

| Entrada | Degrau 0 (sem ajuda) | Degrau 1 (ideia em pt-BR) | Degrau 2 (frase à vista) | Degrau 3 (tocou) |
| --- | --- | --- | --- | --- |
| `voice` | 16 | 12 | 8 | 8 |
| `typed` | 16 | 12 | 8 | 8 |
| `tap` | 4 | 4 | 4 | 4 |

- **`scaffold` é o degrau em vigor quando a resposta casou.** Se a ajuda subiu sozinha depois de duas falhas (D-43), vale o degrau novo.
- **Tocar é sempre 4**, qualquer que seja o `scaffold` informado. Falar ou digitar com as opções na tela (degrau 3) é ler em voz alta: vale como o degrau 2.
- **Por que voz = digitado:**
  - A SPEC e a guarda 2 tratam os dois como a mesma classe ("falar ou digitar").
  - Quem não tem reconhecimento de voz (iPhone, Firefox, lugar público) não fez menos esforço (D-44).
  - A voz já leva vantagem natural: uma rodada falada dura ~2,6 min e uma digitada ~3,8 min **[hipótese]**. Cabem mais conversas na mesma sessão, sem que o XP dependa de tempo.
  - A fala ganha destaque pelas conquistas (seção 5.4), não por um número maior.
- **Por que `flawed` não muda nada:** ideia 1. Além disso, um valor maior premiaria errar de propósito.
- **Por que `attempt` não muda nada:**
  - Reconhecedor de voz que não entende sotaque não é culpa da pessoa (a taxa de casamento ainda nem foi medida, W2-12).
  - A D-43 já sobe a ajuda na segunda falha. O XP acompanha esse degrau; descontar também pela tentativa seria cobrar duas vezes.
- **Por que 16 / 12 / 8 / 4:** a razão é 4 : 3 : 2 : 1. Recuperar sem ajuda vale o dobro de ler a frase, e ler em voz alta vale o dobro de tocar. Todos são múltiplos de 4, então ½ e ¼ (2.2) dão inteiros.

### 2.2 Repetição no mesmo dia (`repeat`): como o replay não vira farm

**Regra:** cada fala paga cheio na primeira vez do dia **e sempre que a pessoa responde com menos ajuda do que já tinha usado hoje naquela fala**. Repetir com a mesma ajuda, ou com mais ajuda, paga metade na 2ª vez e um quarto da 3ª em diante.

| `repeat` | Fator | Resposta sem ajuda | Com a ideia | Com a frase | Toque |
| --- | --- | --- | --- | --- | --- |
| 0 | ×1 | 16 | 12 | 8 | 4 |
| 1 | ×½ | 8 | 6 | 4 | 2 |
| 2 ou mais | ×¼ | 4 | 3 | 2 | 1 |

**Como o motor calcula `repeat`:**
- **Nível de ajuda da resposta:** `h = 3` se tocou; senão `min(scaffold, 2)`.
- **`repeat` de uma resposta** = quantas vezes, **hoje**, a pessoa já respondeu a **mesma fala da mesma missão** com `h` menor ou igual (isto é, tão bem ou melhor). Só contam rodadas concluídas.
- **"Hoje"** é o `day` local do início da rodada. Ele vale para a rodada inteira e é o `day` do evento, mesmo que passe da meia-noite.
- **No fecho** vale a mesma conta, com três níveis: frase própria (0), resposta-modelo repetida (1), toque (2).
- **No feitiço** (fase 3): `repeat` = quantas vezes o mesmo card já foi revisto hoje.

**Exemplo, uma fala num dia só:** tocou (4) → leu a frase (8, cheio: menos ajuda) → só com a ideia (12) → sem ajuda (16) → sem ajuda de novo (8) → de novo (4) → com a frase (2, porque já fez melhor três vezes hoje).

**Por quê:**
- **Sobe o desafio, vale cheio.** A escada de domínio (frase → ideia → nada) pode ser feita num dia só sem perder nada. O que rende menos é repetir o que já foi feito.
- **Acompanha a pedagogia.** Repetir a mesma conversa cinco vezes seguidas ensina pouco; repetir amanhã ensina mais (princípio 4). O XP cheio volta todo dia, e isso é um motivo honesto para voltar.
- **Não pune.** O fator nunca chega a zero, não existe teto diário e nada é tirado. A pessoa pode treinar o quanto quiser.
- **Não tem brecha de escolha de modo.** A conta é por fala e pela ajuda de fato usada. Escolher "sem ajuda" e tocar em tudo não rende mais que tocar.
- **É conhecido na hora.** O motor sabe o valor quando a resposta casa, então o "+16 XP" da tela é o valor real.

**Quanto rende tentar farmar** (missão de 6 falas, no ¼):

| Jeito | XP por rodada | XP por hora | Comparação |
| --- | --- | --- | --- |
| Só tocar | 7 | ~630 | Uma hora tocando rende o mesmo que uma sessão honesta de 12 min falando (~620) |
| Falar sem ajuda | 30 | ~700 | É uma hora falando inglês em voz alta. Isso é o objetivo do jogo, não um abuso |

**Como mostrar (sugestão para o App):** nunca "−50%". A missão que ainda paga cheio hoje ganha uma marca ("XP cheio hoje"); as outras ficam sem marca. O relatório pode dizer "treino extra de hoje".

**Descartados:**
- **Teto diário de XP:** corta justamente o dia em que a pessoa mais quis jogar. Lembra energia e vidas.
- **Espera entre rodadas:** é XP dependendo de relógio.
- **Fator por rodada, pelo modo escolhido:** mais simples, mas quem toca em tudo no modo "sem ajuda" ganharia três rodadas cheias por missão por dia.

### 2.3 Fecho (`kind: 'closing'`)

| Situação | Campos | XP (×1 / ×½ / ×¼) |
| --- | --- | --- |
| Frase própria aceita (1ª ou 2ª tentativa) | `voice`/`typed`, `accepted: true`, `usedModelAnswer: false` | 24 / 12 / 6 |
| Repetiu a resposta-modelo falando ou digitando | `voice`/`typed`, `usedModelAnswer: true` | 12 / 6 / 3 |
| Tocou para seguir | `tap` (quaisquer outros campos) | 4 / 2 / 1 |
| Não houve fecho | `voice`/`typed`, `accepted: false`, `usedModelAnswer: false` | 0 |

- **Por que 24 e não mais:** o fecho é o ato mais valioso (princípio 2), mas a conferência sem IA aceita uma palavra-alvo só (D-43). Com 24, digitar "bread" rende pouco mais que uma resposta sem ajuda. Quando a IA avaliar a frase (fase 6), o valor pode subir numa `rules.v2`.
- **A dica da 2ª tentativa não reduz o XP.** A interface não leva esse dado, e não vale a pena levar.

### 2.4 Missão (`kind: 'mission'`): prêmios únicos

O XP de conversa (2.1 a 2.3) é o que se repete. A fonte `mission` paga só **prêmios que acontecem uma vez por missão**:

| Prêmio | Quando | A1, encontro |
| --- | --- | --- |
| 1ª conclusão | A primeira vez que a missão é concluída, de qualquer jeito | 24 |
| ★ | A primeira vez que o domínio chega a 1 | 40 |
| ★★ | A primeira vez que chega a 2 | 56 |
| ★★★ | A primeira vez que chega a 3 | 80 |

**Tabela completa** (1ª conclusão / ★ / ★★ / ★★★):

| Nível | Fator | Encontro | Chefe (×1,5) |
| --- | --- | --- | --- |
| A1 | ×1 | 24 / 40 / 56 / 80 | 36 / 60 / 84 / 120 |
| A2 | ×1,25 | 30 / 50 / 70 / 100 | 45 / 75 / 105 / 150 |
| B1 | ×1,5 | 36 / 60 / 84 / 120 | 54 / 90 / 126 / 180 |
| B2 | ×1,75 | 42 / 70 / 98 / 140 | 63 / 105 / 147 / 210 |
| C1 | ×2 | 48 / 80 / 112 / 160 | 72 / 120 / 168 / 240 |
| C2 | ×2,25 | 54 / 90 / 126 / 180 | 81 / 135 / 189 / 270 |

- **Fórmula:** `base × (3 + n) / 4 × (chefe ? 3/2 : 1)`, com `n` = 1 para A1 até 6 para C2. As bases são múltiplos de 8, então tudo dá inteiro.
- **Como ler a interface de §6 sem mudar o tipo:** uma chamada de `xpFor` **por prêmio**.
  - `firstTime: true` soma o prêmio da 1ª conclusão.
  - `mastery: d` (1 a 3) soma o prêmio **daquela** estrela (não é acumulado). `mastery: 0` não soma estrela.
  - Rodada que pula degraus (ex.: chefe vencido sem ajuda de primeira) gera uma chamada por estrela nova. **Pular degrau nunca perde prêmio.**
  - Rodada que não traz estrela nova não chama `mission`: vale só o XP de conversa.
- **Por que prêmio por estrela e não por rodada:** é o que impede o farm do bônus e dá um alvo claro ("falta uma estrela na padaria").
- **Por que 1ª conclusão separada da ★:** quem só toca conclui a missão e leva 24, mas não leva estrela (seção 4). Assim o campo `firstTime` tem sentido próprio.
- **Por que os replies não escalam com o nível CEFR:** a fonte `reply` não leva o nível. O fator fica só no prêmio. Rever quando chegar a conversa livre (fase 6).

### 2.5 Feitiço (`kind: 'spell'`, fase 3)

| Avaliador (`gradedBy`) | Exercício | `hard`/`good`/`easy` | `again` | Toque |
| --- | --- | --- | --- | --- |
| `ai` | Frase própria com a palavra, avaliada pela IA | 16 | 8 | 2 |
| `local` | Recuperar a palavra a partir da tradução, conferida pelo app | 12 | 6 | 2 |
| `self` | A pessoa se avalia | 8 | 8 | 2 |

- Com `repeat` (o mesmo card revisto de novo hoje): ×½, depois ×¼, arredondando para cima.
- **`hard` = `good` = `easy`.** "Fácil" costuma querer dizer "rápido"; pagar mais seria pagar por velocidade.
- **`self`: a nota não muda o XP** (ideia 5).
- **`again` paga metade, não zero:** tentar lembrar e não conseguir também ensina. O laço "errar de propósito" rende 6 → 3 → 2 XP por card: não compensa.

### 2.6 Missão do dia e conquistas (fase 3)

| Fonte | XP | Observação |
| --- | --- | --- |
| `daily_complete` | 40 | Uma vez por dia (id `daily:<dia>`). É pequeno de propósito: as partes já foram pagas, e ele não depende de como a pessoa respondeu |
| `achievement` | 20 / 50 / 100 | Por tamanho da conquista (seção 5.4). Id `ach:<id>` |

### 2.7 O que vira evento

| Evento | Id | XP | Moedas |
| --- | --- | --- | --- |
| `mission_completed` ou `boss_defeated` (um por rodada concluída) | uuid | Soma das respostas e do fecho | 0 |
| `mission_first` | `first:<missionId>` | Prêmio da 1ª conclusão | 5 |
| `mission_star` | `star:<missionId>:<1 a 3>` | Prêmio da estrela | 5 / 10 / 15 |
| `daily_complete` | `daily:<dia>` | 40 | 10 |
| `achievement` | `ach:<id>` | 20 / 50 / 100 | 10 / 25 / 50 |

- **Por que os prêmios são eventos próprios, com id determinístico:** é o princípio 3 da W0-03 §4.1 ("determinístico para o que só existe uma vez"). Dois aparelhos offline que ganham a mesma estrela geram a mesma linha, e a mescla não paga duas vezes.
- **Continua "um evento por missão":** os prêmios somam no máximo 4 linhas na vida inteira de cada missão.
- **Limite para a importação (W2-05, W2-13):** nas regras v1, nenhum evento legítimo passa de **400 XP** (rodada de 20 falas: 344; maior prêmio: 270) nem de **50 moedas**. Serve de teto barato contra XP forjado no arquivo.

---

## 3. Curva de nível e títulos

**Curva:** do nível `L` ao `L + 1` custa `50 × L` XP. O total para estar no nível `L` é `25 × L × (L − 1)`. Não há nível máximo.

| Nível | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 23 | 27 | 31 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XP total | 50 | 150 | 300 | 500 | 750 | 1.400 | 2.250 | 3.300 | 6.000 | 9.500 | 12.650 | 17.550 | 23.250 | 39.000 | 61.250 | 88.500 |

**`levelAt(totalXp)`:**
- `level` = o maior `L` com `25 × L × (L − 1) ≤ totalXp`;
- `into` = `totalXp − 25 × L × (L − 1)` (quanto já andou dentro do nível);
- `toNext` = `50 × L − into` (quanto **falta**). A barra é `into / (into + toNext)`.

**Títulos** (`TitleId` e nome nos dois idiomas da interface):

| A partir do nível | `TitleId` | pt-BR | en | Quem fala chega na sessão¹ |
| --- | --- | --- | --- | --- |
| 1 | `apprentice` | Aprendiz | Apprentice | — |
| 5 | `traveler` | Viajante | Traveler | 1 |
| 10 | `merchant` | Mercador | Merchant | 4 |
| 16 | `diplomat` | Diplomata | Diplomat | 9 |
| 23 | `ambassador` | Embaixador | Ambassador | 17 |
| 31 | `scholar` | Erudito | Scholar | 30 |
| 40 | `sage` | Sábio | Sage | 49 |
| 50 | `legend` | Lenda da Vila | Village Legend | 75 |

¹ Cenário B da seção 6 (fase 3 pronta).

**Por quê:**
- **O 1º nível custa 50** para que a primeira missão dê level up até para quem só toca (52 XP).
- **Custo linear, total quadrático:** o nível cresce com a raiz do XP. No começo há vários level ups por sessão; depois, um a cada 1 a 3 sessões. Não estagna e não infla.
- **Faixas que alargam** (5, 6, 7, 8, 9, 10 níveis): os dois primeiros títulos caem dentro do portão da fase 2; depois ficam raros.
- **Sem nível máximo:** o jogo ainda vai ganhar idiomas e exames. Títulos novos acima de 50 podem entrar depois sem mexer em nada.
- **Cuidado ao rebalancear:** o XP é gravado, mas o nível sai do total pela curva atual (W0-03 §4.1). **Mudar a curva muda o nível de todo mundo.** Depois do portão da fase 2, ajuste de ritmo deve ser feito nas fontes de XP (que têm versão), e a curva só pode ficar mais fácil.

---

## 4. Níveis de domínio (`masteryOf`)

**Três estrelas por missão:**

| Estrelas | Nome sugerido | Modo da rodada | Começa no degrau de ajuda |
| --- | --- | --- | --- |
| ★ | Com a frase | 1 | 2 (frase à vista) |
| ★★ | Com a ideia | 2 | 1 (ideia em pt-BR) |
| ★★★ | De cor | 3 | 0 (nada) |

**O que uma rodada concluída prova** (`runDegree`):
- `n` = número de respostas da rodada; **folga** = `floor(n / 5)` (1 fala em 6; 2 em 10; nenhuma até 4);
- `h` de cada resposta = 3 se tocou; senão `min(scaffold, 2)`;
- **★★★:** pelo menos `n − folga` respostas com `h = 0`, **e** fecho com frase própria (falada ou digitada, sem a resposta-modelo);
- **★★:** pelo menos `n − folga` respostas com `h ≤ 1`, **e** fecho com frase própria;
- **★:** pelo menos `n − folga` respostas com `h ≤ 2` (falou ou digitou), **e** fecho falado ou digitado (vale a resposta-modelo);
- **0:** concluiu, mas tocando além da folga ou tocando no fecho. A missão fica "concluída", sem estrela.

**`masteryOf(runs)`** = o maior `runDegree` entre as rodadas concluídas da missão. Sem rodada: 0.

**Regras de uso:**
- **O domínio nunca desce.** Uma rodada pior depois não tira estrela.
- **Modo sugerido** = `min(domínio + 1, 3)`: o próximo degrau a conquistar. É um ajuste fino da D-43, que fala em "1ª, 2ª e 3ª vez": se a pessoa ainda não ganhou a estrela, o jogo oferece o mesmo modo de novo.
- **A pessoa pode escolher menos ajuda desde a 1ª vez.** Se provar ★★★ de primeira, leva as três estrelas e os três prêmios.
- **Durante a rodada, pedir ajuda é livre** (ideia → frase → tocar). O XP e a estrela seguem o que foi de fato usado.
- **Chefe** (`kind: boss`) começa sempre no degrau 0 (D-43) e segue as mesmas regras.
- **`flawed` não atrapalha a estrela.** Conta pelo degrau de ajuda, como qualquer resposta.

**Por quê:**
- **A folga** existe por causa do reconhecedor de voz: uma fala mal entendida duas vezes sobe a ajuda sozinha (D-43). Sem folga, um tropeço do microfone custaria a estrela.
- **Tocar não dá estrela.** É o que mantém a guarda "esforço" no nível da missão: os prêmios grandes (88% do bônus) exigem produzir.
- **O fecho entra na estrela** porque é o princípio 2: a missão termina com algo próprio.

**Quanto cada degrau vale** (A1, encontro, 6 falas, 1ª rodada do dia, tudo no degrau do modo, fecho próprio):

| Rodada | Conversa | Prêmio | Total |
| --- | --- | --- | --- |
| Modo 1, 1ª vez | 6 × 8 + 24 = 72 | 24 + 40 | **136** |
| Modo 2, ganha ★★ | 6 × 12 + 24 = 96 | 56 | **152** |
| Modo 3, ganha ★★★ | 6 × 16 + 24 = 120 | 80 | **200** |
| Modo 3, já com ★★★ | 120 | — | **120** |
| Só toque, 1ª vez | 6 × 4 + 4 = 28 | 24 | **52** |
| Só toque, outro dia | 28 | — | **28** |

---

## 5. Fase 3 (definido já)

### 5.1 Desbloqueio de locais (`unlocksAt`)

| Nível | Local | Sessão em que chega: fala / digita / só toca¹ |
| --- | --- | --- |
| 1 | Padaria (`bakery`) | — |
| 5 | 2º local (sugestão: Mercado) | 1 / 2 / 3 |
| 9 | 3º (Taverna) | 3 / 4 / 8 |
| 14 | 4º (Estação) | 7 / 9 / 20 |
| 20 | 5º (Ferraria) | 13 / 18 / 42 |
| 27 | 6º (Biblioteca) | 23 / 32 / 76 |

¹ Cenário B da seção 6.

- **`unlocksAt(level)`** devolve o que abre **exatamente** naquele nível: `{ type: 'location', id }` e, nos níveis da seção 3, `{ type: 'title', id }`.
- **A ordem dos temas é do Conteúdo.** A tabela fixa os níveis por posição; os nomes são sugestão (do mais concreto, A1, para o mais abstrato).
- **O 2º local coincide com o título Viajante** (nível 5): é o grande momento do fim da 1ª sessão.
- **Quem só toca não fica trancado:** chega a tudo, só que 3 a 4 vezes mais devagar.
- **Itens cosméticos não têm trava de nível em v1:** a loja usa só moedas. Duas travas no mesmo item confundem.
- **Depende de conteúdo:** só vale abrir um local quando houver missões nele. Os níveis ficam numa tabela à parte e podem ser adiados sem tocar no XP.

### 5.2 Moedas (`coinsFor`)

| Fonte | Moedas |
| --- | --- |
| Resposta, fecho, feitiço | 0 |
| 1ª conclusão de missão | 5 (chefe: 10) |
| ★ / ★★ / ★★★ | 5 / 10 / 15 (chefe: 10 / 20 / 30) |
| Missão do dia completa | 10 |
| Conquista pequena / média / grande | 10 / 25 / 50 |

- **Por que só marcos:** a conversa fica limpa (um número só na tela, o XP), e não existe moeda para farmar com replay.
- **Quem só toca ganha pouco** (1ª conclusão e missão do dia): as estrelas pedem produção.
- **Ritmo na simulação** (cenário B): quem fala ganha ~40 moedas por sessão; quem digita, ~29; quem só toca, ~14.
- **Preços sugeridos para a loja** (a loja em si é tarefa da fase 3): item pequeno 40 (uma sessão), médio 120 (três sessões), grande 300 (uma semana).
- **Nada comprado dá vantagem** (SPEC). `coinsFor` nunca é negativo; só `purchase` tira moeda.

### 5.3 Ofensiva com congelamento (`streak`)

| Regra | Valor |
| --- | --- |
| Dia ativo | Dia local com pelo menos 1 missão concluída (ou 1 feitiço conjurado, na fase 3) |
| Como se ganha congelamento | Jogando: **1 a cada 2 dias ativos**, contados na vida toda (no 2º, 4º, 6º dia ativo...) |
| Estoque máximo | 2 |
| Como se gasta | Sozinho. Uma pausa de `g` dias entre dois dias ativos gasta `g` congelamentos **se** houver `g` no estoque, e a ofensiva continua |
| Pausa maior que o estoque | A ofensiva recomeça em 1 no próximo dia ativo. **O estoque não é gasto à toa** |
| Hoje, ainda sem jogar | Não conta como pausa (o dia não acabou) |
| O que a ofensiva conta | Dias ativos em sequência. Dia congelado mantém a sequência, mas não soma |
| XP ou moedas por ofensiva | Nenhum |

**Algoritmo** (derivado só de `activeDays`; dois aparelhos chegam ao mesmo resultado em qualquer ordem):

```
dias = activeDays sem repetição, em ordem, até hoje
n = 0; estoque = 0; atual = 0; melhor = 0
para cada dia d:
  pausa = dias inteiros entre o dia ativo anterior e d (0 se for o primeiro ou se forem vizinhos)
  se é o primeiro, ou pausa > estoque:  atual = 1
  senão:                                estoque -= pausa; os dias da pausa entram em frozenDays; atual += 1
  n += 1; se n é par: estoque = min(2, estoque + 1)
  melhor = max(melhor, atual)
cauda = dias inteiros entre o último dia ativo e hoje
se cauda > estoque: atual = 0
senão:              estoque -= cauda; os dias da cauda entram em frozenDays
devolve { current: atual, best: melhor, freezesLeft: estoque, frozenDays }
```

**Por quê:**
- **Aguenta um fim de semana.** Quem joga de segunda a sexta ganha 2 por semana e gasta 2 no sábado e domingo: a ofensiva segue indefinidamente (conferido por 8 semanas). Três dias parados recomeçam a contagem.
- **"Ganho jogando, sem culpa"** (SPEC): não se compra, não se pede, não se ativa. A pessoa só vê "2 dias protegidos".
- **Sem XP por ofensiva:** bônus de sequência transforma dia perdido em punição.
- **Ganhar também é derivado**, não só gastar. Assim não existe evento `freeze_earned` que possa divergir entre dois aparelhos. O parâmetro `freezesEarned` de §6 fica para congelamentos de presente no futuro; em v1 recebe `[]`.
- **Sugestão para a tela:** mostrar "dias jogados" (total, nunca desce) com o mesmo destaque da ofensiva, e "melhor ofensiva" ao lado. A guarda do Revisor já proíbe texto de "ofensiva perdida".

### 5.4 Conquistas iniciais (12)

| Id | Nome sugerido | Condição (`check(stats)`) | Tamanho |
| --- | --- | --- | --- |
| `first_mission` | Primeiras palavras | `missionsCompleted ≥ 1` | P |
| `first_star3` | De cor | `missionsWithStar3 ≥ 1` | M |
| `first_boss` | Primeiro chefe | `bossesCompleted ≥ 1` | M |
| `voice_50` | Voz da vila | `voiceReplies ≥ 50` | M |
| `own_words_25` | Com as minhas palavras | `ownClosings ≥ 25` (fechos com frase própria) | M |
| `recast_10` | Errar faz parte | `recasts ≥ 10` | P |
| `spells_100` | Cem feitiços | `spellsCast ≥ 100` | G |
| `all_npcs` | Amigo de todos | conversou com todos os NPCs de `content/npcs/` | G |
| `can_do_5` | Eu consigo | `canDo ≥ 5` metas "consigo..." | M |
| `streak_7` | Sete dias | `bestStreak ≥ 7` | M |
| `days_30` | Morador da vila | `activeDays ≥ 30` (total, não seguidos) | G |
| `comeback` | De volta à vila | jogou depois de 7 ou mais dias longe (`longestGapDays ≥ 7`) | P |

- **Prêmios:** P = 20 XP e 10 moedas; M = 50 e 25; G = 100 e 50.
- **Três são exemplos da SPEC** (`first_boss`, `spells_100`, `all_npcs`).
- **Duas premiam a fala e a produção própria** (`voice_50`, `own_words_25`): é onde a voz ganha o destaque que o XP por resposta não dá.
- **Três existem contra a culpa:** `recast_10` comemora o erro corrigido, `days_30` conta o total em vez da sequência, e `comeback` recebe bem quem sumiu.
- **`recast_10` não premia errar de propósito:** é única, pequena, e o recast sem IA só acontece quando a pessoa fala ou digita o erro previsto.
- **Conquista é registro:** uma vez ganha, fica, mesmo que a condição deixe de valer (ex.: chegam NPCs novos).

---

## 6. Equilíbrio e simulação

### 6.1 Onde está a dopamina, e o que ficou de fora

| Ritmo | Recompensa |
| --- | --- |
| Cada resposta | "+16 XP" pequeno, sem parar a conversa |
| Cada missão | A barra enche no relatório. Na 1ª sessão há level up em quase toda missão |
| Cada degrau | Estrela nova, prêmio e moedas |
| Cada sessão (as 10 primeiras) | Pelo menos um level up para quem fala ou digita |
| A cada poucas sessões | Título novo ou local novo |
| De vez em quando | Conquista |

**De propósito, não existe:** bônus de velocidade, combo de acertos, multiplicador de ofensiva, XP maior para "fácil", perda de qualquer coisa, teto diário, moeda por resposta.

**Sugestão para o App:** o "+XP" de cada resposta aparece na hora, mas a barra e o level up animam no **relatório**. Assim o level up não interrompe a conversa.

### 6.2 Hipóteses da simulação

| Hipótese | Valor |
| --- | --- |
| Conteúdo da fase 2 **[hipótese: a W2-03 ainda está em andamento]** | 3 encontros A1 e 1 encontro A2 com 6 falas; 1 chefe A2 com 8 falas |
| Duração de uma rodada | Só toca: ~1,9 min. Fala: ~2,6 min. Digita no celular: ~3,8 min |
| Rodadas por sessão de 10–15 min | Só toca: 6. Digita: 3. Fala: 5 |
| **Só toca** | Toca em todas as respostas e no fecho. Nunca ganha estrela |
| **Digita** | Segue o modo sugerido. No modo 2 acerta com a ideia em 80% das falas (sobe 5 pontos por rodada já feita, até 90%). No modo 3 acerta sem ajuda em 60% (sobe 8 pontos por rodada, até 84%). Fecho próprio em 90% |
| **Fala e reduz a ajuda** | Igual, com 85% (até 95%), 70% (até 94%) e fecho próprio em 95% |
| Escolha da missão | Primeiro a que ainda paga cheio hoje e tem menos estrelas |
| Sessões | Uma por dia, salvo no cenário A' |

As durações e as taxas de acerto são estimativas. **[provar no portão]**

### 6.3 Cenário A: só as 5 missões da fase 2, uma sessão por dia

Este é o cenário do portão. Depois da sessão 5 ele é o pior caso (nenhum conteúdo novo, nunca).

| Perfil | | S1 | S2 | S3 | S4 | S5 | S30 | S90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Só toca** | XP | 309 | 471 | 633 | 795 | 957 | 5.007 | 14.727 |
| | Nível | 4 | 4 | 5 | 6 | 6 | 14 | 24 |
| | Estrelas | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Digita** | XP | 408 | 1.009 | 1.407 | 1.889 | 2.373 | 11.583 | 32.949 |
| | Nível | 4 | 6 | 8 | 9 | 10 | 22 | 36 |
| | Estrelas | 3 | 6 | 9 | 10 | 12 | 15 | 15 |
| **Fala** | XP | 925 | 1.695 | 2.627 | 3.349 | 3.969 | 19.437 | 56.557 |
| | Nível | 6 | 8 | 10 | 12 | 13 | 28 | 48 |
| | Estrelas | 6 | 10 | 14 | 15 | 15 | 15 | 15 |

- **1ª missão:** quem só toca faz 52 XP e vai ao nível 2. Quem fala ou digita faz 136 e fica a 14 XP do nível 3: o level up seguinte vem na primeira resposta da missão seguinte.
- **Level ups na 1ª sessão:** só toca 3, digita 3, fala 5 (com o título Viajante).
- **Level ups por sessão, da 1ª à 5ª:** fala 5, 2, 2, 2, 1. Digita 3, 2, 2, 1, 1. Só toca 3, 0, 1, 1, 0.
- **Depois que as estrelas acabam**, o XP por sessão fica estável: ~620 (fala), ~355 (digita), ~160 (só toca). O XP cheio diário das 5 missões basta para não estagnar no número.

### 6.4 Cenário A': as 5 sessões no mesmo dia

| Perfil | | S1 | S2 | S3 | S4 | S5 |
| --- | --- | --- | --- | --- | --- | --- |
| **Só toca** | XP / nível | 309 / 4 | 383 / 4 | 427 / 4 | 471 / 4 | 517 / 5 |
| **Digita** | XP / nível | 408 / 4 | 989 / 6 | 1.355 / 7 | 1.741 / 8 | 2.114 / 9 |
| **Fala** | XP / nível | 925 / 6 | 1.597 / 8 | 2.345 / 10 | 2.754 / 11 | 2.938 / 11 |

- **A escada inteira paga cheio num dia só**, então as sessões 1 a 3 quase não mudam.
- **A 5ª sessão de quem fala rende só ~180 XP**, sem level up: tudo já foi feito hoje, e é exatamente aí que o retorno decrescente age.
- **Consequência para o roteiro do portão (W2-14):** as 5 sessões devem ser em dias diferentes. É também o que "voltar no dia seguinte" pede.

### 6.5 Cenário B: fase 3 pronta

**Hipóteses a mais:** missão do dia (1 conversa nova quando existe, antigas com menos estrelas, chefe); um encontro novo a cada 2 sessões e um chefe novo a cada 6; feitiços crescendo até 10 por sessão (5 para quem digita), conferidos pelo app. Quem digita faz 2 encontros e o chefe (cabe em 15 min) e não fecha a missão do dia.

| Perfil | | S1 | S5 | S10 | S30 | S60 | S90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Só toca** | XP | 225 | 1.119 | 2.267 | 6.901 | 13.918 | 20.968 |
| | Nível e título | 3 | 7 Viajante | 10 Mercador | 17 Diplomata | 24 Embaixador | 29 Embaixador |
| **Digita** | XP | 493 | 2.515 | 5.183 | 16.567 | 34.454 | 52.868 |
| | Nível e título | 4 | 10 Mercador | 14 Mercador | 26 Embaixador | 37 Erudito | 46 Sábio |
| **Fala** | XP | 541 | 3.345 | 7.517 | 23.739 | 48.718 | 74.076 |
| | Nível e título | 5 Viajante | 12 Mercador | 17 Diplomata | 31 Erudito | 44 Sábio | 54 Lenda da Vila |

- **XP por sessão em regime:** ~850 (fala), ~620 (digita), ~240 (só toca).
- **Level ups de quem fala:** mais de um por sessão até a 10ª; um a cada ~1,5 sessão até a 30ª; um a cada 2 a 3 sessões até a 90ª.
- **Quem digita fica perto de quem fala** neste cenário, porque as estrelas dependem do conteúdo novo e os dois pegam todas. Está certo: os dois produzem.
- **Quem só toca** faz 28% do XP de quem fala e nunca ganha estrela. Mesmo assim sobe de nível toda semana.

### 6.6 Leitura contra as metas

| Meta do pedido | Resultado |
| --- | --- |
| 1º level up na 1ª sessão | Sim, nos três perfis, já no fim da 1ª missão |
| Não estagna | Quem produz tem level up em toda sessão do portão. No pior caso (sem conteúdo novo), quem fala ainda faz ~620 XP por sessão |
| Não infla | O último título pede ~75 sessões de quem fala todo dia. No longo prazo o ritmo é de um nível a cada 2 a 3 sessões |
| Tocar dá menos | 4× menos por resposta; 26% a 28% do XP total; zero estrela |
| Portão: "quer voltar no dia seguinte" | Os números sustentam: há título novo nas sessões 1 e 3 e level up até a 5ª. **O limite é o conteúdo:** quem fala bem fecha as 15 estrelas na sessão 4, e a sessão 5 fica sem estrela nova **[provar no portão]** |

**Se o portão falhar, o que girar:**

| Sintoma | Botão | Efeito |
| --- | --- | --- |
| "Acabou o que fazer na sessão 4 ou 5" | Nenhum número. É conteúdo: a fábrica sobe na fila (D-43) | — |
| "Subo devagar" | Prêmios das estrelas (40 / 56 / 80), ou o coeficiente da curva, de 25 para 20 | +20% de ritmo |
| "Subo rápido demais, perdeu a graça" | Coeficiente da curva, de 25 para 30, **antes** de fechar a fase | −15% de níveis |
| "Tocar compensa" | Toque de 4 para 2. Custo: a 1ª missão de quem só toca dá 38 XP, e o 1º level up passa para a 2ª missão | −50% no toque |
| "Não quero falar, digitar rende igual" | +2 por resposta falada (18 / 14 / 10). Custo: a tabela deixa de ter ½ e ¼ exatos em todos os valores, e iPhone e Firefox ficam atrás | +12% na voz |

---

## 7. Conformidade com as 6 guardas de W0-03 §6

Conferi por enumeração: todas as combinações de entrada, degrau, `flawed`, tentativa (1 a 7) e repetição (0 a 9); os 6 níveis × 2 tipos de missão × `firstTime` × domínio; todas as notas e avaliadores de feitiço.

| # | Guarda | Como os números passam |
| --- | --- | --- |
| 1 | `xpFor` e `coinsFor` nunca negativos | Tudo vem de tabelas positivas, multiplicadas por 1, ½ ou ¼ e arredondadas para cima. O menor valor possível é 0 (fecho que não houve; fonte sem moeda) |
| 2 | Voz ou digitado dá mais que toque; menos ajuda nunca dá menos | No mesmo degrau e na mesma repetição, falar ou digitar vale no mínimo o dobro do toque (8 × 4, 4 × 2, 2 × 1). Em cada linha da tabela 2.1, o valor nunca cresce com o degrau. No fecho: própria ≥ modelo > toque. Na missão: estrela maior nunca vale menos. No feitiço: voz e digitado > toque |
| 3 | `flawed` avança e não tira nada | `flawed` não entra na conta: o XP é idêntico ao da resposta sem erro. Também não atrapalha a estrela |
| 4 | A ofensiva nunca cai por erro | `streak` só recebe dias. Nenhuma informação de acerto, erro ou XP chega até ela |
| 5 | Só `purchase` tem moeda negativa | `coinsFor` é 0 ou positivo em todas as fontes |
| 6 | Nenhuma fonte depende de tempo de resposta | Nenhum campo de `XpSource` mede duração. `attempt` é ignorado. `hard` = `good` = `easy`. O único dado de calendário é o **dia** local, usado em `repeat` e na ofensiva; ele não mede rapidez |

**Guardas a mais que estes números permitem** (sugestão para o Revisor, W2-11):

| # | Guarda |
| --- | --- |
| 7 | `repeat` maior nunca dá mais XP, e nunca zera uma fonte que valia alguma coisa |
| 8 | `attempt` não muda o XP de `reply` |
| 9 | Feitiço com `gradedBy: 'self'`: a nota não muda o XP. Em qualquer avaliador, `hard` = `good` = `easy` |
| 10 | `masteryOf` nunca diminui quando se acrescenta uma rodada |
| 11 | Rodada só de toque nunca ganha estrela |
| 12 | `streak` dá o mesmo resultado para os mesmos dias em qualquer ordem e com repetições |

---

## 8. O que muda nas interfaces de §6

| # | Mudança | Por quê |
| --- | --- | --- |
| 1 | `repeat: number` em `reply`, `closing` e `spell` | É a entrada do retorno decrescente (2.2). Fica dentro de `xpFor`, então as guardas testam a regra inteira |
| 2 | `mission`: mesmo tipo, com a leitura "uma chamada por prêmio" (2.4) | Evita campo novo e casa com os eventos de id determinístico |
| 3 | `RunSummary` precisa ter, no mínimo: `missionId`, `day`, `replies[]` com `{ node, input, scaffold, flawed, attempts }` e `closing` com `{ input, accepted, usedModelAnswer }` | `masteryOf`, `repeat` e o relatório leem daqui. `runs` guarda só rodadas concluídas |
| 4 | `streak(activeDays, extraFreezes, today)`: o 2º parâmetro vira "congelamentos de presente"; em v1 é `[]` | Ganhar passa a ser derivado (5.3) |
| 5 | `EventKind` ganha `mission_first`, `mission_star` e `daily_complete`, com os ids da seção 2.7 | Prêmio único não duplica na mescla |
| 6 | `Unlock` = `{ type: 'location'; id: LocationId } \| { type: 'title'; id: TitleId }` | Seção 5.1 |
| 7 | `Stats` com os campos da seção 5.4 | Conquistas |

**`rules.v1` de referência.** É o mesmo código que passou na conferência da seção 7 e gerou a seção 6, com tipos. O App é o dono da implementação; isto é só a forma exata dos números.

```ts
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const REPLY_XP: Record<InputMode, readonly [number, number, number, number]> = {
  voice: [16, 12, 8, 8], typed: [16, 12, 8, 8], tap: [4, 4, 4, 4],   // índice = scaffold
};
const repeatFactor = (repeat: number) => (repeat <= 0 ? 1 : repeat === 1 ? 0.5 : 0.25);
const CLOSING_XP = { own: 24, model: 12, tap: 4 };
const FIRST_XP = 24, STAR_XP = [40, 56, 80] as const;                 // A1, encontro
const FIRST_COINS = 5, STAR_COINS = [5, 10, 15] as const;
const missionFactor = (level: Cefr, kind: 'encounter' | 'boss') =>
  ((4 + CEFR.indexOf(level)) / 4) * (kind === 'boss' ? 1.5 : 1);       // A1 = 1 … C2 = 2,25
const SPELL_XP = { ai: 16, local: 12, self: 8 }, SPELL_TAP_XP = 2;
const DAILY = { xp: 40, coins: 10 };
const ACH_REWARD = { S: { xp: 20, coins: 10 }, M: { xp: 50, coins: 25 }, L: { xp: 100, coins: 50 } };
const ACH_SIZE = {
  first_mission: 'S', first_star3: 'M', first_boss: 'M', voice_50: 'M', own_words_25: 'M', recast_10: 'S',
  spells_100: 'L', all_npcs: 'L', can_do_5: 'M', streak_7: 'M', days_30: 'L', comeback: 'S',
} as const;

function xpFor(s: XpSource): number {
  switch (s.kind) {
    case 'reply':                                        // flawed e attempt não entram
      return Math.ceil(REPLY_XP[s.input][s.scaffold] * repeatFactor(s.repeat));
    case 'closing': {
      const base = s.input === 'tap' ? CLOSING_XP.tap
        : s.accepted && !s.usedModelAnswer ? CLOSING_XP.own
        : s.usedModelAnswer ? CLOSING_XP.model : 0;
      return Math.ceil(base * repeatFactor(s.repeat));
    }
    case 'mission':                                      // uma chamada por prêmio; mastery = a estrela paga
      return ((s.firstTime ? FIRST_XP : 0) + (s.mastery >= 1 ? STAR_XP[Math.min(s.mastery, 3) - 1] : 0))
        * missionFactor(s.level, s.missionKind);
    case 'spell': {
      const base = s.input === 'tap' ? SPELL_TAP_XP : SPELL_XP[s.gradedBy];
      const half = s.input !== 'tap' && s.gradedBy !== 'self' && s.grade === 'again';
      return Math.ceil(base * (half ? 0.5 : 1) * repeatFactor(s.repeat));
    }
    case 'daily_complete': return DAILY.xp;
    case 'achievement': return ACH_REWARD[ACH_SIZE[s.id] ?? 'S'].xp;
  }
}

function coinsFor(s: XpSource): number {
  switch (s.kind) {
    case 'mission':
      return ((s.firstTime ? FIRST_COINS : 0) + (s.mastery >= 1 ? STAR_COINS[Math.min(s.mastery, 3) - 1] : 0))
        * (s.missionKind === 'boss' ? 2 : 1);
    case 'daily_complete': return DAILY.coins;
    case 'achievement': return ACH_REWARD[ACH_SIZE[s.id] ?? 'S'].coins;
    default: return 0;
  }
}

const totalAt = (level: number) => 25 * level * (level - 1);
const TITLES: readonly [number, TitleId][] = [
  [50, 'legend'], [40, 'sage'], [31, 'scholar'], [23, 'ambassador'],
  [16, 'diplomat'], [10, 'merchant'], [5, 'traveler'], [1, 'apprentice'],
];
function levelAt(totalXp: number) {
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * totalXp) / 25)) / 2));
  while (totalAt(level + 1) <= totalXp) level++;         // corrige o arredondamento da raiz
  while (totalAt(level) > totalXp) level--;
  const title = TITLES.find(([min]) => level >= min)![1];
  return { level, into: totalXp - totalAt(level), toNext: totalAt(level + 1) - totalXp, title };
}

const UNLOCK_LEVELS = [1, 5, 9, 14, 20, 27];             // posição = `order` do local em locations.json

const helpOf = (r: { input: InputMode; scaffold: Scaffold }) => (r.input === 'tap' ? 3 : Math.min(r.scaffold, 2));
function runDegree(run: RunSummary): number {
  const n = run.replies.length, need = n - Math.floor(n / 5);
  const upTo = (h: number) => run.replies.filter((r) => helpOf(r) <= h).length;
  const produced = run.closing.input !== 'tap';
  const own = produced && run.closing.accepted && !run.closing.usedModelAnswer;
  if (own && upTo(0) >= need) return 3;
  if (own && upTo(1) >= need) return 2;
  if (produced && upTo(2) >= need) return 1;
  return 0;
}
const masteryOf = (runs: RunSummary[]) => runs.reduce((best, r) => Math.max(best, runDegree(r)), 0);

// repeat de uma resposta: `today` = níveis de ajuda já usados hoje nesta fala, em rodadas concluídas
const repeatOf = (today: number[], help: number) => today.filter((h) => h <= help).length;
```

O algoritmo de `streak` está em 5.3.

---

## 9. Pontos para o Arquiteto decidir

| # | Ponto | Recomendo | Alternativa |
| --- | --- | --- | --- |
| 1 | **Campo `repeat` nas fontes** (muda o tipo de §6) e conta **por fala**, pela ajuda usada | Sim. É a única forma sem brecha, e o valor é conhecido na hora da resposta | Por rodada, pelo modo escolhido: mais simples, mas quem toca em tudo no modo "sem ajuda" ganha três rodadas cheias por missão por dia |
| 2 | **Prêmios de missão como eventos próprios, com id determinístico** (`first:…`, `star:…`) | Sim. Segue o princípio 3 de W0-03 §4.1 e não duplica na mescla | Somar o prêmio no evento da rodada e aceitar o prêmio em dobro quando dois aparelhos offline ganham a mesma estrela |
| 3 | **Voz = digitado** no XP por resposta | Sim (2.1). A fala é premiada pelas conquistas | +2 por resposta falada (ver 6.6) |
| 4 | **Tocar não dá estrela**, e o modo sugerido segue a estrela conquistada, não o número de vezes que jogou | Sim. É um ajuste fino da D-43 | Dar ★ por qualquer conclusão: mais simples, mas aí o toque leva 32% do bônus em vez de 12% |
| 5 | **Roteiro do portão em 5 dias diferentes** | Sim (6.4). No mesmo dia, a 5ª sessão rende pouco por desenho | Manter livre e avisar o dono |
| 6 | **Ofensiva: ganhar congelamento é derivado** (1 a cada 2 dias ativos, até 2) | Sim. Sem evento `freeze_earned` em v1 | 1 a cada 3 dias: quem joga só de segunda a sexta perde a ofensiva na 4ª semana |
| 7 | **Ordem dos locais** e nomes dos títulos e das conquistas | Os níveis e os ids são a proposta; nomes e ordem dos temas são do Conteúdo e do dono | — |
| 8 | **Curva congelada depois do portão da fase 2** | Sim. Depois disso, rebalancear só pelas fontes de XP | — |

**Fica para depois, anotado:**
- **Fábrica (fase 4):** missão colada tem id novo, então cada uma traria 200 XP de prêmio. Sugestão para a chamada da fábrica: prêmio proporcional ao número de falas (`min(n, 6) / 6`), para que missão de 2 falas não vire fonte de bônus.
- **Modo completo (fase 6):** a conversa livre não tem degrau de ajuda nem opção para tocar. Vai pedir uma fonte nova (`turn`) numa `rules.v2`. O fecho avaliado por IA pode valer mais que 24.
- **Agendador (SM-2):** fora deste pedido. As regras só precisam da nota e de quem avaliou.
- **Dependência da W2-03:** se as 5 missões tiverem outro número de falas ou não tiverem chefe, os totais da seção 6 mudam na mesma proporção (o XP de conversa é linear no número de falas). As regras não mudam.
