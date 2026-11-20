# tests — guardas do Revisor

Dono: **Revisor**. Teste de unidade fica ao lado do código, com o dono da pasta. Aqui ficam as guardas transversais:

| Pasta | O quê |
| --- | --- |
| `arch/` | Fronteiras entre camadas e atalhos inseguros barrados pelo lint |
| `security/` | CSP (arquivo, build, navegador), key, injeção |
| `i18n/` | Paridade de chaves e marcadores entre os idiomas |
| `a11y/` | Acessibilidade (axe) |
| `pedagogy/` | Guardas dos princípios (sem punição, esforço vale mais) |
| `e2e/` | Playwright, Chromium com viewport de celular |
| `fixtures/` | Arquivos de exemplo (exportação de cada versão) |

Referência: D-41 e W0-03 §7.
