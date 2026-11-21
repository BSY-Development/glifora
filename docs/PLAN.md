# PLAN — Glifora (versão open source)

Dono: Arquiteto. Cada tarefa tem: dono, descrição, critério de pronto, testes esperados e, ao ser aprovada, notas de passagem (o que fez, onde parou, pendências). O fluxo entre terminais está em `docs/EQUIPE.md`.

Status possíveis: `a fazer` · `em andamento` · `em revisão` · `aprovada` · `bloqueada`

Antes de qualquer tarefa, leia: `docs/SPEC.md`, `docs/DECISIONS.md` e a sua tarefa aqui.

IDs: `W<fase>-<nº>` (W de web), para não confundir com as tarefas `F…` da versão comercial (arquivo privado, D-38).

## Fase atual: 2 — Núcleo jogável sem IA

**Estado (2026-11-20):** fechamento técnico concluído e no ar (`b4c34d0`; o verify-deploy passou, e o STRICT_DETACHED só falha pelos Report-To e NEL do Cloudflare, aviso aceito na D-46). **Aguardando o portão do dono**, pelo roteiro `docs/roteiros/fase-2-celular.md`, e a W2-12 (taxa da voz real).

Portão da fase (SPEC, D-49): o dono joga **5 sessões em dias diferentes, dentro de 7 dias**, no celular (Android + Chrome). Passa se ele sentir vontade de voltar **e** conseguir lembrar das frases das missões anteriores sem ver. Se não, ajustar o núcleo antes de seguir. Antes do portão, o QA Tester ataca a fase (D-47).

**O que entra:**
- player de missões v1 (D-43) com níveis de domínio;
- 5 missões demo em inglês A1–A2, com base pt-BR (D-40);
- voz do navegador e teste da taxa de casamento da voz no celular;
- XP, nível do personagem, level up e relatório da sessão;
- as pendências aceitas na D-46.

**Fica para a fase 3:** a missão do dia com 3 encontros mais o chefe, Grimório, ofensiva, conquistas, moedas, desbloqueio de locais.

**Ordem:** (W2-01, W2-03 → W2-02, W2-05, W2-06 em paralelo) → W2-04 → W2-07 → W2-08 → W2-09 → W2-10 → W2-11 → W2-12 → W2-13 → W2-14. Detalhes: W0-03 §2.5, §4.1, §5.1–5.5, §6 e D-43.

| ID | Dono | Tarefa | Pronto quando | Testes | Status |
| --- | --- | --- | --- | --- | --- |
| W2-01 | Fable (chamada nº 2) | **Regras de jogo v1.** Números para as interfaces de W0-03 §6: XP por fonte (resposta por modo e ajuda, fecho, missão, níveis de domínio), curva de nível, títulos, desbloqueios. Também moedas, ofensiva e conquistas iniciais, já para a fase 3. Proposta em `docs/propostas/W2-01-regras.md`; o Arquiteto decide (D-49) | Os números passam nas 6 guardas de W0-03 §6, com justificativa de equilíbrio (dopamina × aprendizado) | Simulação de 5, 30 e 90 sessões na proposta | aprovada |
| W2-02 | Conteúdo | **Schemas e casamento.** `mission.ts` (v1, D-43, com `closing.target_words`), `mission.check.ts` (as 6 conferências), `npc.ts`, `vocab.ts` e `pattern.ts`. `match.ts` com a comparação tolerante da D-43 e o fecho por palavras-alvo. Portar do arquivo comercial (W0-03 §5.5). Um `parseMission` só | A tabela de testes da D-43 passa | Unidade ao lado do código | aprovada |
| W2-03 | Conteúdo | **Plano de conteúdo da fase 2.** As 5 missões EN A1–A2: local, NPC, `can_do`, padrões de erro, ordem e qual é `boss` (se houver). Se precisar de local novo, dizer. O Arquiteto aprova antes de escrever | Plano aprovado | — | aprovada |
| W2-04 | Conteúdo | **Conteúdo.** `content/npcs/` (Tilda e as novas), `content/patterns/pt-BR_en.json` e as 5 missões. `scripts/content/build-index.ts` valida tudo e gera o índice. Frases do teste de voz em `content/eval/` | Tudo passa no schema e nas conferências; amostra revisada pelo dono | Unidade do script; validação no CI | aprovada |
| W2-05 | App | **Dados v2.** Tabelas `events`, `runs` e `session` (W0-03 §4.1). Exportar e importar passam a incluir `events` e `runs` (registros por união de id, com os limites da W1-17) | A migração v1 → v2 não perde nada; os arquivos v1 continuam importando | `fake-indexeddb`; fixture v1 | aprovada |
| W2-06 | App | **Voz.** `speech/` com `Tts` e `Stt` (W0-03 §2.5), aviso de privacidade antes do 1º microfone e `/settings/voice` (diagnóstico com alternativas e confiança) | Fala e escuta no Chrome do Android; sem suporte, o microfone some e o texto vira o caminho | Dublês no e2e (Revisor) | aprovada |
| W2-07 | App | **Motor e catálogo.** `engine/` com as regras v1 (D-49): `xpFor`, `levelAt`, `masteryOf`, `deriveProgress`. `catalog/` com `list` e `load`, carregando pelo `parseMission` | As guardas de `tests/pedagogy/` passam | Unidade e guardas do Revisor | aprovada |
| W2-08 | App | **Player de missão.** Escuta → falas → resposta por voz, digitada ou toque → reação com o recast destacado → `retry` → fecho (duas tentativas e resposta-modelo). Níveis de domínio (frase à vista / ideia em pt-BR / nada). Sessão retomável. XP e level up com animação (respeita reduzir movimento). HUD de XP real | `bakery-01` jogável do começo ao fim no celular, por voz e por texto | Componente e e2e com dublês | aprovada |
| W2-09 | App | **Relatório da sessão.** O que a pessoa conseguiu (`can_do`), recasts com a explicação do padrão, palavras novas, XP, a frase do fecho ao lado do modelo e convite para jogar de novo com menos ajuda | Relatório correto para uma rodada real | Componente | aprovada |
| W2-10 | App | **Pendências da D-46.** Tentar tirar `NEL`/`Report-To` e `Access-Control-Allow-Origin` pelo `_headers` (e conferir no `verify-deploy`). Atualização automática na abertura quando a pessoa está na vila. Aviso para iPhone (instalar e exportar). `navigator.storage.persist()` depois da 1ª missão | Conferido na URL real | `verify-deploy` e e2e | aprovada |
| W2-11 | Revisor | **Guardas e e2e da fase.** `tests/pedagogy/` com as 12 guardas sobre as regras v1 (W0-03 §6 e §7 da W2-01), e2e do player com dublês de voz, a11y das telas novas, teste da atualização com 2 builds (D-46) | Tudo no CI | — | aprovada |
| W2-12 | Dono + Conteúdo | **Taxa de casamento da voz.** O dono lê as frases de `content/eval/` em `/settings/voice` no celular; o Conteúdo ajusta as `keywords` | Taxa registrada; `keywords` ajustadas | — | em andamento |
| W2-13 | QA Tester | **Ataque à fase 2.** Sem microfone, permissão negada, offline no meio da missão, troca de idioma no meio da missão, duas abas na mesma missão, importação com `events`/`runs` hostis, XP forjado | Sem crítico ou alto em aberto | `tests/e2e-security/` | aprovada |
| W2-14 | Revisor | **Revisão da fase e roteiro do celular** (5 sessões em dias diferentes, dentro de 7 dias; em cada uma, lembrar sem ver as frases das missões anteriores) | Lista zerada ou aceita pelo Arquiteto | `tests/a11y/` e o roteiro | aprovada |
| W2-15 | App | **Taverna e Bram** (plano da W2-03). Arte própria (pixel art em código) da taverna e do Bram, chave i18n `place.tavern`, vila com 2 locais e `/place/tavern`. O enum `tavern`/`bram` em `world.ts` e o `locations.json` (Conteúdo) entram junto, combinados entre os dois. Na fase 2 os dois locais ficam abertos; o desbloqueio é da fase 3 | Vila com padaria e taverna, bonita e legível em 360×640; o leitor de tela anuncia os dois | e2e: tocar na taverna abre a tela | aprovada |
| W2-16 | App | **Teste das frases de voz** em `/settings/voice`: as 44 frases de `content/eval/stt/` uma a uma, com o `matchReply` da fala esperada (as alternativas em ordem, como o player), ✓/✗ por frase, a taxa e "Copiar resultado" para o Conteúdo ajustar as keywords. Nada é gravado | O dono faz o teste inteiro no Chrome do Android e copia o resultado | Componente com Stt falso; e2e do Revisor | aprovada |
| W2-17 | App | **Achados do dono no celular.** (1) **Urgente:** o "Copiar resultado" do teste de voz não foi encontrado no resumo. Pôr o botão logo abaixo da taxa, antes da lista, e mostrar o texto do resultado selecionável (para quando a cópia falhar). (2) **Vila em rua com rolagem lateral (D-52)**, que também corrige a padaria "no céu" | O dono acha e copia o resultado; a vila funciona com 2 locais e com 6 (fixture) em 360×640 | Componente; e2e e a11y do Revisor | aprovada |
| W2-18 | Conteúdo + App | **Apelido nas falas das NPCs (D-53):** o marcador `{player}` (schema e conferência, Conteúdo), as 5 missões com 1 ou 2 vocativos cada (Conteúdo) e a troca no player, no relatório e no TTS (App) | Com apelido, a NPC fala o nome; sem apelido, a frase continua natural | Tabela no `mission.test`; componente do player | aprovada |
| W2-19 | Conteúdo + App | **Correções do ataque da fase 2 (W2-13).** Conteúdo: F-W2-13-01 (médio: "constructor" quebra a vez, porque a tabela de contrações é objeto comum) e F-04 (marcas combinantes no nome falado). App: F-02 (dia inexistente na sessão), F-03 (TTS que lança), F-05 (transcrição crua no "Copiar resultado") e F-06 (HUD com nível 1 enquanto carrega). Os dois varrem as próprias pastas atrás de busca em objeto comum com texto do usuário | Os test.fail da W2-13 viram testes normais e passam; a suíte inteira passa | e2e-security da QA; reconferência da QA; Revisor com o e2e inteiro | aprovada |
| W2-20 | App | **Interface, a partir da sessão 1 do dono (D-55):** apelido com até 10 caracteres (só letras, espaço, hífen e apóstrofo); relatório com "Você disse" e o jeito natural em cada fala, mais o botão Copiar relatório; o "{title}" sem valor no relatório; botão de jogar de novo dizendo a próxima estrela e o modo; "Continuar" a missão em andamento na vila; texto da escuta (já trocado pelo Arquiteto) | O dono entende o que cada botão faz e cola o relatório na conversa | Componente; e2e; Revisor com o e2e inteiro | aprovada |
| W2-21 | Conteúdo | **Recast para toda resposta (D-54):** reproduzir e corrigir "I roll of honey" sem recast; reação das respostas boas repetindo o trecho-chave (regra no lib.ts e as 5 missões); fecho com o modelo mais próximo do que foi dito e com os erros previstos; combinar com o App o uso no player e no relatório | A fala do dono recebe o recast; o modelo do fecho combina com o pedido | Tabela no match.test com as falas reais; mission.test | aprovada |

