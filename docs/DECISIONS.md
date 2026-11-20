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

### D-39 — Hospedagem no Cloudflare Pages (2026-11-20) · aceita (dono)
- **Como:** site estático no Cloudflare Pages, com deploy só por GitHub Actions a partir do repositório público. A CSP e os outros cabeçalhos de segurança vão num arquivo `_headers`, como cabeçalho HTTP de verdade, verificável no DevTools.
- **Por quê:** o GitHub Pages não aceita cabeçalhos próprios. A CSP só iria por `<meta>`, sem `frame-ancestors` (clickjacking) e sem relatório de violação.
- **Na fase 1:** o dono cria a conta no Cloudflare e o token de deploy, que vira secret do GitHub Actions e nunca entra no chat nem no código. A URL inicial é `glifora.pages.dev`, ou outra se o nome estiver ocupado.

### D-40 — Inglês primeiro (2026-11-20) · aceita (dono)
- **Resolve a contradição da SPEC:** "Idiomas" punha inglês e espanhol no início, a fase 2 só falava de espanhol e a fase 9 punha o inglês "depois".
- **Como fica:** as missões demo da fase 2 são em **inglês A1–A2, base pt-BR**, e aproveitam o material da versão comercial (catálogo de erros do aluno brasileiro, conjunto-ouro, teste do STT, padaria). O espanhol vem logo depois, com base pt-BR e base inglês. A fase 8 começa pelo IELTS, como já estava. A interface é em pt-BR e inglês desde a fase 1.
