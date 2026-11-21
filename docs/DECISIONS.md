# DECISIONS — Glifora

Dono: Arquiteto. Toda decisão importante entra aqui, com data, para nenhum terminal trabalhar com informação velha. Decisão substituída não é apagada: fica marcada como `substituída por D-xx` ou `ajustada por D-xx`.

Formato: **D-xx — título** (data) · Status · Decisão · Por quê · Alternativas descartadas

Status: `aceita` · `provisória` · `proposta` · `ajustada por D-xx` · `substituída por D-xx`

> A numeração começa na D-37 porque D-01 a D-36 são de uma versão anterior, comercial (app Android com IA no servidor), que não faz parte deste repositório (D-38).

## Índice

| ID | Tema | Status |
| --- | --- | --- |
| D-37 | Pivô: jogo web open source (PWA), sem monetização, IA pela key do usuário (BYOK) | aceita (dono) |
| D-38 | Versão comercial fora do repositório; histórico novo no repositório público; glifora-dev sem IA | aceita (dono) |
| D-39 | Hospedagem no Cloudflare Pages, CSP em cabeçalho HTTP | aceita (dono) |
| D-40 | Inglês primeiro nas missões demo (base pt-BR) | aceita (dono) |
| D-41 | Arquitetura da versão web (W0-03): camadas, dados, CSP, key, adaptadores, testes | aceita (dono aprovou o portão da fase 0) |
| D-42 | Pontos que ficam para depois: licenças, modelos recomendados, OAuth do OpenRouter, tabelas do Supabase | aberta (decidir nas fases indicadas) |
| D-43 | Missão v1, comparação tolerante, fecho por palavras-alvo e níveis de domínio na fase 2 | aceita (dono) |
| D-44 | Aparelho-alvo: Android + Chrome | aceita (dono) |
| D-45 | Licenças: código AGPL-3.0, conteúdo CC BY-SA 4.0 (substitui a MIT) | aceita (dono) |
| D-46 | Fechamento da fase 1: cabeçalhos que o Cloudflare acrescenta, manifesto em pt-BR e pendências aceitas | aceita (Arquiteto) |
| D-47 | Terminal QA Tester: ataque ao app rodando no fim de cada fase | aceita (dono) |

---

### D-37 — Pivô: Glifora vira jogo web open source, sem monetização, com IA pela key do usuário (2026-11-20) · aceita (pedido do dono)
- **Pedido do dono (2026-11-20):** mudar todo o projeto conforme o documento `glifora-prompt-maestri.md`, salvo como `docs/SPEC.md` (a especificação) e `docs/EQUIPE.md` (a organização dos terminais e os prompts).
- **Como fica:** jogo **web**, PWA instalável e mobile-first (Vite + React + TypeScript), **open source** (MIT; trocada pela AGPL-3.0 na D-45), **sem anúncios, sem assinatura, sem RevenueCat/AdMob, sem Expo**. Custo fixo zero ou perto disso: a IA é paga pelo próprio usuário (**BYOK**, chamada direto do navegador ao provedor) ou não é usada (modo demo e fábrica de cenários por copiar e colar). O Supabase (plano gratuito) serve só para conta opcional, sincronização e cenários públicos; **a key do usuário nunca vai para o Supabase**, nem criptografada.
- **Motivação:** ferramenta de estudo do próprio autor, bem personalizada, e projeto de portfólio no GitHub.
- **D-01 a D-36:** ficam como histórico, no arquivo privado do autor (D-38). Ideias da versão comercial que podem voltar, se a arquitetura nova (W0-03) as aproveitar, sempre como decisão nova: recast destacado pelo trecho corrigido, catálogo de padrões de erro do aluno brasileiro, conjunto-ouro de 207 falas, teste do STT com erros de propósito (D-09, D-36), fecho falado conferido no aparelho (D-31), cartão de ajuda e cuidado com fala sensível (D-33), injeção neutralizada entre marcadores.
- **O que da versão comercial ainda existia fora do git:** o projeto `glifora-dev` no Supabase e o projeto no EAS. O destino está na D-38.
- **Equipe:** Arquiteto, App e Revisor agora; Conteúdo na fase 2; Backend na fase 5; Fable nas chamadas marcadas (`docs/EQUIPE.md`).

### D-38 — Versão comercial fora do repositório, histórico novo e glifora-dev sem IA (2026-11-20) · aceita (dono)
- **Código:** sai do repositório. O histórico completo, com a tag `comercial-expo-v0`, fica num clone privado do autor em `C:\glifora-arquivo-comercial`, fora do repositório público. Peças úteis entram na estrutura nova só por tarefa, copiadas e adaptadas: o catálogo de padrões de erro, o conjunto-ouro, o teste do STT, o casamento de respostas no aparelho e a cena da padaria.
- **Repositório público:** histórico novo, começando no primeiro commit da versão web. Os documentos da versão comercial não entram.
- **glifora-dev (feito em 2026-11-20):** o secret `ANTHROPIC_API_KEY` foi removido e as 6 Edge Functions foram apagadas (`health`, `account-delete`, `age-submit` e as 3 de conversa). O banco (migrations 0001–0005 e o job do pg_cron) fica parado até a fase 5, quando é recriado do zero com o modelo novo.
- **EAS:** o projeto no expo.dev fica sem uso. O dono pode apagá-lo quando quiser.
- **Publicado em 2026-11-20:** <https://github.com/BSY-Development/glifora>. Os commits usam o e-mail noreply do GitHub (configurado só neste repositório), a pedido do dono, para não expor o e-mail pessoal. O push de cada tarefa aprovada é do Arquiteto.

### D-39 — Hospedagem no Cloudflare Pages (2026-11-20) · aceita (dono)
- **Como:** site estático no Cloudflare Pages, com deploy só por GitHub Actions a partir do repositório público. A CSP e os outros cabeçalhos de segurança vão num arquivo `_headers`, como cabeçalho HTTP de verdade, verificável no DevTools.
- **Por quê:** o GitHub Pages não aceita cabeçalhos próprios. A CSP só iria por `<meta>`, sem `frame-ancestors` (clickjacking) e sem relatório de violação.
- **Na fase 1:** o dono cria a conta no Cloudflare e o token de deploy, que vira secret do GitHub Actions e nunca entra no chat nem no código. A URL inicial é `glifora.pages.dev`, ou outra se o nome estiver ocupado.