### Notas de passagem (fase 2)

**W2-08, W2-09 e item 10 (App, aprovadas pelo Revisor; e2e inteiro 233/233):**
- **Motor (`engine/play.ts`):** `step(missão, estado, entrada) → { estado, resultado }`, puro e sem relógio. Entradas: `next`, `help`, `say` (alternativas do reconhecedor ou texto), `tap` (só com o degrau 3) e `skip` (só depois da resposta-modelo). Entrada fora de hora é ignorada. Não casou: conta e, a cada 2ª falha, a ajuda sobe um degrau (para no 3). Fecho: 2 tentativas, depois `model`; repetir a resposta-modelo (`usedModel: true, accepted: false`) ou tocar fecha sem travar. `parseState` confere o estado guardado com a missão e devolve `null` se não bater (a rodada recomeça, nunca quebra). `replyXp`/`todayLevels` dão o "+N XP" igual ao que o `planRun` grava.
- **Service (`services/play.ts`):** `prepare` (missão, fichas de NPC, vozes, estrelas, retomada), `startRun`, `keepSession` (a cada passo; falha de disco não derruba a rodada), `finishRun` (grava `runs` e depois `events`, limpa `session`; **idempotente**: queda no meio refaz sem pagar em dobro), `loadReport`. Texto do fecho vai ao registro sem `<`, `>`, controle ou invisíveis (`plain`). `navigator.storage.persist()` uma vez depois da 1ª missão (`glifora.storage.persist-asked`).
- **Catálogo:** `loadNpc(id)` e `loadPatterns(par)` (`content/npcs/`, `content/patterns/`), validados com `Npc` e `PatternCatalog`. `retry` vem da ficha da NPC de quem fala (senão da anfitriã; senão a própria fala se repete). O freguês sem ficha usa voz mais grave que a da NPC.
- **Telas:** `/place/<local>` lista missões (título, meta, estrelas, "XP cheio hoje" = nenhuma rodada da missão hoje; nunca "−50%"); `/play/:id` (`ui/play/`: `Intro`, `Player`, `Bubble`, `AnswerInput`); `/report/:runId`. O relatório sai só do que foi gravado (rodada, eventos, missão, padrões), então reabre igual depois de recarregar; o level up só anima quando vem do player (`state.fresh`). Sem estrela nem meta (`canDo`) quando só tocou. Recast destacado em `<mark>` por string separada (`ui/recast.ts`), nunca HTML.
- **Acessibilidade:** falas da NPC em região `aria-live="polite"`; o foco vai para "Continuar" ou para o microfone a cada passo (`autoFocus` com `key` por passo); o texto sempre aparece; a animação some com "reduzir movimento". `holdUpdates()` vale a missão inteira.
- **Item 10:** `Access-Control-Allow-Origin` de volta em `/` é **erro** no `verify-deploy`; `Report-To`/`NEL` seguem como aviso (borda do Cloudflare, D-46); `STRICT_DETACHED=1` ainda os torna erro.
- **Build:** `dev`, `build`, `test` e `test:watch` rodam `node scripts/content/build-index.ts &&` explicitamente (o .npmrc tem ignore-scripts=true, então hooks pre* não rodam); `engines.node` `>=22.18` (o script usa `module.registerHooks`).
- **Textos:** `play.xp` e `report.xp.total` em pt-BR ficaram diferentes do inglês de propósito (guarda de paridade); "From memory" no lugar de "By heart" (guarda do princípio 6).
- **Como testar no celular:** `npm run build && npm run preview` (ou o site publicado), Chrome do Android. Vila > Padaria > "Pão quentinho" > Começar (escolher o modo; o sugerido vem marcado) > escutar a cena > responder as 5 falas falando (1º toque no microfone mostra o aviso de privacidade) ou digitando; pedir ajuda (ideia, frase, tocar); dizer bobagem 2 vezes e ver a ajuda subir; escolher a opção com erro ("A roll of honey") e ver o recast destacado; no fecho, errar duas vezes para ver a dica e a resposta-modelo; "Ver o relatório". Fechar o app no meio e reabrir a missão: "Continuar de onde parei". Jogar de novo em "De cor" para as 3 estrelas e o level up.
- **Pendências:** `lang=` nos textos em idioma-alvo de Place e Report (menores do Revisor); só inglês tem voz (`VOICE_LANGS`); a taxa de casamento da voz real ainda é a W2-12; `catalog/` ainda confere o índice e as frases de voz à mão (trocar por `CatalogIndex`/`parseVoiceEvalSet`, exportados pelo Conteúdo).

**W2-04, amostra da bakery-01:** o dono aprovou "a princípio" o tom e o formato em 2026-11-20. As outras 4 missões estão liberadas. Ele vai jogar a bakery-01 no celular quando estiver no ar, e um ajuste que sair de lá vale para as 5.

**W2-07 (App, aprovada pelo Revisor):**
- **Motor (`src/engine/`):** `rulesV1` (D-49), `planRun` (rodada → eventos `run:<runId>`, `first:<missão>`, `star:<missão>:<n>`; `repeat` por fala; pular degraus paga todas as estrelas que faltam), `deriveProgress` (eventos de mesmo id valem uma vez), ofensiva e 12 conquistas. Recebe `history` e `granted` por parâmetro; quem grava é `services/` (player, W2-08). `RunSummary.id` evita contar a própria rodada ao replanejar.
- **Dados:** `mission_first` e `mission_star` em `EVENT_KINDS`; `Run.answers` e `closing.input`; teto de evento 400 XP / 100 moedas ganhas (`EVENT_MAX_SPEND` 10.000 só para `purchase`); `appendEvent`/`appendRun` aceitam `day` (dia de início da rodada). Export da W2-05 continua importando.
- **Catálogo:** `list`/`load` e `loadVoicePhrases` (D-48) prontos, testados com fixture. Falta o Conteúdo (W2-04): `build-index`, `content/missions/` e `content/eval/stt/`; depois trocar a conferência à mão por `CatalogIndex` e `parseVoiceEvalSet`, e pôr `predev`/`prebuild`/`pretest` no `package.json`.
- **HUD (vila):** nível, título e barra de `deriveProgress`; `<progress class="xp" aria-hidden>` + texto `hud.xp`; 8 títulos em pt-BR/en. Celular: com 0 eventos a vila segue em nível 1, Aprendiz, barra vazia.
- **Pendências:** locais 3 a 6 só abrem quando entrarem em `LocationId`. `title`/`can_do` do índice devem ser renderizados como texto puro.

**W2-10 (App, aprovada pelo Revisor):**
- **Cabeçalhos (D-46):** `public/_headers` ganhou `! Report-To`, `! NEL` e `! Access-Control-Allow-Origin` no bloco `/*`. `config/headers.ts`: o parser ignora linhas `!` e `detachedHeaders()` lista os nomes. `verify-deploy` só **avisa** (`console.warn`) se algum ainda chegar em `/`; com `STRICT_DETACHED=1` vira erro. **Não conferido na URL real:** falta ver no 1º deploy se o Cloudflare deixa tirar. Se deixar, ligar `STRICT_DETACHED=1` no workflow; se não, domínio próprio (D-46).
- **Atualização automática:** `services/appUpdate.ts`, `onUpdateReady()`. Ativa e recarrega sozinha só se passaram **no máximo 5 s** desde a abertura, o caminho é exatamente `/` (vila) e não há trava `holdUpdates()`. Senão, aviso com o botão (como antes). **Por que 5 s:** a versão nova baixa em 1 a 3 s no celular (caso do 1º acesso depois de um deploy); passado isso a pessoa já começou a usar, e recarregar tiraria o lugar dela. Fora da vila nunca recarrega sozinha (missão, perfil, ajustes, boas-vindas com rascunho). `holdUpdates()` devolve a função que solta; já usado na importação. **A W2-08 deve chamar `holdUpdates()` durante a missão** (rede de segurança além do caminho). O ramo "já havia versão esperando na abertura" (W1-12) segue ativando direto, de propósito.
- **Aviso de iPhone (D-44):** `services/install.ts` + `ui/IosInstallNotice.tsx` na vila. Aparece se `navigator.standalone === false`, sem `display-mode: standalone` e sem `onbeforeinstallprompt` (sem User-Agent). Convida a Compartilhar → Adicionar à Tela de Início, lembra da exportação (link para Ajustes) e some para sempre ao dispensar (`glifora.install.ios-notice`). Textos `install.ios.*` em pt-BR e en.
- **`navigator.storage.persist()`:** não entrou aqui (vai para a W2-08, depois da 1ª missão concluída).
- **Para o Revisor (W2-11, teste com 2 builds):** servir o build A com o SW controlando; subir o B na mesma origem; abrir `/` e ver recarregar sozinho em até 5 s; em `/place/*`, `/settings` ou depois de 5 s ver `.update-notice` com o botão; durante uma importação não recarrega.
- **Como testar no celular:** iPhone/Safari fora da Tela de Início: aviso na vila, dispensar e reabrir (não volta); instalado ou no Chrome do Android: não aparece. Android: depois de um deploy novo, abrir o app na vila e ele atualiza sozinho; abrir em Ajustes e ver o botão.

