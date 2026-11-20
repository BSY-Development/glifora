# W0-03 — Arquitetura da versão web (Fable, 2026-11-20)

Proposta para o Arquiteto decidir. Cobre: crítica da W0-02, arquitetura do front, pastas e donos, dados (local e Supabase), conteúdo, interfaces das regras de jogo, testes/CI/deploy, a Fase 1 em tarefas e os pontos para o dono.

Li: `docs/SPEC.md`, `docs/DECISIONS.md` (D-37 a D-40), `docs/EQUIPE.md`, `docs/propostas/W0-02-revisao-spec.md` e, no arquivo comercial, `match.ts`, `conversation.ts`, a cena/roteiro/fecho da padaria, `tilda.json`, `error-patterns.json`, o prompt `npc-turn/v1`, o conjunto-ouro, o teste do STT e a F0-03.

O que conferi em documentação nesta data está marcado com **[conferido]**, com as fontes no fim. O que só dá para provar rodando está marcado com **[provar no teste]**.

**Resumo das escolhas**

| Tema | Escolha |
| --- | --- |
| Camadas | `schemas` → `engine` (TS puro) → `data` / `catalog` / `speech` / `ai` → `services` → `ui`. A direção das importações é travada pelo lint |
| Estado | Dexie é a fonte da verdade (`useLiveQuery`); a missão em andamento é um reducer puro, salvo a cada passo. Sem Redux/Zustand |
| Rotas | React Router, caminhos em inglês, histórico normal (o Cloudflare Pages faz o fallback de SPA) |
| i18n | Sem biblioteca: ~100 linhas, chaves tipadas, plural por `Intl.PluralRules` |
| PWA | `vite-plugin-pwa` (precache), registro do service worker escrito à mão por causa do Trusted Types, atualização por aviso |
| IA | Adaptador com streaming; JSON validado por Zod; 1 retentativa; aceitação parcial; fala de contingência |
| Key | Só na memória por padrão; "lembrar" grava em `localStorage`, fora do Dexie, do exportar e da sincronização |
| CSP | `default-src 'none'`, tudo `'self'`, `connect-src` cresce por fase com revisão, Trusted Types ligado |
| Dados | Dois formatos: **documentos** (último a escrever vence) e **registros só de acréscimo**. Exportar/importar e sincronizar usam a mesma função de mescla |
| Conteúdo | Missão = uma conversa. Sequência linear por padrão, reação da NPC por resposta, fecho obrigatório. Entra no build por `import`, com índice gerado |

---

## 1. Crítica da W0-02

### 1.1 As 12 recomendações

| # | Tema | Veredito | O que eu mudaria ou acrescentaria |
| --- | --- | --- | --- |
| 1 | Idiomas | Concordo (D-40) | O rascunho do schema só tem `idioma`. Precisa de `base` **e** `target`. "Base inglês → português" exige normalização de fala em português; fica para quando esse par chegar |
| 2 | CSP e hospedagem | Concordo (D-39) | **Sem relatório de violação**: não há servidor para receber e mandar a um terceiro quebra o "sem terceiros". O `vite preview` não aplica o `_headers`; a seção 2.8 resolve. No Cloudflare, deixar desligado tudo que injeta script (Web Analytics; com domínio próprio, Rocket Loader e ofuscação de e-mail) |
| 3 | Falar/digitar em vez de escolher | Concordo, é a melhor da lista | Três refinamentos (1.2 A): escada de ajuda, opção "com erro" que gera recast sem IA, e relatório que mostra o que a pessoa disse ao lado do modelo |
| 4 | Fábrica tolerante a campo extra | Concordo | Campo extra não é a maior causa de falha. As maiores são **referência quebrada** (`proxima` apontando para fala que não existe) e **resposta cortada**. Por isso proponho missão em sequência linear, sem ids obrigatórios (5.1). Um schema só, estrito, com uma passada antes que remove e lista os campos desconhecidos |
| 5 | Contrato do turno | Concordo com `{original, corrected}` e `errors[]`. **Discordo da ordem** | `npc_reply` não deve vir primeiro. A ordem certa é `understood` → `recast` → `npc_reply`: o modelo decide o recast e depois escreve a fala que o contém (o prompt antigo já pedia isso). Custa ~30 tokens de espera. Também: `goals_met` (ids de lista fechada) no lugar de `goal_progress` numérico, que modelo fraco inventa; e aceitação parcial no lugar de retentar depois que a fala já apareceu (2.6) |
| 6 | Provedores | Concordo (Anthropic em segundo) | O OpenRouter tem login **OAuth PKCE** que devolve uma key para o app, com limite de crédito pré-preenchido **[conferido]**: no celular isso vale mais que colar key. `GET /api/v1/key` mostra o limite e o uso **[conferido]**. Limites grátis confirmados: 20/min e 50/dia, ou 1000/dia para quem já comprou 10 créditos **[conferido]** |
| 7 | Supabase pausa em 7 dias | Concordo | O ping por GitHub Actions tem uma pegadinha: o GitHub desliga workflows agendados depois de 60 dias sem atividade no repositório. O SDK do Supabase só deve ser carregado (import dinâmico) quando a pessoa escolhe entrar. Falta **cota por usuário** (4.2) |
| 8 | Sincronização por histórico | Concordo, e estendo | Conquistas viram conjunto (id determinístico), moedas viram livro-razão, ofensiva é derivada dos dias ativos. Exportar/importar é a mesma mescla da sincronização, então dá para testar desde já |
| 9 | Key no navegador | Concordo no padrão. Discordo da ênfase | (a) Trusted Types hoje existe nos três motores, não só no Chrome **[conferido]**. (b) O maior risco não é XSS clássico, é **cadeia de dependências**: código malicioso dentro do bundle é `'self'`. (c) A CSP não impede vazamento por navegação (`location = 'https://x/?k=...'`). (d) Não usar `sessionStorage`: mesma exposição e semântica confusa. Ver 1.2 C |
| 10 | Reconhecimento de voz | Concordo no aviso de privacidade. **Discordo do momento do teste** | No modo árvore, o reconhecedor "consertar" o erro quase não atrapalha (a resposta boa casa do mesmo jeito). O que a fase 2 precisa medir é a **taxa de casamento** das palavras-chave com sotaque brasileiro. O teste das 44 frases é pré-requisito da fase 6 (recast por voz). A mesma tela de diagnóstico serve aos dois |
| 11 | Idade | Concordo | No modo completo, quem tem key já aceitou os termos do provedor (adulto). As regras "adequado para 13 anos" do prompt antigo voltam de graça. A exposição que sobra é o catálogo público |
| 12 | Arte CC0 | Concordo | Mapa em **DOM + CSS** (sprites posicionados, cada local é um `<button>`), sem motor de jogo: acessível, leve e sem dependência. "A vila evolui" pede arte em camadas que pacote pronto raramente tem; planejar com sobreposição e troca de sprite. Créditos em `public/assets/CREDITS.md` |

### 1.2 O que faltou

**A. Diversão — o gargalo é volume de conteúdo.**
- A fase 3 pede 3 encontros + chefe por dia. Com 5 missões demo, o conteúdo acaba no segundo dia. Um mês de ofensiva pede ~120 conversas.
- No modo árvore, rejogar igual não tem graça: a pessoa já sabe a resposta.
- **Proposta: níveis de domínio por missão.** Rejogar a mesma missão com menos ajuda: 1ª vez com as frases à vista; 2ª só com a ideia no idioma base; 3ª sem nada. Cumpre os princípios 3 e 4 (recuperação e intercalação), dá progressão visível e triplica o rendimento de cada missão. A missão diária passa a ser 1 conversa nova + 2 antigas num nível de ajuda menor + chefe.
- O motor e os dados já nascem prontos para isso (`scaffold` em cada rodada). Os números ficam para a chamada nº 2.
- A fábrica (fase 4) é o que dá conteúdo infinito ao próprio autor. Se o portão da fase 2 falhar por falta de variedade, é ela que deve subir na fila.

**B. Pedagogia.**
- **Princípio 1 (input antes de output) não aparece no rascunho do schema.** A missão começa direto na pergunta da NPC. Proponho `listen`: 2 a 6 falas curtas no idioma-alvo que a pessoa ouve antes (outro freguês pedindo), com as frases que ela vai precisar.
- **Escada de ajuda** (refina a recomendação 3): 0 = sem ajuda; 1 = a ideia no idioma base ("peça um pão de mel"); 2 = a frase no idioma-alvo; 3 = tocar. O degrau 1 ainda é recuperação; o 2 é leitura em voz alta; o 3 é reconhecimento. O XP acompanha o degrau.
- **Recast sem IA.** A opção "com erro" do rascunho ganha sentido novo: ela só casa quando a pessoa **produz** aquele erro ("two breads"). A NPC responde com o recast ("Two loaves of bread? Sure!"). São os erros do catálogo do aluno brasileiro, previstos pelo Conteúdo.
- **Limite honesto do casamento por palavra-chave:** "me want honey" casa com a resposta boa. O relatório nunca diz "perfeito"; diz "a Tilda entendeu" e mostra a frase da pessoa ao lado da frase-modelo. É um retorno atrasado, sem IA e sem tela de erro.
- **`feedback` na hora quebra o princípio 5.** No rascunho, cada opção tem `feedback` ("Compreensível, mas soa rude"). Durante a conversa só aparece o recast; a explicação vai para o relatório.
- **CEFR adaptativo só existe no modo completo** (depende de `understood`). No modo demo, o nível é o do nivelamento mais o avanço nas unidades. A SPEC precisa dizer isso.
- **"Missão" tem dois sentidos na SPEC.** Defino: arquivo de missão = **uma conversa** (1–3 min). A "missão do dia" é uma lista montada pelo motor. O chefe é uma missão com `kind: "boss"`, que começa sem ajuda.

**C. Segurança da key.**

