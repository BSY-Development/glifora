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
| `mission.check.ts` | As 9 conferências (`checkMission`) e **`parseMission`, a única entrada de missão** |
| `match.ts` | `normalize`, `matchReply`, `checkClosingAnswer`, `closingTargets` (comparação tolerante da D-43) |
| `natural.ts` | O jeito natural de cada fala (D-54): `naturalWay` (falas), `closingModel` (fecho), `closestModel` (modelo do fecho mais próximo), `closingRecast`, `closingModels` |
| `player.ts` | Apelido nas falas (D-53): `spokenName(nickname)` (o nome falado: até 10 letras, só letras, senão a 1ª palavra, senão `null`), `fillPlayer(text, nickname)`, `PLAYER_MARKER`, `PLAYER_VOCATIVE` e as conferências do marcador |

## Como usar

```ts
const res = parseMission(json, { origin: "builtin" });            // catálogo e scripts
const res = parseMission(json, { origin: "generated", id: "local:<uuid>" }); // fábrica e IA
if (!res.ok) res.issues;  // [{ path: "nodes[3].text", message: "passou de 300 caracteres" }]

const hit = matchReply(node.replies, sttAlternatives /* ou o texto digitado */, mission.target);
// null → a NPC diz lines.<alvo>.retry; senão hit.reply (hit.reply.flawed → recast), hit.pass, hit.alternative

checkClosingAnswer(closingTargets(mission), said, mission.target).accepted;

// Relatório e player (D-54): "Você disse" e, ao lado, o jeito natural.
naturalWay(mission, { node: "order", reply: 0, said: "honey" });
// → { kind: "model", text: "Can I have a honey roll, please?", translation } (natural | recast | model)
closingModel(mission, "Can I have one roll of honey?");
// → { kind: "recast", original: "A roll of honey", corrected: "A honey roll", node: "order", reply: 2 }
closestModel(mission, lastTry);  // o modelo do fecho para repetir, o mais próximo do que a pessoa tentou

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

## Recast para toda resposta (D-54)

- **Resposta boa:** `chunk` é o trecho-chave, como está no `text` ("a honey roll"). A reação da NPC repete o trecho (conferência 9), e as embutidas têm `chunk` em toda resposta boa que não é livre (`scripts/content/lib.ts`). Quando a NPC muda a pessoa do verbo, `echo` diz como ela repete ("I'm from" → "you're from").
- **Resposta com erro:** `recast.learner` é a forma certa na boca da pessoa, quando a da NPC muda a pessoa ("You're from Brazil" → "I'm from Brazil"). `recast.local: true` marca o erro que só é erro naquela fala ("Good night" ao chegar, "I eat" sobre hoje): ele não vale no fecho.
- **Fecho:** `closing.models` (1 a 3) são outros modelos além do `model_answer`; as embutidas têm de 2 a 4 no total. Vale o que tem mais palavras-alvo em comum com a fala; sem nada em comum, o `model_answer`. Os erros previstos da missão (sem `local`) também valem no fecho.
- **Regra 5 da voz mantida** (a 1ª alternativa que casa): trocar pela "maior pontuação entre as alternativas" foi medido na W2-21 e dá recast falso quando a pessoa fala certo e o reconhecedor põe a forma com erro numa alternativa de baixo.
