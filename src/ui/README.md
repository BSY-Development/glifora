# src/ui — interface (React)

Dono: **App**. Rotas, telas, componentes, hooks e estilos.

- Todo texto vem do i18n (`t('chave')`); texto solto no JSX não passa no lint.
- Conteúdo é sempre texto puro: nada de `dangerouslySetInnerHTML` nem `innerHTML`.
- Não importa `ai/keyVault` nem `ai/providers`.
- Acessibilidade: texto escalável, bom contraste, reduzir movimento, desligar sons.
- Referência: W0-03 §2.2.
