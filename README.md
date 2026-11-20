# Glifora

Jogo web open source (PWA, mobile-first) para aprender idiomas conversando com NPCs numa vila de fantasia em pixel art. Funciona sem cadastro e sem IA. O modo completo chega na fase 6: com a sua própria key de IA (BYOK), ela vai direto do navegador ao provedor, sem passar por servidor do projeto ([SECURITY.md](SECURITY.md)).

**Estado:** fase 1 (fundação) concluída. Hoje existem a vila com a padaria, o perfil, os ajustes, exportar e importar o progresso e a instalação como app. As conversas chegam na fase 2.

Para jogar: **https://glifora.pages.dev**. No Android, abra no Chrome e use "Instalar app".

## Rodar local

Precisa do **Node 22.13 ou mais novo** e do npm que vem com ele. A `.nvmrc` aponta para o 26, que é a versão em que o projeto é testado. Funciona em Windows, macOS e Linux.

```sh
git clone https://github.com/BSY-Development/glifora.git
cd glifora
npm ci
npm run dev
```

Abra http://localhost:5173.

O `npm ci` pode avisar de "4 moderate severity vulnerabilities". São ferramentas que só rodam no build (via `vite-plugin-pwa`), já avaliadas e aceitas. O que vai para o site tem 0 (`npm audit --omit=dev`). **Não rode `npm audit fix --force`**: ele rebaixa o plugin e quebra o build.

| Comando | O quê |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173. **Sem CSP e sem service worker** (o Vite injeta script inline), então é mais frouxo que o site publicado |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` em http://localhost:4173 **com a CSP do `public/_headers`** e o PWA. É o que mais se parece com o site no ar. Rode depois do `build` |
| `npm run typecheck` / `npm run lint` / `npm test` | Tipos, lint (inclui as fronteiras entre camadas) e testes de unidade |
| `npm run check` | Tudo acima mais o build, na ordem do CI |
| `npm run test:e2e` | Testes no navegador (abaixo) |

### Testes no navegador (Playwright)

Cobrem a CSP, o service worker e o modo offline, a acessibilidade (axe) e os fluxos principais. Rodam no Chromium com tela de celular (Pixel 7). Eles constroem e sobem o `preview` sozinhos.

```sh
npx playwright install chromium   # uma vez
npm run test:e2e
```

Se você já tem o Chrome instalado, pode pular a instalação: `PW_CHANNEL=chrome npm run test:e2e`. No PowerShell: `$env:PW_CHANNEL="chrome"; npm run test:e2e`.

### Testar no celular

A instalação como app e o service worker só funcionam em HTTPS, ou em `localhost` no próprio computador. Para testar no celular, use o site publicado, https://glifora.pages.dev, e siga o [roteiro da fase 1](docs/roteiros/fase-1-celular.md).

## Documentos

- Especificação: [docs/SPEC.md](docs/SPEC.md)
- Plano: [docs/PLAN.md](docs/PLAN.md) · Decisões: [docs/DECISIONS.md](docs/DECISIONS.md)
- Arquitetura: [docs/propostas/W0-03-arquitetura.md](docs/propostas/W0-03-arquitetura.md)

## Licença

- **Código:** [GNU AGPL-3.0](LICENSE) (somente a versão 3). Você pode usar, estudar, modificar, redistribuir e até vender. Quem distribuir uma versão modificada, ou colocá-la no ar para outras pessoas usarem pela rede, precisa oferecer o código-fonte dela sob a mesma licença.
- **Conteúdo** (`content/`: missões, NPCs, textos do jogo): [CC BY-SA 4.0](content/LICENSE). Dê crédito e compartilhe pela mesma licença.
- **Nome e logo "Glifora":** não estão licenciados. Uma versão modificada precisa de outro nome.

Copyright (C) 2026 BSY-Development e colaboradores.
