# SPEC — Glifora (versão open source)

> Versão open source (D-37, 2026-11-20). Substitui a SPEC da versão comercial, que fica no arquivo privado do autor (D-38). A organização dos terminais no Maestri e os prompts de cada um estão em `docs/EQUIPE.md`.

## Objetivo
Glifora é um **jogo web open source** (PWA instalável, mobile-first) para aprender idiomas de verdade: a pessoa sai **falando**, escrevendo, lendo e entendendo áudio. Não é mais um Duolingo. É um RPG leve de fantasia em que se aprende conversando com NPCs.

O projeto não tem monetização. O custo fixo deve ser zero ou perto disso: a IA é paga pelo próprio usuário (BYOK) ou não é usada.

Motivação: ser a ferramenta de estudo do próprio autor, bem personalizada, e um projeto de portfólio bem arquitetado no GitHub.

## Idiomas
- **Interface em pt-BR e inglês**, com seletor de idioma sempre acessível (primeira tela, configurações e rodapé). Detectar o idioma do navegador na primeira visita, salvar a escolha (local e na conta, se logado). Todos os textos da interface em arquivos de tradução (`i18n/pt-BR.json`, `i18n/en.json`); nenhum texto de interface fixo no código. Teste automatizado que falha se faltar chave em algum idioma.
- O **idioma base** (das traduções, dicas e explicações) acompanha a interface por padrão, mas pode ser trocado separadamente.
- Início: base pt-BR → **inglês primeiro** (fase 2), espanhol logo depois; base inglês → português e espanhol (D-40).
- Depois: japonês e chinês (traçado de caracteres com o dedo, flashcards de kana/kanji/hanzi, campo de romanização).
- Todo conteúdo é indexado por par (base, alvo) e nível CEFR. Nenhum texto de conteúdo fixo no código.

## Princípios pedagógicos (obrigatórios em toda feature)
1. Input antes de output: cada missão abre com diálogo/história em áudio + texto, um pouco acima do nível.
2. Output obrigatório: toda sessão termina com a pessoa falando ou escrevendo algo próprio.
3. Recuperação > reconhecimento: preferir falar/digitar a escolher opções (opções só no modo sem IA).
4. Intercalação: revisões misturam conteúdos antigos.
5. Feedback por **recast**: o NPC repete do jeito certo dentro da fala, sem tela de erro. Explicação detalhada só no relatório.
6. **Sem vidas, sem punição por erro.** Ofensiva congelável.
7. Recompensa só por esforço real (compreender e produzir), nunca por tocar rápido.
8. Transparência: mostrar nível CEFR estimado e metas "consigo..." (ex.: "consigo pedir comida num restaurante").

## Sensação de jogo e progressão (prioridade alta)
O app precisa dar a dopamina de evoluir, sem trair os princípios acima.

### Mundo
- Vila de fantasia aconchegante, visual pixel art. Cada local é um tema: Mercado, Ferraria, Taverna, Estação, Biblioteca...
- Mapa da vila como tela principal. Locais novos são **desbloqueados** conforme o jogador sobe de nível.
- NPCs recorrentes com personalidade e memória curta das conversas anteriores (resumo salvo por NPC).
- A vila evolui visualmente com o progresso (barra de progresso da vila, construções restauradas, NPCs novos chegando).

### Sessão diária (10–15 min)
1. Missão do dia num local da vila, com **3 encontros curtos** (1–3 min cada).
2. Fim da missão: **chefe**, uma conversa mais longa que exige usar o vocabulário da sessão.
3. Revisão do Grimório.
4. Relatório da sessão: o que a pessoa conseguiu fazer, recasts recebidos, palavras novas, XP ganho.

Cada **missão** é uma conversa curta (1–3 min) com um NPC. A "missão do dia" é a lista que o motor monta, e o **chefe** é uma missão do tipo `boss`, que começa sem ajuda (D-43).

