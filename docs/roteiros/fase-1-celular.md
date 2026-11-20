# Roteiro de teste no celular — fase 1 (Fundação)

Para: o dono do projeto. Aparelho: **Android com Chrome** (D-44). Tempo: uns 20 minutos.
Endereço do jogo: **https://glifora.pages.dev**

## Antes de começar

- Chrome atualizado e internet ligada (você vai desligá-la no passo 13).
- Tenha à mão uma nota no celular (ou papel). **Se algo não acontecer como descrito, anote assim:** número do passo + o que você viu + um print da tela (botão ligar + volume para baixo, juntos). No fim, mande a lista para o Arquiteto.
- Este roteiro não precisa de código, de cabo nem de DevTools. A CSP e os cabeçalhos do site já foram conferidos pelo Revisor na URL real.

## 1. Começar do zero

1. **Limpe os dados do site** (só se você já abriu o Glifora neste celular): no Chrome, abra o endereço, toque no cadeado ao lado dele → **Configurações do site** → **Limpar dados** → confirme. Feche a aba.
   - *Deve acontecer:* nada visível. É só para a próxima abertura ser a "primeira visita".
2. Abra **https://glifora.pages.dev** numa aba nova.
   - *Deve acontecer:* aparece **"Boas-vindas ao Glifora"** (se o celular está em português), com o seletor de idioma, o campo **Apelido (opcional)** e o botão **Começar**. A tela cabe inteira, sem rolar para o lado.
   - *Se não:* anote o que apareceu (tela em branco, mensagem de erro, texto em inglês com o celular em português).

## 2. Primeira visita e perfil

3. No campo de apelido, escreva `<b>oi</b>` e toque em **Começar**.
   - *Deve acontecer:* uma mensagem avisa que o apelido não pode ter `<` nem `>`, e você **continua** na tela de boas-vindas.
4. Apague e escreva um apelido normal (ex.: `Teste`). Toque em **Começar**.
   - *Deve acontecer:* abre **"A vila"**, com **"Olá, Teste!"**, "Nível 1 · Aprendiz" e o mapa com a Padaria.
5. Toque em **Perfil** (barra de baixo). Troque o **avatar** (por exemplo, "Chapéu roxo") e mude o apelido; toque em **Salvar apelido**.
   - *Deve acontecer:* aparece "Apelido salvo." e o avatar escolhido fica marcado. Volte para a **Vila**: o desenho do avatar e o nome mudaram.
6. Feche o Chrome por completo (tire-o da lista de apps) e abra o endereço de novo.
   - *Deve acontecer:* você cai direto na vila, com o mesmo apelido e avatar (sem passar pelas boas-vindas outra vez).

## 3. A vila e a padaria

7. Na vila, toque na **Padaria**.
   - *Deve acontecer:* abre a Padaria, com a Tilda (Padeira) e "Missões em breve." Ainda não há botão de jogar: é normal.
8. Toque no botão **Voltar** do próprio Android (gesto ou botão).
   - *Deve acontecer:* volta para a vila (não sai do app nem do site).
9. Os desenhos estão nítidos (pixel art, sem borrão) e os textos são legíveis sem dar zoom?
   - *Se não:* anote em qual tela.

## 4. Ajustes

10. Toque em **Ajustes**. Em **Tamanho do texto**, escolha **Muito grande**. Passe por **Vila**, **Perfil**, **Ajustes** e **Sobre**.
    - *Deve acontecer:* o texto cresce na hora em todas as telas, nada fica cortado, não há rolagem para o lado e a barra de baixo continua alcançável (rolando a página, se preciso). Depois volte para **Normal**.
11. Em **Movimento**, escolha **Reduzir movimento**, feche e reabra o app.
    - *Deve acontecer:* a escolha continua marcada. (Quase nada se mexe nesta fase; o que vale aqui é a escolha ficar guardada.)

## 5. Instalar e usar sem internet

12. No Chrome, toque nos **três pontinhos (⋮)** → **Instalar app** (ou **Adicionar à tela inicial**) → confirme.
    - *Deve acontecer:* aparece um ícone do Glifora (um "G" em pixel art) na tela inicial. Abra por ele: o jogo abre em tela cheia, **sem a barra de endereço**.
    - *Se a opção de instalar não aparecer:* anote.