### D-40 — Inglês primeiro (2026-11-20) · aceita (dono)
- **Resolve a contradição da SPEC:** "Idiomas" punha inglês e espanhol no início, a fase 2 só falava de espanhol e a fase 9 punha o inglês "depois".
- **Como fica:** as missões demo da fase 2 são em **inglês A1–A2, base pt-BR**, e aproveitam o material da versão comercial (catálogo de erros do aluno brasileiro, conjunto-ouro, teste do STT, padaria). O espanhol vem logo depois, com base pt-BR e base inglês. A fase 8 começa pelo IELTS, como já estava. A interface é em pt-BR e inglês desde a fase 1.

### D-41 — Arquitetura da versão web (2026-11-20) · aceita (dono aprovou o portão da fase 0)
- **Fonte:** `docs/propostas/W0-03-arquitetura.md` (Fable, revisada pelo Arquiteto), citada como **[W0-03 §x]**. Quando divergir deste arquivo, vale este arquivo.
- **Camadas em `src/`** [W0-03 §2.1]: `schemas` (só `zod`) → `engine` (TS puro, sem React/DOM/relógio/sorteio) → `data`, `catalog`, `speech`, `ai` → `services` → `ui`. A direção das importações é travada pelo ESLint e o CI falha se cruzar.
- **Estado e rotas** [§2.2]: o Dexie é a fonte da verdade (`useLiveQuery`); a missão em andamento é um reducer puro salvo a cada passo; React Router; sem Redux/Zustand.
- **i18n sem biblioteca** [§2.4]: `i18n/pt-BR.json` e `i18n/en.json`, chaves tipadas, plural por `Intl.PluralRules`, nenhum HTML nas traduções.
- **PWA** [§2.3]: `vite-plugin-pwa` (`generateSW`), registro do service worker escrito à mão por causa do Trusted Types, atualização por aviso.
- **CSP** [§2.8]: `default-src 'none'`, tudo `'self'`, Trusted Types com uma política só (`glifora-sw`), `frame-ancestors 'none'`, sem relatório de violação. O `connect-src` fica só `'self'` até a fase 4. Ele cresce por fase (Supabase com o host exato na 5; OpenRouter e Anthropic com caminho na 6), e cada acréscimo é revisado. Zod em modo `jitless`.
- **Key** [§2.7]: só na memória por padrão; "lembrar neste aparelho" grava em `localStorage`, fora do Dexie, do exportar e da sincronização. Sem `sessionStorage` e sem criptografia de enfeite. A rede de segurança de verdade é o limite de gasto, que entra como passo na tela de configuração.
- **Adaptadores de IA** [§2.6]: OpenRouter primeiro, Anthropic em segundo, sem SDK (`fetch` direto, origem fixa, `redirect: 'error'`). Ordem do turno: `understood` → `recast` → `npc_reply` → `emotion` → `goals_met` (ids) → `errors` → `new_vocab` → `hint` → `flag` [§5.4]. Se a fala vier completa e o resto quebrado, a fala vale sem avaliação e não há retentativa.
- **Dados** [§4.1]: documentos (o último a escrever vence) e registros só de acréscimo (XP, moedas, revisões, rodadas, conquistas); totais derivados; ids determinísticos para o que só existe uma vez. Exportar/importar usa a mesma mescla da sincronização e **entra na fase 1** (W1-09).
- **Dependências de runtime:** `react`, `react-dom`, `react-router`, `dexie`, `dexie-react-hooks`, `zod`; `@supabase/supabase-js` na fase 5, por import dinâmico. Dependência nova de runtime só com aprovação do Arquiteto, anotada na tarefa.
- **Testes** [§7]: teste de unidade ao lado do código, do dono da pasta (Vitest; `schemas` e `engine` em ambiente `node`). `tests/` é do Revisor: e2e (Playwright, Chromium com viewport de celular), segurança (CSP por arquivo, build e navegador), i18n, acessibilidade (axe) e guardas dos princípios pedagógicos.
- **Deploy** [§7]: Cloudflare Pages em modo Direct Upload, só pelo GitHub Actions (ambiente `production`, Actions fixadas por SHA, token só de Pages), com conferência dos cabeçalhos na URL real e `version.json` com o commit.
- **O que mudou da minha revisão W0-02** (o Fable discordou e eu aceitei):
  - a ordem do turno começa por `understood` e `recast`, e não pela fala;
  - `goals_met` por id, no lugar de um progresso numérico;
  - sem `sessionStorage`;
  - sem relatório de violação da CSP;
  - na fase 2 o teste que importa é a taxa de casamento da voz, e o das 44 frases fica como pré-requisito da fase 6;
  - o ping agendado do GitHub para quando o repositório fica 60 dias parado;
  - o rascunho do schema passa a usar chaves em inglês.
- **A conferir na fase 6:** a afirmação de que a API atual da Anthropic recusa `temperature` [§2.6] não está marcada como conferida na proposta.
- **Fronteiras no lint, depois da revisão da W1-01:**
  - os padrões valem igual para `import` e `import()` dinâmico, e `import()` só aceita caminho literal;
  - caminho absoluto, via `src/`, `./../` e `pasta/../` são barrados;
  - `content/` só entra por `src/catalog/`, e `import.meta.glob` também;
  - `schemas/` e `engine/` não usam relógio, sorteio, rede, temporizador nem `globalThis`;
  - **rede só em `src/ai/` e `src/data/`** (defesa contra vazamento, [W0-03 §1.2 C]);
  - **`ui/` importa `services/`, `i18n/`, `schemas/` e `engine/`** (os dois últimos são puros); dados, catálogo, voz e IA chegam à interface só por `services/`. Isso ajusta a tabela [W0-03 §2.1], que permitia só tipos de `engine/`;
  - testes ao lado do código podem ter texto literal, mas nunca injetar HTML.
