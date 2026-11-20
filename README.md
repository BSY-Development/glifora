# Glifora

Jogo web open source (PWA, mobile-first) para aprender idiomas conversando com NPCs numa vila de fantasia em pixel art. Funciona sem cadastro e sem IA. Com a sua própria key de IA (BYOK), a conversa fica livre, e a key vai direto do navegador ao provedor, sem passar por servidor do projeto ([SECURITY.md](SECURITY.md)).

**Em construção:** fase 1 (fundação).

## Rodar local

Precisa do Node 22.13 ou mais novo (o projeto usa o da `.nvmrc`).

```sh
git clone <este repositório>
cd glifora
npm ci
npm run dev
```

| Comando | O quê |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (sem CSP: o Vite injeta script inline) |
| `npm run build` / `npm run preview` | Build de produção e prévia local |
| `npm run typecheck` / `npm run lint` / `npm test` | Tipos, lint (inclui as fronteiras entre camadas) e testes |
| `npm run check` | Tudo acima, na ordem do CI |

## Documentos

- Especificação: [docs/SPEC.md](docs/SPEC.md)
- Plano: [docs/PLAN.md](docs/PLAN.md) · Decisões: [docs/DECISIONS.md](docs/DECISIONS.md)
- Arquitetura: [docs/propostas/W0-03-arquitetura.md](docs/propostas/W0-03-arquitetura.md)

Licença: [MIT](LICENSE).