| Ameaça | O que protege | O que não protege |
| --- | --- | --- |
| Dependência npm comprometida | Poucas dependências (7 de runtime), lockfile, `npm ci`, `ignore-scripts`, toda dependência nova aprovada pelo Arquiteto, Dependabot | CSP: o código malicioso é `'self'` |
| XSS por conteúdo colado ou público | Nenhum HTML vindo de dado, Trusted Types, lint contra `dangerouslySetInnerHTML`, Zod estrito | — |
| Vazamento depois de um XSS | `connect-src` fechado, `form-action 'none'` | Navegação de topo com a key na URL; escrita da key num lugar permitido (ex.: um cenário público). A CSP reduz, não zera |
| Deploy adulterado (token do Cloudflare ou conta do GitHub) | Token só de Pages, ambiente protegido, Actions fixadas por SHA, `version.json` com o commit, build atestado nas Releases | Inerente a qualquer site: quem serve o JS pode trocar o JS |
| Extensão maliciosa, aparelho compartilhado | Nada no app | Dizer no README |

- **A rede de segurança de verdade é o limite de gasto.** Entra na tela de configuração como passo, não como conselho de README.
- **Privacidade dos modelos grátis:** vários modelos grátis do OpenRouter só funcionam se a conta permitir uso dos prompts para treino (conferir na fase 6). A tela precisa avisar.
- **O README não pode prometer mais do que a tabela acima.**

**D. Qualidade do modelo é a variável nº 1 do modo completo.** Um modelo fraco corrige frase certa e ensina errado. O conjunto-ouro (207 falas, meta de menos de 5% de correção indevida) deixa de ser "Haiku ou Sonnet" e vira o teste que define a lista de **modelos recomendados** da tela de configuração. Modelo fora da lista: aviso claro.

**E. Custo zero.** Está de pé. Dois furos pequenos: abuso do Supabase grátis (qualquer conta pode encher o banco: cota por usuário, 4.2) e CAPTCHA, que não dá para usar sem script de terceiro (aceitar o risco; confirmação de e-mail e cotas bastam).

**F. iOS.** O Safari apaga IndexedDB e `localStorage` de site não instalado depois de 7 dias sem uso. Em PWA instalada no iOS o reconhecimento de voz costuma não funcionar. Ver seção 9.

**G. Licença.** MIT cobre o código. Falta a licença de `content/` e a dos cenários enviados pela comunidade. Ver seção 9.

---

## 2. Arquitetura do front

### 2.1 Módulos e fronteiras em `src/`

| Pasta | O que é | Pode importar | Não pode |
| --- | --- | --- | --- |
| `schemas/` | Contrato de dados do conteúdo: schemas Zod, tipos, e as funções puras que definem o sentido do conteúdo (normalizar fala, casar palavras-chave, conferir o grafo da missão, contrato do turno) | `zod` | qualquer outra pasta |
| `engine/` | Regras do jogo em TS puro: rodada de missão, XP, nível, ofensiva, desbloqueio, domínio, repetição espaçada, relatório | `schemas` | React, Dexie, DOM, `Date.now`, `Math.random` (relógio e sorteio entram por parâmetro) |
| `data/` | Dexie, repositórios, migrações, exportar/importar, mescla; na fase 5, sincronização | `schemas`, `engine` (tipos), `dexie` | React, `ai`, `ui` |
| `catalog/` | Carrega e indexa o conteúdo embutido (`import.meta.glob`) | `schemas` | resto |
| `speech/` | Voz: fala e reconhecimento atrás de uma interface | nada do projeto | resto |
| `ai/` | Cofre da key, adaptadores, JSON estruturado, tarefas (turno, feitiço, gerar missão) | `schemas` | React, `data`, `ui` |
| `i18n/` | `t()`, detecção e troca de idioma (os textos ficam em `/i18n`) | — | resto |
| `services/` | Casos de uso que juntam tudo: jogar missão, fechar sessão, revisar feitiço, exportar | tudo acima | React |
| `ui/` | React: rotas, telas, componentes, hooks, estilos | `services`, `i18n`, tipos de `engine`/`schemas`, `dexie-react-hooks` | `ai/keyVault`, `ai/providers` |

- **Como travar:** `no-restricted-imports` por pasta no ESLint (sem dependência nova). O CI falha se uma importação cruzar a fronteira.
- **Prova de pureza:** os testes de `schemas/` e `engine/` rodam no Vitest em ambiente `node`, sem jsdom.
- **Motor como máquina de estados:** `step(estado, entrada) → { estado, efeitos[] }`. Efeitos são dados (`npc_line`, `event`, `vocab`, `finished`). Quem grava no Dexie, fala e toca som é `services/`.

### 2.2 Estado e rotas

**Estado, em três tipos:**

| Tipo | Onde vive | Como a tela lê |
| --- | --- | --- |
| Persistente (perfil, eventos, cards, missões salvas) | Dexie | `useLiveQuery` (reage a escrita). Sem cópia em store global |
| Missão em andamento | Reducer puro do motor (`useReducer`), com cópia na tabela `session` a cada passo | Contexto da tela da missão. Se o celular matar a aba, a missão retoma |
| Efêmero da interface (aviso, "nova versão", online/offline) | Store mínima própria (`useSyncExternalStore`) | hook |

- A key **nunca** entra em estado do React, em store nem em contexto.
- Derivados (XP total, nível, ofensiva, desbloqueios) são calculados dos eventos por função pura, com cache em memória.

**Rotas** (React Router, carregadas sob demanda, caminhos em inglês porque a interface é bilíngue):

| Rota | Tela | Fase |
| --- | --- | --- |
| `/` | Vila (mapa) | 1 |
| `/welcome` | Primeira visita | 1 |
| `/place/:id` | Local: NPC e missões | 1 (casca), 2 |
| `/mission/:id` | Conversa | 2 |
| `/report/:runId` | Relatório | 2 |
| `/grimoire` | Grimório | 3 |
| `/achievements` | Conquistas e metas "consigo..." | 3 |
| `/factory` | Fábrica de cenários | 4 |
| `/profile` | Perfil e avatar | 1 |
| `/settings`, `/settings/ai`, `/settings/data`, `/settings/voice` | Configurações | 1 / 5 / 6 |
| `/about` | Privacidade, licenças, versão e commit | 1 |
| `/catalog` | Cenários públicos | 7 |

- O Cloudflare Pages devolve `index.html` para rota desconhecida quando não existe `404.html`. O service worker faz o mesmo offline.
- Nada sensível na URL. O código do OAuth é trocado e removido com `history.replaceState`.
- Sair no meio da missão pede confirmação (`useBlocker`); o progresso da rodada fica salvo.

### 2.3 PWA e service worker

| Tema | Decisão |
| --- | --- |
| Geração | `vite-plugin-pwa` no modo `generateSW`: precache do app, do i18n e da arte básica; `navigateFallback: /index.html`; limpeza de caches antigos |
| Registro | **Escrito à mão** (`src/sw-register.ts`), com `injectRegister: false`. O `virtual:pwa-register` passa uma string para `serviceWorker.register`, e com Trusted Types isso é barrado **[provar no teste]** |
| Atualização | `registerType: 'prompt'`. Versão nova esperando: na abertura do app, ativa e recarrega sozinha; no meio de uma missão, só mostra "Nova versão disponível" |
| O que o SW **não** faz | Não intercepta nem guarda pedido para outra origem. Chamada com key passa direto |
| Offline | Depois da primeira visita: vila, missões embutidas, Grimório e relatório funcionam. Reconhecimento de voz precisa de rede no Chrome; cai para digitar/tocar |
| Cache HTTP | `/assets/*` imutável por 1 ano (nome com hash); `/sw.js` e `index.html` sem cache |
| Manifesto | `display: standalone`, `orientation: portrait`, ícones 192/512 e maskable, `id` e `start_url` em `/` |
| Persistência | `navigator.storage.persist()` depois da primeira missão concluída (não na primeira tela) |
| Escala | Com dezenas de missões, os JSON saem do precache e vão para cache em tempo de uso (`CacheFirst`, nome com hash) |

### 2.4 i18n: sem biblioteca

- **Por quê:** dois idiomas de interface, textos curtos. As bibliotecas (i18next, FormatJS) pesam e somam dependências a um app que guarda key. O que precisamos cabe em ~100 linhas.
- **Como:**
  - `i18n/pt-BR.json` e `i18n/en.json` na raiz (SPEC), os dois no bundle; trocar é instantâneo.
  - Chaves tipadas a partir do `pt-BR.json`: chave inexistente não compila.
  - `t('mission.xp', { n: 12 })`; plural como objeto `{ "one": "...", "other": "..." }` resolvido por `Intl.PluralRules`.
  - **Nenhum HTML nas traduções.** Negrito no meio da frase se resolve com duas chaves ou componente.
  - Detecção: `navigator.languages`; começa com `pt` → `pt-BR`; senão `en`. A escolha é salva e atualiza `<html lang>`.
- **Três idiomas diferentes, três campos:** interface (`pt-BR`/`en`), base (das traduções do conteúdo) e alvo (o que se aprende). Texto de conteúdo no idioma base vem do conteúdo, nunca do i18n.
- **Trava:** lint `react/jsx-no-literals` (texto solto no JSX falha) e teste de paridade (seção 7).

### 2.5 Voz (Web Speech API)

```ts
interface Tts {
  readonly supported: boolean;
  voicesFor(lang: string): Promise<VoiceInfo[]>;          // vazio = sem voz para o idioma
  speak(text: string, o: { lang: string; rate?: number; pitch?: number }): Promise<'done' | 'interrupted' | 'unavailable'>;
  cancel(): void;
}
interface Stt {
  readonly supported: boolean;
  listen(o: { lang: string; signal: AbortSignal; onInterim?: (text: string) => void }): Promise<SttResult>;
}
type SttResult =
  | { ok: true; alternatives: { text: string; confidence: number }[] }   // até 5, a melhor primeiro
  | { ok: false; reason: 'no_speech' | 'denied' | 'network' | 'lang' | 'aborted' | 'unsupported' };
```

