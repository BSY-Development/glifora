# Segurança do Glifora

> **Estado: em construção (fase 1).** Este arquivo descreve o desenho aprovado (D-41), não o que já está no ar. A CSP e os outros cabeçalhos entram na W1-03; o CI, o Dependabot e as Actions fixadas por SHA na W1-02; o service worker e o `version.json` na W1-12 e na W1-13; a key só existe a partir da fase 6. Esta nota sai quando a fase 1 fechar, e cada item passa a valer quando a tarefa dele for aprovada.

## Como reportar uma vulnerabilidade

Use o relatório privado do GitHub (aba **Security → Report a vulnerability** deste repositório). Não abra issue pública para falha de segurança. Diga o que acontece, como reproduzir e o impacto.

## Sua key de IA

O modo completo (fase 6) usa a sua própria key (BYOK). O desenho é este:

- A key vai **direto do seu navegador ao provedor** (OpenRouter, Anthropic...). Não passa por servidor do Glifora nem pelo Supabase, nem criptografada.
- Por padrão a key fica **só na memória da aba** e some ao recarregar. Com "Lembrar neste aparelho", fica no `localStorage` deste site (veja em DevTools → Application → Local Storage). "Apagar minha key" a remove.
- A key nunca entra no banco local, na exportação, na sincronização, em log, em URL ou em relatório.
- O site publica uma Content-Security-Policy restritiva (sem scripts de terceiros, sem `eval`, conexões só para os provedores suportados e para o Supabase). Confira no DevTools → Network → cabeçalhos da página.

**Use uma key só para o Glifora, com limite de gasto.** É a proteção que funciona mesmo quando o resto falha.

## O que a CSP protege e o que não protege

| Ameaça | O que protege | O que não protege |
| --- | --- | --- |
| Conteúdo colado ou público com script | Tudo é renderizado como texto; Trusted Types; schemas estritos | — |
| Envio da key para outro site depois de um ataque | `connect-src` fechado; `form-action 'none'` | Navegação de página inteira com a key na URL. A CSP reduz o risco, não zera |
| Dependência npm comprometida | Poucas dependências, lockfile, `npm ci` com `ignore-scripts`, Dependabot | Código malicioso dentro do bundle roda como se fosse do site |
| Deploy adulterado | Deploy só pelo GitHub Actions, Actions fixadas por SHA, `version.json` com o commit publicado | Quem controla a publicação controla o JavaScript |
| Extensão do navegador maliciosa ou aparelho compartilhado | Nada no site | Use o limite de gasto e apague a key em aparelho de outra pessoa |

Detalhes: `docs/propostas/W0-03-arquitetura.md` §1.2 C e §2.7–2.8.
