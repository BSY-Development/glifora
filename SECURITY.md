# Segurança do Glifora

> **Estado (fase 1 concluída):** já estão no ar:
> - a CSP e os outros cabeçalhos (conferidos na URL real a cada deploy);
> - o CI com Actions fixadas por SHA e o Dependabot;
> - o service worker sem acesso a outra origem;
> - o `version.json` com o commit publicado.
>
> A key **ainda não existe**: a seção sobre ela descreve o desenho aprovado (D-41) para a fase 6.

## Como reportar uma vulnerabilidade

Use o relatório privado do GitHub (aba **Security → Report a vulnerability** deste repositório). Não abra issue pública para falha de segurança. Diga o que acontece, como reproduzir e o impacto.

## Sua key de IA

O modo completo (fase 6) usa a sua própria key (BYOK). O desenho é este:

- A key vai **direto do seu navegador ao provedor** (OpenRouter, Anthropic...). Não passa por servidor do Glifora nem pelo Supabase, nem criptografada.
- Por padrão a key fica **só na memória da aba** e some ao recarregar. Com "Lembrar neste aparelho", fica no `localStorage` deste site (veja em DevTools → Application → Local Storage). "Apagar minha key" a remove.
- A key nunca entra no banco local, na exportação, na sincronização, em log, em URL ou em relatório.
- O site publica uma Content-Security-Policy restritiva (sem scripts de terceiros, sem `eval`, conexões só para os provedores suportados e para o Supabase). Confira no DevTools → Network → cabeçalhos da página.

**Use uma key só para o Glifora, com limite de gasto.** É a proteção que funciona mesmo quando o resto falha.

## Privacidade e hospedagem

- **O jogo não manda nada para fora.** Perfil, progresso e preferências ficam no seu navegador (IndexedDB e `localStorage`). Só saem quando você exporta o arquivo. Não há analytics, anúncio nem rastreador. Os testes conferem que o app não faz pedido para outro site.
- **O Cloudflare hospeda o site.** Como qualquer hospedagem, ele recebe o seu IP e os pedidos dos arquivos do site.
- **Cabeçalhos que o Cloudflare acrescenta:**
  - `Report-To` e `NEL`: o navegador pode avisar o Cloudflare quando **falha** ao carregar um arquivo do site (`success_fraction` 0, ou seja, só falhas);
  - `Access-Control-Allow-Origin: *`: os arquivos do site, que já são públicos, podem ser lidos por outros sites.
  - Nenhum dos dois leva dado do jogo (D-46).

## O que a CSP protege e o que não protege

| Ameaça | O que protege | O que não protege |
| --- | --- | --- |
| Conteúdo colado ou público com script | Tudo é renderizado como texto; Trusted Types; schemas estritos | — |
| Envio da key para outro site depois de um ataque | `connect-src` fechado; `form-action 'none'` | Navegação de página inteira com a key na URL. A CSP reduz o risco, não zera |
| Dependência npm comprometida | Poucas dependências, lockfile, `npm ci` com `ignore-scripts`, Dependabot | Código malicioso dentro do bundle roda como se fosse do site |
| Deploy adulterado | Deploy só pelo GitHub Actions, Actions fixadas por SHA, `version.json` com o commit publicado | Quem controla a publicação controla o JavaScript |
| Extensão do navegador maliciosa ou aparelho compartilhado | Nada no site | Use o limite de gasto e apague a key em aparelho de outra pessoa |

Detalhes: `docs/propostas/W0-03-arquitetura.md` §1.2 C e §2.7–2.8.