| Cuidado | Como tratar |
| --- | --- |
| Suporte varia (Firefox sem reconhecimento; iOS instável, pior em PWA instalada) | Detectar a função, nunca o navegador. Sem suporte: o microfone some e o campo de texto vira o caminho principal |
| Vozes chegam depois (`voiceschanged`) e podem faltar para o idioma | `voicesFor` assíncrono; sem voz, o texto aparece sem áudio e a tela avisa uma vez |
| Áudio só depois de um toque (política do navegador) | A primeira fala sai do botão "Começar" |
| O microfone ouve a própria NPC | Cancelar a fala antes de ouvir; microfone só por toque, nunca automático |
| Casamento frágil | Pedir `maxAlternatives: 5` e tentar casar cada alternativa, na ordem. Aumenta o acerto sem custo |
| Privacidade | Antes do primeiro uso do microfone: o áudio vai para o serviço de voz do navegador (Google no Chrome, Apple no Safari), não para o Glifora |
| Permissão | `Permissions-Policy: microphone=(self)`; pedir no primeiro toque no microfone, com explicação |
| Diagnóstico | `/settings/voice`: mostra o que o aparelho reconhece (alternativas e confiança). Serve ao dono, ao Conteúdo (homófonos nas palavras-chave) e ao teste das 44 frases |
| Voz do provedor (fase 6+) | Mesmas interfaces, outra implementação (`MediaRecorder` → provedor). O OpenRouter não tem voz; com ele continua a do navegador |

Nos testes e2e, `SpeechRecognition` e `speechSynthesis` são trocados por dublês com `page.addInitScript`. O bundle de produção não tem gancho de teste.

### 2.6 Adaptadores de IA

```ts
type ProviderId = 'openrouter' | 'anthropic';          // depois: 'openai' | 'gemini'

interface ChatRequest {
  model: string;
  system: { text: string; cache?: boolean }[];         // parte fixa primeiro (cacheável), parte do turno depois
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  json?: { name: string; schema: JsonSchema };          // usa saída estruturada nativa se o modelo tiver; senão ignora
  signal: AbortSignal;
}
type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'done'; text: string; stop: 'end' | 'max_tokens' | 'refusal' | 'other';
      usage: { input: number; output: number; cachedInput?: number } | null };

interface AiProvider {
  readonly id: ProviderId;
  readonly origin: string;                              // constante; o teste confere contra a CSP
  listModels(signal: AbortSignal): Promise<ModelInfo[]>;
  checkKey(key: string, signal: AbortSignal): Promise<KeyStatus>;   // válida? limite? uso?
  chat(key: string, req: ChatRequest): AsyncIterable<ChatEvent>;    // lança AiError
}
type AiErrorKind = 'auth' | 'credits' | 'rate_limit' | 'network' | 'timeout' | 'refused' | 'invalid_output' | 'aborted' | 'server';
```

**Camadas dentro de `ai/`:**

| Arquivo | Papel |
| --- | --- |
| `keyVault.ts` | Único lugar que guarda e lê a key (2.7) |
| `providers/openrouter.ts`, `providers/anthropic.ts` | Traduzem `ChatRequest` para a API de cada um e leem o SSE |
| `structured.ts` | `completeJson(provider, req, zodSchema, { onField })`: streaming, extração, validação, retentativa |
| `tasks/npcTurn.ts`, `gradeSpells.ts`, `generateMission.ts` | Montam o prompt (modelos em `content/prompts/`) e chamam `completeJson` |
| `models.ts` | Lista de modelos recomendados (resultado do conjunto-ouro) |

**Por provedor:**

| | OpenRouter (1º) | Anthropic (2º) |
| --- | --- | --- |
| Endereço | `https://openrouter.ai/api/v1/chat/completions` | `https://api.anthropic.com/v1/messages` |
| Cabeçalhos | `Authorization: Bearer`, `X-Title: Glifora` | `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access: true` **[conferido]** |
| JSON nativo | `response_format: { type: 'json_schema', json_schema: { name, strict, schema } }`, só em modelos com `structured_outputs`; `provider.require_parameters: true` **[conferido]** | `output_config: { format: { type: 'json_schema', schema } }` **[conferido]** |
| Sem JSON nativo | Instrução de formato no prompt + extrator tolerante (o mesmo da fábrica) | — |
| Conferir a key | `GET /api/v1/key` (limite, uso) | `GET /v1/models` |
| Entrada sem colar | OAuth PKCE com limite pré-preenchido (fase 6, depois do básico) | — |
| Cache de prompt | Depende do modelo | `cache_control` no bloco fixo do sistema; mínimo de 512 tokens nos modelos atuais **[conferido]** |
| Modelo inicial | Lista recomendada; grátis marcados | `claude-haiku-5-5`, esforço baixo; sem `temperature` (a versão atual da API rejeita) |
| Voz | Não | Não |

Sem SDK de provedor: `fetch` direto. São duas chamadas pequenas, e cada SDK é uma dependência grande num app que guarda key.

**Todo `fetch` com key usa:** origem fixa em constante (sem campo "URL personalizada"), `redirect: 'error'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, `AbortController` com teto de 30 s. Motivo do `redirect: 'error'`: o `x-api-key` não é removido num redirecionamento para outra origem.

**Streaming e validação:**
1. O adaptador entrega pedaços de texto.
2. Um extrator incremental (máquina de estados, ~60 linhas, sem biblioteca) acha o valor de `"npc_reply"` no JSON parcial e entrega a fala conforme chega. Ele **não depende da ordem das chaves**; a ordem só melhora a espera e a qualidade.
3. No fim: extrair o objeto (tolerando texto e cercas ```json em volta), `JSON.parse`, Zod, e as conferências de sentido da seção 5.4.

**Falhas:**

| Situação | O que acontece |
| --- | --- |
| JSON inválido **antes** de haver fala completa | 1 retentativa, com os erros do Zod numa linha |
| Fala completa e válida, resto quebrado | **Aceitação parcial:** fica a fala, o turno entra sem avaliação. Não retenta (a pessoa já leu; outra chamada daria outra fala) |
| Segunda falha, rede, 5xx, tempo esgotado | Fala fixa de contingência da NPC ("Oh, the oven is so loud! Can you say that again, dear?"). O turno não conta |
| Duas contingências seguidas | Oferecer continuar no modo roteiro (se a missão tiver árvore) ou encerrar com o XP já ganho |
| 401 | "Sua key não foi aceita" → configurações. Sem retentar |
| 402 / 429 | Explicar créditos ou limite (no OpenRouter grátis: 50 por dia). Sem retentar |
| `stop: 'refusal'` | Contingência; não retenta |

**O que vai para a IA (SPEC):** prompt de sistema da NPC, resumo curto do encontro e as 6 últimas mensagens. A fala do jogador vai entre marcadores (`<player_utterance>`), com os marcadores removidos do texto dele e teto de 500 caracteres. Um turno = uma chamada.

### 2.7 Armazenamento da key

| Estado | Onde fica | Some quando |
| --- | --- | --- |
| Padrão (não lembrar) | Variável dentro de `ai/keyVault.ts` | Recarregar ou fechar a aba |
| "Lembrar neste aparelho" | `localStorage`, entrada `glifora.key.v1.<provedor>` | "Apagar minha key", ou limpar dados do site |

- **Por que `localStorage` e não Dexie:** exportar, importar e sincronizar percorrem as tabelas do Dexie. Fora dele, a key não entra nesses caminhos nem por descuido. Também é fácil de ver no DevTools (Application → Local Storage) e apagar é síncrono.
- **Sem `sessionStorage`:** o XSS lê igual, e "some ao fechar a aba, mas não ao recarregar" é difícil de explicar.
- **Sem criptografia de enfeite:** cifrar com chave guardada na mesma origem não protege de quem roda script na página.
- **API do cofre:** `setKey`, `hasKey`, `maskedKey` (4 últimos caracteres), `clearKey`, `withKey(provider, fn)`. Só `ai/providers/*` e `ai/structured.ts` podem importar `withKey` (lint).
- **Na tela:** campo `type="password"`, não controlado, limpo ao salvar; `autocomplete="off"`, `spellcheck="false"`. Escolha explícita entre os dois modos na hora de salvar, com o aviso. Passos: criar uma key só para o Glifora → pôr limite de gasto → colar → "Testar" (`checkKey`).
- **Nunca:** em log, mensagem de erro, URL, relatório, exportação, Supabase.
- **No celular** o navegador descarta abas em segundo plano, então o modo "não lembrar" vai pedir a key com frequência. Mantenho como padrão por honestidade, mas a maioria vai marcar "lembrar". É mais um motivo para o limite de gasto e para o OAuth do OpenRouter.

### 2.8 CSP e cabeçalhos (`public/_headers`)

Arquivo estático, versionado, igual ao que o DevTools mostra. **Fase 1:**

```
/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; media-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types glifora-sw; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: microphone=(self), camera=(), geolocation=(), payment=(), usb=(), midi=(), display-capture=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache
```

**`connect-src` cresce por fase.** Cada linha nova é um commit revisado pelo Revisor, e o teste da CSP tem a lista esperada:

| Fase | Acrescenta | Por quê |
| --- | --- | --- |
| 1–4 | nada (`'self'`) | Não há chamada externa |
| 5 | `https://<ref-do-projeto>.supabase.co` | Auth e REST. **O host exato, nunca `*.supabase.co`**: com o curinga, um XSS mandaria dados para o projeto Supabase de qualquer pessoa |
| 6 | `https://openrouter.ai/api/v1/` e `https://api.anthropic.com/v1/` | Com caminho (barra no fim = prefixo): só a API |
| 6+ (voz) | `https://api.openai.com/v1/`, `https://generativelanguage.googleapis.com/`; e `media-src 'self' blob:` | Só quando o adaptador entrar; `blob:` para tocar o áudio recebido |
| 9 (offline) | `'wasm-unsafe-eval'` em `script-src`, talvez COEP | Whisper no navegador; decidir na hora |