**W2-11 (Revisor, aprovada por ele mesmo; vitest 980/980 com `REQUIRE_DIST=1`; Playwright 278/278 em ~2,6 min com 2 workers e `PW_CHANNEL=chrome`):**
- **Guardas (`tests/pedagogy/guards.test.ts`, 32 testes):** as 12 guardas da W2-01 §7 contra o `rules.v1` de verdade, por enumeração (mais de 1.000 combinações de fonte): XP e moeda inteiros e ≥ 0; voz = digitado > toque; menos ajuda nunca vale menos; `flawed` e `attempt` não entram na conta; `repeat` nunca aumenta nem zera; `hard = good = easy`; `masteryOf` só sobe; só toque nunca dá estrela; a ofensiva só recebe dias e dá o mesmo resultado em qualquer ordem; sem relógio no motor. Moeda negativa fora de `purchase`: o schema do livro-razão recusa (importação hostil).
- **e2e do player (`tests/e2e/play.spec.ts`, 14):** a bakery-01 do começo ao fim por texto (pela Place; 128 XP, ★) e por voz em "De cor" (304 XP, ★★★, level up para o nível 4, aviso de privacidade antes do 1º microfone, alternativas do reconhecedor). Recast destacado sem tela de erro e no relatório. Duas falhas fazem a ajuda subir (só na 2ª). Fecho com dica e depois a resposta-modelo (52 XP) e o "seguir sem dizer". Recarregar no meio e retomar; recomeçar. Replay no mesmo dia (32 XP, 0 de prêmio, ★★★ não se perde). Tocar vale 4. Sem suporte de voz e permissão negada. Os dublês estão em `tests/e2e/support/speech.ts` (`addInitScript`).
- **Atualização com 2 builds (`tests/e2e/update.spec.ts`, 3):** servidor próprio com o `dist/` (A) e uma cópia com o `sw.js` trocado (B, responde "B" em `/__build`), com a CSP e os cabeçalhos reais. Na vila, nos primeiros 5 s: atualiza sozinho e sem aviso. No meio da missão: aviso com "Update", a página não recarrega e a rodada segue; ao abrir de novo depois da missão, atualiza. O botão aplica a versão nova.
- **a11y (`tests/a11y/play.spec.ts`, 13, mais 2 rotas novas em `routes.spec.ts`):** axe (WCAG 2.1 A/AA, 2.2 AA e boas práticas) na lista da Place e em 10 telas do player e do relatório, em pt-BR e en, claro e escuro, 360×640. Foco a cada passo, região `aria-live`, "reduzir movimento" zera a animação do level up. `lang=en` nas falas, nas frases da ajuda, no fecho e nas palavras novas: ok.
- **Teste das frases (`tests/e2e/voice-test.spec.ts`, 6; revisão da W2-16):** início, aviso de privacidade, ✓/✗, pular, repetir, resumo, copiar, nada gravado, sem suporte, axe.
- **Achados em aberto:** nenhum. **R-W2-11-1** (o inglês citado no recast e no exemplo do relatório sem `lang="en"`) foi corrigido pelo App (`ui/Quoted.tsx`) e o teste em `tests/a11y/play.spec.ts` é normal (a11y do player: 14 verdes).
- **Achados já corrigidos:** o CI do `53dc4bb` rodou com o catálogo vazio (`ignore-scripts=true` desliga os hooks `pre*`). O App tirou os hooks e `tests/security/dist-catalog.test.ts` (com `REQUIRE_DIST=1`) falha se o `dist/` não tiver o `generated-*.js` com todas as missões (testado por mutação). Texto de privacidade do teste das frases (R-W2-16-1): corrigido.
- **Fatos para a W2-13 e a W2-14:** com a interface em inglês a Place diz "Missões em breve" (o par é pt-BR → en, D-40) e o player só abre por URL; os e2e que passam pela Place usam `setUi(page, "pt-BR")`. Uma vez a suíte inteira reprovou `update.spec` "o botão aplica a versão nova" (isolado e com `--repeat-each=4`, 12 de 12 passaram; o CI tem 1 retry). Se voltar, olhar o tempo da instalação do `sw.js` novo.
- **Tempo:** ~2,6 min com 2 workers (abaixo de 3 min). O que pesa: `e2e-security` (rotas inválidas, ~130 casos) e as 10 telas do axe do player × 4 combinações (~8 s cada). Se passar de 3 min, cortar `light`/`dark` do player para o pior caso.

**W2-01 (Fable, aprovada como D-49 em 2026-11-20):** as regras v1 estão em `docs/propostas/W2-01-regras.md`.
- **Para o App (W2-07):** o `rules.v1` de referência está na §8.
- **Para o Revisor (W2-11):** as guardas 7 a 12 estão na §7.
- **O dono decidiu:** 5 sessões em dias diferentes, dentro de 7 dias. O critério é ter vontade de voltar e lembrar das frases sem ver. O roteiro da W2-14 precisa ter, em cada sessão, um teste de lembrar sem ver as frases das missões anteriores (o modo "de cor", ★★★).

**W2-05, W2-06 e W2-15 (App, aprovadas pelo Revisor):**
- **Dados v2 (`src/data/`):** Dexie versão 2 só acrescenta `events`, `runs` e `session` (sem `upgrade`; `docs` e `meta` ficam como estavam). Schemas em `schema/records.ts`; `records.ts` tem `appendEvent`, `appendRun`, `listEvents`, `listRuns` e `saveSession`/`loadSession`/`clearSession`. Registro só se acrescenta: id repetido devolve o que já existe.
  - **Limites:** xp 0 a 10000 por evento, coins -10000 a 10000 (negativo só em `purchase`, e `purchase` não ganha moeda nem XP), `rules` inteiro, `day` existente e coerente com `at` (±1 dia), `at` até 1 dia no futuro, ids `[A-Za-z0-9_.:-]` até 120, textos sem `<`, `>`, controle ou invisíveis. Teto de 25.000 eventos e 2.000 rodadas por arquivo (no pior caso cabe nos 20 MB; teste prova).
  - **Exportar/importar:** o formato continua `version: 1` (o envelope já previa `events` e `runs`; `futureTables` agora só avisa `cards`, `reviews`, `missions`). Importar une por id, o que já existe aqui fica como está, entra com `synced: 0`; tudo ou nada numa transação; `session` nunca vai; "Apagar os dados" limpa as 5 tabelas. O arquivo v1 do Revisor continua importando.
  - **XP:** estrutura só. O motor é a W2-07.
- **Voz:** `src/speech/` (`Tts`, `Stt`, `createVoice`) não lê nada na importação (o dublê do e2e vale), detecta por função, `maxAlternatives: 5`, ouvir corta a fala, `aborted` quando a pessoa para. `services/voice.ts` guarda o consentimento do microfone em `glifora.voice.mic-consent`; `listen()` sem ele devolve `denied` sem abrir o microfone. Falha tem mensagem para os 6 motivos (`voice.fail.*`).
  - **Telas:** `/settings/voice` (idioma, frase de teste, escutar, alternativas com confiança; link em Ajustes). `MicConsentDialog` e `NoMicNotice` (aviso de navegador sem escuta, uma vez só em `glifora.voice.no-mic-notice`) ficam prontos para o player (W2-08). `ConfirmDialog` ganhou `variant`.
  - **CSP:** a voz não pede origem externa.
  - **Frase de teste:** fixa em `services/voice.ts` até existir o `content/eval/`. Combinado com o Conteúdo: `content/eval/pt-BR_en.json`, cada frase aponta `expect {mission,node,reply}` e a tela mede com `matchReply`; entra como chunk separado carregado só em `/settings/voice` (precisa do `build-index` da W2-04).
- **Taverna e Bram (W2-15):** `TAVERN` e `BRAM` em `ui/art/sprites.ts`, `place.tavern` e `npc.bram.*` nos dois idiomas, `PLACE_*`/`NPCS` em `ui/world.ts`. No mapa, padaria e taverna lado a lado (46% de largura cada, taverna mais abaixo). Os dois locais abertos (desbloqueio é da fase 3). Enum `tavern`/`bram` e `locations.json` são do Conteúdo.
- **Como testar no celular:** `npm run build && npm run preview`, Chrome do Android. Vila: dois locais sem sobrepor, tocar na Taverna mostra o Bram. Ajustes > Teste de voz: tocar a frase; tocar no microfone mostra o aviso de privacidade, depois permissão do navegador, falar e ver as alternativas com a confiança; negar a permissão mostra a mensagem; no Firefox o microfone some.
- **Pendências:** o QA/PW local sem navegador instalado usa `PW_CHANNEL=chrome`. Se o ledger passar de 25.000 eventos, exportar precisará de plano (compactar o JSON ou dividir).

**W2-16 (App, aprovada pelo Revisor):**
- **Teste das frases:** `PhraseTest` (`ui/screens/VoicePhraseTest.tsx`) em `/settings/voice`, abaixo do diagnóstico. Frases de `content/eval/stt/pt-BR_en.json` por `loadVoicePhrases`, agora com `parseVoiceEvalSet` (a conferência à mão saiu de `catalog/voice.ts`). `services/voiceTest.ts`: `judge` (o mesmo `matchReply` do player, alternativas em ordem), `tally` (pular não conta) e `formatResult` (texto em inglês: cabeçalho com a taxa, uma linha por frase tentada).
- **Tela:** "Frase N de 44" grande com `lang`, Ouvir opcional, microfone, ✓/✗ (casou com outra mostra qual), alternativas com confiança, Repetir/Pular/Próxima/Ver resumo, resumo com taxa, lista dos ✗ e "Copiar resultado". Nada é gravado. Sem escuta, só avisa. Textos `voice.test.*` nos dois idiomas; o aviso de privacidade diz que a voz vai ao serviço de fala do navegador.
- **Como testar no celular:** `npm run build && npm run preview` (ou o site publicado), Chrome do Android, Ajustes > Teste de voz > "Começar o teste"; ler as 44; "Ver resumo" > "Copiar resultado" e colar na conversa.
- **Testes:** componente com Stt falso (`ui/voicePhraseTest.test.tsx`); e2e do Revisor em `tests/e2e/voice-test.spec.ts`.

**W2-17 e W2-18 (App, aprovadas pelo Revisor; e2e inteiro 290/290):**
- **Teste das frases (17.1):** "Copiar resultado" logo abaixo da taxa, caixa readonly com o texto (selecionável), resumo abre no topo. **R-W2-11-1:** `ui/Quoted.tsx` (`useQuoted`) põe `lang` nos trechos em inglês do relatório.
- **Rua da vila (D-52):** `ui/Street.tsx` (lista de links, scroll-snap ~2 por vez, setas, ArrowLeft/Right, pontinhos aria-hidden, posição em `glifora.street.pos` com try/catch, reduz movimento, `locked` para silhuetas da fase 3 só visual). Setas e pontinhos só com mais de 2 locais; `home.hint_swipe` só então. `.page` ganhou `min-width:0` (sem isso a rua alargava a página em "Muito grande"). Testado com fixture de 6 locais (`ui/street.test.tsx`).
- **Apelido nas falas (D-53):** `services/play.ts` `fillMission` (usa `fillPlayer`/`spokenName` do Conteúdo) em `prepare()`: balões, tradução, recast e TTS já vêm trocados. Perfil mostra o nome falado.
- **Pendência:** o Conteúdo precisa corrigir o erro de parse de `scripts/content/build-index.test.ts` no eslint (se ainda aparecer).

