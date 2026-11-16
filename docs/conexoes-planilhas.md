# Google Planilhas e catálogo da gerência

Google Planilhas é uma conexão independente do Google Workspace em testes. Fica disponível para dono e gerência em **Conexões → Google Planilhas**.

## Conectar

1. No Google Cloud, crie ou selecione o projeto da empresa e ative a **Google Sheets API**.
2. Configure o Google Auth Platform para as contas que usarão a conexão. Em um projeto externo em modo de teste, inclua as contas autorizadas como usuários de teste.
3. Crie um cliente OAuth do tipo **App para computador**. Use o ID e o segredo desse cliente na configuração do Kyro.
4. Cole de um a cinco links de planilhas que sua conta Google possa acessar. Links com `#gid=` selecionam a aba inicial.
5. Clique em **Conectar com o Google**, autorize a conta no navegador e volte ao Kyro.

O escopo solicitado é `spreadsheets.readonly`. Ele autoriza a leitura das planilhas acessíveis à conta; o Kyro consulta os links configurados. A conexão não solicita Gmail, calendário ou edição de células. Credenciais ficam no armazenamento protegido de segredos da conta do Kyro.

Depois de conectar, é possível trocar os links usando **Salvar e atualizar** e deixando o segredo vazio. Para autorizar novamente uma sessão expirada ou outra conta Google, preencha o segredo do cliente e conecte novamente.

## Consultar

A janela permite escolher a aba, pesquisar os valores da prévia, navegar entre páginas e abrir o documento no Google. A prévia consulta até 100 linhas e 20 colunas, respeitando os limites reais da aba. As células são exibidas como texto com a formatação devolvida pelo Google; a edição é feita no Google Planilhas.

Uma aba vazia é identificada como vazia. Falhas de acesso e arquivos indisponíveis recebem mensagens próprias, e a falha de um arquivo não apaga as prévias dos demais. O seletor consulta somente documentos que foram adicionados à conexão da conta.

## Gerência e dono

A gerência não vê GitHub, Vercel, Railway, Supabase, Cloudflare, Resend, n8n, Linear, Stripe, Cripto, Strava, Reddit e Discord. Essa regra vale para o catálogo, configurações da conexão, janelas, ilha e avisos. As consultas de segundo plano também ignoram esses serviços na gerência.

O dono mantém todas as conexões em Pessoal e Empresa. A ocultação não remove serviços do catálogo geral nem apaga suas configurações.

## Validação

`node --test scripts/planilhas.test.mjs` verifica os links, as permissões OAuth, PKCE, preservação das credenciais, prévias e abas, falhas de acesso, conteúdo exibido como texto e diferenças entre os perfis. Os testes usam dados controlados; não autorizam contas reais.

Referências: [escopos da API](https://developers.google.com/workspace/sheets/api/scopes), [metadados de planilhas](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get), [leitura de células](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).