**O que a política exige do código:**

| Diretiva | Consequência |
| --- | --- |
| `script-src 'self'` | Nenhum script inline no `index.html`; nada de CDN |
| `style-src 'self'` | CSS em arquivo (CSS Modules ou CSS puro). O `style={{}}` do React funciona, porque altera pelo CSSOM. Biblioteca que injeta `<style>` (CSS-in-JS) quebra. SVG com atributo `style` entra por `<img>` |
| `img-src 'self'` | Sem `data:`. No Vite, `build.assetsInlineLimit: 0` |
| `font-src 'self'` | Fontes no repositório |
| `require-trusted-types-for 'script'` | `innerHTML` e afins lançam erro. O app não usa nenhum |
| `trusted-types glifora-sw` | Uma única política, criada em `sw-register.ts`, que só aceita a string `/sw.js`. Sem política `default` |
| Sem `'unsafe-eval'` | Zod 4 testa `new Function` na primeira validação. `z.config({ jitless: true })` na primeira linha do `main.tsx`, antes de qualquer parse (Zod ≥ 4.4) **[conferido]** |
| `form-action 'none'` | Formulário só por JavaScript |
| `frame-ancestors 'none'` | Ninguém embute o Glifora (clickjacking) |
| COOP `same-origin` | Login do Google por redirecionamento, não por popup |

**Outros pontos:**
- **Sem `report-uri`/`report-to`** (não há para onde mandar sem servidor ou terceiro).
- **Supabase:** o host fica literal no `_headers`. Quem fizer fork troca uma linha. Um teste confere que bate com `VITE_SUPABASE_URL` quando a variável existe.
- **Desenvolvimento:** `npm run dev` roda sem CSP (o Vite injeta script inline). A política vale no `vite preview` (o `vite.config.ts` lê o bloco `/*` de `public/_headers` e põe em `preview.headers`) e em produção. Os testes e2e rodam contra o preview.
- **Limites do Cloudflare Pages:** até 100 regras e 2.000 caracteres por linha **[conferido]**; a linha da CSP tem ~600. O `_headers` não vale para respostas de Pages Functions (não usamos).

---

## 3. Estrutura de pastas e donos

```
/
├─ .github/                  App        workflows (ci.yml), dependabot.yml
├─ content/                  Conteúdo   (Arquiteto até a fase 2)
│  ├─ world/                            locations.json
│  ├─ npcs/                             <id>.json
│  ├─ patterns/                         <par>.json — catálogo de erros
│  ├─ units/<par>/                      metas "consigo..." e ordem das missões (fase 3)
│  ├─ missions/<par>/<nivel>/           <slug>.json
│  ├─ themes/                           <base>.json — temas aleatórios (fase 4)
│  ├─ prompts/                          factory/, npc-turn/ (fases 4 e 6)
│  ├─ eval/                             conjunto-ouro, teste do STT (nunca entra no bundle)
│  └─ exams/                            (fase 8)
├─ docs/                     Arquiteto
├─ i18n/                     App        pt-BR.json, en.json
├─ public/                   App        _headers, ícones, assets/ (arte, sons, fontes, CREDITS.md)
├─ scripts/
│  ├─ content/               Conteúdo   validar, gerar índice, gerar em lote, pontuar conjunto-ouro
│  └─ moderation/            Backend    (fase 7) revisão dos cenários públicos
├─ src/
│  ├─ schemas/               Conteúdo   (Arquiteto até a fase 2)
│  ├─ engine/  data/  catalog/  speech/  ai/  i18n/  services/  ui/     App
│  └─ main.tsx, sw-register.ts          App
├─ supabase/                 Backend    (fase 5)
├─ tests/                    Revisor    e2e/, security/, i18n/, a11y/, pedagogy/, fixtures/
├─ index.html, package.json, package-lock.json, tsconfig*.json,
│  vite.config.ts, eslint.config.js, .nvmrc, .npmrc                     App (criados pelo Arquiteto no W1-01)
├─ vitest.config.ts, playwright.config.ts                               Revisor
└─ README.md, LICENSE, SECURITY.md, CONTRIBUTING.md,
   .gitignore, .gitattributes, .env.example                             Arquiteto
```

`<par>` = `<base>_<alvo>`, ex.: `pt-BR_en`.

**Fronteira `src/schemas/` (Conteúdo) × `src/` (App):**

| Regra | Detalhe |
| --- | --- |
| `src/schemas/` é uma folha | Só importa `zod`. O lint barra o resto. Assim os scripts em Node, o app e os testes usam o mesmo arquivo |
| O que mora lá | Tudo que define **o que o conteúdo é e significa**: `lang.ts`, `world.ts`, `mission.ts`, `mission.check.ts` (grafo), `match.ts` (normalizar e casar), `npc.ts`, `vocab.ts`, `theme.ts`, `turn.ts` (contrato do turno), `factory.ts` (extração e limpeza do JSON colado) |
| O que **não** mora lá | Schemas das linhas do Dexie, do arquivo de exportação e das preferências: são do App, em `src/data/schema/` |
| Quem muda | O Conteúdo. O App pede mudança pelo Arquiteto; mudança de formato sobe `schema` e é combinada antes |
| Contrato entre os dois | Os tipos exportados por `src/schemas/index.ts`. O App nunca importa de arquivo interno |
| Antes da fase 2 | O Arquiteto cria o mínimo (`lang.ts`, `world.ts`), como "schemas iniciais" do papel dele |

**Testes:** teste de unidade fica ao lado do código (`x.test.ts`) e é do dono da pasta. `tests/` é do Revisor: e2e, segurança, i18n, acessibilidade e guardas dos princípios pedagógicos. O Revisor aponta falta de teste de unidade; não escreve dentro de `src/`.

**Raiz:** o Arquiteto cria tudo no esqueleto (W1-01) e passa os arquivos de build ao App. **Dependência nova de runtime só com aprovação do Arquiteto**, anotada na tarefa.

**Dependências de runtime previstas (7):** `react`, `react-dom`, `react-router`, `dexie`, `dexie-react-hooks`, `zod`; na fase 5, `@supabase/supabase-js` por import dinâmico. Versões: as últimas estáveis no dia do esqueleto, fixadas no lockfile.

---

## 4. Modelo de dados

### 4.1 Local (Dexie)

**Princípios, já pensando na sincronização:**
1. **Dois formatos de dado.** *Documento*: tem dono único e o último a escrever vence (`updatedAt`). *Registro*: só se acrescenta, nunca muda.
2. **O que é somável é registro.** XP, moedas, revisões, rodadas e conquistas são registros. Totais, nível, ofensiva, desbloqueios e o estado de cada card são **calculados** deles.
3. **Ids.** Aleatório (`crypto.randomUUID`) para o que pode repetir. **Determinístico** para o que só existe uma vez: card = `<alvo>:<termo normalizado>`; conquista = `ach:<id>`. Dois aparelhos offline criam a mesma linha, e a mescla une sem duplicar.
4. **Marcas de envio.** Documento tem `dirty` (0/1); registro tem `synced` (0/1). São índices (o Dexie não indexa booleano).
5. **Um banco, um dono.** `meta.owner` = `null` (local) ou o id da conta. Entrar com outra conta exige exportar ou apagar antes.
6. **A key não está em nenhuma tabela.**

**Tabelas e versões do banco:**

| Tabela | Chave | Índices | Tipo | Versão (fase) |
| --- | --- | --- | --- | --- |
| `meta` | `key` | — | Só local: `deviceId`, `owner`, cursores, `createdAt`, `lastExportAt` | 1 (1) |
| `docs` | `id` | `dirty` | Documento: `profile`, `prefs`, `avatar`; depois `npc:<alvo>:<id>` (memória da NPC) | 1 (1) |
| `events` | `id` | `at`, `day`, `kind`, `synced` | Registro: livro-razão de XP e moedas | 2 (2) |
| `runs` | `id` | `missionId`, `day`, `synced` | Registro: rodada concluída, com o resumo para o relatório | 2 (2) |
| `session` | `id` | — | Só local: a rodada em andamento | 2 (2) |
| `cards` | `id` | `target`, `[target+due]`, `dirty` | Documento (termo, tradução, exemplo, origem, suspenso) + estado de revisão em cache | 3 (3) |
| `reviews` | `id` | `cardId`, `at`, `synced` | Registro: cada revisão (nota, modo, quem avaliou) | 3 (3) |
| `missions` | `id` | `[base+target+level]`, `source`, `dirty` | Documento: missões da fábrica, da IA e baixadas do catálogo | 4 (4) |

```ts
// Documento
interface Doc<T> { id: string; v: number; data: T; updatedAt: number; deleted: 0 | 1; dirty: 0 | 1 }

// Registro do livro-razão
interface GameEvent {
  id: string;        // uuid, ou determinístico para prêmio único ("ach:first_boss")
  at: number;        // epoch ms
  day: string;       // 'YYYY-MM-DD' no fuso local do momento (a ofensiva usa isto)
  kind: EventKind;   // mission_completed | boss_defeated | spell_cast | achievement | purchase | freeze_earned | ...
  xp: number;        // ≥ 0, já calculado
  coins: number;     // negativo só em 'purchase'
  rules: number;     // versão das regras que calculou
  target?: string; ref?: string; runId?: string;
  device: string; synced: 0 | 1;
}
```