**W2-03 (Conteúdo, aprovada pelo Arquiteto em 2026-11-20):**
- **Missões, na ordem:** `bakery-01` (A1) → `bakery-02` (A1) → `tavern-01` (A1) → `tavern-02` (A2) → `tavern-03` (A2, **chefe**, com Bram e Tilda).
- **Mundo:** local novo "tavern" e NPC novo Bram (W2-15). O catálogo de erros tem os 14 padrões do arquivo comercial e mais 3 novos: `en.what_time`, `en.prep_time` e `en.past_simple`.
- **Ajustes do Arquiteto:**
  1. **Bebidas sem álcool** nas respostas, nas respostas-modelo e nas palavras-alvo (suco, chá, leite, chocolate quente). O público inclui adolescentes, e o foco é o pedido, não a bebida.
  2. **Ajuda:** toda resposta precisa de uma `translation` que sirva de "ideia em pt-BR" para o 2º degrau de ajuda. É a ideia, não a tradução palavra por palavra de uma frase com erro.
  3. **Enum `tavern`/`bram`:** entra junto com a arte do App (W2-15), para o `npm run check` não quebrar no meio do caminho.

**W2-02 (Conteúdo, aprovada pelo Revisor em 2026-11-20):**
- **Arquivos (todos em `src/schemas/`, exportados por `index.ts`):** `match.ts`, `mission.ts`, `mission.check.ts`, `npc.ts`, `vocab.ts`, `pattern.ts`, `text.ts`; `world.ts` ganhou `NpcId` (`Location.npcs` usa o enum). Testes ao lado de cada um. O resumo e os exemplos de uso estão no `README.md` da pasta.
- **Entrada única:** `parseMission(raw, { origin: "builtin" | "generated", id?, patterns? })` devolve `{ ok, mission }` ou `{ ok: false, issues: [{ path: "nodes[3].text", message }] }`, sem lançar erro. A embutida exige `keywords` em toda resposta, escuta de pelo menos 2 falas em A1–A2 e id em slug. A gerada recebe do app o id `local:<uuid>`.
- **Casamento (D-43):** `matchReply(replies, texto | alternativas, alvo)` e `checkClosingAnswer(closingTargets(m), fala, alvo)`. Decisões aceitas pelo Revisor:
  - inversão de duas letras vizinhas conta como 1 letra;
  - contrações ambíguas sem apóstrofo (`were`, `ill`, `well`...) não são expandidas, e `its` vira `it is`;
  - o passe tolerante só roda quando o exato não acha nada;
  - a conferência 2 também recusa fala inalcançável.
  - A fala é cortada em 500 caracteres (`MAX_UTTERANCE`).
- **Formato combinado com o App:** os tipos acima; `Reply.translation` é a ideia em pt-BR do 2º degrau de ajuda; o `recast.corrected` aparece literal em `reaction.text` (é o trecho que o app destaca).
- **Na W2-04:** o `content/eval/pt-BR_en.json` sai com `{ schema, base, target, phrases: [{ id, text, expect: { mission, node, reply } }] }`, e o `EvalSet`/`parseEvalSet` entram em `src/schemas/`. Evitar keywords curtas que viram outra palavra com duas letras trocadas (`three`/`there`, `form`/`from`); nota do Revisor.
- **Enums da taverna (W2-15):** `tavern` e `bram` entraram em `world.ts` e em `content/world/locations.json` (order 1) quando a arte do App ficou pronta.
- **Pendência para o Arquiteto:** o App propõe que `content/eval/` entre no bundle num chunk separado, carregado por `import()` só em `/settings/voice` (via `src/catalog/`), para o dono medir no site publicado e offline. A W0-03 §5.3 diz que `eval/` nunca entra no bundle. (Decidida na D-48: só `content/eval/stt/`.)

**W2-04 (Conteúdo; parte 1 aprovada e no commit `53dc4bb`; parte 2 aprovada pelo Revisor em 2026-11-20):**
- **Fichas:** `content/npcs/tilda.json` (do arquivo comercial, sem a voz Azure) e `bram.json` (novo: dono da taverna, calmo, humor seco, com a cachorra Pepper).
- **Catálogo de erros:** `content/patterns/pt-BR_en.json`, com os 14 padrões do arquivo comercial e mais `en.what_time`, `en.prep_time` e `en.past_simple`.
- **Missões, na ordem do índice:**
  - `bakery-01` e `bakery-02` (A1, padaria);
  - `tavern-01` (A1);
  - `tavern-02` (A2);
  - `tavern-03` (A2, **chefe**, Tilda e Bram).
  - Todas têm escuta, uma resposta com erro e recast em quase toda fala, e fecho com palavras-alvo.
- **Retomada (pedido do dono para o portão):**
  - "Can I have...?", os números e "Here you go"/"That's all" voltam na bakery-02, na tavern-01 e na tavern-02;
  - "I'm from..." volta na tavern-01 e no chefe;
  - o chefe pede um pouco de tudo, e o fecho dele aceita palavras das 5.
- **Teste de voz (D-48):** `content/eval/stt/pt-BR_en.json`, com 44 frases. Cada uma aponta para `mission/node/reply` e casa com a resposta esperada; o `build-index` confere.
- **`scripts/content/`:**
  - **`build-index.ts` (CLI) e `lib.ts`:** validam `world`, `npcs`, `patterns`, `missions` e `eval/stt`, e gravam `src/catalog/generated/index.json`. Além do schema e do `parseMission`, conferem:
    - pasta, nível e nome do arquivo;
    - ficha da NPC, com `lines` do alvo e o local da vila;
    - teto da fala por nível (A1 80, A2 120);
    - fala sem dígito nem símbolo, com pontuação no fim;
    - nenhuma bebida alcoólica (inglês, português e espanhol), no JSON cru de todo arquivo.
  - **Gancho:** `module.registerHooks` resolve os imports sem extensão de `src/schemas/` no Node.
  - **`missions.test.ts`:** 147 falas naturais (certas, com erro e ambíguas) com a resposta esperada. É a proteção para mexer nas keywords na W2-12.
- **Regras de escrita que ficaram:**
  - a resposta com erro casa só com a forma que a reação repete ("I from Brazil", "Three night"), e as keywords dela nunca aparecem na frase certa;
  - reações neutras quanto a nome, país, número e comida;
  - preço fixo só quando não depende do pedido;
  - traduções sem marcar gênero;
  - `translation` como a ideia em pt-BR.
- **Pendências:**
  - **Para o Arquiteto:** o nome sozinho ("Maria") nos nós de nome (bakery-02, tavern-02) faz a NPC pedir para repetir. Uma saída é o player aceitar qualquer fala de 1–2 palavras num nó marcado como "nome", mas isso pede um campo novo na missão.
  - **Para o Arquiteto (nota do Revisor):** `engines.node` em `>=22.18`.
  - O ajuste que o dono pedir depois de jogar a bakery-01 vale para as 5.

**D-51 (Conteúdo, aprovada pelo Revisor em 2026-11-20):**
- **Schema e casamento:** `Reply.free: "name"` (opcional, sem subir `schema`); conferência 7 no `mission.check.ts` (no máximo uma por fala, nunca com `flawed`). No `match.ts`, a resposta livre só entra quando nenhuma alternativa casou nem empatou. Aceita fala de 1 a 3 palavras normalizadas (`FREE_MAX_WORDS`), com `pass: "free"`. O fecho continua só com `exact`/`fuzzy` (`ScorePass`).
- **Não-nomes (pedido do Revisor):** `couldBeName` recusa fala com palavra que mostra que a pessoa não entendeu ou não disse o nome ("Sorry?", "What?", "Repeat, please", "Yes", "Hello"...). Há uma lista curta por idioma-alvo, sem nomes comuns (Will, Grace, Hope, Joy, May).
- **Conteúdo:** a resposta livre está na 1ª resposta da fala de nome da bakery-02 e da tavern-02; as reações não repetem o nome.
- **Player:** não muda; ele usa só o `index`/`reply` do `matchReply`.

**W2-18, parte do Conteúdo (D-53, aprovada pelo Revisor em 2026-11-20):**
- **`src/schemas/player.ts`:** `spokenName(apelido)` dá o nome falado (o apelido inteiro se tiver até 10 letras e só letras, com acento valendo e no máximo um hífen ou apóstrofo no meio; senão a 1ª palavra; senão `null`). `fillPlayer(texto, apelido)` troca `", {player}"` pelo nome falado ou, com `null`, tira o trecho inteiro. Também exporta `PLAYER_MARKER`, `PLAYER_VOCATIVE` e as funções que conferem o marcador.
- **Conferência 8 (`mission.check.ts`):** o marcador só entra nas falas das NPCs e nas traduções delas, sempre como `", {player}"` depois de algum texto, e o texto e a tradução têm o mesmo número de vocativos. Em qualquer outro campo é recusado. A conferência 4 agora exige o `recast.corrected` na reação com e sem apelido.
- **`scripts/content/lib.ts`:** as regras de qualidade da fala (teto, símbolos, pontuação) olham a fala sem o vocativo. O `build-index.test` barra mais de 2 vocativos por missão.
- **Missões:** 2 vocativos em cada uma destas: bakery-02 (nó "like" e despedida), tavern-02 (nó "questions" e despedida) e tavern-03 (nó "day" e despedida). A bakery-01 e a tavern-01 ficaram sem vocativo porque a NPC ainda não sabe o nome (na bakery-02 a Tilda diz "I don't know your name yet").
- **Combinado com o App:** a troca acontece num lugar só (`services/play.ts`, `fillMission` no `prepare()`). Recebem o texto trocado o balão, a tradução, o destaque do recast e o TTS. O relatório não mostra fala com marcador, e a romanization não leva marcador. O perfil mostra "as NPCs vão te chamar de: <spokenName>" (App).

**W2-19, parte do Conteúdo (F-W2-13-01 e F-W2-13-04, aprovada pelo Revisor em 2026-11-20):**
- **F-01:** em `src/schemas/match.ts`, as 4 tabelas que buscam texto da pessoa viraram `Map` com `.get()`: `EN_BARE`, `EN_SUFFIX`, `EN_NOT_SPECIAL` e `NUMBER_FOLD` (pt e es). As outras buscas por chave em `src/schemas` e `scripts/content` usam enum já validado. `match.test` testa constructor, `__proto__`, toString, hasOwnProperty e valueOf em qualquer caixa, no meio da frase e nos 3 idiomas.
- **F-04:** em `spokenName`, depois do NFC, cada letra aceita no máximo 1 marca de acento de uma lista fechada. CGJ, keycap, VS16, U+17B4, Zalgo, acento empilhado e o preenchimento do hangul dão `null`. "João", "Inês" e "Zoë" continuam valendo. Os 38 apelidos de `tests/payloads/nicknames-npc.json` dão o esperado.
- **e2e:** saíram os `test.fail` de F-01 e F-04 em `tests/e2e-security/w2-findings.spec.ts`. O Playwright deles roda na revisão final do Revisor, quando a máquina estiver livre.

