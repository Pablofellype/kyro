# Histórico e plano do Kyro

Este arquivo registra decisões, problemas, correções e o que ainda precisa ser validado. As novas anotações devem ser adicionadas no final.

## 1. Visão do produto

O Kyro deve funcionar como dois ambientes claramente separados:

- **Pessoal:** rotina, tarefas, estudos, finanças, metas, calendário pessoal, perfil, preferências e ilha.
- **Escritório:** ambiente da empresa para colaboradores, solicitações, tarefas, calendário da empresa, reuniões, avisos, rotina por horário, acompanhamento e comunicação de trabalho.

Dados pessoais devem ser isolados por usuário. Dados empresariais devem ser isolados por empresa, usuário e permissão. Dois usuários nunca devem enxergar ou alterar informações pessoais um do outro.

## 2. Decisões de produto já tomadas

- A antiga aba **Coordenação** deve se chamar **Escritório**.
- A área de Escritório poderá receber colaboradores autorizados pelo administrador.
- Colaboradores poderão conversar, receber tarefas, acompanhar atividades e consultar solicitações.
- O WhatsApp permanece como ferramenta de trabalho dentro da área de empresa.
- A ideia de um chat com IA dentro do Kyro foi abandonada por enquanto. O sistema não deve depender de conexão de IA para funcionar.
- As telas de modelos de IA, uso de IA e conexões específicas de IA não fazem parte do fluxo principal.
- Conectores que não sejam de IA, como WhatsApp, Gmail, Notion e Outlook, podem ser avaliados separadamente quando houver acesso e autorização.
- A parte 3D do escritório foi considerada pesada e deve permanecer removida.
- A ilha deve mostrar apenas o personagem Kyro com sua animação ociosa. Personagens antigos não devem aparecer na apresentação, onboarding ou telas de desenvolvedor.
- O usuário quer menos elementos técnicos expostos, principalmente código, modelos de IA e controles que não façam sentido para o usuário final.

## 3. Melhorias de layout e celular

Foram discutidos e trabalhados:

- hierarquia de títulos;
- navegação pessoal/empresa;
- ilha no celular com melhor leitura;
- menus que indiquem claramente se são para clicar ou arrastar;
- acesso à engrenagem e ao perfil no celular;
- redução de informações espremidas no topo;
- separação visual entre conteúdo pessoal e de empresa.

Ainda é necessário validar cada tela visualmente em desktop e celular após os próximos deploys. Uma mudança só deve ser marcada como concluída depois de ser conferida no navegador e, quando necessário, no celular.

## 4. Catálogo de materiais na ilha

Objetivo do catálogo:

- cadastrar materiais como BOTA PRETA, óculos e outros itens;
- guardar códigos únicos ou códigos por tamanho;
- permitir foto do material;
- pesquisar por nome, tamanho ou código;
- clicar no material para abrir os códigos;
- copiar o código com um toque;
- editar e excluir material.

Correções realizadas no fluxo local:

- o seletor de foto passou a ser acionado por um botão controlado diretamente;
- o botão de salvar fica bloqueado enquanto a foto está sendo preparada;
- a foto é reduzida para um tamanho adequado ao armazenamento local;
- no desenvolvimento, inclusive acessando pelo celular com `--host 0.0.0.0`, a foto fica local e não tenta chamar o Blob da produção;
- a ilha não fecha mais quando o seletor de arquivos tira o foco da janela;
- no localhost, a foto é guardada como imagem local. Em produção, novas fotos podem ser enviadas ao Vercel Blob quando o token estiver configurado;
- foto criada no localhost não é migrada automaticamente para o Blob: precisa ser reenviada em produção.

Layout atual trabalhado:

- botão superior com “Materiais” e contador;
- cartões com foto, nome e quantidade de códigos;
- códigos fechados até o usuário abrir o material;
- ações de editar/excluir mais discretas;
- busca e cartões com visual mais próximo do Kyro.

Status: a funcionalidade local da foto foi confirmada pelo usuário como funcionando. O novo visual foi aplicado, mas ainda precisa de validação final do usuário porque ele já informou que não gostou de versões anteriores.

Arquivos diretamente envolvidos:

- `src/janelas/ilha/barra/MateriaisNaBarra.tsx`
- `src/janelas/ilha/barra/BarraDoTopo.tsx`
- `src/janelas/ilha/barra/barra.css`
- `src/servicos/fotos.ts`

## 5. Login, usuários e e-mail

Foram investigados problemas de cadastro de novos usuários, redefinição de senha e envio de e-mail.

- O fluxo de “Esqueci minha senha” chegou a apresentar falhas de envio.
- Foi configurado um provedor Resend e uma API key para envio, mas o funcionamento precisa ser confirmado na versão publicada.
- A versão do sistema e as variáveis da Vercel precisam ser conferidas sempre que uma correção de autenticação for publicada.
- Foi relatado erro administrativo `column "cargo" does not exist`; isso deve ser tratado como pendência de compatibilidade entre código e banco até ser validado em produção.

## 6. Publicação e versões

