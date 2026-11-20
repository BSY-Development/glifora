# src/schemas — contrato de dados do conteúdo

Dono: **Conteúdo**. Schemas Zod, tipos e funções puras que dizem o que o conteúdo é e significa: idiomas, vila, missão, casamento de respostas, contrato do turno, extração do JSON colado.

- Só importa `zod`. Sem React, Dexie, DOM, relógio ou sorteio (o lint barra).
- O App importa só de `index.ts`, nunca de arquivo interno. Mudança de formato sobe `schema` e é combinada antes.
- Testes de unidade ao lado do código (`x.test.ts`), em ambiente `node`.
- Referência: D-41, D-43 e `docs/propostas/W0-03-arquitetura.md` §3 e §5.

| Arquivo | O quê |
| --- | --- |
| `lang.ts` | `UiLang`, `ContentLang`, `Cefr`, `Pair` |
| `world.ts` | `LocationId`, `NpcId`, `World` (`content/world/locations.json`) |
| `text.ts` | Texto de uma linha com teto (`text(max)`), `LocalId` (interno) |
| `vocab.ts` | `VocabItem` |
| `pattern.ts` | `PatternId`, `Pattern`, `PatternCatalog` (`content/patterns/<par>.json`) |
| `npc.ts` | `Npc` (`content/npcs/<id>.json`), `NpcLines` (`retry`, `contingency`), `NpcVoice` |
| `mission.ts` | Missão v1 (D-43): `Mission`, `MissionNode`, `Reply`, `Closing`... e `MISSION_LIMITS` |
| `mission.check.ts` | As 8 conferências (`checkMission`) e **`parseMission`, a única entrada de missão** |
| `match.ts` | `normalize`, `matchReply`, `checkClosingAnswer`, `closingTargets` (comparação tolerante da D-43) |
| `player.ts` | Apelido nas falas (D-53): `spokenName(nickname)` (o nome falado: até 10 letras, só letras, senão a 1ª palavra, senão `null`), `fillPlayer(text, nickname)`, `PLAYER_MARKER`, `PLAYER_VOCATIVE` e as conferências do marcador |

## Como usar

```ts
const res = parseMission(json, { origin: "builtin" });            // catálogo e scripts
const res = parseMission(json, { origin: "generated", id: "local:<uuid>" }); // fábrica e IA
if (!res.ok) res.issues;  // [{ path: "nodes[3].text", message: "passou de 300 caracteres" }]

const hit = matchReply(node.replies, sttAlternatives /* ou o texto digitado */, mission.target);
// null → a NPC diz lines.<alvo>.retry; senão hit.reply (hit.reply.flawed → recast), hit.pass, hit.alternative

checkClosingAnswer(closingTargets(mission), said, mission.target).accepted;

// Toda fala de NPC que vai para a tela, o relatório ou a voz (D-53): texto e tradução.
fillPlayer(node.text, profile.nickname || null);  // "Good morning, {player}!" → "Good morning, Maria!" ou "Good morning!"
spokenName(profile.nickname);  // "Maria Clara" → "Maria"; "xX_Pro_Xx" → null (o perfil mostra o nome que as NPCs vão usar)
```

## Comparação tolerante (D-43)

1. Normalização dos dois lados: minúsculas, sem acento, sem pontuação, apóstrofos tipográficos, contrações com e sem apóstrofo (as ambíguas sem apóstrofo, como "were" e "ill", ficam), `'s` só depois de pronome ou palavra interrogativa, números de 0 a 99 por extenso.
2. Passe exato com todas as respostas; só se nada casar, passe tolerante **só com as boas** (1 letra em palavras de 4–7, 2 em 8+, exata até 3; inversão de vizinhas conta 1).
3. Empate boa × com erro → a boa; empate entre boas ou nada → `null`.
4. Sem `keywords`: 60% das palavras de conteúdo do texto da resposta.
5. Voz: alternativas do reconhecedor em ordem; fica a primeira que casa.
6. Resposta livre (`free: "name"`, D-51): se nenhuma resposta casar (nem empatar) em nenhuma alternativa, a resposta livre aceita fala de 1 a 3 palavras normalizadas ("Maria"); `pass: "free"`. No máximo uma por fala, nunca com `flawed`, e a reação da NPC não repete o que a pessoa disse.