**W2-21 (Conteúdo, D-54; aprovada pelo Revisor em 2026-11-20):**
- **"I roll of honey" sem recast:** o `matchReply` acerta essa fala sozinha (flawed, passe exato), também "a/one roll of honey" e "can I have one roll of honey". O motor passa todas as respostas em todo modo (o ★ não tira as flawed). O Player mostra em "Você disse" a alternativa que casou, então a causa provável é a 1ª alternativa final ter vindo sem o "of" e casado com a boa pela palavra "honey"; o "I roll of honey" seria o texto provisório. Falta a confirmação do dono. A flawed da bakery-01 ganhou o ruído "role of honey", "roll a honey" e "rolls a honey".
- **Regra 6 mantida** (a 1ª alternativa que casa). A troca para "maior pontuação entre as alternativas" foi medida: nas 44 frases do eval com alternativas simuladas, 2 recasts falsos e 15 ganhos em 220 pares; nos meus 16 casos de pessoa falando certo com a forma errada numa alternativa de baixo ("two rolls" × "two roll", "an orange" × "a orange", "I ate" × "I eat"), 11 recasts falsos (7 com uma guarda de tolerância). Não adotada. Teste em `match.test` documenta.
- **Schema (campos opcionais, sem subir `schema`):** `Reply.chunk` (trecho-chave, está no `text`) e `Reply.echo` (como a NPC repete quando muda a pessoa: "I'm from" → "you're from"); `Recast.learner` (a forma certa na boca da pessoa, para o relatório) e `Recast.local` (erro que só vale naquela fala; fora do fecho); `Closing.models` (1 a 3 modelos além do `model_answer`). Conferência 9: `chunk` no texto da resposta e `echo ?? chunk` na reação, com e sem apelido; a 5 olha também os `models`.
- **`scripts/content/lib.ts`:** toda resposta boa que não é livre tem `chunk`; o fecho tem de 2 a 4 modelos; os modelos passam pelas regras de fala (sem dígito, pontuação no fim).
- **`src/schemas/natural.ts` (puro):** `naturalWay(missão, { node, reply?, said? })` e `closingModel(missão, said)` devolvem `natural | recast {original, corrected, node, reply} | model {text, translation}`; `closestModel` (modelo do fecho com mais palavras-alvo em comum; sem nada, o `model_answer`), `closingRecast` (erros previstos sem `local`, só com keywords, o de mais palavras vence) e `closingModels`. O App usa no relatório (`services/said.ts`) e no Player (fase do modelo).
- **Missões:** as 5 com reações que repetem o trecho (ex.: "A honey roll! Lovely, those are new today."), 2 a 4 modelos no fecho, `learner` em "I from Brazil" (3×) e "I eat", `local` em "Good night", "Has bread", "in seven o'clock" e "I eat". bakery-01: a resposta "Two, please." virou "Two rolls, please." (mesmas keywords). tavern-01: a resposta 1 de "from" virou "I'm staying in the village for a while."; "I'm Brazilian" passa a cair na resposta 0. tavern-02 "wake": keywords yes/seven/sure/okay/ok/please (saíram six/eight/nine, porque o Bram responde "At seven o'clock, then").
- **Testes:** `natural.test.ts` (novo), `mission.test`, `match.test` (tabela D-54), `build-index.test` (regras de qualidade) e `missions.test` (os exemplos do dono e as 5 missões). E2e do Revisor em `tests/e2e/recast-voice.spec.ts`.
- **Sugestões do Revisor não aplicadas (opcionais):** modelo da bakery-02 com o nome "Alex" fixo (igual ao `model_answer` e às respostas de nome); "here you go" da Tilda ao entregar os pãezinhos (mantido: é natural, e o echo "thank you" não seria o mesmo trecho); `chunk` "It was" na tavern-03 (o trecho precisa estar no texto "It was great, thanks!", e "It was great" daria modelo para quem disse "It was good").

**W2-20, parte do App (D-55; aprovada pelo Revisor):**
- **Apelido:** o que se digita tem até 10 caracteres, só letras (com acento), espaço, hífen e apóstrofo (`checkNickname` em `services/player.ts`; ajuda e erros dizem isso). O schema de leitura segue em 30. Um apelido antigo, se a pessoa não mexer nele, continua valendo no Perfil (compara com o salvo); editou, vale a regra nova.
- **"{title}" vazio:** era `report.level` sem o `{title}` no Report. `translate()` agora é estrito: sem parâmetro, em dev e teste lança o erro com a chave; em produção o marcador some do texto (nunca aparece "{...}"). `render()` sem o modo estrito não mudou (entradas hostis).
- **O que a pessoa disse:** `Step.said`/`Step.reply` no motor, `Run.answers[].said` (texto puro, até 100 caracteres, limpo com `plain()`) e `reply` (0 a 2), ambos opcionais, então rodada e arquivo antigos valem. O relatório mostra "Você disse" em cada fala e, ao lado, a correção ou o jeito natural, ou nada (já natural). O fecho também. A conta vem de `naturalWay`/`closingModel` (Conteúdo, W2-21) por `services/said.ts`, num lugar só.
- **Copiar relatório:** botão no topo; copia texto simples (`ui/reportText.ts`, sem `<`, `>`, controle nem bidi); se a cópia falhar, aparece uma caixa somente leitura que seleciona ao focar.
- **Jogar de novo:** "Ganhar a 1ª/2ª/3ª estrela: ..." com uma linha explicando o modo (o botão a descreve por `aria-describedby`); com 3 estrelas (ou chefe), "Jogar de novo" com a linha "não dá estrela nova".
- **Vila:** cartão "Missão em andamento" com o título e "Continuar a missão", lido da `session` (`loadInProgress`). Sem rodada guardada, não aparece.
- **Testes:** componente em `ui/play.test.tsx` (fim), `services/nicknameInput.test.ts`, `i18n/index.test.ts`, `data/records.test.ts`, `engine/play.test.ts`. E2e do Revisor em `tests/e2e/report-w2-20.spec.ts` (13) e `recast-voice.spec.ts`. `saveNickname` confere com o apelido salvo (achado da revisão). O fecho no Player usa `closestModel`. **Pendente fora do App:** e2e do QA que digitam apelido recusado pela D-55 (33 falhas; entrar por perfil antigo via IndexedDB).
- **Como testar no celular:** jogar a bakery-01 e dizer "a roll of honey" na fala do pedido: o relatório mostra "Você disse" e a correção; tocar em "Copiar relatório" e colar na conversa; sair no meio de outra missão e ver o cartão na vila; no Perfil, tentar um apelido com 11 letras ou com número.
- **Fechadas depois (pedido do Arquiteto):** a animação do `.levelup-fresh` só muda a escala (sem opacidade nem cor no texto, então o contraste vale em todo quadro); o relatório e o "Copiar relatório" mostram a tradução do modelo (`translation` do `naturalWay`, `lang` do idioma base) abaixo do jeito natural. Só vitest rodado; o Revisor inclui na rodada final. `report.closing.yours/model` saíram do i18n.

## Fase 1 — Fundação (fechada em 2026-11-20; portão aprovado pelo dono)

Portão da fase: no celular do dono (Android + Chrome), o site publicado pelo GitHub Actions abre, instala na tela inicial e funciona em modo avião depois da primeira visita. O DevTools mostra a CSP do `public/_headers`. O dono troca o idioma, cria o perfil, vê a vila com a padaria, e exporta e importa o perfil.

**Estado do portão (2026-11-20):** W1-01 a W1-14 aprovadas e no ar. O que ficou aceito para depois está na D-46.

O dono testou no celular com o roteiro [docs/roteiros/fase-1-celular.md](roteiros/fase-1-celular.md). Resultado:
- **Passou:** primeira visita, apelido com `<b>` recusado, vila e padaria, ajustes no site e no app instalado, instalar, abrir em modo avião, apagar e importar de volta (apelido e avatar recuperados), exportar, importar arquivo errado e JSON quebrado (mensagem de erro, nada alterado), idioma, Sobre e licenças.
- **Achado:** o aviso de apelido salvo não aparecia, porque ficava fora da área visível. A correção é a W1-15.
- **Passo 26 (atualização):** passou, com o deploy `32a17de`.
  - Na 1ª abertura depois do deploy, o app abriu na versão antiga e mostrou o aviso "Atualizar". Um toque atualizou.
  - Era o esperado pelo desenho (W0-03 §2.3): a versão nova só "espera" depois de baixada, e o app estava fechado durante o deploy.
- **Aviso de apelido salvo (W1-15):** conferido no celular.

Ordem: W1-01 → (W1-02, W1-03, W1-05 em paralelo) → (W1-04, W1-06) → W1-07 → (W1-08, W1-09) → W1-13 → (W1-10, W1-11) → W1-12 → W1-14. Detalhes de cada tarefa: [W0-03 §8] e as seções citadas.

O deploy (W1-13) foi adiantado em 2026-11-20. O Cloudflare e o ambiente `production` do GitHub já estão prontos. Assim, os cabeçalhos são conferidos no Cloudflare de verdade, e o dono testa no celular mais cedo.

