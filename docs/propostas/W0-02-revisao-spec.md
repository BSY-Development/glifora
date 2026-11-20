# W0-02 — Revisão crítica da SPEC (Arquiteto, 2026-11-20)

Revisão da `docs/SPEC.md` (versão open source) olhando quatro coisas: diversão, pedagogia, segurança da key e custo zero. As 4 perguntas ao dono estão no fim. O resto são recomendações que entram na arquitetura (W0-03), a não ser que o dono vete.

## O que está forte
- O custo zero é real: modo demo sem IA, fábrica por copiar e colar e BYOK. O projeto não tem nenhum servidor que pague IA.
- O jogo é útil sem cadastro: demo na primeira tela, dados locais, login só para sincronizar e publicar.
- Recast sem tela de erro, sem vidas e recompensa por esforço: os princípios estão claros e dá para testar cada um.
- A key nunca passa pelo projeto: o requisito é simples de verificar (CSP + DevTools) e bom para portfólio.

## Problemas e recomendações

1. **Os idiomas se contradizem** (pergunta 4). "Idiomas" põe inglês e espanhol no início, a fase 2 fala só de espanhol, a fase 9 põe o inglês "depois" e a fase 8 começa pelo IELTS, que é inglês.
2. **CSP e hospedagem** (pergunta 3). O GitHub Pages não deixa definir cabeçalhos HTTP, então a CSP só pode ir por `<meta>`. Assim ficam de fora `frame-ancestors` (proteção contra clickjacking) e o relatório de violação. O Cloudflare Pages aceita um arquivo `_headers` e continua com deploy por GitHub Actions e custo zero.
3. **Recuperação × árvore de opções no modo demo.**
   - **Problema:** sem IA, a missão em árvore é escolher uma opção, e o princípio 2 ("toda sessão termina com a pessoa falando ou escrevendo algo próprio") quebra.
   - **Recomendação:** o jogador **fala ou digita** a resposta, e o jogo casa com as opções no próprio aparelho (palavras-chave, tolerante ao reconhecimento de voz). Tocar na opção fica como ajuda e vale menos XP (princípio 7).
   - **Fecho:** toda missão termina com uma frase própria. A falada é conferida por palavras-chave; a escrita vai para o relatório. A versão comercial já tinha isso pronto (`matchScriptChoice`, `checkClosingAnswer`) e dá para reaproveitar.
4. **Fábrica: "rejeitar campos desconhecidos" × taxa de acerto das IAs grátis.**
   - **Problema:** as IAs grátis costumam acrescentar campos, e a rejeição estrita derruba boa parte das respostas.
   - **Recomendação:** ao colar, campo desconhecido é descartado com aviso e nunca é usado (a segurança é a mesma). A rejeição estrita vale para o que é publicado.
   - **Limite:** o texto colado tem tamanho máximo (ex.: 100 KB) antes de ir para o parser.
5. **O contrato da conversa não traz o que o relatório precisa.**
   - **Problema:** a SPEC diz "explicação detalhada só no relatório", mas o JSON do turno não traz os erros.
   - **Recomendação:**
     - `recast` vira `{ original, corrected }`, e o app calcula o trecho a destacar.
     - Entra `errors[]` (tipo, original, corrigido, explicação no idioma base), guardado para o relatório e para o Grimório.
     - A ordem das chaves fica fixa, para a fala do NPC aparecer enquanto o resto chega (streaming).
6. **Provedores.**
   - **Limite do OpenRouter grátis:** os modelos grátis aceitam poucos pedidos (por volta de 50 por dia sem crédito comprado e 20 por minuto). Uma sessão diária com 3 encontros e chefe gasta 30–40 chamadas, então a tela de configuração precisa avisar.
   - **Anthropic cedo:** recomendo o adaptador da Anthropic logo depois do OpenRouter. Ela aceita chamada direta do navegador com um cabeçalho próprio, e o autor já tem key.
   - **Voz do provedor:** o OpenRouter não faz voz. Com ele, a voz continua sendo a do navegador; voz do provedor só com OpenAI ou Gemini.
7. **O Supabase grátis pausa o projeto depois de 7 dias sem uso.**
   - O app já é local-first e tem que funcionar inteiro sem o Supabase, mostrando "sincronização indisponível" sem quebrar.
   - Opcional: um ping semanal por GitHub Actions.
8. **Sincronização.**
   - **Problema:** "último a escrever vence, por registro" perde revisões do Grimório feitas em dois aparelhos offline.
   - **Recomendação:** guardar as revisões como histórico que só cresce e recalcular o card a partir dele. O XP também é soma de eventos, não um número sobrescrito.
9. **A key no navegador.**
   - **Risco:** qualquer XSS lê a key, seja na memória ou guardada.
   - **Proteção:** CSP sem `'unsafe-inline'`, mais `require-trusted-types-for 'script'` como camada extra (Chrome/Android), sem nenhum HTML vindo de conteúdo.
   - **Padrão:** a key fica só na memória da aba. "Lembrar" é opção explícita, com aviso.
10. **Reconhecimento de voz do navegador.**
    - **Privacidade:** no Chrome, o reconhecimento manda o áudio para o Google, e a tela de privacidade precisa dizer isso.
    - **Erros consertados:** o reconhecedor tende a "consertar" o erro do aluno ("She have" vira "She has"), e aí o recast por voz não aparece. O teste das 44 frases com erro de propósito, da versão comercial, volta a valer, agora no navegador do celular, na fase 2.
11. **Idade.** A SPEC não fala de idade.
    - Sem conta obrigatória e sem IA paga pelo projeto, o risco cai bastante.
    - Ainda assim, cenários públicos (texto de terceiros) e conversa livre com IA chegam a menores. Antes da fase 7 é preciso decidir o aviso de idade e a moderação do catálogo (a moderação manual já está prevista).
12. **Arte.**
    - Nenhum terminal desenha pixel art. Recomendo pacotes CC0 (ex.: Kenney), com a licença no repositório, e placeholders na fase 1.
    - Fontes e sons ficam hospedados no próprio site, por causa da CSP.

## Perguntas ao dono e respostas (2026-11-20)
1. O que fazer com a versão comercial? **Arquivar tudo** (D-38).
2. Repositório público? **Histórico novo** (D-38).
3. Hospedagem? **Cloudflare Pages** (D-39).
4. Qual idioma vem primeiro? **Inglês** (D-40).
