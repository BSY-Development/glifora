# content — conteúdo do jogo

Dono: **Conteúdo** (até a fase 2, o Arquiteto). Dados, nunca código: a vila, NPCs, missões, catálogo de erros, temas, prompts.

| Pasta | O quê | Fase |
| --- | --- | --- |
| `world/` | `locations.json`: locais da vila | 1 |
| `npcs/` | Uma ficha por NPC | 2 |
| `patterns/` | Catálogo de erros por par (`pt-BR_en.json`) | 2 |
| `missions/<base>_<alvo>/<nível>/` | Missões v1 (D-43) | 2 |
| `units/`, `themes/`, `prompts/`, `eval/`, `exams/` | Unidades, temas, prompts, avaliação, simulados | 3+ |

Licença: **CC BY-SA 4.0** (ver `LICENSE` nesta pasta; D-45). O código do repositório é AGPL-3.0.

Todo arquivo é validado pelos schemas de `src/schemas/`. `content/eval/` nunca entra no bundle. Referência: W0-03 §3 e §5.

**Apelido nas falas (D-53):** a NPC chama a pessoa com `", {player}"` só como vocativo ("Good morning, {player}!"), só nas falas das NPCs e nas traduções delas, e 1 ou 2 vezes por missão, depois que a NPC já sabe o nome. Sem apelido, o trecho some ("Good morning!"); escreva a frase para ficar natural das duas formas.