13. Com o app aberto, navegue pelas quatro abas e pela Padaria (para ter certeza de que tudo carregou). Depois **feche o app**, ligue o **modo avião** (confira que o Wi-Fi também está desligado) e abra o app pelo ícone.
    - *Deve acontecer:* o jogo abre normalmente, com o seu perfil. Vila, Padaria, Perfil, Ajustes e Sobre funcionam. Nenhuma tela de "sem conexão" do Chrome.
    - *Se não:* anote qual tela falhou e o que apareceu.
14. Ainda no modo avião, em **Ajustes**, toque em **Exportar meu progresso**.
    - *Deve acontecer:* o celular baixa um arquivo `glifora-AAAA-MM-DD.json` e o app mostra "Arquivo gerado com N itens." Depois desligue o modo avião.

## 6. Exportar, apagar e importar

15. Em **Ajustes → Seus dados**, toque em **Exportar meu progresso** (de novo, para ter um arquivo atual). Anote o apelido e o avatar de agora.
    - *Deve acontecer:* o arquivo vai para a pasta **Downloads** do celular.
16. Toque em **Apagar os dados deste aparelho**. Na pergunta, toque em **Cancelar**.
    - *Deve acontecer:* nada é apagado. Volte à vila e confira que o perfil continua lá.
17. Toque em **Apagar os dados deste aparelho** de novo e confirme em **Sim, apagar tudo**.
    - *Deve acontecer:* o app recomeça do zero, na tela de **Boas-vindas** (perfil, avatar, ajustes e idioma escolhido sumiram).
18. Toque em **Ajustes** (barra de baixo) → **Importar de um arquivo** → escolha o arquivo `glifora-….json` que você exportou.
    - *Deve acontecer:* aparece "Importação concluída: N itens novos ou atualizados." Vá em **Vila** e **Perfil**: apelido e avatar voltaram como estavam.
19. Importe o **mesmo arquivo** outra vez.
    - *Deve acontecer:* "Nada de novo no arquivo: seus dados já estavam em dia."
20. (Opcional, 1 minuto) Tente importar um arquivo que **não** é do Glifora (qualquer foto ou PDF do celular).
    - *Deve acontecer:* uma mensagem de erro clara ("não parece ter sido exportado pelo Glifora" ou "não é um JSON válido"), e os seus dados continuam intactos.

## 7. Trocar o idioma

21. Em **Perfil**, em **Idioma da interface**, escolha **English**.
    - *Deve acontecer:* tudo muda para inglês na hora (barra de baixo: Village, Profile, Settings, About).
22. Feche e abra o app.
    - *Deve acontecer:* continua em inglês.
23. Volte para **Português (Brasil)** (Profile → Interface language).
    - *Deve acontecer:* tudo volta ao português.

## 8. Sobre e licenças

24. Toque em **Sobre**.
    - *Deve acontecer:* aparecem a **versão**, o **commit** e a seção **Licenças**:
      - "O código é livre, sob a GNU AGPL-3.0."
      - "As missões e demais conteúdos (pasta content/) estão sob a CC BY-SA 4.0."
      - "O nome "Glifora" não é licenciado."
    - *Confira:* o commit mostrado é o mesmo do último commit da `main` no GitHub (os 7 primeiros caracteres).
25. Toque em **Código-fonte no GitHub**.
    - *Deve acontecer:* abre a página do repositório `BSY-Development/glifora` (no Chrome). Volte ao app pelo botão Voltar.
    - *Se não:* anote o que abriu.

## 9. Atualização (só se houver um deploy novo depois do passo 12)

26. Com o app **fechado** quando o deploy acontecer, abra-o pelo ícone.
    - *Deve acontecer:* abre já na versão nova (confira o commit em **Sobre**). Se o app estava **aberto** durante o deploy, aparece o aviso **"Nova versão disponível."** com o botão **Atualizar**; apelido e avatar continuam depois de atualizar.

## Resultado

Marque cada passo: **OK**, **Falhou** (escreva o que viu) ou **Não testei**.

| Passo | Resultado | Anotação |
| --- | --- | --- |
| 1–2 Começar do zero | | |
| 3–4 Apelido e vila | | |
| 5–6 Perfil e persistência | | |
| 7–9 Padaria, Voltar, legibilidade | | |
| 10–11 Texto grande e movimento | | |
| 12–14 Instalar, modo avião, exportar offline | | |
| 15–20 Exportar, apagar, importar | | |
| 21–23 Idioma | | |
| 24–25 Sobre e licenças | | |
| 26 Atualização | | |

Dados do aparelho (preencha uma vez): modelo do celular: ______ · versão do Android: ______ · versão do Chrome (⋮ → Configurações → Sobre o Chrome): ______ · commit mostrado em Sobre: ______
