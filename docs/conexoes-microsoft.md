# Teams e Planner no Kyro

As conexões ficam em **Conexões**, junto do Outlook. Funcionam no aplicativo instalado e no servidor local de desenvolvimento. O site publicado não oferece a ponte local usada por essas integrações.

Cada pessoa autoriza sua própria conta de trabalho. Teams e Planner usam autorizações independentes; conectar um deles não amplia a autorização já concedida ao Outlook.

## Preparação no Microsoft Entra

1. Abra **Registros de aplicativo** e crie um registro para as contas de trabalho da organização, ou use um registro que o administrador já tenha aprovado.
2. Em **Autenticação**, adicione **Aplicativo móvel e desktop**, com URI de redirecionamento `http://localhost`, e habilite os fluxos de cliente público.
3. Em **Permissões de API → Microsoft Graph → Permissões delegadas**, configure:

   | Conexão | Permissões |
   |---|---|
   | Teams | `User.Read`, `Chat.Read` |
   | Planner | `User.Read`, `Tasks.Read` |

4. Obtenha o consentimento administrativo caso a política da organização exija.
5. Copie o **ID do aplicativo (cliente)**. No cartão da conexão no Kyro, abra a configuração, preencha esse ID e clique em **Conectar com a Microsoft**.
6. No navegador, escolha a conta de trabalho e conceda a autorização. Volte ao Kyro e aguarde a consulta inicial.

Um mesmo registro de aplicativo pode atender às duas conexões se tiver as permissões necessárias. O fluxo é OAuth com PKCE; a interface recebe apenas o ID público do aplicativo. A autorização fica no armazenamento protegido de segredos da conta do Kyro.

## O que aparece

**Teams:** até 12 conversas recentes da pessoa, com até 12 mensagens recentes por conversa, busca, menções e links para abrir o Teams. Inclui conversas privadas, em grupo e de reuniões. As mensagens são exibidas como texto. A conexão não inclui canais de equipes, envio de mensagens nem uma contagem de mensagens não lidas.

**Planner:** tarefas atribuídas à pessoa em planos básicos, com nome do plano quando acessível, progresso, prioridade, prazo e links para abrir as tarefas na Microsoft. A consulta acompanha a paginação até 1.000 tarefas ou 25 páginas e informa quando há dados adicionais. Planos e tarefas Premium não são disponibilizados por essa API do Microsoft Graph. A edição e a conclusão das tarefas são feitas no Planner.

As duas conexões podem ser fixadas na ilha. As menções recentes no Teams e os prazos de hoje no Planner seguem as preferências de avisos de cada conexão. Falhas parciais são identificadas na interface; uma falha ao consultar não é apresentada como uma lista vazia confirmada.

## Verificação

`node --test scripts/microsoft.test.mjs` verifica o retorno OAuth com estado e PKCE, os escopos separados, a renovação de token, os destinos permitidos, a paginação, os dados parciais, a restauração de contas antigas e o descarte de respostas após troca de conta. Os testes usam respostas controladas e não autorizam contas Microsoft reais.

Referências: [conversas](https://learn.microsoft.com/en-us/graph/api/chat-list?view=graph-rest-1.0), [mensagens](https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0), [tarefas atribuídas](https://learn.microsoft.com/en-us/graph/api/planneruser-list-tasks?view=graph-rest-1.0), [limites da API do Planner](https://learn.microsoft.com/en-us/graph/api/resources/planner-overview?view=graph-rest-1.0).