- **Ajuste do Arquiteto na W1-04:** o Revisor entrega os testes e2e e o `playwright.config.ts`; quem liga o job `e2e` no `ci.yml` (pasta do App) é o App.

### D-42 — Pontos que ficam para depois (2026-11-20) · aberta
- **Licença de `content/`:** decidida na D-45 (CC BY-SA 4.0).
- **Licença dos cenários públicos:** proposta CC BY 4.0 (com a D-45, a CC BY-SA 4.0 deixa tudo coerente), aceita por quem marca "Tornar público". Decidir antes da fase 7.
- **Modo completo:** lista curta de modelos recomendados, testados no conjunto-ouro, com aviso nos demais; e "Entrar com OpenRouter" (OAuth com limite de gasto) além de colar a key. Decidir na fase 6.
- **Supabase:** a direção (tabelas genéricas `sync_docs`/`sync_events`, gatilhos de último a escrever, tamanho e cota por usuário, apagar conta sem Edge Function) está aceita. O Backend detalha na fase 5, junto com o login por e-mail (código ou link, sem senha).

### D-43 — Missão v1, comparação tolerante, fecho por palavras-alvo e níveis de domínio (2026-11-20) · aceita (dono)
- **Formato da missão** [W0-03 §5.1, com o ajuste do fecho abaixo]:
  - chaves em inglês e par completo (`base` + `target`);
  - escuta inicial (`listen`) e sequência linear com `next` opcional;
  - reação da NPC por resposta;
  - a resposta `flawed` só casa quando a pessoa produz aquele erro, e gera o recast sem IA;
  - fecho obrigatório;
  - `note`/`pattern` só no relatório;
  - `kind: boss` para o chefe.
  A SPEC foi ajustada.