- **XP é gravado calculado**, com a versão das regras. Rebalancear muda o futuro, não o passado. O nível sai do total pela curva atual.
- **Um evento por missão**, não por resposta: o detalhe fica no resumo da rodada. Dá ~10–30 linhas por dia de jogo.
- **Estado do card** = revisões do card em ordem de `at`, passadas pelo agendador. O cache em `cards` é refeito quando chega revisão nova.
- **Moedas** em dois aparelhos offline podem gastar o mesmo saldo. Aceito: o saldo mostrado não desce de zero, e são só cosméticos.
- **Transcrições do modo completo** ficam só no aparelho, com prazo, e não sincronizam.

**Versão e migração:**
- **Índices e tabelas:** `db.version(n).stores(...)`; `upgrade()` só quando precisar mexer em dado.
- **Conteúdo das linhas:** cada `data` tem `v`. Funções puras `vN → vN+1`, aplicadas ao ler. As mesmas servem ao importar e ao receber da sincronização.
- **Linha de versão mais nova que o app:** guardar, não mexer, não sobrescrever, e avisar para atualizar.
- **Teste:** arquivos de exemplo de cada versão em `tests/fixtures/`; todos têm de importar nas versões seguintes.

**Exportar/importar:**

```json
{
  "format": "glifora-export",
  "version": 1,
  "exportedAt": "2026-11-20T15:00:00Z",
  "app": "0.1.0",
  "device": "c0ffee00-…",
  "docs": [], "events": [], "runs": [], "cards": [], "reviews": [], "missions": []
}
```

- **Importar é mesclar**, com a função da sincronização (`data/merge.ts`): registros por união de id; documentos pelo `updatedAt` mais novo. Importar duas vezes não muda nada.
- Validação por Zod estrito, teto de 20 MB, `version` maior que a conhecida → recusa com mensagem.
- Não leva a key nem `meta` nem `session`.
- "Substituir tudo" não existe; existe "Apagar os dados deste aparelho", à parte, com confirmação.

### 4.2 Supabase (fase 5)

**Ideia:** o servidor é um cofre de sincronização. Ele guarda, separa por usuário e limita tamanho; quem entende o conteúdo é o cliente.

| Tabela | Colunas | Uso |
| --- | --- | --- |
| `profiles` | `user_id` PK → `auth.users` (cascade), `nickname` (único, 3–20), `created_at` | O apelido público dos cenários |
| `sync_docs` | `user_id`, `doc_id`, `v`, `data jsonb`, `updated_at` (cliente), `deleted`, `server_at`; PK (`user_id`, `doc_id`) | Perfil, preferências, avatar, cards, memória de NPC, missões salvas |
| `sync_events` | `user_id`, `id`, `kind` (`ledger`/`review`/`run`), `at`, `data jsonb`, `server_at`; PK (`user_id`, `id`) | Tudo que é só de acréscimo |
| `sync_usage` | `user_id` PK, `docs`, `events` | Contadores para a cota |
| `scenarios` | ver abaixo | Cenários públicos (fase 7) |
| `scenario_plays`, `scenario_reports` | ver abaixo | Jogadas e denúncias (fase 7) |

**RLS (esboço):**

```sql
-- sync_docs: cada um vê e escreve só o que é seu. Sem DELETE (apagar = deleted true).
create policy docs_select on sync_docs for select using (user_id = (select auth.uid()));
create policy docs_insert on sync_docs for insert with check (user_id = (select auth.uid()));
create policy docs_update on sync_docs for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- sync_events: só SELECT e INSERT. Nada de UPDATE nem DELETE.
create policy ev_select on sync_events for select using (user_id = (select auth.uid()));
create policy ev_insert on sync_events for insert with check (user_id = (select auth.uid()));
```

**Gatilhos (o cliente não consegue burlar):**

| Gatilho | O que faz |
| --- | --- |
| Carimbo | `server_at = clock_timestamp()` em todo insert/update |
| Último a escrever vence | Em `sync_docs`, update com `updated_at` menor ou igual ao gravado é ignorado. `updated_at` mais de 5 min no futuro é cortado para agora (relógio errado não vence para sempre) |
| Tamanho | `data` até 32 KB em documento e 8 KB em registro |
| Cota | Por usuário: 20.000 documentos e 50.000 registros (ajustar). Passou: erro claro, o app avisa e segue local |
| Conta apagada | `on delete cascade` em tudo. `delete_my_account()` (`security definer`) apaga a linha de `auth.users` do próprio usuário. Sem Edge Function |

**Protocolo:**

| Passo | Como |
| --- | --- |
| Quando | Ao abrir, ao terminar a sessão, ao voltar a ficar online e no botão "Sincronizar agora". Sem tempo real |
| 1. Puxar | Linhas com `server_at` > cursor − 30 s, em ordem, em páginas de 1.000. A sobreposição cobre gravação fora de ordem; aplicar duas vezes não muda nada |
| 2. Aplicar | `data/merge.ts`: união para registros, mais novo para documentos |
| 3. Recalcular | Derivados e cards tocados |
| 4. Enviar | `dirty = 1` e `synced = 0`, em lotes de 500. Registros: insert ignorando duplicado. Documentos: upsert (o gatilho decide) |
| 5. Marcar | Zera `dirty`/`synced` do que foi aceito; guarda o cursor em `meta` |
| Primeiro login | Tudo que é local está marcado para envio; se a conta já tem dados, vira união |
| Falha (offline, projeto pausado, cota) | Estado "sincronização indisponível", nova tentativa com espera crescente. O jogo nunca espera pela rede |

**Cenários públicos (fase 7):**

| Item | Desenho |
| --- | --- |
| `scenarios` | `id`, `author_id` (cascade), `author_nick`, `base`, `target`, `level`, `location`, `title`, `theme`, `mission jsonb` (≤ 32 KB), `schema`, `content_hash` (único), `status` (`pending`/`published`/`rejected`/`removed`), `plays`, `created_at`, `published_at` |
| Ler | Qualquer um lê `status = 'published'`. O autor lê os próprios em qualquer estado |
| Enviar | Só logado; `with check (author_id = auth.uid() and status = 'pending' and plays = 0)`. Sem política de UPDATE: ninguém muda o status pelo site. O autor pode apagar o próprio |
| Limites | Até 5 pendentes e 10 envios por dia por usuário (gatilho) |
| Validar | No cliente ao enviar; **de novo, em modo estrito**, no script de moderação; e outra vez no cliente de quem baixa. O servidor nunca é a única barreira |
| Moderar | `scripts/moderation/` na máquina do autor, com a chave de serviço no `.env`. Sem tela de administrador no site |
| Jogadas | `scenario_plays (user_id, scenario_id)` PK, só insert, só logado; gatilho soma em `plays`. Jogada anônima não conta |
| Denúncias | `scenario_reports`, só logado, uma por usuário e cenário; 3 denúncias devolvem o cenário para `pending` |
| Catálogo | Lista sem a coluna `mission`, paginada, índice por (`target`, `base`, `level`, `published_at`) |

**Pontos em aberto para o Arquiteto:**
- **Tabelas genéricas × tipadas.** O prompt do Backend lista "perfil, progresso, Grimório, conquistas, avatar e preferências" como tabelas. Proponho as duas genéricas: menos migrations, RLS trivial e o formato evolui no cliente. O que se perde é consulta por campo no servidor, que não usamos (sem analytics).
- **Login por e-mail:** código ou link mágico, sem senha.
- **Ping semanal:** vale, sabendo que o GitHub desliga o agendamento com o repositório parado por 60 dias.

---

## 5. Modelo de conteúdo

### 5.1 Missão v1

**O que muda em relação ao rascunho da SPEC:**

| Rascunho | v1 | Por quê |
| --- | --- | --- |
| Chaves em português (`falas`, `opcoes`) | Chaves em inglês (`nodes`, `replies`) | Código e contribuições em inglês; a interface é bilíngue. As mensagens de erro citam o caminho real (`nodes[3].text`) |
| `idioma` | `base` + `target` | Par completo |
| `proxima` obrigatória | `next` **opcional**; sem ela, segue para a próxima fala da lista; a última encerra | IA grátis erra referência. A fábrica pede missão linear, sem `next` |
| `correta: true/false` | `flawed: true` só na opção com erro | Menos campo, mesma informação |
| `feedback` mostrado na hora | `note` (ou `pattern` do catálogo) só no relatório | Princípio 5 |
| `recast` como texto | `recast: { original, corrected }` + `reaction` (fala curta da NPC para aquela resposta) | A NPC reage a cada resposta sem duplicar nós. `corrected` aparece literal dentro de `reaction.text`, e o app destaca, como no modo completo |
| — | `keywords` | Casar a fala ou o texto digitado |
| — | `listen` | Princípio 1 |
| — | `closing` obrigatório | Princípio 2 |
| — | `kind`: `encounter` ou `boss` | Chefe começa sem ajuda |

**Exemplo (padaria da versão comercial, convertida e resumida):**