| ID | Dono | Tarefa | Critério de pronto | Testes esperados | Status |
| --- | --- | --- | --- | --- | --- |
| W1-01 | Arquiteto | **Esqueleto.** `package.json`, lockfile, `.nvmrc`, `.npmrc`, TS estrito, Vite + React, ESLint (fronteiras de D-41, sem texto solto no JSX, sem `dangerouslySetInnerHTML`, sem `eval`), pastas com um `README.md` curto em cada, `index.html` sem script inline, `i18n/` com 3 chaves, `src/schemas/lang.ts` e `world.ts`, `content/world/locations.json` com 1 local, `SECURITY.md` | `git clone` → `npm ci` → `dev`, `build`, `test`, `lint` e `typecheck` passam. Só as dependências de D-41 | Teste de fumaça; o lint acusa uma importação proibida de exemplo | aprovada |
| W1-02 | App | **CI.** `ci.yml` com o job `check`; Actions por SHA; permissões mínimas; Dependabot | O PR mostra o resultado; erro de tipo, lint ou teste derruba | O próprio pipeline | aprovada |
| W1-03 | App | **Cabeçalhos.** `public/_headers` igual a [W0-03 §2.8]; o `vite preview` aplica o bloco `/*`; `assetsInlineLimit: 0`; `z.config({ jitless: true })` no início do `main.tsx` | No preview, o DevTools mostra a CSP inteira e o console fica limpo | Unidade para o leitor do `_headers` | aprovada |
| W1-04 | Revisor | **Testes da CSP.** Playwright (Chromium, Pixel 7) e os testes "arquivo", "build" e "navegador" de [W0-03 §7]. O App liga o job `e2e` no `ci.yml` (D-41) | Tirar uma diretiva ou pôr um script inline faz o CI falhar | Os três testes, com os casos negativos (`fetch` externo, `eval`, `innerHTML`) | aprovada |
| W1-05 | App | **i18n.** `src/i18n/`: `t()`, chaves tipadas, plural, detecção, `<html lang>`, componente seletor | Trocar o idioma muda a tela na hora e persiste | Unidade: interpolação, plural, detecção (`pt-PT` → `pt-BR`; `fr` → `en`) | aprovada |
| W1-06 | Revisor | **Guardas de i18n.** Paridade de chaves e de marcadores; valor vazio; plural | Apagar uma chave de um idioma derruba o CI | `tests/i18n/` | aprovada |
| W1-07 | App | **Dados locais v1.** Dexie com `meta` e `docs`; repositórios de `profile`, `prefs` e `avatar`; `deviceId`; o banco abre antes da primeira tela | O perfil sobrevive a recarregar e a fechar o navegador | Vitest + `fake-indexeddb`: criar, ler e alterar (`updatedAt` sobe, `dirty` vira 1) | aprovada |
| W1-08 | App | **Casca e rotas.** React Router; layout com navegação inferior; `/`, `/welcome`, `/place/:id`, `/profile`, `/settings`, `/about` e 404; carregamento sob demanda; erro com tela amigável; foco no título ao trocar de rota; `/about` com versão e commit | Navegação por toque e por teclado; o voltar do Android funciona; 360×640 sem rolagem lateral | Componente: rota desconhecida cai no 404. e2e: fumaça por todas as rotas | aprovada |
| W1-09 | App | **Exportar/importar v1.** Formato de [W0-03 §4.1] (só `docs` por enquanto); `data/merge.ts`; "Apagar os dados deste aparelho" com confirmação | Exportar num navegador e importar em outro recupera o perfil; arquivo inválido dá mensagem clara | Ida e volta; importar duas vezes; arquivo de versão futura recusado; `tests/fixtures/export-v1.json` | aprovada |
| W1-10 | App | **Primeira visita e perfil.** `/welcome`: idioma (já detectado) e apelido opcional. `/profile`: apelido, avatar entre 4 figuras, idioma da interface e idioma base. `/settings`: reduzir movimento, sons, tamanho do texto | Tudo persiste; o texto escala sem quebrar a tela; a preferência de movimento do sistema é respeitada | Componente: salvar perfil. e2e: primeira visita completa | aprovada |
| W1-11 | App | **Mapa da vila com 1 local.** DOM + CSS, arte CC0 provisória com `public/assets/CREDITS.md`, `image-rendering: pixelated`; a padaria é um botão com rótulo; barra de XP (nível 1) de enfeite; `/place/bakery` mostra a Tilda e "missões em breve" | Bonito e legível no celular do dono; o leitor de tela anuncia o local; nenhuma imagem de fora | e2e: tocar no local abre a tela | aprovada |
| W1-12 | App | **PWA.** Manifesto, ícones, `vite-plugin-pwa` (`generateSW`, `injectRegister: false`), `sw-register.ts` com a política `glifora-sw`, aviso de versão nova, `Cache-Control` no `_headers` | Instala na tela inicial do Android; abre em modo avião depois da primeira visita; nenhuma violação de CSP ao registrar | e2e: recarregar offline; registro sem violação (resolve o "provar no teste" do Trusted Types) | aprovada |
| W1-13 | App | **Deploy.** Job `deploy` (wrangler, ambiente `production`), `version.json` com o commit, conferência dos cabeçalhos na URL real. **Depende do dono:** repositório público no GitHub, conta no Cloudflare, projeto Direct Upload e token (D-39) | Push na `main` publica sozinho; a URL abre no celular; o DevTools mostra a CSP do arquivo | A conferência pós-deploy | aprovada |
| W1-14 | Revisor | **Revisão da fase.** Acessibilidade em todas as rotas (axe), segurança contra [W0-03 §1.2 C], princípios da SPEC, README "como rodar", roteiro de teste no celular para o dono | Lista de problemas zerada ou aceita pelo Arquiteto | `tests/a11y/` e o roteiro manual | aprovada |
| W1-15 | App | **Ajuste do teste do dono.** O aviso "Apelido salvo." aparece perto do botão; antes ficava no fim da tela, fora da área visível. Erros de salvar ficam junto do grupo que falhou | O dono vê o aviso no celular sem rolar | Componente e e2e do aviso visível no Pixel 7 | aprovada |
| W1-16 | QA Tester | **Ataque à fase 1** (D-47). No build local: CSP e Trusted Types (script externo e inline, `eval`, `fetch` para fora), apelido e importação com payloads hostis, robustez (IndexedDB bloqueado ou cheio, modo anônimo, offline) | Relatório com severidade, reprodução e evidência; nenhum achado crítico ou alto em aberto | `tests/e2e-security/` e `tests/payloads/`, no CI | aprovada |
| W1-17 | App | **Correções do ataque do QA (W1-16).** F-03: na importação, doc conhecido de versão mais nova recusa o arquivo. F-04: lápide sem `data` e teto de 32 KB por doc. F-01/02: apelido sem `\p{Cf}`, `\p{Zl}` e `\p{Zp}` (ZWJ só entre emoji) e sem apelido invisível | Os `test.fail` do QA viram `test` e passam | `tests/e2e-security/` e unidade em `src/data/` | aprovada |

### Notas de passagem

**W1-01 (Arquiteto, aprovada pelo Revisor na 2ª rodada):**
- **Versões:** Vite 8.3, React 19.3, React Router 8.5, Dexie 4.4, Zod 4.6, Vitest 5.1, ESLint 10.15.
  - O TypeScript fica no **6.0.3**: o typescript-eslint 8.73 ainda não aceita o 7.
  - Sem eslint-plugin-react, que não roda no ESLint 10. O texto solto no JSX e o HTML perigoso são barrados por `no-restricted-syntax`.
- **Lint (`eslint.config.js`):** um bloco por camada com todas as regras (fronteiras de D-41, também em `import()`). Rede só em `ai/` e `data/`; `content/` e `import.meta.glob` só em `catalog/`.
  - Mexeu numa regra: rode `tests/arch/` (52 sondagens do Revisor, com os falsos positivos que não podem voltar).
  - **Regex dos padrões:** sem escapar `-` nem `/`, porque o ESLint compila com a flag `u` e o erro só aparece quando existe um arquivo naquela camada.
- **tsconfig em três:** `tsconfig.json` (src, sem tipos do Node), `tsconfig.tests.json` (tests/, com Node) e `tsconfig.node.json` (configs).
- **Tela provisória:** `src/ui/App.tsx` lê `i18n/pt-BR.json` direto. A W1-05 troca por `t()` e precisa atualizar `document.documentElement.lang` (o `index.html` nasce com `lang="pt-BR"`).
- **Para a W1-03:** o Revisor escreve o teste do `_headers` em `tests/security/`.
- **SECURITY.md:** tem o aviso "em construção". O aviso sai quando a fase 1 fechar.

