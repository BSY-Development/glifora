# tests — guardas do Revisor

Dono: **Revisor**. Teste de unidade fica ao lado do código, com o dono da pasta. Aqui ficam as guardas transversais:

| Pasta | O quê |
| --- | --- |
| `arch/` | Fronteiras entre camadas e atalhos inseguros barrados pelo lint |
| `security/` | CSP (arquivo, build, navegador), ameaças de W0-03 §1.2 C (`threats-phase1`), key, injeção |
| `i18n/` | Paridade de chaves e marcadores entre os idiomas |
| `a11y/` | Acessibilidade: axe em todas as rotas (pt-BR/en, claro/escuro), foco ao trocar de rota, movimento, 360×640 com texto Muito grande |
| `pedagogy/` | Guardas dos princípios (sem punição, esforço vale mais) |
| `e2e/` | Playwright, Chromium com viewport de celular: CSP, PWA, primeira visita, privacidade e conteúdo hostil (`privacy`) |
| `fixtures/` | Arquivos de exemplo (exportação de cada versão) |

Referência: D-41 e W0-03 §7.

Rodar: `npm test` (unidade e guardas) e `npx playwright test` (navegador; `PW_CHANNEL=chrome` usa o Chrome instalado). Rota nova: entra em `ROUTES` de `e2e/csp.spec.ts` e de `a11y/routes.spec.ts`. Depois do build, `REQUIRE_DIST=1 npx vitest run tests/security` torna obrigatória a varredura do `dist/`.
