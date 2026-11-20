# Proposta de README (W1-14) — para o Arquiteto aplicar

O README é do Arquiteto. Segui o texto atual do zero (clone do commit 119480a numa pasta limpa: `npm ci`, `npm run dev`, `npm run check`, `npm run build && npm run preview`). **Tudo funciona**; o que está errado ou falta:

1. `git clone <este repositório>` é um marcador: falta a URL real.
2. "Node 22.13 ou mais novo" convive com `.nvmrc` = 26. Quem tem o 22 não sabe se o projeto foi testado nele; o `engine-strict` recusa abaixo de 22.13.
3. `npm ci` imprime "4 moderate severity vulnerabilities" e sugere `npm audit fix --force`. Quem seguir o conselho rebaixa o `vite-plugin-pwa` e quebra o Vite 8. Precisa de uma nota.
4. Não diz a porta do `dev` (5173) nem a do `preview` (4173), nem que o `dev` não tem CSP nem service worker.
5. Não há nada sobre os testes no navegador (Playwright): `npx playwright install chromium` e `npx playwright test` (e o `PW_CHANNEL=chrome`, e como se escreve isso no PowerShell).
6. Não diz como testar no celular (precisa de HTTPS: o site publicado serve) nem aponta o roteiro.
7. A frase de abertura fala da key (BYOK) no presente; o modo completo só chega na fase 6. O README "não pode prometer mais do que a tabela" (W0-03 §1.2 C).
8. (Para o fechamento da fase) tirar "Em construção" do README e do `SECURITY.md` quando o Arquiteto aprovar a W1-14.

## Texto sugerido (substitui da abertura até o fim da seção "Rodar local")

````markdown
# Glifora

Jogo web open source (PWA, mobile-first) para aprender idiomas conversando com NPCs numa vila de fantasia em pixel art. Funciona sem cadastro e sem IA. Na fase 6 chega o modo completo, com a sua própria key de IA (BYOK): a key irá direto do navegador ao provedor, sem passar por servidor do projeto ([SECURITY.md](SECURITY.md)).

**Em construção:** fase 1 (fundação). Hoje existem a vila com a padaria, o perfil, os ajustes, exportar/importar o progresso e a instalação como app. As conversas chegam na fase 2.

Para jogar: **https://glifora.pages.dev** (no Android, abra no Chrome e use "Instalar app").

## Rodar local

Precisa do **Node 22.13 ou mais novo** (a `.nvmrc` aponta para o 26, que é a versão com que o projeto é testado) e do npm que vem com ele. Funciona em Windows, macOS e Linux.

```sh
git clone https://github.com/BSY-Development/glifora.git
cd glifora
npm ci
npm run dev
```

Abra http://localhost:5173. O `npm ci` pode avisar de "4 moderate severity vulnerabilities": são ferramentas que só rodam no build (via `vite-plugin-pwa`), já avaliadas e aceitas; o que vai para o site tem 0 (`npm audit --omit=dev`). **Não rode `npm audit fix --force`**: ele rebaixa o plugin e quebra o build.

| Comando | O quê |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173. **Sem CSP e sem service worker** (o Vite injeta script inline), então é mais frouxo que o site publicado |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em http://localhost:4173 **com a CSP do `public/_headers`** e o PWA: é o que mais se parece com o site no ar. Rode depois do `build` |
| `npm run typecheck` / `npm run lint` / `npm test` | Tipos, lint (inclui as fronteiras entre camadas) e testes de unidade |
| `npm run check` | Tudo acima mais o build, na ordem do CI |

### Testes no navegador (Playwright)

Cobrem a CSP, o service worker e o modo offline, a acessibilidade (axe) e os fluxos principais, em Chromium com tela de celular (Pixel 7). Eles constroem e sobem o `preview` sozinhos.

```sh
npx playwright install chromium   # uma vez
npx playwright test
```

Se você já tem o Chrome instalado, pode pular a instalação: `PW_CHANNEL=chrome npx playwright test` (no PowerShell: `$env:PW_CHANNEL="chrome"; npx playwright test`).

### Testar no celular

A instalação como app e o service worker só funcionam em HTTPS (ou em `localhost`, no próprio computador). Para testar no celular, use o site publicado, https://glifora.pages.dev, e siga o [roteiro da fase 1](docs/roteiros/fase-1-celular.md).
````

## Se preferir menos: o mínimo indispensável

Os itens 1, 3 e 5 (URL do clone, nota do `npm audit` e os comandos do Playwright). Um script `"test:e2e": "playwright test"` no `package.json` simplificaria o item 5 (é seu: não mexi).