- **Garantia 1 do dono: a comparação é tolerante.** "Senão a pessoa acerta e o jogo diz que errou."
  - **Normalização, dos dois lados (fala/texto da pessoa e palavras-chave):**
    - minúsculas, sem acento (NFD) e sem pontuação;
    - apóstrofos tipográficos (’ ‘ ´ `) viram `'`;
    - espaços colapsados;
    - números por extenso ou em dígito;
    - **contrações expandidas** por idioma, com e sem apóstrofo: "I'm"/"Im" = "I am", "don't"/"dont" = "do not", "can't"/"cant" = "cannot"/"can not", "it's" = "it is" só depois de pronome ou palavra interrogativa (o possessivo "Tilda's" não muda).
  - **Pequeno erro de digitação:** depois do casamento exato, um segundo passe aceita palavra a 1 letra de distância (palavras de 4 a 7 letras) ou a 2 (8 letras ou mais). Palavras de até 3 letras precisam ser exatas.
  - **A tolerância nunca leva para a resposta com erro:** a resposta `flawed` só casa no passe exato. No segundo passe só entram as respostas boas. Isso resolve o caso "roll"/"rolls" [W0-03 §5.1].
  - **Na dúvida, vale a resposta boa:** se a resposta boa e a com erro empatarem, vence a boa. Empate entre duas boas ou nenhum casamento: a NPC pede para repetir (`retry`) e, na segunda vez, a ajuda sobe um degrau. Nunca trava e nunca tira XP.
  - **Testes obrigatórios** (do Conteúdo, ao lado de `src/schemas/match.ts`): tabela com maiúsculas, acentos, pontuação, cada contração com e sem apóstrofo, erros de digitação de 1 e 2 letras, "roll"/"rolls", empate boa × com erro e as alternativas do reconhecedor de voz.
- **Garantia 2 do dono: o fecho sem IA confere só as palavras-alvo.**
  - A frase própria é aceita se tiver **pelo menos uma das palavras-alvo da missão** (`closing.target_words`; se faltar, as palavras do `vocabulary`), com a mesma normalização e tolerância. Nada além disso é exigido: sem mínimo de palavras e sem gramática.
  - São duas tentativas, com a dica na segunda. Depois, a resposta-modelo aparece para repetir, sem travar nem tirar XP. A frase da pessoa vai para o relatório ao lado do modelo.
  - Substitui o `accept: { all_of, min_words }` da proposta.
- **Níveis de domínio já na fase 2:**
  - Rejogar a mesma missão com menos ajuda: 1ª vez com as frases à vista, 2ª só com a ideia no idioma base, 3ª sem nada.
  - O XP acompanha a ajuda usada. Os números ficam para a chamada nº 2 do Fable.
  - Se mesmo assim faltar variedade no portão da fase 2, a fábrica (fase 4) sobe na fila.

### D-44 — Aparelho-alvo: Android + Chrome (2026-11-20) · aceita (dono)
- Os testes de fim de fase do dono são no Android com o Chrome. O e2e usa o Chromium com viewport de celular (Pixel 7). O WebKit roda só localmente, antes de fechar a fase.
- **No iPhone:** o jogo funciona com texto. O microfone some se o reconhecimento falhar. O jogo convida a instalar e lembra de exportar, porque o Safari apaga os dados de site não instalado depois de 7 dias sem uso.

### D-45 — Licenças: código AGPL-3.0, conteúdo CC BY-SA 4.0 (2026-11-20) · aceita (dono)
- **Decisão:**
  - **Código:** GNU AGPL-3.0, somente a versão 3 (`AGPL-3.0-only`). Substitui a MIT da D-37. O texto oficial está em `LICENSE` (SHA-256 `0d96a4ff…abcb0`, de gnu.org).
  - **Conteúdo de `content/`:** CC BY-SA 4.0, em `content/LICENSE`, com o texto legal.
  - **Arte desenhada em código** (`src/ui/art/`) e ícones gerados por script: fazem parte do código, sob AGPL-3.0.
  - **Nome e logo "Glifora":** não são licenciados.
- **Por quê:** o dono não quer ver o jogo virar produto fechado com anúncio ou assinatura. Com a MIT, qualquer pessoa pode fazer isso sem devolver nada. A AGPL continua open source e permite vender, mas quem distribui ou **põe no ar** uma versão modificada tem de abrir o código dela (seção 13). Para um app web, só a AGPL cobre o caso de hospedar. A CC BY-SA leva a mesma ideia para o conteúdo.
- **Na prática:**
  - `/about` mostra as licenças e o link do código-fonte (atende à seção 13 e ajuda quem fizer uma versão própria);
  - `package.json` com `"license": "AGPL-3.0-only"`;
  - as dependências de runtime são MIT ou Apache-2.0, ambas compatíveis.
- **Commits anteriores:** do `86642fb` ao `ef65016` foram publicados com a MIT. O dono informou que ainda não houve download, e daqui em diante vale a AGPL. O histórico não foi reescrito.
- **Contribuições:** de fora, entram sob as mesmas licenças. Se um dia o dono quiser relicenciar, vai precisar do aceite de quem contribuiu. Avaliar um DCO quando o primeiro PR externo chegar.
- **Descartadas:**
  - **GPL-3.0:** não alcança quem só hospeda o site;
  - **PolyForm Noncommercial e similares:** deixariam de ser open source;
  - **MIT:** não atende ao objetivo.

### D-46 — Fechamento da fase 1: o que fica aceito (2026-11-20) · aceita (Arquiteto)
- **Cabeçalhos do Cloudflare** que não estão no `_headers`: `Report-To`/`NEL` e `Access-Control-Allow-Origin: *`. Achado da W1-14.
  - **`Report-To`/`NEL`:** o navegador manda ao Cloudflare só relatórios de **falha** de rede (`success_fraction` 0). Não é analytics do jogo e não leva dado do jogo. O Cloudflare já vê IP e pedidos por ser a hospedagem.
  - **`Access-Control-Allow-Origin: *`:** só deixa outro site ler arquivos que já são públicos, sem cookie nem credencial.
  - **Decisão:** aceitar e explicar no `SECURITY.md` ("Privacidade e hospedagem").
  - **Na fase 2:** tentar tirar os dois com a sintaxe `! Cabeçalho` do `_headers` e conferir no `verify-deploy`. Se o Cloudflare não deixar, o caminho é um domínio próprio, com o NEL desligado na zona.
  - **Resultado (W2-10, deploy `06a1897`):**
    - O `Access-Control-Allow-Origin` **saiu** com o `! Cabeçalho`, e o `verify-deploy` passa a exigir que ele não volte.
    - O `Report-To`/`NEL` **continua**: é injetado pela borda do Cloudflare, e o `_headers` não alcança.
    - Segue aceito como acima (só falha de rede, `success_fraction` 0). Tirar de vez depende de domínio próprio, com o NEL desligado na zona; a compra é decisão do dono, sem pressa.
- **Manifesto:** `lang` e `description` ficam fixos em pt-BR. O manifesto é um só para os dois idiomas. Rever quando houver público em inglês.
- **`npm audit`:** os 4 alertas moderados (`glob`/`minimatch` via `workbox-build`) ficam aceitos. Só rodam no build, e `--omit=dev` dá 0. O README avisa para não usar `audit fix --force`.
- **Para a fase 2:**
  - o teste automático da atualização do service worker com 2 builds;
  - o aviso de iPhone da D-44 (instalar e exportar);
  - `navigator.storage.persist()` depois da primeira missão.
  - **Atualização na 1ª abertura depois de um deploy** (achado no teste do dono): hoje aparece o aviso "Atualizar", porque a versão nova termina de baixar com o app já aberto.
    - **Avaliar na fase 2:** se ela terminar de instalar nos primeiros segundos e a pessoa ainda estiver na vila, sem missão aberta, ativar e recarregar sozinha.
    - **No meio de missão:** continua o aviso.
- **Configurações da fase 1 que não dá para testar no código:** token só de Pages, ambiente `production` só para a `main`, sem integração Git no Cloudflare. O dono configurou em 2026-11-20, e o Arquiteto conferiu o ambiente pela API do GitHub.

### D-47 — Terminal QA Tester (2026-11-20) · aceita (dono)
- **Decisão:** o dono pediu um sexto terminal, o QA Tester (prompt do dono, em `docs/EQUIPE.md`). Ele ataca o app rodando como usuário malicioso, no fim de cada fase ou quando o Arquiteto pedir. Não revisa código (isso é do Revisor) e não corrige.
- **Pastas:** é dono de `tests/e2e-security/` e `tests/payloads/`. O Revisor segue dono do resto de `tests/` e do `playwright.config.ts`, e põe os testes do QA no CI quando ele pedir. O `ci.yml` continua do App.
- **No fluxo:** o portão de cada fase passa a ter o ataque do QA **antes** do teste do dono. Os achados críticos e altos são corrigidos antes do portão; os médios e baixos, o Arquiteto aceita ou agenda.
- **Limites:** ataque no build local (`vite preview`). Na produção, só conferência leve de leitura. Key real nunca: string falsa e provedor simulado.
- **Modelo:** Sonnet 5.5, como o Revisor.
- **Fase 1:** o portão espera o primeiro ataque do QA (W1-16). O dono já testou no celular, e tudo passou.

### D-48 — Frases do teste de voz entram no bundle, num pedaço à parte (2026-11-20) · aceita (Arquiteto)
- **O que muda:** a W0-03 §5.3 dizia que `content/eval/` nunca entra no bundle. Agora uma parte entra.
- **O que entra:** só as frases do teste de voz (`content/eval/stt/`). Ficam num pedaço próprio, carregado por `import()` apenas em `/settings/voice` (pelo `src/catalog/`). Não vão para a tela inicial nem para o player.
- **O que continua fora:** o conjunto-ouro e o resto de `content/eval/` (fase 6). O `build-index` não põe esses arquivos no índice.
- **Por quê:** o teste da taxa de casamento (W2-12) é feito pelo dono no celular, no site publicado e também offline. São frases curtas, sem segredo, com o mesmo cuidado de conteúdo do resto de `content/`.
- **Quem pediu:** o App, com a concordância do Conteúdo, na W2-02/W2-06.

### D-49 — Regras de jogo v1 (2026-11-20) · aceita (Arquiteto; item 5 pelo dono)
- **O que vale:** os números da proposta do Fable, `docs/propostas/W2-01-regras.md`, como estão.
  - **Resposta:** 16 / 12 / 8 por falar ou digitar sem ajuda, com a ideia ou com a frase. Tocar vale 4.
  - **Fecho:** 24 / 12 / 4.
  - **Prêmios únicos por missão:** 1ª conclusão e cada estrela.
  - **Curva e títulos:** do nível L ao L+1 custam `50 × L`, com 8 títulos.
  - **Fase 3:** desbloqueios, moedas, ofensiva e conquistas.
  - **O App implementa `rules.v1` a partir da §8** (W2-07).
- **Os 8 pontos da §9:**
  1. **Repetição:** campo `repeat` contado por fala, pela ajuda de fato usada. O replay no mesmo dia paga ½ e depois ¼, nunca zero e sem teto diário. Muda o tipo de W0-03 §6.
  2. **Prêmios de missão como eventos próprios, com id determinístico** (`first:<missão>`, `star:<missão>:<n>`). `EVENT_KINDS` ganha `mission_first` e `mission_star`.
  3. **`Run` ganha `answers` e `closing.input`:** `answers` são até 20 itens `{ node, input, scaffold }`. Sem eles não dá para calcular a estrela nem o `repeat`. Não há migração, porque ainda não existe rodada gravada.
  4. **Voz vale o mesmo que digitado** no XP por resposta, porque quem não tem reconhecimento de voz não fez menos esforço (D-44). A fala é premiada por conquistas.
  5. **Portão em dias diferentes (decisão do dono):**
     - **Como:** 5 sessões em dias diferentes, dentro de uma janela de 7 dias.
     - **Passa se:** o dono sentir vontade de voltar **e** conseguir lembrar das frases das missões anteriores sem ver.
     - **O que muda:** a SPEC foi ajustada; antes eram "5 sessões seguidas". No mesmo dia, a 5ª sessão rende pouco, por desenho.
  6. **Tocar não dá estrela.** O modo sugerido segue a estrela conquistada, não o número de vezes jogadas. É um ajuste fino da D-43: a 1ª, a 2ª e a 3ª vez viram ★, ★★ e ★★★, e a pessoa pode escolher menos ajuda desde a 1ª vez.
  7. **Congelamento da ofensiva:** derivado dos dias ativos, 1 a cada 2 dias, guardando até 2. `freeze_earned` fica sem uso na v1.
  8. **Curva congelada depois do portão da fase 2.** Depois disso, rebalancear só pelas fontes de XP, que têm versão. A curva só pode ficar mais fácil.
- **Também decidido:**
  - **Teto por evento na importação:** 400 XP e 100 moedas ganhas. Nas regras v1, nenhum evento legítimo passa de 344 XP nem de 50 moedas.
  - **Nomes:** títulos e conquistas seguem a proposta. A ordem dos locais da fase 3 é do Conteúdo, com o dono.
- **Guardas pedagógicas:** às 6 de W0-03 §6 somam-se as 6 sugeridas na §7 da proposta (7 a 12), testadas pelo Revisor na W2-11.
- **Por quê:**
  - o XP paga a ajuda dispensada, não o acerto;
  - o prêmio grande é único;
  - repetir no mesmo dia rende menos, sem punir;
  - nada desce.
  Assim a dopamina vem de produzir, e os princípios 5 a 7 continuam de pé.

### D-50 — Material pessoal privado e biblioteca da comunidade em repositório próprio (2026-11-20) · aceita (dono), com ajustes do Arquiteto
Proposta do dono. Muda a fase 7 e acrescenta itens às fases 4, 5 e 8. Nada é implementado agora.

**1. Importar material próprio** (fase 4 para missões, fase 8 para simulados)
- **O que é:** uma opção "Importar material próprio". A pessoa converte o material dela com a própria IA (por exemplo, um livro de preparação que comprou), no schema de missão ou de simulado, e cola no app.
- **Origem:** `origin: "personal"`. Fica **na linha do Dexie (e do Supabase), não no JSON da missão**. O app marca, como já faz com o `id` (W0-03 §5.1); o que a IA mandar é ignorado.
- **Nunca é publicado:**
  - a opção de enviar para a comunidade não aparece;
  - o envio recusa no código, com teste automatizado;
  - a origem sobrevive a exportar e importar e a sincronizar, e nunca vira outra.
- **Sincronização (fase 5):** só com a conta da própria pessoa, com RLS. Na fase 5 ninguém lê dado de outro usuário, então isso já vale para tudo.
- **Aviso na importação e nos termos:** "Você declara ter direito de usar este material. Ele fica só com você e é sua responsabilidade." Os termos de uso ainda não existem e entram na fase 4, junto com esta opção.
- **Sem busca:** o app não oferece busca nem download de provas ou de material de terceiros.
- **Limite honesto:** o bloqueio evita o envio por engano, não a fraude de quem edita o próprio arquivo exportado. A proteção de verdade é a declaração de autoria no envio (item 3), a revisão do mantenedor e o canal de remoção.

**2. Biblioteca da comunidade num repositório só de conteúdo** (fase 7, que pode vir antes das fases 5 e 6, porque não depende delas)
- **Repositório público `glifora-content`:** missões, temas e simulados originais, em pacotes versionados por par de idiomas e nível. Licença CC BY-SA 4.0.
- **Licença do código: continua AGPL-3.0 (D-45).** A proposta dizia MIT, mas a licença já foi trocada.
- **O conteúdo central fica no repositório do app:** as missões demo, NPCs e locais, em `content/`, porque dependem dos enums e da arte do app. Os pacotes da comunidade só usam locais e NPCs que existem, ou a figura genérica do local (W0-03 §5.1).
- **Como o app carrega os pacotes: no build, não em tempo de execução.**
  - O CI do app baixa uma versão fixada do `glifora-content`, confere o hash e valida tudo com o mesmo `parseMission`.
  - Os pacotes viram pedaços do bundle: entram no precache, funcionam offline e **não abrem `connect-src` para o GitHub**, então a CSP fica como está.
  - Ao carregar, a validação roda de novo, como em toda missão (W0-03 §5.3).
- **Tela "Fases da comunidade":** navegar por idioma, nível e tema, jogar e ver o autor (apelido do GitHub).

**3. Fluxo de contribuição**
- **Botão "Enviar para a comunidade"** (só para conteúdo que não é pessoal):
  - valida o schema e abre a página de criação de arquivo do GitHub com o arquivo pronto. Para quem não é colaborador, ela faz o fork e o PR sozinha.
  - **Risco a provar:** missão grande pode passar do tamanho de URL que o GitHub aceita. Plano B: copiar o JSON e abrir a página vazia, para a pessoa colar.
- **Declaração antes de enviar:** caixa "Declaro que sou autor deste conteúdo, que ele é original e que aceito a licença CC BY-SA 4.0".
- **DCO (Signed-off-by)** com check no CI. No repositório, ligar "exigir sign-off em commits pela web", para quem envia pelo navegador não precisar saber git.
- **CI do `glifora-content`:**
  - validação com os schemas do app (de uma versão fixada) e limites de tamanho;
  - idioma declarado × idioma detectado e lint de conteúdo;
  - **falha se o PR mexer em qualquer coisa fora da pasta de pacotes**;
  - roda com `pull_request` (nunca `pull_request_target`), token só de leitura e sem secrets.
  - Merge só com revisão do mantenedor.
- **README e CONTRIBUTING** com as regras de conteúdo e o canal de pedido de remoção (direito autoral ou conteúdo impróprio).

**4. Supabase sem cenários públicos (opção A)**
- **O que muda:** o Supabase fica só com login e sincronização. A tabela `scenarios`, o `/catalog` pelo Supabase e o `scripts/moderation/` da W0-03 §4.2 saem.
- **Por quê:** menos superfície de ataque (nenhuma tabela pública, nenhum conteúdo de usuário servido a terceiros), moderação pelo PR, que já tem histórico e revisão, e nenhum custo de plano.
- **A opção B** (rascunhos compartilhados por link entre amigos) pode vir depois, se houver pedido.

**5. QA Tester** (fases 4 e 7)
- tentar publicar ou enviar conteúdo `personal` por todas as camadas: interface, chamada direta, arquivo exportado editado e sincronização;
- mandar JSON malicioso pelo fluxo de contribuição.

### D-51 — Resposta livre curta para nome (2026-11-20) · aceita (Arquiteto)
- **Problema:** nas falas em que a NPC pergunta o nome (bakery-02, tavern-02), quem responde só "Maria" ouve "repete". Nenhuma palavra-chave casa com um nome qualquer. É a pessoa acertar e o jogo dizer que errou, o que a garantia 1 da D-43 proíbe.
- **Decisão:** a resposta ganha um campo opcional `free: "name"`.
  - **Quando aceita:** quando nenhuma outra resposta da fala casa (nem as boas, nem a com erro), aceita qualquer fala de **1 a 3 palavras** depois da normalização. Casa como uma resposta boa.
  - **Ordem:** o casamento normal vem antes. "My name is Maria" casa com a resposta que tiver essas palavras, e "I am call Maria" continua indo para a resposta com erro, se existir.
- **Regras do campo:**
  - no máximo uma resposta livre por fala, e nunca com `flawed`;
  - o `text` dela é o modelo mostrado na ajuda (ex.: "I'm Maria.");
  - a reação da NPC é fixa: nada do que a pessoa disse entra na fala da NPC (sem modelo de texto).
- **Onde mora:** o schema e o casamento em `src/schemas/` (`mission.ts` e `match.ts`), do Conteúdo. O player só usa o resultado do `matchReply`.
- **Versão:** campo opcional novo, então não sobe `schema` (W0-03 §5.1).
- **Fábrica (fase 4):** o prompt não pede esse campo. Se vier, é validado igual.

### D-52 — A vila vira uma rua com rolagem lateral (2026-11-20) · aceita (dono)
- **Problema:** com a taverna, a padaria foi parar "no céu", e quanto mais locais, pior fica a navegação (achado do dono no celular). A fase 3 chega a 6 locais.
- **Decisão:**
  - **Rua:** os locais ficam lado a lado numa rua de pixel art. A pessoa desliza para os lados (scroll-snap) e vê cerca de 2 locais por vez em 360 px.
  - **Navegação:** pontinhos mostram a posição. Setas e teclado servem para quem não desliza. Para o leitor de tela, continua uma lista de links.
  - **Locais trancados (fase 3):** aparecem como silhuetas, o que mostra o que vem pela frente.
  - **Posição:** o app lembra a última posição da rua (conveniência local, com try/catch).
- **Por quê:** cresce sem apertar nada, é fácil com uma mão e mantém a sensação de andar pela vila. As alternativas eram bairros com abas e um mapa para arrastar, este mais difícil com uma mão e para o leitor de tela.

### D-53 — As NPCs chamam a pessoa pelo apelido (2026-11-20) · aceita (dono)
- **O que muda:** a Tilda e o Bram usam o apelido do perfil nas falas deles ("Good morning, Maria!"). O Ben da escuta continua sendo o freguês de exemplo: a escuta é ouvir alguém fazendo o pedido, e não pôr frases na boca da pessoa.
- **Custo:** nenhum. A voz do modo demo é a do navegador, no próprio aparelho, sem crédito nem token. Vale para todos os modos.
- **Formato** (campo de texto novo, sem subir `schema`):
  - **Marcador:** `{player}`, só na forma de vocativo com vírgula antes (`", {player}"`). Sem apelido, o trecho inteiro some e a frase continua natural ("Good morning!"), sem problema de gênero.
  - **Onde pode:** só nas falas das NPCs (`nodes[].text`, `reaction.text`, `closing.question` e `closing.success`) e nas traduções delas.
  - **Onde não pode:** em `replies[].text`, `keywords`, `recast`, `model_answer`, `hint` e `listen`. O `mission.check` confere.
- **Segurança:**
  - o apelido já passa pelo schema `Nickname` (sem `<`, `>`, controle nem invisíveis; até 30 caracteres);
  - a troca acontece num lugar só do player e sai sempre como texto;
  - o TTS lê o apelido com a voz do idioma-alvo.
- **Quem faz:** o Conteúdo faz o schema, a conferência e as missões (com moderação: 1 ou 2 vezes por missão, onde soar natural). O App faz a troca no player, no relatório e na fala.
- **Nome falado (pedido do dono, para não ficar estranho):** a NPC não usa o apelido cru, e sim um **nome falado** derivado dele por uma função pura, `spokenName(apelido)`, em `src/schemas/player.ts`:
  - o apelido inteiro, se tiver **até 10 letras e só letras** (acentos valem, porque nomes brasileiros têm acento), com no máximo um hífen ou apóstrofo no meio ("Ana-Lu", "D'Ávila");
  - senão, a primeira palavra do apelido, se passar na mesma regra ("Maria Clara" vira "Maria");
  - senão, nenhum nome: o vocativo some ("Good morning!"). Emoji, número, símbolo e palavra com mais de 10 letras não entram.
  - **O apelido continua como está** (até 30 caracteres): mudar o schema do apelido quebraria perfis e arquivos exportados.
  - O perfil mostra "Nas conversas, as NPCs vão te chamar de: Maria", ou avisa que não vão usar um nome. Assim a pessoa ajusta se quiser.

### D-54 — O recast vale para toda resposta, não só para a do erro previsto (2026-11-20) · aceita (Arquiteto, a partir da sessão 1 do dono)
- **Achados do dono (sessão 1, bakery-01):**
  - **Erro de propósito sem correção:** ele disse "a roll of honey", erro pedido no roteiro. O reconhecedor ouviu "I roll of honey" e a Tilda respondeu "Lovely! Those are new today.", sem recast. A resposta com erro (`flawed`, palavra-chave "roll of honey") deveria ter vencido pelo número de palavras; a causa precisa ser reproduzida.
  - **Fecho com modelo sem relação:** ele pediu "Can I have one roll of honey?" e o fecho mostrou "Can I have two cheese rolls, please?", o `model_answer` fixo. O modelo não tem nada a ver com o pedido dele.
- **Decisão:**
  1. **Erro previsto:** a resposta `flawed` cuja expressão aparece na fala ganha da resposta boa de palavra mais curta, também com ruído do reconhecedor em volta ("I roll of honey"). Com teste usando a fala real do dono.
  2. **Recast implícito em toda resposta boa:** a reação repete o trecho-chave da resposta modelo ("A honey roll! Lovely, those are new today."). Assim, quem acertou só a palavra ouve a frase inteira do jeito natural, sem ser corrigido. Vira regra de qualidade no `lib.ts`, aplicada às 5 missões.
  3. **Fecho:**
     - o modelo mostrado é o mais próximo do que a pessoa disse, escolhido pelas palavras-alvo em comum (campo opcional com vários modelos, ficando o `model_answer` como padrão);
     - os erros previstos da missão também valem no fecho, com o recast.
  4. **Relatório:** mostra o que a pessoa disse em cada fala e o jeito natural ao lado (D-55).
- **Causa provável do "I roll of honey"** (W2-21; falta a confirmação do dono):
  - o modo ★ não tira as respostas com erro, e o `matchReply` acerta "I roll of honey";
  - então a 1ª alternativa final do reconhecedor deve ter vindo sem o "of" e casou com a boa pela palavra "honey";
  - com o item 2, até nesse caso a pessoa agora ouve "A honey roll!" e vê o jeito natural no relatório;
  - a resposta com erro também passou a aceitar "role of honey" e "roll a honey".
- **Medido e recusado:** trocar a regra 6 por "a alternativa de maior pontuação entre todas".
  - Deu 2 recasts falsos em 220 pares simulados do eval.
  - Em 16 casos de quem fala certo com a forma errada numa alternativa de baixo ("two rolls" × "two roll", "an orange" × "a orange"), deu 11 recasts falsos, e 7 mesmo com guarda.
  - A regra continua sendo "a 1ª alternativa que casar".

### D-55 — Achados de interface da sessão 1 do dono (2026-11-20) · aceita (dono)
- **Apelido:**
  - o campo aceita **até 10 caracteres**, só letras (com acento), espaço, hífen ou apóstrofo. O texto de ajuda diz o limite;
  - o schema de leitura continua aceitando 30, para perfis e arquivos antigos, e o `spokenName` continua protegendo a fala.
- **Relatório:**
  - lista cada fala da pessoa ("Você disse") com o jeito natural ou a correção;
  - ganha um botão **Copiar relatório**, com o texto selecionável quando a cópia falhar, útil agora para depuração;
  - corrige o "{title}" que apareceu sem valor.
- **Botão de jogar de novo:** diz o que vai acontecer, por exemplo "Ganhar a 2ª estrela: jogar só com a ideia", com uma linha explicando o modo.
- **Missão em andamento:** aparece também na vila, com "Continuar", e não só ao entrar de novo na mesma missão.
- **Escuta:** o texto de abertura diz que são outras pessoas da vila conversando antes da sua vez (o Ben não é você).

### D-56 — Revisão do relatório com IA, com a key grátis do próprio jogador, adiantada para a fase 2 (2026-11-20) · aceita (dono)
- **Pedido do dono:** cada pessoa usa a própria key. A IA lê o que a pessoa disse, corrige quando errou e dá um jeito natural **adaptado ao que ela quis dizer** (ela preferiu "bread" → "Can I have some bread, please?"). O dono quer testar já, com o guia de como pegar a key.
- **Provedor desta rodada: Gemini API** (Google AI Studio), pela cota grátis sem cartão e pela key fácil de criar no celular com a conta Google.
  - GPT e Claude não têm cota grátis.
  - O adaptador segue a interface de `ai/providers/` (W0-03 §2.6), então OpenRouter e Groq entram depois sem refazer nada.
- **Como funciona:**
  - um botão **"Revisar com IA"** no relatório. Nada é enviado sem a pessoa tocar, o que também poupa a cota;
  - **uma chamada por missão**, com todas as falas juntas. A cota grátis é pequena (~20 por dia, conforme a conta).
- **O que vai, minimizado:**
  - idioma, nível, a fala da NPC, as respostas da missão, o que a pessoa disse (até 100 caracteres, limpo) e se casou, com erro ou não;
  - **sem apelido** (o vocativo sai antes de enviar), sem perfil e sem ids;
  - a fala da pessoa vai entre marcadores, com os marcadores tirados do texto dela (W0-03 §2.6).
- **O que volta:** JSON validado por schema Zod rígido, com campos fechados e teto de tamanho. Para cada fala:
  - `verdict`, um entre natural, ok com dica e erro;
  - `correction` e `natural`, no idioma-alvo;
  - `tip`, no idioma da interface.
- **Como aparece:**
  - só como texto, com `lang`, e entra no Copiar relatório;
  - **nunca muda XP, estrelas nem a rodada guardada**, porque as regras continuam sem IA (D-49);
  - fica só na memória da sessão: reabrir o relatório não gasta cota de novo enquanto a aba vive.
- **A key** segue a W0-03 §2.7:
  - **cofre:** memória por padrão; com "Lembrar neste aparelho", vai para o `localStorage` (`glifora.key.v1.gemini`);
  - **nunca** em Dexie, exportação, sincronização, log, URL, mensagem de erro ou relatório;
  - **tela:** campo de senha não controlado e "Apagar minha key".
- **Apelido na fala (W2-25):** o `maskName` normaliza a fala em NFKC e troca por [name] a palavra inteira (sem diferenciar maiúsculas) e a forma soletrada com espaços ou hífens. **Resíduo aceito:** 'Zorbaxx' (letra a mais ou a menos) passa, porque não há busca aproximada: um apelido curto como 'Ana' mascararia palavras comuns.
- **CSP:** `connect-src` ganha só `https://generativelanguage.googleapis.com/v1beta/models/` (prefixo com barra), com o teste da lista esperada.
- **Erros:**
  - key inválida → "confira a key";
  - cota do dia esgotada (429) → "a cota grátis de hoje acabou";
  - offline;
  - resposta fora do schema → "a IA não respondeu direito";
  - no máximo 1 nova tentativa, nunca em laço.
- **Guia na tela "IA (opcional)", em Ajustes:**
  - passo a passo para criar a key grátis no celular;
  - recomendação de criar uma key só para o Glifora;
  - **aviso:** na cota grátis, o Google pode usar o que é enviado para melhorar os produtos dele, e pessoas podem ler. Não escreva dados pessoais nas respostas;
  - onde a key fica, para onde vai e como apagar.
- **Proposta do Fable** (docs/propostas/W2-22-prompt-relatorio.md), com as decisões do Arquiteto:
  - **Vereditos:** 4, com `unclear` para fala vazia ou sem sentido. Ficam `natural | polish | fix | unclear`.
  - **Campo `meant`:** o que a pessoa quis dizer, até 60 caracteres. O App valida e não mostra.
  - **Nome:** a resposta livre de nome (D-51) não é enviada, e o apelido dentro da fala vira `[name]`.
  - **Aceitação parcial:**
    - envelope quebrado falha tudo (1 nova tentativa);
    - item quebrado derruba só aquela fala, que volta ao relatório sem IA.
  - **Guarda:** se o jogo casou uma resposta com erro previsto e a IA disse `natural`, vale o recast da missão. A IA não desmente o jogo.
  - **Endpoint:** `generateContent` em `/v1beta/models/`, dentro da CSP. O endpoint novo `/v1beta/interactions` fica de fora.
  - **Modelo:** um Flash ou Flash-Lite da cota grátis, numa constante. O gemini-2.5-flash sai em 01/12/2026; o candidato é o gemini-3.5-flash-lite, a conferir na documentação.
  - **Configuração:** `thinkingLevel` mínimo, `maxOutputTokens` 2048 e tetos de tamanho valendo no Zod, porque o Gemini pode não respeitar `maxLength`.
- **Quando a key ou os créditos acabam (pedido do dono): avisar sem quebrar nada.**
  - **Quais casos:**
    - cota grátis do dia esgotada;
    - créditos ou cobrança expirados;
    - key revogada ou vencida;
    - modelo que saiu da cota grátis;
    - região não atendida.
  - **Cada caso:** tem mensagem própria, em linguagem simples, e diz o que fazer (esperar até amanhã, conferir a conta no AI Studio, trocar a key).
  - **O aviso:** aparece no relatório, no lugar da revisão, e fica marcado na tela "IA (opcional)", com o último problema e a hora.
  - **O resto segue igual:** o relatório normal, o XP, as estrelas e o resto do jogo. Nenhuma tela de erro e nenhuma tentativa em laço.
- **Sem key, nada muda:** o relatório de hoje continua igual, e o jogo inteiro funciona sem IA.
- **Quem faz:** Fable (prompt, contrato de saída e casos de avaliação), App (cofre, adaptador, tela, guia e relatório), Revisor e QA (ataque à key e à injeção).

### D-57 — Pedido aberto aceita qualquer item do local (2026-11-20) · aceita (dono)
- **Pedido aberto:** nas perguntas abertas ("What can I get you?"), o jogo aceita qualquer item do vocabulário do local, como bread, loaf ou pie na padaria. A reação repete o item (recast implícito, D-54). Hoje só os itens previstos casam, e o resto ouve "repete".
- **Quem faz:** o Conteúdo, nas 5 missões, sem quebrar o fluxo das falas seguintes.

