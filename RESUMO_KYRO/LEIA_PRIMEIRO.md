# Memória do projeto Kyro

Esta pasta é o resumo permanente do projeto e deve ser usada para continuar o trabalho mesmo quando a conversa não estiver disponível.

O ponto de retomada mais recente está em [RETOMADA.md](RETOMADA.md), com o estado confirmado, as correções publicadas e os testes ainda pendentes. Consulte esse arquivo junto com o final do histórico para não tratar pendências antigas já concluídas como abertas.

## Regra obrigatória para qualquer continuação

1. Ler este arquivo e depois o `HISTORICO.md` antes de alterar o Kyro.
2. Usar o histórico como contexto, mas confirmar no código o que realmente está pronto.
3. Não considerar uma ideia como concluída só porque foi planejada na conversa.
4. Preservar alterações existentes e não desfazer trabalho do usuário.
5. Depois de cada tarefa, validar o resultado de acordo com o risco: build, testes ou verificação visual.
6. Acrescentar uma nova entrada no final de `HISTORICO.md`, começando pela última linha existente.
7. Cada entrada nova deve informar: data, versão, objetivo, o que foi alterado, validação, resultado e pendências.
8. Não apagar entradas antigas. Se algo estiver errado, acrescentar uma correção explicando o motivo.

## Projeto principal

- Pasta: `C:\Users\pfmmelo\Downloads\kyro`
- Produto: Kyro, sistema pessoal + sistema de empresa.
- Área pessoal: rotina, estudos, finanças, objetivos, calendário pessoal e preferências do usuário.
- Área de empresa: deve ser separada da vida pessoal e se chamar **Escritório**.
- O usuário pediu para preservar o visual Kyro, a experiência responsiva e as animações, mas remover excessos técnicos visíveis para pessoas que não são desenvolvedoras.

## Regra de trabalho

Antes de publicar, fazer build e testes proporcionais. Não fazer push, deploy, alteração em produção ou mudança de banco sem o usuário pedir.