```json
{
  "schema": 1,
  "id": "bakery-01",
  "base": "pt-BR",
  "target": "en",
  "level": "A1",
  "kind": "encounter",
  "title": "Pão quentinho",
  "theme": "Comprar pão na padaria",
  "location": "bakery",
  "can_do": "Consigo pedir comida e dizer quantos quero.",
  "description": "De manhã cedo, na padaria da Tilda. O pão acabou de sair do forno.",
  "characters": [
    { "id": "tilda", "name": "Tilda", "personality": "calorosa, rápida, orgulhosa do próprio pão", "npc": "tilda" },
    { "id": "ben", "name": "Ben", "personality": "freguês apressado" }
  ],
  "listen": [
    { "speaker": "ben", "text": "Can I have two rolls, please?", "translation": "Pode me dar dois pãezinhos, por favor?" },
    { "speaker": "tilda", "text": "Two rolls. Here you go!", "translation": "Dois pãezinhos. Aqui está!" }
  ],
  "nodes": [
    {
      "id": "order",
      "speaker": "tilda",
      "text": "Good morning! Fresh bread today. What would you like?",
      "translation": "Bom dia! Pão fresquinho hoje. O que você vai querer?",
      "emotion": "happy",
      "replies": [
        {
          "text": "A honey roll, please.",
          "translation": "Um pão de mel, por favor.",
          "keywords": [["honey"]],
          "reaction": { "text": "Lovely! My new honey rolls.", "translation": "Que bom! Meus pães de mel novos." }
        },
        {
          "text": "I want two breads.",
          "translation": "Quero dois pães.",
          "flawed": true,
          "keywords": [["breads"], ["a bread"]],
          "recast": { "original": "two breads", "corrected": "Two loaves of bread" },
          "reaction": { "text": "Two loaves of bread? Sure!", "translation": "Dois pães? Claro!" },
          "pattern": "en.uncountable_noun"
        }
      ]
    }
  ],
  "closing": {
    "question": { "text": "Oh, one more thing, dear! What would you like tomorrow?", "translation": "Ah, mais uma coisa! O que você vai querer amanhã?" },
    "accept": { "all_of": [["honey", "cheese", "roll", "rolls", "bread", "loaf", "pie"]], "min_words": 2 },
    "hint": "Diga algo do cardápio, por exemplo com \"I'd like...\".",
    "model_answer": { "text": "I'd like two cheese rolls, please.", "translation": "Eu queria dois pães de queijo, por favor." },
    "success": { "text": "Lovely! See you tomorrow, dear!", "translation": "Que bom! Até amanhã!" }
  },
  "vocabulary": [
    { "term": "a loaf of bread", "translation": "um pão inteiro", "example": "A loaf of bread, please." }
  ]
}
```

**Campos e limites** (objeto estrito; enums fechados):

| Campo | Regra |
| --- | --- |
| `schema` | `1` |
| `id` | Embutida: slug único. Fábrica e IA: o **app** gera (`local:<uuid>`); o que a IA mandar é ignorado |
| `base`, `target` | Enum de idiomas; diferentes entre si |
| `level` | `A1`…`C2` |
| `kind` | `encounter` (padrão) ou `boss` |
| `title`, `theme`, `can_do` | até 80 / 120 / 160 caracteres, no idioma base |
| `description` | até 300 |
| `location` | Enum dos locais da vila |
| `characters` | 1–4; `npc` opcional, do enum de NPCs (sem ele, o app usa uma figura genérica do local) |
| `listen` | 0–6 falas; recomendado sempre, exigido nas embutidas de A1–A2 |
| `nodes` | 2–20; `text` e `translation` até 300; `emotion` do enum (padrão `neutral`) |
| `replies` | 1–3 por fala; pelo menos uma sem `flawed` |
| `keywords` | Lista de alternativas; cada alternativa é uma lista de palavras ou expressões que têm de aparecer todas. Obrigatório nas embutidas; opcional na fábrica |
| `reaction` | Opcional; obrigatória quando `flawed` |
| `recast` | Só com `flawed`; `original` e `corrected` até 200 |
| `note` / `pattern` | Opcionais; `note` até 200, no idioma base; `pattern` é id do catálogo |
| `next` | Opcional; id de fala **posterior** |
| `closing` | Obrigatório |
| `vocabulary` | 0–20; `term` 60, `translation` 80, `example` 160 |
| `romanization` | Opcional em falas, respostas e vocabulário (japonês e chinês) |
| `ai` | Opcional, fase 6: `situation`, `npc_intent`, `facts[]`, `goals[]`, `max_turns` (vem da cena antiga). Campo opcional novo não sobe `schema` |

**Conferências além do Zod** (`mission.check.ts`; valem para embutida, colada e baixada):
1. Ids de fala únicos; `next` existe e aponta para a frente (sem ciclo).
2. Todo caminho chega ao fim.
3. O texto de cada resposta casa com ela mesma, sem empate com as irmãs.
4. Com `flawed`: `recast.original` está no texto da resposta e `recast.corrected` está em `reaction.text`.
5. `model_answer` passa no próprio `accept`.
6. `speaker` existe em `characters`.

**Casamento da resposta** (reaproveita `match.ts`, com dois ajustes):
- **Regra mantida:** normalizar; uma alternativa casa quando todas as suas palavras aparecem como palavras inteiras; pontos = palavras da maior alternativa que casou; vence quem tem mais pontos; empate ou nada → `null`.
- **Ajuste 1: normalização por idioma.** `normalize(texto, idioma)`. Hoje é só inglês (`[^a-z0-9]`, números por extenso em inglês). Na fase 2 só existe `en`, mas a assinatura já nasce certa.
- **Ajuste 2: sem `keywords`** (fábrica), o motor compara com as palavras de conteúdo do texto da opção: casa com 60% ou mais delas, e tem de ser a única melhor.
- **Com voz:** testar as alternativas do reconhecedor em ordem; fica a primeira que casar.
- **Sem tolerância a erro de digitação por enquanto:** "roll" e "rolls" estão a uma letra, e é essa letra que separa a resposta boa da com erro.
- **Não casou:** a NPC diz a fala `retry` da ficha dela; na segunda vez, a ajuda sobe um degrau sozinha. Nunca trava e nunca tira XP.

**Fecho:** a NPC faz a pergunta; a pessoa fala ou digita; `checkClosingAnswer` (um termo de cada grupo de `all_of` e pelo menos `min_words` palavras). Duas tentativas, com `hint` na segunda. Depois, mostra `model_answer` para repetir, sem travar. A frase da pessoa vai para o relatório ao lado do modelo.

**Fábrica (fase 4):** texto colado até 100 KB → extrair o maior objeto `{…}` equilibrado (ignora texto e cercas em volta) → `JSON.parse` (sem JSON5, sem `eval`) → remover e listar campos desconhecidos → Zod estrito → conferências 1–6 → erros num bloco copiável, com o caminho de cada um. Para publicar, campo desconhecido é erro.

### 5.2 NPC, local, tema e card

| Tipo | Arquivo | Campos |
| --- | --- | --- |
| Local | `content/world/locations.json` | `id` (enum), `order`, `npcs[]`. O nome é texto de interface (`i18n`: `place.bakery`). O sprite vem de uma tabela no código, indexada pelo id; **nunca de um caminho no JSON** |
| NPC | `content/npcs/<id>.json` | `schema`, `id`, `name`, `location`, `role`, `persona` (`summary`, `personality[]`, `speaking_style[]`, `world_details[]`, em inglês, para o prompt), `voice` (`lang`, `rate`, `pitch`), `lines.<alvo>` (`retry`, `contingency`) |
| Catálogo de erros | `content/patterns/<par>.json` | Como o antigo: `id` (`en.uncountable_noun`), `cefr`, `title`, `explanation`, `example` |
| Unidade (fase 3) | `content/units/<par>/<id>.json` | `id`, `level`, `title`, `can_do[]`, `missions[]` |
| Tema (fase 4) | `content/themes/<base>.json` | `schema`, `base`, `themes[]`: `id`, `text` (até 120), `levels[]`, `location` |
| Card | `VocabItem` em `src/schemas/vocab.ts` | `term`, `translation`, `example`, `romanization?`. O card local acrescenta alvo, origem e estado de revisão (4.1) |

### 5.3 Como o conteúdo entra no build

| Pergunta | Resposta |
| --- | --- |
| `import` ou `fetch`? | **`import`**, com `import.meta.glob('/content/missions/**/*.json')` preguiçoso. Cada missão vira um pedaço com hash no nome: cache eterno, entra no precache e não precisa de `connect-src` |
| E os catálogos pequenos? | `world`, `npcs` e `units`: importação direta. `patterns` e `themes`: por par, sob demanda |
| Índice | `scripts/content/build-index.ts` valida tudo e gera `src/catalog/generated/index.json` (fora do git): por missão, `id`, par, nível, unidade, `kind`, `title`, `location`, `can_do`. Roda em `predev`, `prebuild` e `pretest` |
| Como o app consulta | `catalog.list({ base, target, level?, location? })` (índice) e `catalog.load(id)` (pedaço) |
| Valida de novo ao carregar? | Sim, com a mesma `parseMission` da fábrica. Um caminho só para toda missão |
| O que nunca entra no bundle | `content/eval/` e `content/prompts/` de fases que ainda não chegaram |
| Fábrica, IA e catálogo público | Ficam na tabela `missions` do Dexie, já validadas. Mesmo tipo `Mission` |

Na fase 1 não há missão: o `catalog` só tem `world` e `npcs`. O índice chega na fase 2.

### 5.4 Contrato do turno (modo completo, fase 6)

Vem do `NpcTurnModelOutput` antigo, mais enxuto. **A ordem faz parte do contrato:**

| # | Chave | Tipo | Observação |
| --- | --- | --- | --- |
| 1 | `understood` | boolean | `false` → NPC pede para repetir; sem recast, sem erros, sem metas |
| 2 | `recast` | `{ original, corrected }` ou `null` | No máximo um por fala. Decidido **antes** da fala |
| 3 | `npc_reply` | string, até 400 | Idioma-alvo. Contém `recast.corrected` literal. Teto por nível aplicado pelo app (A1 80, A2 120, B1 160, B2+ 220) |
| 4 | `emotion` | enum | `neutral`, `happy`, `curious`, `confused`, `surprised`, `sad`, `proud` |
| 5 | `goals_met` | ids, até 6 | Só as metas cumpridas **neste** turno; o app acumula e calcula o progresso |
| 6 | `errors` | até 3 | `type` (enum antigo), `pattern` (catálogo ou `other`), `original`, `corrected`, `explanation` (idioma base, até 200), `severity` 1–3 |
| 7 | `new_vocab` | até 2 | `term`, `translation`, `example` |
| 8 | `hint` | string até 160 ou `null` | Idioma base; só quando não entendeu ou a pessoa travou |
| 9 | `flag` | enum | `none`, `off_topic`, `personal_data`, `sensitive`, `abuse` |

**Saiu em relação ao antigo:** `confidence` e `estimated_level` (modelo fraco inventa número), o aninhamento `evaluation`, e tudo que era do servidor (cotas, planos, áudio).