### Progressão
- **Nível do personagem** (XP): sobe com missões, chefes e feitiços do Grimório. Barra de XP sempre visível, animação de level up, título novo a cada faixa de níveis (Aprendiz, Viajante, Mercador, Diplomata...).
- **Nível CEFR adaptativo por idioma** (A1–C2): começa no nivelamento. Se o jogador for entendido em mais de 80% dos turnos durante 3 sessões, sobe; abaixo de 50%, desce. Mostrado separado do nível do personagem. No modo demo, sem IA, o nível CEFR é o do nivelamento mais o avanço nas unidades; o ajuste pelos turnos entendidos só existe no modo completo (D-41).
- **Níveis de domínio por missão** (D-43): rejogar a mesma conversa com menos ajuda. Na 1ª vez as frases ficam à vista, na 2ª só a ideia no idioma base, na 3ª nada. Menos ajuda dá mais XP.
- **Metas "consigo..."** por unidade, marcadas como conquistadas, com tela de lista estilo "livro de conquistas".
- **Moedas** para itens cosméticos: roupas e acessórios do avatar, decoração da casa do jogador na vila. Nada que dê vantagem no aprendizado.
- **Conquistas** (ex.: primeiro chefe derrotado, 100 feitiços conjurados, conversou com todos os NPCs da vila).
- **Ofensiva** de dias com congelamento (ganho jogando, sem culpa).
- Perfil com avatar, nível, títulos, nível CEFR por idioma e estatísticas.

### Grimório (repetição espaçada)
- Cada palavra/expressão usada ou aprendida vira um card com **FSRS** (ou SM-2 no MVP).
- Card vencido vira um **feitiço**: para conjurar, o jogador precisa dizer ou escrever uma frase própria usando a palavra. Com IA, a IA avalia se o uso faz sentido; sem IA, o feitiço vira exercício de recuperação (digitar a palavra a partir da tradução/contexto).

### Nivelamento inicial
- Mini-teste de leitura e escuta (sem IA) + conversa de 2 min com um NPC (se houver IA).

## Conta e login
- **Login opcional**, com Supabase Auth (Google e e-mail). O projeto `glifora-dev` já existe.
- Sem login: tudo funciona localmente (IndexedDB), com botão de exportar/importar progresso em JSON.
- Com login: progresso, Grimório, avatar, conquistas e cenários são sincronizados entre aparelhos. O login também é necessário para publicar cenários públicos.
- O banco guarda **apenas** progresso e conteúdo do jogo. **A API key nunca vai para o Supabase**, nem criptografada.
- Usar só o plano gratuito do Supabase. RLS em todas as tabelas. Botão "Apagar minha conta e meus dados" (LGPD).

## Os três modos de IA

### 1. Modo demo (sem key, sem IA)
- Missões pré-geradas embutidas no projeto (`content/missions/<base>_<alvo>/<nível>/*.json`), geradas com IA pelo autor e revisadas.
- Conversas no formato da missão v1 (abaixo): cada fala do NPC oferece 1–3 respostas. O jogador **fala ou digita** a resposta (tocar na opção é ajuda e vale menos XP). A NPC reage a cada resposta, com recast quando a pessoa produz um erro previsto; a explicação fica para o relatório.
- **Comparação tolerante** (D-43): maiúsculas, acentos, pontuação, contrações ("I'm" = "I am", também sem apóstrofo) e pequenos erros de digitação não fazem a pessoa "errar". Na dúvida, vale a resposta boa.
- **Fecho sem IA** (D-43): a frase própria do fim é aceita se usar pelo menos uma das palavras-alvo da missão, e nada além disso é exigido. São duas tentativas; depois o jogo mostra uma resposta-modelo para repetir, sem travar nem tirar XP.
- Dá XP e progressão normalmente. Disponível na primeira tela, sem cadastro.
- Ao final da missão, convite para os outros modos.