- Foram usadas versões 0.2.30, 0.2.31 e 0.2.33 durante o ciclo de correções.
- O projeto local estava em `0.2.35` na última validação.
- O instalador Kyro Desktop passou a exibir a versão 0.2.33 em uma etapa anterior.
- O comando utilizado para testar pelo computador e celular é:

```powershell
npm run dev -- --host 0.0.0.0
```

- Se a porta 5420 estiver ocupada, o Vite pode abrir outra porta. Sempre usar a URL `Local` ou `Network` que aparece no terminal.
- Um build local recente terminou com sucesso (`tsc && vite build`).
- A suíte geral anterior teve 368 testes, com 366 aprovados e 2 falhas antigas relacionadas a expectativas da limpeza de IA/configurações; essas falhas não foram causadas pelo catálogo de materiais.
- Nenhum deploy ou push deve ser considerado feito sem confirmação explícita.

## 7. Ideia de integrar o sistema externo de solicitações

Foi analisada a pasta:

`C:\Users\pfmmelo\Desktop\Inventario-internoo-main 1\Inventario-internoo-main`

Ela contém um sistema separado de inventário e solicitações. A ideia não é copiar o projeto inteiro, mas transportar o fluxo para a área **Escritório** do Kyro.

Fluxo que pode ser aproveitado:

```text
Escritório → Solicitar material → Identificar colaborador →
Escolher setor/material → Escolher tamanho e quantidade →
Carrinho → Enviar solicitação → Protocolo → Acompanhar status
```

Funcionalidades observadas no sistema externo:

- formulário público em etapas sem senha para colaboradores;
- identificação por matrícula e nome;
- direcionamento por equipe/setor;
- catálogo de DML, EPI e uniformes;
- tamanhos, variações e códigos;
- limite de quantidade;
- carrinho;
- protocolo e rastreio;
- painel administrativo;
- aprovação, rejeição, status, observação e código SAP;
- monitor em cards, tabela e Kanban;
- filtros avançados;
- cadastro de colaboradores e fotos;
- consulta individual de colaborador;
- kits padronizados;
- planilha geral de reservas;
- estoque DML, contenção lateral e jardinagem;
- sincronização de Excel e Google Sheets;
- envio de pedido por banco local e mensagem de WhatsApp.

Arquitetura encontrada no sistema externo:

- HTML e JavaScript modular, sem React;
- Vite e TailwindCSS;
- Node.js para a API local;
- MySQL para usuários, colaboradores, materiais e pedidos;
- fotos de colaboradores e EPI guardadas como binário no MySQL;
- integração antiga/parcial com Google Sheets e Apps Script;
- sincronização de uma planilha Excel para uma tabela de reservas.

Conclusão: o fluxo é aproveitável, mas precisa ser refeito dentro da arquitetura do Kyro, usando os usuários, permissões, banco por empresa e armazenamento de fotos do Kyro. Não é uma cópia direta de arquivos.

Observações sobre o sistema externo:

- o README descreve Firebase/Apps Script, mas o código atual indica que o Firebase foi removido e que o MySQL local passou a ser importante;
- `app_script/backend.gs` e `vercel.json` aparecem excluídos no estado atual do Git daquela pasta;
- há alterações não commitadas na pasta externa;
- existem credenciais de fallback no código do servidor, que não devem ser reaproveitadas em produção.

## 8. Pendências atuais

- Validar visual final da ilha de materiais com o usuário.
- Confirmar foto de material em produção após reenvio e configuração do Vercel Blob.
- Finalizar o desenho da área Escritório antes de transportar o fluxo de solicitações.
- Definir papéis e permissões: administrador, gestor, colaborador e solicitante.
- Definir se uma solicitação é pessoal, de uma equipe ou da empresa.
- Confirmar estrutura definitiva do banco para não misturar dados pessoais com dados empresariais.
- Corrigir e validar o fluxo de redefinição de senha/e-mail.
- Resolver a compatibilidade do campo `cargo` no painel administrativo.
- Reavaliar as duas falhas antigas da suíte de testes.

## 9. Modelo para novas entradas

Adicionar sempre no final deste arquivo:

```text
## AAAA-MM-DD — vX.Y.Z — Título

Objetivo:

Alterações:

Validação:

Resultado:

Pendências:
```

## 2026-11-09 — v0.2.35 — Revisão das pendências e validação local

Objetivo:

Revisar o conteúdo da pasta RESUMO_KYRO, confirmar o estado real do projeto local e registrar o plano para resolver as pendências sem perder as anotações anteriores.

Alterações:

- Nenhum código foi alterado nesta revisão.
- A captura fornecida pelo usuário confirmou que a ilha de materiais funciona no localhost, exibindo materiais, foto, quantidade de códigos, busca e ações de editar/excluir.
- Foi confirmado no código que o fallback local de fotos existe e que a API de fotos usa Vercel Blob quando configurada.
- Foi confirmado que a migração 013 e a checagem local das colunas profissionais (`cargo`, `setor` e `telefone`) existem.
- Foi identificado que o teste de configurações não testa a ilha: ele espera o Chat na barra lateral, mas a configuração atual remove o Chat da barra padrão.