**Conferências de sentido no app** (protegem de modelo fraco):
- `recast.original` não aparece na fala do jogador (normalizada) → descarta o recast e o erro correspondente.
- `recast.corrected` não aparece em `npc_reply` → mantém o recast, sem destaque.
- `goals_met` com id que não está aberto → ignora o id.
- `understood: false` com recast ou erros → ignora os dois.
- Erro em fala por voz entra no relatório como "talvez" e só vira card do Grimório na segunda vez do mesmo padrão.
- `flag: sensitive` → mostra o cartão de ajuda (texto fixo no i18n), sem encerrar a conversa.

O schema Zod gera o JSON Schema (`z.toJSONSchema`) usado na saída estruturada e no exemplo do prompt: uma fonte só.

### 5.5 O que vem do arquivo comercial

| Peça | Vai para | Fase | Adaptação |
| --- | --- | --- | --- |
| `match.ts` e os testes dele | `src/schemas/match.ts` | 2 | Normalização por idioma; casamento sem `keywords` |
| `scripted/` + `closing/` da padaria | `content/missions/pt-BR_en/A1/bakery-01.json` | 2 | Converter para a v1 (vira ~6 falas lineares com reações) e acrescentar `listen` |
| `npcs/tilda.json` | `content/npcs/tilda.json` | 1–2 | Tirar a voz Azure; `fixed_lines` vira `lines.en` |
| `error-patterns.json` | `content/patterns/pt-BR_en.json` | 2 | Direto; alimenta `pattern` das opções com erro e o relatório |
| `units/a1-01.json` | `content/units/pt-BR_en/a1-01.json` | 3 | Metas "consigo..." |
| `scenes/a1-01-bakery.json` | Bloco `ai` da missão | 6 | `facts`, `goals` com critério, `npc_intent` |
| `prompts/npc-turn/v1` | `content/prompts/npc-turn/v1` | 6 | Tirar referências a servidor; acrescentar a instrução de formato para modelo sem JSON nativo |
| `conversation.ts` | `src/schemas/turn.ts` | 6 | Só a saída do modelo (5.4) |
| `goldsets/` + `gold-score.ts`, `testsets/` | `content/eval/`, `scripts/content/` | 6 | Vira o teste que escolhe os modelos recomendados |
| `stt-tests/` | `content/eval/` + tela `/settings/voice` | 2 (taxa de casamento), 6 (44 frases) | Rodar no navegador do celular |
| `support/pt-BR.json` | `i18n/` (cartão de ajuda) | 6 | Textos nos dois idiomas |
| F0-03 | Ideias | 3, 6 | Três camadas de avaliação do feitiço (conferência local, autoavaliação, IA **em lote**: uma chamada por revisão, não por card, o que poupa o limite de 50 por dia); frequência do recast; botão "não foi isso que eu disse" |
| Cotas, planos, anúncios, Play Integrity, Edge Functions | — | — | Não aproveitar |

---

## 6. Regras de jogo: só as interfaces

Os números (curva de XP, títulos, desbloqueios, preços, congelamentos) são da chamada nº 2. O motor só precisa disto:

```ts
type InputMode = 'voice' | 'typed' | 'tap';
type Scaffold = 0 | 1 | 2 | 3;        // 0 sem ajuda · 1 ideia no idioma base · 2 frase à vista · 3 tocou

type XpSource =
  | { kind: 'reply'; input: InputMode; scaffold: Scaffold; flawed: boolean; attempt: number }
  | { kind: 'closing'; input: InputMode; accepted: boolean; usedModelAnswer: boolean }
  | { kind: 'mission'; missionKind: 'encounter' | 'boss'; level: Cefr; firstTime: boolean; mastery: number }
  | { kind: 'spell'; input: InputMode; grade: 'again' | 'hard' | 'good' | 'easy'; gradedBy: 'local' | 'self' | 'ai' }
  | { kind: 'daily_complete' }
  | { kind: 'achievement'; id: string };

interface GameRules {
  readonly version: number;
  xpFor(source: XpSource): number;                 // sempre ≥ 0
  coinsFor(source: XpSource): number;              // sempre ≥ 0
  levelAt(totalXp: number): { level: number; into: number; toNext: number; title: TitleId };
  unlocksAt(level: number): Unlock[];              // locais, itens, NPCs
  masteryOf(runs: RunSummary[]): number;           // degrau de domínio da missão
  streak(activeDays: string[], freezesEarned: string[], today: string): { current: number; best: number; freezesLeft: number; frozenDays: string[] };
  achievements: { id: string; check(stats: Stats): boolean }[];
}

interface Scheduler {                               // SM-2 na fase 3; FSRS depois, atrás da mesma interface
  next(state: CardState | null, grade: 'again' | 'hard' | 'good' | 'easy', at: number): CardState;
}

function deriveProgress(events: GameEvent[], rules: GameRules, today: string): Progress;   // xp, moedas, nível, título, ofensiva, desbloqueios, conquistas
```

- O motor recebe `rules` por parâmetro. Na fase 1 existe um `rules.v0` de enfeite (nível 1, barra vazia).
- **Congelamento não é evento "gasto":** é derivado (dia sem jogo consome um, se houver). Dois aparelhos chegam ao mesmo resultado.
- **Guardas para o Revisor** (`tests/pedagogy/`), verdadeiras para quaisquer números:
  1. `xpFor` e `coinsFor` nunca são negativos (sem punição).
  2. Mesma resposta: voz ou digitado dá mais que toque; menos ajuda nunca dá menos (esforço).
  3. Resposta `flawed` avança a conversa e não tira nada do que já foi ganho.
  4. A ofensiva nunca cai por erro, só por dia sem jogo e sem congelamento.
  5. Só `purchase` tem moeda negativa.
  6. Nenhuma fonte de XP depende de tempo de resposta.

---

## 7. Testes, CI e deploy

**Camadas de teste:**

| Camada | Ferramenta | Onde | O que cobre |
| --- | --- | --- | --- |
| Unidade pura | Vitest, ambiente `node` | ao lado do código | `schemas/` (schema, casamento, grafo, extração do JSON colado), `engine/` (rodada, XP, nível, ofensiva, agendador) |
| Dados | Vitest + `fake-indexeddb` | `src/data/` | Repositórios, migrações, mescla, exportar/importar (ida e volta; importar duas vezes; arquivos de versões antigas) |
| Componentes | Vitest + Testing Library (jsdom) | `src/ui/` | Poucos: seletor de idioma, formulário da key, player |
| e2e | Playwright, Chromium com viewport de celular (Pixel 7) | `tests/e2e/` | **Vale a pena, mas pequeno.** CSP, Trusted Types, service worker e offline não existem no jsdom. WebKit com viewport de iPhone: só local, antes de fechar fase |
| Acessibilidade | `@axe-core/playwright` | `tests/a11y/` | Cada rota sem violação grave; foco ao trocar de rota; `prefers-reduced-motion` |

**Testes de segurança** (`tests/security/`):

| Teste | Como |
| --- | --- |
| CSP — arquivo | Lê `public/_headers` e compara, diretiva por diretiva, com a lista esperada no próprio teste. Falha com `'unsafe-inline'`, `'unsafe-eval'`, `*`, `data:`, `http:`. Mudar a CSP obriga a mudar o teste, e o Revisor vê |
| CSP — provedores | Toda `origin` de `src/ai/providers/*` está no `connect-src`, e não há origem sobrando |
| CSP — build | Varre `dist/`: nenhum `<script>` sem `src`, nenhum `<style>` ou `style=` no HTML, nenhuma URL `http(s)://` nos JS fora de uma lista conhecida (ex.: o endereço de erros do React, que é só texto) |
| CSP — navegador (e2e) | Abre cada rota no preview com os cabeçalhos e exige zero `securitypolicyviolation` e zero erro no console. Depois tenta de propósito: `fetch` para fora (bloqueado), `eval` (bloqueado), `innerHTML` (erro) |
| CSP — produção | No fim do deploy: busca os cabeçalhos da URL real e compara com o arquivo; `version.json` tem de trazer o commit publicado |
| Key (fase 6) | e2e com key falsa e provedor simulado (`page.route`): a string só aparece em pedido para a origem do provedor; não está em `localStorage` sem "lembrar"; não está no IndexedDB, na exportação nem na URL; some com "Apagar minha key" |
| Injeção (fase 4) | Missão colada com `<script>`, `<img onerror>`, `javascript:` e campos extras: aparece como texto ou é recusada |

**i18n** (`tests/i18n/`): mesmas chaves nos dois arquivos; mesmos marcadores (`{n}`) por chave; nenhum valor vazio; plural com `one` e `other`. Somam-se o lint de texto solto no JSX e as chaves tipadas.

**GitHub Actions** (`ci.yml`, em PR e em push na `main`):

| Job | Passos |
| --- | --- |
| `check` | `npm ci` → typecheck → lint → Vitest → build → varredura do `dist/` |
| `e2e` | Chromium do Playwright → `vite preview` → e2e + segurança + acessibilidade |
| `deploy` | Só na `main`, depois dos dois: ambiente `production` → `wrangler pages deploy dist` → conferência dos cabeçalhos e do `version.json` |
| `release` (em tag `v*`) | Build → zip do `dist/` → atestado de procedência → Release |

**Cuidados do pipeline:**
- Actions fixadas por SHA; `permissions: contents: read` por padrão.
- Segredos só no ambiente `production`. Nunca `pull_request_target`. PR de fork roda `check` e `e2e` sem segredo.
- `.npmrc` com `ignore-scripts=true` (confirmar no W1-01 que o build passa); Dependabot semanal, agrupado.
- Node pela `.nvmrc`.

**Cloudflare Pages:**
- Projeto do tipo **Direct Upload** (sem integração Git): o deploy só acontece pelo Actions, como pede a SPEC.
- Token com uma única permissão (Cloudflare Pages: editar), em `CLOUDFLARE_API_TOKEN`, mais `CLOUDFLARE_ACCOUNT_ID`.
- Web Analytics desligado.