**W1-04 (Revisor, testes da CSP):**
- **Arquivo** (`tests/security/csp-file.test.ts`): compara `public/_headers` diretiva por diretiva com a lista do próprio teste; barra `unsafe-*`, `*`, `data:`, `http:`, curinga de host, nonce. **Mudar a CSP obriga a mudar `EXPECTED`/`EXPECTED_CONNECT` ali** (é o gancho do Revisor para os commits do `connect-src` das fases 5 e 6).
- **Build** (`tests/security/csp-build.test.ts`): varre `dist/` (script inline, `<style>`, `style=`, `on*=`, `data:`, URL `http(s)://` nos JS fora de `KNOWN_URLS`, `_headers` copiado). Pula sem `dist/`; com `REQUIRE_DIST=1` falha. **Passo novo no `check` do `ci.yml`, depois do build:** `REQUIRE_DIST=1 npx vitest run tests/security/csp-build.test.ts`.
- **Navegador** (`tests/e2e/csp.spec.ts`, `playwright.config.ts`: Chromium Pixel 7 contra `vite preview`): cada rota em `ROUTES` abre com os cabeçalhos do arquivo, sem violação, sem erro de console, sem HTTP ≥ 400, sem rede fora do site. Casos negativos: `fetch`/XHR/`sendBeacon`/form/iframe/img/CSS externos, `eval`, `new Function`, `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`setHTMLUnsafe`, política Trusted Types extra, `<script>` injetado.
  - **Armadilha:** `page.evaluate` roda via CDP e **desliga a trava de eval**. As tentativas rodam como código da página (o `page.route` acrescenta uma sonda ao JS do app, mantendo os cabeçalhos). Não "simplifique" para `evaluate`.
  - **Toda rota nova (W1-08 em diante) entra em `ROUTES`.**
- **Verificado por mutação:** tirar `form-action`, pôr `'unsafe-inline'` e pôr `<script>` inline no `index.html` derrubam os testes (arquivo, build e navegador).
- **Para o App ligar o job `e2e`:** `npx playwright install --with-deps chromium` e `npx playwright test` (o config sobe o preview sozinho; `CI` liga retry e relatório). Localmente, `PW_CHANNEL=chrome` usa o Chrome instalado. Falta `tsc -p tests/e2e/tsconfig.json` no script `typecheck` (Arquiteto).
- **Dependências de desenvolvimento novas:** `@playwright/test` 1.65.1 e `@axe-core/playwright` 4.14.0 (o axe só entra em uso na W1-14).
- **Pendente:** o e2e de `/` falha hoje por `GET /favicon.ico` 404 (erro no console). O App precisa de um `public/favicon.svg` + `<link rel="icon">` (sem `data:`, a CSP não deixa).

**W1-06 (Revisor, guardas de i18n):**
- `tests/i18n/parity.test.ts`: mesmas chaves em todos os `i18n/*.json`, formato da chave, nenhum valor vazio, nenhum HTML, texto não copiado entre idiomas (exceções em `SAME_OK`), mesmos marcadores `{x}` por chave, plural igual nos dois idiomas, só categorias do `Intl.PluralRules`, `one` e `other` obrigatórios, `{n}` em toda forma.
- `tests/i18n/render.test.ts`: entradas hostis no `render` (HTML, `$&`, `n` inválido). Há um `it.fails` documentando o bug do `{constructor}` em `src/i18n/index.ts`; quando o App corrigir, trocar por `it`.

**W1-02, W1-03 e W1-05 (App):**
- **CI (`.github/workflows/ci.yml`):** `check` (npm ci → typecheck → lint → test → build → `REQUIRE_DIST=1` na varredura do `dist/`) e `e2e` (Chromium do Playwright; o `webServer` do `playwright.config.ts` faz o build e sobe o `vite preview`; relatório como artefato). Actions por SHA (checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2), `permissions: contents: read`, sem `pull_request_target`. Dependabot semanal e agrupado (npm e actions). **Pendência:** a primeira rodada real no GitHub; local só validei o `npm run check` e o e2e (`PW_CHANNEL=chrome`).
- **Cabeçalhos:** `public/_headers` igual a W0-03 §2.8. Leitor puro em `config/headers.ts` (com teste), usado por `vite.config.ts` em `preview.headers`. Mexi em `tsconfig.node.json`, `vitest.config.ts` e `eslint.config.js` só para cobrir a pasta `config/`; `allowImportingTsExtensions` evita o aviso do Vite. `assetsInlineLimit: 0`; `public/favicon.svg` (sem `data:`).
- **Zod jitless:** `src/zod-config.ts` é o **primeiro** import do `main.tsx`. Imports ESM sobem antes do corpo, então a chamada no corpo rodaria depois dos outros módulos.
- **i18n:** `src/i18n/index.ts` (puro: `t`, `translate`, `render`, `detectLocale`, `initLocale`, `setLocale`, `subscribe`); `ui/useT.ts` (`useT`, `useLocale`) e `ui/LanguageSelector.tsx` (no rodapé). Idioma em `localStorage` (`glifora.ui-lang`), lido de forma síncrona no boot; **na W1-07, espelhar no doc `prefs`**. Detecção: primeiro idioma de `navigator.languages` que a interface tem (`pt*` → pt-BR, `en*` → en, senão en). Interpolação só com propriedades próprias (`Object.hasOwn`), números formatados por `Intl.NumberFormat`.
- **Como testar:** `npm ci && npm run check`; `npx playwright test` (ou `PW_CHANNEL=chrome`); `npm run build && npm run preview`, abrir no celular/Chrome, trocar o idioma no rodapé, recarregar e ver que persiste e que `<html lang>` muda.
- **Dependências:** nenhuma de runtime. As de desenvolvimento (`@playwright/test`, `@axe-core/playwright`) vieram do Revisor (W1-04).

**W1-07, W1-08 e W1-09 (App, aprovadas pelo Revisor):**
- **Dados (`src/data/`):** Dexie v1 (`meta`, `docs`). `defineDoc` (docRepo.ts) dá `read/get/save/update` com Zod: `updatedAt` sempre sobe, `dirty=1`, valor igual não escreve, linha de versão futura não é lida nem sobrescrita (`NewerDocError`). Schemas em `src/data/schema/` (perfil: apelido e `createdAt`; prefs: `uiLang`, `baseLang`, `reduceMotion`, `sounds`, `textSize`; avatar: `figure` a–d). Relógio e uuid entram por `Deps`. Apelido conta por caractere (emoji).
- **Services:** `boot()` abre o banco antes da primeira tela (só falha de abertura mostra `StorageError`). `player.ts` (perfil, prefs, avatar), `locale.ts` (espelho do idioma em `prefs`; o localStorage segue sendo a leitura síncrona; no boot, sem escolha local vale o `prefs`, com escolha local vale a local), `transfer.ts`, `about.ts`. A tela lê com `useLiveQuery(() => loadX())`.
- **Exportar/importar:** `glifora-export` v1, só `docs`, sem `dirty`/`meta`/`session`/key. `merge.ts`: vence `updatedAt` mais novo, empate converge por conteúdo, importar 2x não muda nada. Recusa: arquivo > 20 MB, versão maior (`too_new`), `updatedAt` mais de 1 dia no futuro, Zod estrito; id desconhecido é pulado e tabelas futuras são avisadas. Erros copiáveis (textarea + versão do app). Apagar: `ConfirmDialog` (`<dialog>`), limpa `docs`, `meta` e `glifora.*` do localStorage. UI em `/settings` > "Seus dados".
- **Rotas:** `src/ui/routes.tsx` (`/`, `/welcome`, `/place/:id`, `/profile`, `/settings`, `/about`, `*`), `import()` literal, `ErrorBoundary` em dois níveis, `HydrateFallback`, foco no h1, skip link, navegação inferior. `/about`: `__APP_VERSION__`/`__APP_COMMIT__` por `define` (`config/buildInfo.ts`: `GITHUB_SHA`, senão git, senão "dev"). `/welcome`, `/profile` e `/settings` seguem casca (W1-10).
- **Dependabot:** `typescript` ignorado em semver-major; tirar o bloco quando o typescript-eslint aceitar o TS 7.
- **Dev deps novas:** `fake-indexeddb`, `jsdom`, `@testing-library/react` e `/dom`. Teste de componente usa `// @vitest-environment jsdom` na 1ª linha.
- **Como testar no celular:** `npm run build && npm run preview`, abrir no Chrome do Android: navegar pelas 4 abas e pelo Voltar; Ajustes > Exportar, trocar o idioma, Importar o arquivo, Apagar (Esc/Cancelar não apagam). No Chrome desktop em 360×640 rodei esse roteiro: sem rolagem lateral, 0 violação de CSP, console limpo.
- **Pendências:** o build avisa de chunk > 500 kB (zod, dexie e react-router no 1º carregamento); vale code-splitting numa tarefa futura. O doc `prefs` guarda `reduceMotion`, `sounds` e `textSize`, mas nada os aplica ainda (W1-10).

**Arquiteto, sobre o aviso de bloco > 500 kB (W1-07 a W1-09):** está aceito. O bloco principal tem só as quatro bibliotecas de D-41: react-dom, react-router, zod e dexie. São 507 kB minificados e 157 kB com gzip; o código do app tem 34 kB. Dividir em mais blocos não diminui o download total. A partir da W1-12, o service worker guarda tudo depois da primeira visita. Se a primeira carga pesar no celular, o primeiro candidato é o `zod/mini`.

**W1-13 (App, aprovada pelo Revisor):**
- **Job `deploy` (`ci.yml`):** só em push na `main`, `needs: [check, e2e]`, ambiente `production` (url `https://glifora.pages.dev`), `permissions: contents: read`. O `check` sobe o `dist/` como artefato (só na `main`) e o `deploy` baixa o mesmo, sem novo build. Concorrência: `cancel-in-progress` só fora da `main`.
- **Wrangler:** `npx --yes wrangler@4.165.0 pages deploy dist --project-name=glifora --branch=main --commit-hash=$GITHUB_SHA`, só nesse job e fora do `package.json`. O `.npmrc` (`ignore-scripts=true`) vale; confirmei localmente que o wrangler roda assim. Os secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) ficam só nesse passo; a conferência não tem secret. Sem lockfile, o `npx` resolve as dependências transitivas na hora (o Revisor sugeriu `tools/deploy` com `package.json` e lockfile no futuro).
- **`version.json`:** gerado no build por um plugin em `vite.config.ts`: `{ "version", "commit" }`, commit de 7 caracteres igual ao do `/about`, sem data. `public/_headers` ganhou o bloco `/version.json` com `Cache-Control: no-cache`.
- **Conferência pós-deploy (`scripts/ci/verify-deploy.ts`, lógica em `verifyDeploy.ts`):** busca `/`, `/version.json` e `/settings` na URL real; cada cabeçalho do bloco `/*` do `_headers` com valor exato (cabeçalho a mais não é erro), commit da rodada, `no-cache` no `version.json`, `/settings` com 200 e `id="root"` (fallback de SPA). Tenta por ~3 min e mostra a diferença. Roda com `node` direto (Node >= 22.18; o CI usa a `.nvmrc`).
- **Risco do 1º push:** se o Cloudflare reescrever algum cabeçalho (ex.: `Strict-Transport-Security`, `Permissions-Policy`), a conferência falha depois de ~3 min mostrando a diferença; o certo é ajustar a conferência ou o `_headers` de propósito, nunca afrouxar a CSP.
- **Manutenção:** o Dependabot não vê o wrangler; revisar a versão à mão a cada fase. No GitHub, confirmar que o ambiente `production` aceita só a `main` e que os secrets estão nele. Mitigação no Cloudflare: token só com Cloudflare Pages: Edit na conta do glifora.
- **Pendente de validar na URL real:** abrir `glifora.pages.dev` no Chrome do Android (CSP no DevTools, console limpo) e recarregar `/settings` direto.

**W1-10 e W1-11 (App, aprovadas pelo Revisor):**
- **Primeira visita:** sem perfil, `/` leva a `/welcome` (idioma + apelido opcional, botão "Começar"); com perfil, `/welcome` leva a `/`. `/profile`: apelido (botão Salvar), avatar (4 figuras), idioma da interface e idioma base ("o mesmo da interface", pt-BR ou en; escolhas valem na hora). O seletor de idioma da barra some em `/welcome` e `/profile` (a tela já tem o seu).
- **Apelido:** `Nickname` em `data/schema/docs.ts`: até 30 caracteres, recusa `<`, `>`, controle e bidi. Vale também na importação. `checkNickname` (services/player) dá a mensagem. Perfil antigo inválido: `profileRepo.get` devolve `null` e a pessoa passa por `/welcome` de novo (sobrescreve).
- **Ajustes:** `ui/display.ts` põe `data-text-size` (normal/large/xlarge = 100/125/150% no `<html>`) e `data-motion` (on/off; ausente = segue o `prefers-reduced-motion`). Aplicado no `main.tsx` antes da 1ª tela e ao vivo no Layout. Sons só guardam (quando houver som, o padrão não pode tocar sozinho).
- **Vila:** `ui/art/` (PixelArt, Grid, sprites: avatares, Tilda, padaria, cena) em JSX/SVG `crispEdges`, sem arquivo de imagem; `public/assets/CREDITS.md` diz que tudo é original. Locais por `catalog/index.ts` → `services/world.ts`; rótulo/arte/NPC em `ui/world.ts` (tabelas tipadas por `LocationId`: um local novo no schema não compila sem texto e arte). Barra de XP vazia, de enfeite. O mapa encolhe em tela baixa para caber inteiro em 360×640.
- **`vite.config.ts`:** `codeSplitting` com grupo `zod` (zod + `zod-config.ts`). Sem isso o rolldown juntava zod e schemas e construía os schemas antes do jitless (erro TrustedScript no console).
- **Testes:** `src/ui/screens.test.tsx`, `src/data/nickname.test.ts`; e2e `first-visit.spec.ts` é do Revisor. Rádios são controlados e gravam no IndexedDB: nos e2e usar `click()`.
- **Como testar no celular:** abrir o site limpo → cai em Boas-vindas; escolher idioma e apelido; ver a vila; tocar na Padaria; Perfil (avatar, idiomas); Ajustes (texto Muito grande, movimento).
- **Pendências:** XP real e títulos (fase 2); sons (sem som ainda).

**W1-12 (App, aprovada pelo Revisor):**
- **Plugin:** `vite-plugin-pwa` 2.0.0 (devDependency; peer aceita Vite 8; traz `workbox-build` 7.4.1), `generateSW`, `registerType: 'prompt'`, `injectRegister: false`, `inlineWorkboxRuntime` (sem `importScripts`), `navigateFallback: /index.html`, `cleanupOutdatedCaches`, `runtimeCaching: []`, `version.json` fora do precache, sem SW no `dev`. Precache: JS, CSS, HTML, SVG, PNG e manifesto (o i18n vai dentro do bundle). Config em `vite.config.ts`.
- **Registro (`src/sw-register.ts`):** depois do `load`, só em produção. Política Trusted Types `glifora-sw` aceita só `/sw.js` exato; sem `window.trustedTypes` passa a string. Teste de unidade em `sw-register.test.ts`.
- **Atualização:** ao abrir com versão esperando (e já controlada por um SW), manda `SKIP_WAITING` e recarrega uma vez no `controllerchange`. Com o app aberto, o `updatefound` chama `services/appUpdate.ts` (store mínima, `useSyncExternalStore`) e o `UpdateNotice` (no Layout) mostra "Nova versão disponível" + "Atualizar". Também confere `registration.update()` quando a aba volta a ficar visível. Textos `update.*`. Testado à mão com 2 builds (o Revisor pode automatizar na fase 2).
- **Manifesto:** `id`/`start_url`/`scope` `/`, standalone, portrait, tema e fundo `#fbf7ef`, ícones 192, 512 e maskable 512 em `public/icons/` (+ `apple-touch-icon` 180 e `theme-color` no `index.html`). Os PNG vêm de `scripts/assets/make-icons.ts` (só Node/zlib); `CREDITS.md` atualizado.
- **`_headers`:** sem mudança. O Cloudflare manda `max-age=0, must-revalidate` em `index.html`, manifesto e ícones (conferido com curl) e o bloco `/sw.js` já dava `no-cache`.
- **Pós-deploy:** `verify-deploy.ts` confere `/sw.js` (200, JavaScript, `no-cache`, cabeçalhos do `/*`) e `/manifest.webmanifest` (200, JSON com `id` e `standalone`).
- **Revisor:** `tests/e2e/pwa.spec.ts` (registro sem violação, offline, `register()` com string barrado); `KNOWN_URLS` ganhou o texto `bit.ly/wb-precache` do workbox.
- **Como testar no celular:** abrir `glifora.pages.dev` no Chrome do Android, usar o app, "Instalar app"/"Adicionar à tela inicial"; ligar o modo avião e abrir o ícone: vila, perfil e ajustes funcionam. Depois de um novo deploy: abrir o app instalado já atualiza; com ele aberto aparece o aviso.
- **Pendências/riscos:** com a aba em segundo plano e uma versão esperando, o recarregar só acontece ao abrir ou pelo botão (nunca no meio da edição). Dependabot ignora o plugin só se o Arquiteto quiser; o `workbox-build` entra pelo lockfile.

**Arquiteto, sobre o `npm audit` da W1-12:** os 4 alertas moderados (`glob` e `minimatch`, via `workbox-build` do `vite-plugin-pwa` 2.0.0) estão aceitos.
- Só rodam no build, com padrões fixos sobre arquivos do próprio projeto. O `npm audit --omit=dev` dá 0.
- A saída sugerida (`vite-plugin-pwa` 1.1.0 com `--force`) é um rebaixamento que quebra o Vite 8.
- O Dependabot traz a correção quando o Workbox atualizar.
- **Também aceito:** o recarregar pelo `controllerchange` (observação do Revisor). Hoje só acontece ao abrir ou pelo botão. O teste automático do fluxo de atualização com 2 builds fica para a fase 2.

**Licença no app (D-45, App):** `package.json` com `AGPL-3.0-only`; `CREDITS.md` diz que a arte própria e os ícones ficam sob a AGPL-3.0 do repositório. `/about` ganhou a seção "Licenças" (código AGPL-3.0, conteúdo CC BY-SA 4.0, "Glifora" não licenciado) e o link "Código-fonte no GitHub" (`<a href rel="noopener noreferrer">` para https://github.com/BSY-Development/glifora, constante em `About.tsx`), nos dois idiomas. O teste de build do Revisor precisa listar essa URL exata em `KNOWN_URLS`.

**Correções da W1-14 (App):** Home e Welcome mostram o título (h1) mesmo carregando, então o foco vai para ele ao voltar para a vila (TalkBack anuncia a tela). `ci.yml` roda `REQUIRE_DIST=1 npx vitest run tests/security` (pasta inteira). Observações para o Arquiteto: o manifesto tem `description`/`lang` fixos em pt-BR (vite.config.ts); o Cloudflare acrescenta `Access-Control-Allow-Origin: *`, `Report-To` e `NEL` fora do `_headers`.

**W1-15 (App, achado do dono no passo 5):** em `/profile`, "Apelido salvo." e o erro de salvar agora ficam dentro do formulário do apelido, logo após o botão (`aria-live`). Erros de avatar, idioma-base e (em Ajustes) tamanho do texto, movimento e sons aparecem no próprio grupo: `ChoiceGroup` ganhou a prop `error`. Boas-vindas e Seus dados já eram perto da ação. Teste de componente confere a ordem no DOM.

**W1-16 (QA Tester) e W1-17 (App). As notas são do Arquiteto, porque o PC do dono travou antes de o App escrevê-las:**
- **Ataque do QA:** sem crítico nem alto. Foram 216 testes em `tests/e2e-security/` (payloads em `tests/payloads/`), no CI pelo `testMatch` do `playwright.config.ts` da raiz. O typecheck inclui `tests/e2e-security/tsconfig.json`.
- **F-03:** a importação recusa o arquivo inteiro (`doc_too_new`) quando um doc de id conhecido tem `v` maior que o do app.
  - **Atenção, fase 5:** a mescla da **sincronização** precisa de outra regra. Ela tem de guardar o doc de versão mais nova sem quebrar o local, porque não dá para recusar o que vem do servidor.
- **F-04:** lápide (`deleted: 1`) entra com `data: {}`. O `data` de cada doc tem teto de 32 KB em JSON (`DOC_DATA_MAX_BYTES`), inclusive de id desconhecido.
- **F-01/02:** o `Nickname` (`src/data/schema/docs.ts`) barra `<`, `>`, `\p{Cc}`, `\p{Cf}`, `\p{Zl}` e `\p{Zp}`, menos o ZWJ entre dois emoji. Apelido sem caractere visível é recusado; o vazio continua valendo.
- **Travamento do PC do dono (2026-11-20):** vários terminais rodaram o Playwright ao mesmo tempo, cada um com até 8 Chromes. **Regra:** um Playwright por vez nesta máquina (veja `docs/EQUIPE.md`) e workers limitados fora do CI.

**Revisor (W1-17, aprovada) — um Playwright por vez nesta máquina:** antes de rodar a suíte, confira com `maestri list` e `maestri check` se outro terminal não está rodando. Para conferir algo pontual, rode só o arquivo, com `--workers=2`. O `playwright.config.ts` limita a 3 workers fora do CI (`fullyParallel` continua).

**Nada de IA, key, Supabase ou voz na fase 1.** O `connect-src` fica só `'self'`, e isso é testado.

## Fase 0 — Revisão da SPEC e arquitetura (fechada em 2026-11-20)

Portão da fase: o dono aprova a arquitetura, a estrutura de pastas e o modelo de dados, e a Fase 1 está quebrada em tarefas.

| ID | Dono | Tarefa | Status |
| --- | --- | --- | --- |
| W0-01 | Arquiteto | Salvar a SPEC nova, registrar o pivô (D-37), arquivar a versão comercial (tag `comercial-expo-v0`), montar a equipe no Maestri (`docs/EQUIPE.md`) | feita |
| W0-02 | Arquiteto | Revisão crítica da SPEC (diversão, pedagogia, segurança da key, custo zero) e até 5 perguntas ao dono que mudem a arquitetura | feita (`docs/propostas/W0-02-revisao-spec.md`; respostas em D-38, D-39, D-40) |
| W0-03 | Arquiteto + Fable | Arquitetura, estrutura de pastas, modelo de dados local (IndexedDB) e do Supabase, CSP, adaptadores de IA | aprovada (D-41; ajustes do dono em D-43 e D-44) |
| W0-04 | Arquiteto | Destino do código e da infra da versão comercial (D-38): glifora-dev sem secret e sem funções; arquivo privado; repositório com histórico novo | feita |
| W0-05 | Arquiteto | Quebrar a Fase 1 em tarefas, com dono, critério de pronto e testes | feita (fase 1 abaixo) |

## Fases seguintes (da SPEC; cada uma é detalhada quando a anterior fechar)

2. **Núcleo jogável sem IA:** player de missões (v1, D-43) com níveis de domínio, 5 missões demo em inglês A1–A2 (D-40), teste da taxa de casamento da voz, XP, nível do personagem, level up, relatório da sessão, voz do navegador. Portão: o dono joga 5 sessões em dias diferentes, dentro de 7 dias; passa se tiver vontade de voltar e lembrar das frases sem ver (D-49).
3. **Progressão completa:** missão diária com 3 encontros + chefe, Grimório com feitiços (SM-2), ofensiva, conquistas, metas "consigo...", moedas e avatar básico, desbloqueio de locais.
4. **Fábrica de cenários**, com "Importar material próprio" (missão, `origin: personal`, nunca publicável), o aviso de responsabilidade e a primeira versão dos termos de uso (D-50). QA: tentar publicar material pessoal.
5. **Conta:** login opcional com Supabase, sincronização privada com RLS (sem cenários públicos no Supabase, D-50), apagar conta. Exportar e importar já entram na fase 1. **Da W2-13 (INFO-W2-13-A):** na importação local, dois `mission_first` da mesma missão com ids fora do padrão pagam em dobro, por desenho (D-49, app local). A sincronização tem de fechar isso: `mission_first` só com id `first:<missão>` e `mission_star` só com `star:<missão>:<n>`.
6. **Modo completo com key.**
7. **Comunidade (D-50):** repositório `glifora-content` (CI com DCO, validação e só a pasta de pacotes), pacotes incorporados no build, tela "Fases da comunidade" e botão "Enviar para a comunidade". QA: material pessoal e JSON malicioso pelo envio. Não depende das fases 5 e 6 e pode subir na fila.
8. **Preparação para exames**, com a importação de simulado próprio (`personal`, D-50).
9. **Depois:** japonês e chinês com traçado, modo offline, Azure opcional (o espanhol entra antes, logo depois do inglês).

Parar ao fim de cada fase para o dono testar no celular.