Validação:

- `npm run verificar`: aprovado.
- `npm run build`: aprovado.
- Testes focados de Escritório, Assistive, Vite, GitHub, pré-lançamento e interface: aprovados.
- `scripts/validacoes.test.mjs`: 60 aprovados e 1 falha na expectativa antiga do Chat na barra lateral.

Resultado:

O funcionamento local da ilha está confirmado. O build local está aprovado. A falha encontrada é de alinhamento entre teste e configuração atual da barra lateral, não de funcionamento da ilha. Produção ainda não foi confirmada.

Pendências:

- Atualizar o teste ou decidir se o Chat deve voltar para a barra lateral.
- Configurar e validar em produção `BLOB_READ_WRITE_TOKEN`, Resend e `KYRO_PUBLIC_URL`; fotos locais não migram automaticamente para o Blob.
- Executar/confirmar a migração 013 no banco publicado e validar o campo `cargo`.
- Validar redefinição de senha e convites por e-mail em produção.
- Implementar o fluxo de solicitações de materiais no Escritório.
- Definir papéis de administrador, gestor, colaborador e solicitante.
- Definir se a solicitação pertence à empresa e pode ser vinculada a uma equipe.
- Criar a estrutura empresarial do banco com isolamento por empresa, usuário e permissão.

## 2026-11-09 — v0.2.35 — Checagem antes do push

Objetivo:

Revisar as pendências do RESUMO_KYRO antes de publicar o repositório.

Alterações:

- Nenhum código foi alterado nesta checagem.
- Foi confirmado no código atual que os cargos Dono, Administrador e Colaborador, convites, solicitações de material e bloqueios de acesso já estão implementados.
- Foi identificado que o localhost não serve a função Vercel `/api/custos`; isso explica a falha da tela de custos quando a resposta local não contém `balance`.
- Foi identificado um bundle nativo rastreado pelo Git contendo uma credencial de banco embutida. O segredo não deve ser publicado e a credencial precisa ser revogada/rotacionada.

Validação:

- `pnpm run verificar`: aprovado.
- `pnpm run build`: aprovado.
- `pnpm test`: 366 aprovados e 2 falhas.
- Falha 1: teste espera o texto antigo `Os comandos locais continuam funcionando sem IA`; a interface atual usa texto atualizado.
- Falha 2: `configuracoesValidas` lança `Cannot read properties of undefined (reading 'nome')` no teste de configurações corrompidas.

Resultado:

O projeto compila, mas a checagem não está limpa para um push seguro. O push deve aguardar a remoção do segredo rastreado e a decisão sobre as duas falhas de teste.

Pendências:

- Remover o segredo do bundle rastreado, regenerar o artefato e revogar/rotacionar a credencial de banco.
- Corrigir ou atualizar os dois testes falhos.
- Configurar e validar no ambiente publicado `DATABASE_URL`, `KYRO_PUBLIC_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BLOB_READ_WRITE_TOKEN` e as demais variáveis usadas pelo gateway.
- Executar/confirmar as migrações 013 e 014 no banco publicado.
- Validar em produção convites, redefinição de senha, fotos no Blob e solicitações de material.
- Validar visualmente a ilha de materiais em desktop e celular.

## 2026-11-09 — v0.2.35 — Limpeza de credencial antiga

Objetivo:

Remover a credencial antiga dos arquivos locais e do artefato rastreado antes do push.

Alterações:

- Removido o bundle nativo antigo não utilizado que continha a credencial embutida.
- Os scripts locais de banco agora exigem `DATABASE_URL` ou `POSTGRES_URL` por variável de ambiente.
- O script de cadastro de usuário não mantém mais uma senha fixa; ele exige `KYRO_USUARIO_SENHA`.

Validação:

- Nenhuma ocorrência de credencial `npg_...` nos arquivos atuais rastreados ou no código local pesquisado.
- `pnpm run verificar`: aprovado.
- `pnpm run build`: aprovado.
- `git diff --check`: aprovado, apenas com avisos normais de conversão de final de linha.

Resultado:

A credencial antiga não está mais presente no estado atual do projeto. Nenhuma credencial atual foi alterada.

Pendências:

- O valor antigo permanece na história de um commit local anterior. Se este repositório ainda não foi publicado e for necessário apagar o segredo também do histórico, será preciso fazer uma limpeza/regravação de histórico antes do push.
- As duas falhas antigas da suíte de testes continuam registradas na entrada anterior.

## 2026-11-09 — v0.2.35 — Suíte corrigida antes da nova release

Objetivo:

Eliminar as duas falhas encontradas na preparação da versão 0.2.36.

Alterações:

- Atualizada a expectativa do teste de personalização para o texto atual da interface.
- Atualizado o teste de configurações para usar a rota atual do Escritório, já que o Chat não faz mais parte da barra lateral padrão.

Validação:

- `pnpm run verificar`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.

Resultado:

A suíte está completamente aprovada e o projeto pode avançar para a sincronização da versão 0.2.36.

Pendências:

- Ainda não foi executado `pnpm versao:sincronizar 0.2.36` nem qualquer push ou criação de tag.