### 2. Fábrica de cenários (IA gratuita do usuário, copiar e colar)
1. O jogador escolhe idioma, nível e **tema**: digita livremente ou toca em **"Tema aleatório"** (sorteia de uma lista interna de temas).
2. O site monta um **prompt pronto** (tema + nível + instruções + formato JSON esperado com exemplo) e mostra **"Copiar prompt"**.
3. O jogador cola no ChatGPT/Gemini/Claude gratuito, copia a resposta e cola no site.
4. O site extrai o JSON (tolerando texto ou ```json em volta), valida e transforma numa missão jogável, com um NPC e um local da vila.
5. Ao salvar, há uma **caixinha "Tornar este tema público"** (desmarcada por padrão; exige login).
6. Se a validação falhar, mostrar os erros num bloco pronto para copiar de volta à IA: "Corrija este JSON: o campo `nivel` deve ser um de A1…C2; `falas[3].texto` passou de 300 caracteres."

### 3. Modo completo (key do usuário)
- Conversa livre por voz ou texto com NPCs, no papel de personagem, com recast e progresso da missão.
- Geração de missões na hora (mesmo schema e mesma validação da fábrica).
- Feitiços do Grimório avaliados pela IA.
- Provedores por adaptadores com interface comum: começar por **OpenRouter** (aceita chamada direta do navegador e tem modelos gratuitos), depois **Anthropic** (D-41), OpenAI e Gemini. Verificar o CORS de cada um.
- Mandar para a IA só: prompt de sistema do NPC, resumo curto do encontro e as últimas 6 mensagens.
- Contrato de resposta da conversa (D-41; detalhes em `docs/propostas/W0-03-arquitetura.md` §2.6 e §5.4). É sempre JSON validado, e **a ordem das chaves faz parte do contrato**. Se o JSON vier inválido antes da fala, há 1 retentativa. Se a fala vier completa e o resto quebrado, a fala vale sem avaliação. Se falhar de novo, entra a fala de contingência do NPC.
```json
{
  "understood": true,
  "recast": { "original": "two breads", "corrected": "two loaves of bread" },
  "npc_reply": "Two loaves of bread? Sure! Anything else?",
  "emotion": "happy",
  "goals_met": ["order"],
  "errors": [{ "type": "grammar", "pattern": "en.uncountable_noun", "original": "two breads", "corrected": "two loaves of bread", "explanation": "explicação no idioma base", "severity": 1 }],
  "new_vocab": [{ "term": "a loaf of bread", "translation": "um pão", "example": "A loaf of bread, please." }],
  "hint": null,
  "flag": "none"
}
```
- Prompt de sistema do NPC: personalidade, objetivo do encontro, nível do jogador, frases curtas um pouco acima do nível, corrigir só por recast, nunca sair do personagem.

## Modo preparação para exames
Simulados no formato de exames de proficiência, para quem estuda para uma prova específica.

- **Exames suportados (inicial):** IELTS (inglês) e DELE/SIELE (espanhol). Depois: TOEFL, Cambridge, JLPT e HSK (JLPT não tem fala nem escrita, só leitura e escuta).
- **Leitura e escuta (sem key):** textos e áudios pré-gerados pelo autor, gravados uma vez com TTS e versionados em `content/exames/`. Perguntas nos tipos de questão do exame, com correção automática e gabarito comentado.
- **Escrita e fala (exige key):** a IA corrige com rubrica baseada nos **critérios públicos** de cada exame. No IELTS: Task Achievement/Response, Coherence and Cohesion, Lexical Resource e Grammatical Range and Accuracy na escrita; Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy e Pronunciation na fala.
  - A fala é gravada, transcrita e avaliada. A pronúncia é estimada (sem Azure, a avaliação é aproximada; deixar isso claro).
  - O resultado traz nota estimada por critério, justificativa com trechos do próprio texto ou fala da pessoa, versão melhorada da resposta e o que treinar.
- **Simulado completo cronometrado** ou treino por seção e por tipo de questão.
- **Histórico de notas** por critério, com gráfico de evolução.
- **Integração com o jogo:** palavras e erros recorrentes dos simulados viram cards do Grimório; completar simulados dá XP e conquistas.
- **Cuidados legais:**
  - Nunca copiar questões, textos ou áudios de provas oficiais nem de livros preparatórios. Todo conteúdo é original, só no mesmo formato.
  - Usar os nomes dos exames só de forma descritiva ("simulado no formato IELTS"), sem logos. Aviso fixo: "Nota estimada por IA. Não é oficial nem afiliado aos organizadores do exame."

## Voz
- Demo e fábrica: Web Speech API (`speechSynthesis` e `SpeechRecognition` com `lang` do idioma-alvo). Fallback para texto quando o navegador não suportar (ex.: Firefox) ou não houver voz instalada para o idioma.
- Modo completo: transcrição e TTS do provedor da key, com voz por NPC.
- Botão grande de microfone no centro da tela de conversa; transcrição ao vivo.
- Futuro: modo offline experimental (Whisper + Kokoro/Piper no navegador) e Azure opcional para nota de pronúncia, sempre com key do usuário.

## Segurança da API key (requisito central)
- A key vai **direto do navegador ao provedor**. Nunca passa por servidor do projeto nem pelo Supabase.
- Checkbox **"Lembrar minha key"**: desmarcado = só memória/sessionStorage; marcado = armazenamento local, com aviso claro.
- **Content-Security-Policy** restritiva: `script-src 'self'`; `connect-src` liberado só para os domínios dos provedores de IA suportados e do Supabase. Deve ser verificável pelo DevTools.
- Sem analytics, sem scripts, CDNs ou fontes de terceiros.
- Botão "Apagar minha key".
- Tela de configuração explicando onde a key fica, para onde vai e como verificar.
- Deploy só via GitHub Actions a partir do repositório público.
- Rodar local fácil: `git clone` → `npm install` → `npm run dev`; build pronto nas Releases.
- README com seção "Segurança da sua key" e recomendação de criar uma key só para o Glifora, com **limite de gasto**.

## Validação e proteção contra injection
- Todo JSON colado ou gerado é **dado**, nunca instrução ou código.
- Schemas **Zod** rígidos: campos obrigatórios, enums fechados (idioma, nível, tipo de exercício, emoção), tamanho máximo por texto, máximo de falas/opções, campo de versão `"schema": 1`, rejeitar campos desconhecidos.
- Renderizar sempre como texto puro (sem `dangerouslySetInnerHTML`, sem Markdown com HTML).
- Nunca usar campos do JSON como URL, código, nome de arquivo ou atributo HTML.
- Ao reenviar um cenário colado para a IA no modo completo: conteúdo entre delimitadores, system prompt deixando claro que é material de referência, e escopo da IA limitado.

## Cenários públicos
- Marcar "Tornar este tema público" envia o cenário para uma tabela no Supabase com status `pendente`.
- Validação automática pelo schema no envio; moderação manual pelo autor antes de ficar `publicado`.
- Catálogo público navegável por idioma, nível e tema, com autor (apelido) e contador de jogadas.
- Avisar que o conteúdo ficará público e não deve conter dados pessoais. Botão de denunciar cenário.
- Nada é publicado sem ação explícita do usuário.

## Schema de missão (v1, D-43)
Formato completo, limites e conferências: `docs/propostas/W0-03-arquitetura.md` §5.1. Resumo:
- Chaves em inglês; par completo (`base` + `target`); `"schema": 1`; objeto estrito.
- **Escuta antes** (`listen`, princípio 1): 2 a 6 falas curtas que a pessoa ouve antes de falar (obrigatória nas missões embutidas de A1–A2).
- **Sequência linear** de falas (`nodes`); `next` é opcional e só serve para ramificar para a frente. Assim a IA grátis não erra referência.
- Cada fala tem 1–3 respostas (`replies`), cada uma com `keywords` para casar a fala ou o texto digitado e uma `reaction` curta da NPC. A resposta `flawed` traz um erro previsto: só casa quando a pessoa produz aquele erro, e a reação da NPC traz o recast (`recast: { original, corrected }`). `note`/`pattern` vão só para o relatório.
- **Fecho obrigatório** (`closing`, princípio 2): pergunta da NPC, palavras-alvo, dica, resposta-modelo e fala de despedida.
- `kind`: `encounter` ou `boss`. `romanization` opcional (japonês e chinês).

```json
{
  "schema": 1, "id": "bakery-01", "base": "pt-BR", "target": "en", "level": "A1", "kind": "encounter",
  "title": "Pão quentinho", "theme": "Comprar pão na padaria", "location": "bakery",
  "can_do": "Consigo pedir comida e dizer quantos quero.",
  "description": "De manhã cedo, na padaria da Tilda. O pão acabou de sair do forno.",
  "characters": [{ "id": "tilda", "name": "Tilda", "personality": "calorosa, rápida", "npc": "tilda" }, { "id": "ben", "name": "Ben", "personality": "freguês apressado" }],
  "listen": [{ "speaker": "ben", "text": "Can I have two rolls, please?", "translation": "Pode me dar dois pãezinhos, por favor?" }],
  "nodes": [{
    "id": "order", "speaker": "tilda", "emotion": "happy",
    "text": "Good morning! Fresh bread today. What would you like?",
    "translation": "Bom dia! Pão fresquinho hoje. O que você vai querer?",
    "replies": [
      { "text": "A honey roll, please.", "translation": "Um pão de mel, por favor.", "keywords": [["honey"]],
        "reaction": { "text": "Lovely! My new honey rolls.", "translation": "Que bom! Meus pães de mel novos." } },
      { "text": "I want two breads.", "translation": "Quero dois pães.", "flawed": true, "keywords": [["breads"]],
        "recast": { "original": "two breads", "corrected": "Two loaves of bread" },
        "reaction": { "text": "Two loaves of bread? Sure!", "translation": "Dois pães? Claro!" }, "pattern": "en.uncountable_noun" }
    ]
  }],
  "closing": {
    "question": { "text": "Oh, one more thing, dear! What would you like tomorrow?", "translation": "Ah, mais uma coisa! O que você vai querer amanhã?" },
    "target_words": ["honey", "cheese", "roll", "bread", "loaf", "pie"],
    "hint": "Diga algo do cardápio, por exemplo com \"I'd like...\".",
    "model_answer": { "text": "I'd like two cheese rolls, please.", "translation": "Eu queria dois pães de queijo, por favor." },
    "success": { "text": "Lovely! See you tomorrow, dear!", "translation": "Que bom! Até amanhã!" }
  },
  "vocabulary": [{ "term": "a loaf of bread", "translation": "um pão inteiro", "example": "A loaf of bread, please." }]
}
```

## Tecnologia
- Vite + React + TypeScript, PWA (manifest + service worker), mobile-first.
- Zod para schemas; IndexedDB (Dexie) para dados locais; Supabase (Auth + Postgres) só para conta, sincronização e cenários públicos.
- Hospedagem estática no **Cloudflare Pages** via GitHub Actions, com a CSP em cabeçalho HTTP (D-39).
- Arquitetura detalhada (camadas, CSP exata, dados, adaptadores, testes): `docs/propostas/W0-03-arquitetura.md` (D-41). Quando divergir de `DECISIONS.md`, vale `DECISIONS.md`.
- **Aparelho-alvo** dos testes de fim de fase: Android + Chrome. No iPhone o jogo funciona com texto, convida a instalar e lembra de exportar (D-44).
- Acessibilidade: texto escalável, bom contraste, sem animações piscantes, opção de reduzir movimento e de desligar sons.
- Testes para schemas, parser do JSON colado, cálculo de XP/nível e algoritmo de repetição espaçada.
- Licenças (D-45): **código AGPL-3.0** (somente a versão 3) e **conteúdo de `content/` CC BY-SA 4.0**; nome e logo não são licenciados. README caprichado: o que é, os três modos, como rodar local, segurança da key, como contribuir com missões.

## Fases (parar ao fim de cada uma para eu testar no celular)
1. **Fundação:** estrutura, CSP, deploy automático, i18n, mapa da vila com 1 local, perfil local, exportar/importar (D-41).
2. **Núcleo jogável sem IA:** player de missões (v1, D-43) com níveis de domínio, 5 missões demo em inglês A1–A2 (base pt-BR, D-40), teste da taxa de casamento da voz no celular, XP, nível do personagem, level up, relatório da sessão, voz do navegador.
3. **Progressão completa:** missão diária com 3 encontros + chefe, Grimório com feitiços (SM-2), ofensiva, conquistas, metas "consigo...", moedas e avatar básico, desbloqueio de locais.
4. **Fábrica de cenários:** tema escolhido/aleatório → copiar prompt → colar → validar → jogar, com erros copiáveis.
5. **Conta:** login opcional com Supabase, sincronização, apagar conta.
6. **Modo completo com key:** adaptadores de provedor, conversa livre com recast, nível CEFR adaptativo, feitiços avaliados por IA, voz do provedor.
7. **Comunidade:** cenários públicos com moderação e catálogo.
8. **Preparação para exames:** formato IELTS primeiro (leitura e escuta pré-geradas; escrita e fala corrigidas pela IA com os critérios públicos), histórico de notas, depois DELE/SIELE.
9. **Depois:** japonês e chinês com traçado, modo offline, Azure opcional para pronúncia.

Portão da fase 2: eu jogo 5 sessões seguidas e quero voltar no dia seguinte. Se não, ajustar o núcleo antes de seguir.

## Regras de trabalho entre terminais
- O Arquiteto é dono de `docs/SPEC.md`, `docs/PLAN.md` e `docs/DECISIONS.md`.
- Cada tarefa em `PLAN.md` tem: dono, descrição, critério de pronto e testes esperados.
- Nenhum terminal muda arquivos de outro dono sem pedir ao Arquiteto.
- Toda entrega passa pelo Revisor antes de ser marcada como pronta.
- Parar ao fim de cada fase para teste manual do dono do projeto.
- Senhas, secrets e API keys nunca no chat nem no código; só no `.env` (que não vai para o git).
