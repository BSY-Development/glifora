# PLAN — Glifora (versão open source)

Dono: Arquiteto. Cada tarefa tem: dono, descrição, critério de pronto, testes esperados e, ao ser aprovada, notas de passagem (o que fez, onde parou, pendências). O fluxo entre terminais está em `docs/EQUIPE.md`.

Status possíveis: `a fazer` · `em andamento` · `em revisão` · `aprovada` · `bloqueada`

Antes de qualquer tarefa, leia: `docs/SPEC.md`, `docs/DECISIONS.md` e a sua tarefa aqui.

IDs: `W<fase>-<nº>` (W de web), para não confundir com as tarefas `F…` da versão comercial (arquivo privado, D-38).

## Fase atual: 0 — Revisão da SPEC e arquitetura

Portão da fase: o dono aprova a arquitetura, a estrutura de pastas e o modelo de dados, e a Fase 1 está quebrada em tarefas.

| ID | Dono | Tarefa | Status |
| --- | --- | --- | --- |
| W0-01 | Arquiteto | Salvar a SPEC nova, registrar o pivô (D-37), arquivar a versão comercial (tag `comercial-expo-v0`), montar a equipe no Maestri (`docs/EQUIPE.md`) | feita |
| W0-02 | Arquiteto | Revisão crítica da SPEC (diversão, pedagogia, segurança da key, custo zero) e até 5 perguntas ao dono que mudem a arquitetura | feita (`docs/propostas/W0-02-revisao-spec.md`; respostas em D-38, D-39, D-40) |
| W0-03 | Arquiteto + Fable | Arquitetura, estrutura de pastas, modelo de dados local (IndexedDB) e do Supabase, CSP, adaptadores de IA | a fazer (depois das respostas) |
| W0-04 | Arquiteto | Destino do código e da infra da versão comercial (D-38): glifora-dev sem secret e sem funções; arquivo privado; repositório com histórico novo | feita |
| W0-05 | Arquiteto | Quebrar a Fase 1 em tarefas, com dono, critério de pronto e testes | a fazer |

## Fases seguintes (da SPEC; cada uma é detalhada quando a anterior fechar)

1. **Fundação:** estrutura, CSP, deploy automático, mapa da vila com 1 local, perfil local.
2. **Núcleo jogável sem IA:** player de missões em árvore, 5 missões demo em inglês A1–A2 (D-40), XP, nível do personagem, level up, relatório da sessão, voz do navegador. Portão: o dono joga 5 sessões seguidas e quer voltar no dia seguinte.
3. **Progressão completa:** missão diária com 3 encontros + chefe, Grimório com feitiços (SM-2), ofensiva, conquistas, metas "consigo...", moedas e avatar básico, desbloqueio de locais.
4. **Fábrica de cenários.**
5. **Conta:** login opcional com Supabase, sincronização, exportar/importar, apagar conta.
6. **Modo completo com key.**
7. **Comunidade:** cenários públicos com moderação.
8. **Preparação para exames.**
9. **Depois:** japonês e chinês com traçado, modo offline, Azure opcional (o espanhol entra antes, logo depois do inglês).

Parar ao fim de cada fase para o dono testar no celular.
