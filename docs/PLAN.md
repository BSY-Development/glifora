# PLAN — Glifora (versão open source)

Dono: Arquiteto. Cada tarefa tem: dono, descrição, critério de pronto, testes esperados e, ao ser aprovada, notas de passagem (o que fez, onde parou, pendências). O fluxo entre terminais está em `docs/EQUIPE.md`.

Status possíveis: `a fazer` · `em andamento` · `em revisão` · `aprovada` · `bloqueada`

Antes de qualquer tarefa, leia: `docs/SPEC.md`, `docs/DECISIONS.md` e a sua tarefa aqui.

IDs: `W<fase>-<nº>` (W de web), para não confundir com as tarefas `F…` da versão comercial (arquivo privado, D-38).

## Fase atual: 1 — Fundação

Portão da fase: no celular do dono (Android + Chrome), o site publicado pelo GitHub Actions abre, instala na tela inicial e funciona em modo avião depois da primeira visita. O DevTools mostra a CSP do `public/_headers`. O dono troca o idioma, cria o perfil, vê a vila com a padaria, e exporta e importa o perfil.

Ordem: W1-01 → (W1-02, W1-03, W1-05 em paralelo) → (W1-04, W1-06) → W1-07 → (W1-08, W1-09) → (W1-10, W1-11) → W1-12 → W1-13 → W1-14. Detalhes de cada tarefa: [W0-03 §8] e as seções citadas.

| ID | Dono | Tarefa | Critério de pronto | Testes esperados | Status |
| --- | --- | --- | --- | --- | --- |
| W1-01 | Arquiteto | **Esqueleto.** `package.json`, lockfile, `.nvmrc`, `.npmrc`, TS estrito, Vite + React, ESLint (fronteiras de D-41, sem texto solto no JSX, sem `dangerouslySetInnerHTML`, sem `eval`), pastas com um `README.md` curto em cada, `index.html` sem script inline, `i18n/` com 3 chaves, `src/schemas/lang.ts` e `world.ts`, `content/world/locations.json` com 1 local, `SECURITY.md` | `git clone` → `npm ci` → `dev`, `build`, `test`, `lint` e `typecheck` passam. Só as dependências de D-41 | Teste de fumaça; o lint acusa uma importação proibida de exemplo | aprovada |
| W1-02 | App | **CI.** `ci.yml` com o job `check`; Actions por SHA; permissões mínimas; Dependabot | O PR mostra o resultado; erro de tipo, lint ou teste derruba | O próprio pipeline | a fazer |
| W1-03 | App | **Cabeçalhos.** `public/_headers` igual a [W0-03 §2.8]; o `vite preview` aplica o bloco `/*`; `assetsInlineLimit: 0`; `z.config({ jitless: true })` no início do `main.tsx` | No preview, o DevTools mostra a CSP inteira e o console fica limpo | Unidade para o leitor do `_headers` | a fazer |
| W1-04 | Revisor | **Testes da CSP.** Playwright (Chromium, Pixel 7) e os testes "arquivo", "build" e "navegador" de [W0-03 §7]. O App liga o job `e2e` no `ci.yml` (D-41) | Tirar uma diretiva ou pôr um script inline faz o CI falhar | Os três testes, com os casos negativos (`fetch` externo, `eval`, `innerHTML`) | a fazer |
| W1-05 | App | **i18n.** `src/i18n/`: `t()`, chaves tipadas, plural, detecção, `<html lang>`, componente seletor | Trocar o idioma muda a tela na hora e persiste | Unidade: interpolação, plural, detecção (`pt-PT` → `pt-BR`; `fr` → `en`) | a fazer |
| W1-06 | Revisor | **Guardas de i18n.** Paridade de chaves e de marcadores; valor vazio; plural | Apagar uma chave de um idioma derruba o CI | `tests/i18n/` | a fazer |
| W1-07 | App | **Dados locais v1.** Dexie com `meta` e `docs`; repositórios de `profile`, `prefs` e `avatar`; `deviceId`; o banco abre antes da primeira tela | O perfil sobrevive a recarregar e a fechar o navegador | Vitest + `fake-indexeddb`: criar, ler e alterar (`updatedAt` sobe, `dirty` vira 1) | a fazer |
| W1-08 | App | **Casca e rotas.** React Router; layout com navegação inferior; `/`, `/welcome`, `/place/:id`, `/profile`, `/settings`, `/about` e 404; carregamento sob demanda; erro com tela amigável; foco no título ao trocar de rota; `/about` com versão e commit | Navegação por toque e por teclado; o voltar do Android funciona; 360×640 sem rolagem lateral | Componente: rota desconhecida cai no 404. e2e: fumaça por todas as rotas | a fazer |
| W1-09 | App | **Exportar/importar v1.** Formato de [W0-03 §4.1] (só `docs` por enquanto); `data/merge.ts`; "Apagar os dados deste aparelho" com confirmação | Exportar num navegador e importar em outro recupera o perfil; arquivo inválido dá mensagem clara | Ida e volta; importar duas vezes; arquivo de versão futura recusado; `tests/fixtures/export-v1.json` | a fazer |
| W1-10 | App | **Primeira visita e perfil.** `/welcome`: idioma (já detectado) e apelido opcional. `/profile`: apelido, avatar entre 4 figuras, idioma da interface e idioma base. `/settings`: reduzir movimento, sons, tamanho do texto | Tudo persiste; o texto escala sem quebrar a tela; a preferência de movimento do sistema é respeitada | Componente: salvar perfil. e2e: primeira visita completa | a fazer |
| W1-11 | App | **Mapa da vila com 1 local.** DOM + CSS, arte CC0 provisória com `public/assets/CREDITS.md`, `image-rendering: pixelated`; a padaria é um botão com rótulo; barra de XP (nível 1) de enfeite; `/place/bakery` mostra a Tilda e "missões em breve" | Bonito e legível no celular do dono; o leitor de tela anuncia o local; nenhuma imagem de fora | e2e: tocar no local abre a tela | a fazer |
| W1-12 | App | **PWA.** Manifesto, ícones, `vite-plugin-pwa` (`generateSW`, `injectRegister: false`), `sw-register.ts` com a política `glifora-sw`, aviso de versão nova, `Cache-Control` no `_headers` | Instala na tela inicial do Android; abre em modo avião depois da primeira visita; nenhuma violação de CSP ao registrar | e2e: recarregar offline; registro sem violação (resolve o "provar no teste" do Trusted Types) | a fazer |
| W1-13 | App | **Deploy.** Job `deploy` (wrangler, ambiente `production`), `version.json` com o commit, conferência dos cabeçalhos na URL real. **Depende do dono:** repositório público no GitHub, conta no Cloudflare, projeto Direct Upload e token (D-39) | Push na `main` publica sozinho; a URL abre no celular; o DevTools mostra a CSP do arquivo | A conferência pós-deploy | a fazer |
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
