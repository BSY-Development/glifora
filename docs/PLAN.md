# PLAN — Glifora (versão open source)

Dono: Arquiteto. Cada tarefa tem: dono, descrição, critério de pronto, testes esperados e, ao ser aprovada, notas de passagem (o que fez, onde parou, pendências). O fluxo entre terminais está em `docs/EQUIPE.md`.

Status possíveis: `a fazer` · `em andamento` · `em revisão` · `aprovada` · `bloqueada`

Antes de qualquer tarefa, leia: `docs/SPEC.md`, `docs/DECISIONS.md` e a sua tarefa aqui.

IDs: `W<fase>-<nº>` (W de web), para não confundir com as tarefas `F…` da versão comercial (arquivo privado, D-38).

## Fase atual: 1 — Fundação

Portão da fase: no celular do dono (Android + Chrome), o site publicado pelo GitHub Actions abre, instala na tela inicial e funciona em modo avião depois da primeira visita. O DevTools mostra a CSP do `public/_headers`. O dono troca o idioma, cria o perfil, vê a vila com a padaria, e exporta e importa o perfil.

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
| W1-10 | App | **Primeira visita e perfil.** `/welcome`: idioma (já detectado) e apelido opcional. `/profile`: apelido, avatar entre 4 figuras, idioma da interface e idioma base. `/settings`: reduzir movimento, sons, tamanho do texto | Tudo persiste; o texto escala sem quebrar a tela; a preferência de movimento do sistema é respeitada | Componente: salvar perfil. e2e: primeira visita completa | a fazer |
| W1-11 | App | **Mapa da vila com 1 local.** DOM + CSS, arte CC0 provisória com `public/assets/CREDITS.md`, `image-rendering: pixelated`; a padaria é um botão com rótulo; barra de XP (nível 1) de enfeite; `/place/bakery` mostra a Tilda e "missões em breve" | Bonito e legível no celular do dono; o leitor de tela anuncia o local; nenhuma imagem de fora | e2e: tocar no local abre a tela | a fazer |
| W1-12 | App | **PWA.** Manifesto, ícones, `vite-plugin-pwa` (`generateSW`, `injectRegister: false`), `sw-register.ts` com a política `glifora-sw`, aviso de versão nova, `Cache-Control` no `_headers` | Instala na tela inicial do Android; abre em modo avião depois da primeira visita; nenhuma violação de CSP ao registrar | e2e: recarregar offline; registro sem violação (resolve o "provar no teste" do Trusted Types) | a fazer |
| W1-13 | App | **Deploy.** Job `deploy` (wrangler, ambiente `production`), `version.json` com o commit, conferência dos cabeçalhos na URL real. **Depende do dono:** repositório público no GitHub, conta no Cloudflare, projeto Direct Upload e token (D-39) | Push na `main` publica sozinho; a URL abre no celular; o DevTools mostra a CSP do arquivo | A conferência pós-deploy | aprovada (1º deploy em validação) |
| W1-14 | Revisor | **Revisão da fase.** Acessibilidade em todas as rotas (axe), segurança contra [W0-03 §1.2 C], princípios da SPEC, README "como rodar", roteiro de teste no celular para o dono | Lista de problemas zerada ou aceita pelo Arquiteto | `tests/a11y/` e o roteiro manual | a fazer |

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

2. **Núcleo jogável sem IA:** player de missões (v1, D-43) com níveis de domínio, 5 missões demo em inglês A1–A2 (D-40), teste da taxa de casamento da voz, XP, nível do personagem, level up, relatório da sessão, voz do navegador. Portão: o dono joga 5 sessões seguidas e quer voltar no dia seguinte.
3. **Progressão completa:** missão diária com 3 encontros + chefe, Grimório com feitiços (SM-2), ofensiva, conquistas, metas "consigo...", moedas e avatar básico, desbloqueio de locais.
4. **Fábrica de cenários.**
5. **Conta:** login opcional com Supabase, sincronização, apagar conta (exportar/importar já entra na fase 1).
6. **Modo completo com key.**
7. **Comunidade:** cenários públicos com moderação.
8. **Preparação para exames.**
9. **Depois:** japonês e chinês com traçado, modo offline, Azure opcional (o espanhol entra antes, logo depois do inglês).

Parar ao fim de cada fase para o dono testar no celular.