---

## 8. Fase 1 em tarefas

Alvo: estrutura, CSP, deploy automático, mapa da vila com 1 local, perfil local. Ordem: 01 → 02, 03, 05 em paralelo → 04, 06 → 07 → 08, 09 → 10, 11 → 12 → 13 → 14.

| ID | Dono | Tarefa | Critério de pronto | Testes esperados |
| --- | --- | --- | --- | --- |
| W1-01 | Arquiteto | **Esqueleto.** `package.json`, lockfile, `.nvmrc`, `.npmrc`, TS estrito, Vite + React, ESLint (fronteiras da 2.1, sem texto solto no JSX, sem `dangerouslySetInnerHTML`, sem `eval`), pastas da seção 3 com um `README.md` curto em cada, `index.html` sem script inline, `i18n/` com 3 chaves, `src/schemas/lang.ts` e `world.ts`, `content/world/locations.json` com 1 local, `SECURITY.md` | `git clone` → `npm ci` → `dev`, `build`, `test`, `lint` e `typecheck` passam. Só as dependências da seção 3 | Um teste de fumaça; lint acusa uma importação proibida de exemplo |
| W1-02 | App | **CI.** `ci.yml` com `check`; Actions por SHA; permissões mínimas; Dependabot | PR mostra o resultado; erro de tipo, lint ou teste derruba | O próprio pipeline |
| W1-03 | App | **Cabeçalhos.** `public/_headers` igual à 2.8; `vite preview` aplica o bloco `/*`; `assetsInlineLimit: 0`; `z.config({ jitless: true })` no início do `main.tsx` | No preview, o DevTools mostra a CSP inteira e o console fica limpo | Unidade para o leitor do `_headers` |
| W1-04 | Revisor | **Testes da CSP.** Playwright (Chromium, Pixel 7); os testes "arquivo", "build" e "navegador" da seção 7; job `e2e` no CI | Tirar uma diretiva ou pôr um script inline faz o CI falhar | Os três testes, com os casos negativos (`fetch` externo, `eval`, `innerHTML`) |
| W1-05 | App | **i18n.** `src/i18n/`: `t()`, chaves tipadas, plural, detecção, `<html lang>`, componente seletor | Trocar o idioma muda a tela na hora e persiste | Unidade: interpolação, plural, detecção (`pt-PT` → `pt-BR`; `fr` → `en`) |
| W1-06 | Revisor | **Guardas de i18n.** Paridade de chaves e marcadores; valor vazio; plural | Apagar uma chave de um idioma derruba o CI | `tests/i18n/` |
| W1-07 | App | **Dados locais v1.** Dexie com `meta` e `docs`; repositórios de `profile`, `prefs` e `avatar`; `deviceId`; abertura do banco antes da primeira tela | Perfil sobrevive a recarregar e a fechar o navegador | Vitest + `fake-indexeddb`: criar, ler, alterar (`updatedAt` sobe, `dirty` vira 1) |
| W1-08 | App | **Casca e rotas.** React Router; layout com navegação inferior; `/`, `/welcome`, `/place/:id`, `/profile`, `/settings`, `/about`, 404; carregamento sob demanda; erro com tela amigável; foco no título ao trocar de rota; `/about` mostra versão e commit | Navegação por toque e por teclado; voltar do Android funciona; 360×640 sem rolagem lateral | Componente: rota desconhecida cai no 404. e2e: fumaça por todas as rotas |
| W1-09 | App | **Exportar/importar v1.** Formato da 4.1 (só `docs` por enquanto); `data/merge.ts`; "Apagar os dados deste aparelho" com confirmação | Exportar num navegador e importar em outro recupera o perfil; arquivo inválido dá mensagem clara | Ida e volta; importar duas vezes; arquivo de versão futura recusado; `tests/fixtures/export-v1.json` |
| W1-10 | App | **Primeira visita e perfil.** `/welcome`: idioma (já detectado), apelido opcional. `/profile`: apelido, avatar entre 4 figuras, idioma da interface, idioma base. `/settings`: reduzir movimento, sons, tamanho do texto | Tudo persiste; texto escala sem quebrar a tela; preferência de movimento do sistema é respeitada | Componente: salvar perfil. e2e: primeira visita completa |
| W1-11 | App | **Mapa da vila com 1 local.** DOM + CSS, arte CC0 provisória com `CREDITS.md`, `image-rendering: pixelated`; a padaria é um botão com rótulo; barra de XP (nível 1) de enfeite; `/place/bakery` mostra a Tilda e "missões em breve" | Bonito e legível no celular do dono; leitor de tela anuncia o local; nenhuma imagem de fora | e2e: tocar no local abre a tela |
| W1-12 | App | **PWA.** Manifesto, ícones, `vite-plugin-pwa` (`generateSW`, `injectRegister: false`), `sw-register.ts` com a política `glifora-sw`, aviso de versão nova, `Cache-Control` no `_headers` | Instala na tela inicial do Android; abre em modo avião depois da primeira visita; nenhuma violação de CSP ao registrar | e2e: recarregar offline; registro sem violação (é aqui que o **[provar no teste]** do Trusted Types se resolve) |
| W1-13 | App | **Deploy.** Job `deploy` (wrangler, ambiente `production`), `version.json` com o commit, conferência dos cabeçalhos na URL real. Depende do dono: conta, projeto Direct Upload e token (D-39) | Push na `main` publica sozinho; a URL abre no celular; o DevTools mostra a CSP do arquivo | A conferência pós-deploy |
| W1-14 | Revisor | **Revisão da fase.** Acessibilidade em todas as rotas (axe), segurança contra a seção 1.2 C, princípios da SPEC, README "como rodar", roteiro de teste no celular para o dono | Lista de problemas zerada ou aceita pelo Arquiteto | `tests/a11y/`; o roteiro manual |

**Observações para o W0-05:**
- **W1-09 puxa o exportar/importar da fase 5 para a 1.** Com uma tabela só, é pequeno, fixa o formato versionado e é o backup do dono enquanto o schema muda. Se o Arquiteto preferir manter a fase 1 enxuta, vai para o início da fase 2; depois disso fica caro.
- **Nada de IA, key, Supabase ou voz na fase 1.** A CSP da fase 1 tem `connect-src 'self'` e isso é testado.
- **O dono faz à mão:** conta no Cloudflare, projeto, token, segredos no GitHub (ambiente `production`), repositório público.

---

## 9. Riscos e pontos para o dono decidir

| # | Risco | Decisão pedida | Recomendo |
| --- | --- | --- | --- |
| 1 | **Conteúdo acaba rápido.** 5 missões não sustentam o portão da fase 2 ("quero voltar amanhã") nem a missão diária da fase 3 (4 conversas por dia) | Aceitar **níveis de domínio** (rejogar a mesma missão com menos ajuda) como parte do núcleo já na fase 2? | Sim. Se ainda faltar variedade no portão, subir a fábrica (fase 4) antes da progressão (fase 3) |
| 2 | **O formato da missão muda em relação ao rascunho da SPEC:** chaves em inglês, sequência linear com reação por resposta, escuta inicial e fecho obrigatório | Aprovar o formato da seção 5.1? | Sim. É o que deixa a fábrica funcionar com IA grátis e cumpre os princípios 1, 2 e 5 sem IA |
| 3 | **iOS.** O Safari apaga os dados locais de site não instalado depois de 7 dias sem uso, e o reconhecimento de voz costuma falhar em PWA instalada no iPhone | Qual é o aparelho-alvo dos testes de fim de fase? | Android + Chrome como alvo. No iOS: funciona com texto, com convite para instalar e lembrete de exportar ou entrar |
| 4 | **Licenças.** MIT cobre só o código. Faltam a de `content/` e a dos cenários que a comunidade publicar | Qual licença para o conteúdo e para os cenários enviados? | `content/` em CC BY-SA 4.0 (decidir na fase 2). Cenário público: quem envia concorda com CC BY 4.0 na caixinha "Tornar público" (decidir antes da fase 7) |
| 5 | **Modo completo: modelo fraco ensina errado, e colar key no celular é ruim.** | (a) Mostrar uma lista curta de **modelos recomendados**, testados no conjunto-ouro, com aviso nos demais? (b) Oferecer "Entrar com OpenRouter" (OAuth, key criada para o app com limite de gasto) além de colar a key? | Sim nos dois, na fase 6. E o README diz com franqueza o que a CSP protege e o que não protege (1.2 C) |

---

## Fontes

- OpenRouter — limites dos modelos grátis e `GET /api/v1/key`: <https://openrouter.ai/docs/api/reference/limits>
- OpenRouter — OAuth PKCE: <https://openrouter.ai/docs/guides/overview/auth/oauth>
- OpenRouter — saída estruturada (`json_schema`, `require_parameters`): <https://openrouter.ai/docs/guides/features/structured-outputs>
- Anthropic — chamada direta do navegador (`anthropic-dangerous-direct-browser-access`): <https://platform.claude.com/docs/en/manage-claude/authentication>
- Anthropic — saída estruturada (`output_config.format`): <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>
- Cloudflare Pages — `_headers` (100 regras, 2.000 caracteres por linha, não vale para Functions): <https://developers.cloudflare.com/pages/configuration/headers/>
- MDN — `require-trusted-types-for` (disponível nos três motores desde fevereiro de 2026): <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for>
- Zod — teste do `jitless` (evita o `new Function` sob CSP): <https://unpkg.com/zod@4.4.3/src/v4/classic/tests/jitless-allows-eval.test.ts>

**Não consegui confirmar em documentação** (fica para o teste e2e do W1-12): que `navigator.serviceWorker.register` é tratado como destino de Trusted Types em todos os motores. O código detecta `window.trustedTypes` e funciona nos dois casos.
