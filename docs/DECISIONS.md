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

---

### D-37 — Pivô: Glifora vira jogo web open source, sem monetização, com IA pela key do usuário (2026-11-20) · aceita (pedido do dono)
- **Pedido do dono (2026-11-20):** mudar todo o projeto conforme o documento `glifora-prompt-maestri.md`, salvo como `docs/SPEC.md` (a especificação) e `docs/EQUIPE.md` (a organização dos terminais e os prompts).
- **Como fica:** jogo **web**, PWA instalável e mobile-first (Vite + React + TypeScript), **open source** (MIT), **sem anúncios, sem assinatura, sem RevenueCat/AdMob, sem Expo**. Custo fixo zero ou perto disso: a IA é paga pelo próprio usuário (**BYOK**, chamada direto do navegador ao provedor) ou não é usada (modo demo e fábrica de cenários por copiar e colar). O Supabase (plano gratuito) serve só para conta opcional, sincronização e cenários públicos; **a key do usuário nunca vai para o Supabase**, nem criptografada.
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
- **Licença de `content/`:** proposta CC BY-SA 4.0 [W0-03 §9]. Decidir na fase 2, antes da primeira missão publicada.
- **Licença dos cenários públicos:** proposta CC BY 4.0, aceita por quem marca "Tornar público". Decidir antes da fase 7.
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
