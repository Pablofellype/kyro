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

## 2026-11-10 — v0.2.36 — Perfis da empresa e portal público

Objetivo:

Separar definitivamente Proprietário, Gerência e Visitante e preparar o Kyro para reunir os seis sistemas da empresa.

Alterações:

- O proprietário foi fixado em `pablofellype03@gmail.com`, com acesso total e proteção contra desativação, alteração ou exclusão.
- `pabloflp50@gmail.com` e usuários identificados como Ronaldo passam a Gerência; perfis antigos de administrador/colaborador são normalizados para Gerência ou Visitante.
- Gerência usa o mesmo painel Empresa do proprietário, sem acesso à área Pessoal, mas com Conexões de trabalho, WhatsApp, Agenda, Escritório e Apps Empresa.
- Criada a aba Apps Empresa com seis cartões centralizados em `aplicativosEmpresaConfig.ts` e uma área de acompanhamento das solicitações de materiais.
- Criado o portal público `/?visitante=1`, sem login, ilha ou painel Kyro. O portal direciona aos sistemas e já contém o formulário público de solicitação de materiais.
- Solicitações públicas passaram a guardar nome/e-mail do visitante e ficam visíveis para Proprietário e Gerência.
- Administração ganhou exclusão definitiva de acesso, além da desativação/reativação já existente.
- Visitante não inicia sessão; sessões antigas de visitante são encerradas na verificação.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `pnpm build`: aprovado.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

O código está preparado para o novo modelo de acesso e para o portal público. Nenhum push, deploy ou alteração remota de banco foi executado.

Pendências:

- Substituir os cinco nomes/links provisórios dos sistemas restantes em `src/modulos/escritorio/aplicativosEmpresaConfig.ts`.
- Executar a migração de perfis e solicitações no banco publicado antes de liberar o portal público.

## 2026-11-10 — v0.2.36 — Nova tela de login e acesso de visitante

Objetivo:

Trocar completamente a apresentação da tela de login e deixar o acesso de Visitante visível, sem exigir conta.

Alterações:

- Substituída a composição antiga por uma tela de entrada em dois painéis, com identidade visual Kyro, contraste forte, cards de Proprietário/Gerência/Visitante e responsividade para telas menores.
- Mantidos os fluxos privados de login, convite, recuperação e redefinição de senha.
- Adicionado o botão explícito “Sou visitante”, direcionando para `/?visitante=1` sem login, painel Kyro ou ilha.
- Mantidos diagnóstico de conexão e instalação do aplicativo no painel privado.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

A tela de login agora apresenta claramente os três caminhos de acesso e o Visitante consegue entrar diretamente nos sistemas públicos da empresa.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Ocupa a tela inteira sem divisão visual

Objetivo:

Corrigir o excesso de espaço vazio criado pelo cartão central isolado, mantendo a decisão de não usar uma tela dividida.

Alterações:

- Restaurada a composição de tela cheia com título grande, marca, ambientes e status ocupando o painel principal.
- O formulário foi integrado ao mesmo fundo grafite, sem uma segunda cor de painel ou uma divisão central.
- A lista de Pessoal, Empresa e Visitante voltou a aparecer como estrutura do produto.
- Mantidos o vermelho do Kyro, o fundo sólido e a remoção dos gradientes, personagens e ilustrações.
- Ajustado o comportamento para telas baixas e celulares.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

A tela deixou de ser um cartão pequeno no centro e voltou a ocupar a janela inteira, sem retornar ao layout dividido.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Tela de login em painel único

Objetivo:

Abandonar a composição dividida e criar uma entrada mais direta, sem verde, sem gradiente e sem aparência de ilustração de IA.

Alterações:

- Removido visualmente o layout de duas colunas; o login agora é um único cartão centralizado.
- Fundo grafite sólido e acento vermelho discreto, alinhado à identidade já usada pelo Kyro.
- Painel branco substituído por cartão escuro com campos, visitante e rodapé no mesmo acabamento.
- Ocultados definitivamente na entrada o mockup da ilha, a lista visual anterior, a grade e os efeitos de brilho.
- Mantidos todos os fluxos funcionais e a adaptação para telas menores.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

A tela de login deixou de ser dividida e passou a ter uma composição única, plana e objetiva, sem o verde que não pertencia ao sistema e sem gradientes.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Paleta flat e remoção do visual futurista

Objetivo:

Remover o gradiente vermelho/preto, o aspecto de arte gerada e o painel branco da nova tela de login.

Alterações:

- Substituída a paleta vermelha por grafite azul-petróleo com verde-água como acento funcional.
- Removidos gradientes, brilhos, grade decorativa e a ilustração da ilha da composição ativa.
- Substituído o mockup 3D por uma lista flat e objetiva dos ambientes Pessoal, Empresa e Visitante.
- Transformado o painel de acesso em uma superfície sólida escura, com campos e cartões no mesmo sistema visual.
- Mantidos autenticação, visitante, recuperação de senha, instalação e responsividade.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.
- A prévia automática no Chrome não foi concluída porque a política local não permitiu determinar a URL atual da janela.

Resultado:

A tela agora usa uma composição flat, limpa e de produto, sem gradiente vermelho/preto, sem personagens, sem estrelas e sem aparência de ilustração gerada por IA.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Visual abstrato da ilha na tela de login

Objetivo:

Dar mais identidade ao painel visual da entrada sem colocar personagens ou elementos decorativos em forma de estrela na tela de login.

Alterações:

- Criada uma ilha 3D em CSS com plataforma, prédio Kyro, torre, terminais, núcleo e linhas de conexão.
- A cena é integrada ao conceito de Pessoal, Empresa e Apps conectados por meio de uma legenda discreta.
- Removida a dependência do componente `Personagem` na tela de login.
- Removidas órbitas, pontos e animações decorativas que poluíam a composição.
- Mantidos os assets e pastas dos personagens do sistema, pois outras telas ainda dependem deles.
- O fluxo de login, visitante, recuperação de senha e instalação não foi alterado.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

A tela de login agora apresenta uma visualização abstrata do ecossistema Kyro, sem personagens e sem estrelas, preservando a responsividade e as funcionalidades existentes.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Remove a barra vertical normal do painel branco

Objetivo:

Eliminar a barra de rolagem vertical que ainda aparecia no painel branco da tela de login mesmo quando todo o conteúdo já cabia na altura da janela.

Alterações:

- Em desktop com altura útil a partir de 680px, o painel de acesso usa `overflow-y: clip` quando está no estado normal.
- Estados de erro de login e diagnóstico preservam rolagem vertical de emergência para manter todas as mensagens acessíveis.
- Mantida a rolagem natural para viewports realmente baixos, sem alterar a rolagem horizontal ou as regras de negócio.

Validação:

- Chrome headless em 1920×867, 1920×870, 1536×864 e 1366×768: painel com `scrollHeight` igual a `clientHeight` e `overflow-y: clip`.
- Nos mesmos viewports, `document.scrollWidth` permaneceu igual a `document.clientWidth`.
- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.

Resultado:

A barra vertical desnecessária do painel branco foi removida nas alturas mostradas nas capturas, mantendo fallback acessível para conteúdo que realmente precise rolar.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Responsividade da tela de login

Objetivo:

Garantir que a nova entrada funcione sem cortes em celulares, notebooks de 13 e 15 polegadas, MacBooks e monitores grandes.

Alterações:

- Painel privado passa a ter rolagem própria quando a altura disponível não comporta mensagem de erro, campos, recuperação e ações finais.
- Alturas usam o viewport dinâmico (`dvh`) e o layout deixa de esconder conteúdo na parte inferior da janela.
- Criadas faixas responsivas para telas médias, ultrawide, celulares e larguras muito estreitas.
- Reduzidos espaçamentos, tipografia e alturas dos campos em notebooks baixos, preservando a leitura e os alvos de toque.
- Em telas pequenas, a composição vira uma coluna com rolagem natural e cards reorganizados.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

Os campos inferiores do login não ficam mais cortados e a tela se adapta às principais proporções de celular, notebook, MacBook e monitor grande.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Responsividade universal e foco móvel

Objetivo:

Validar a tela de login inteira em diferentes larguras, alturas, orientações e estados, sem rolagem horizontal.

Alterações:

- Aplicado contrato responsivo exclusivo da tela de login com `box-sizing`, `min-width: 0`, Grid fluido, larguras máximas e fallback `vh`/`svh`/`dvh`.
- Removidas dependências estruturais de `100vw` e larguras mínimas fixas da nova entrada; o overflow horizontal deixou de ser corrigido apenas por ocultação.
- Adicionadas áreas seguras para notch/navegação móvel, campos com toque mínimo de 44px, fonte de 16px em mobile, foco visível e quebra segura de textos longos.
- Mantida a composição em duas colunas no espaço adequado; celulares e tablets estreitos usam uma coluna com rolagem vertical natural.
- Desativada a animação deslocada da grade decorativa para não criar caixas fora do viewport.
- Removido o `autoFocus` do e-mail, que fazia o navegador móvel pular o cabeçalho e esconder a apresentação no primeiro carregamento.

Validação:

- Viewports reais em Chrome headless: 320×568, 360×640, 375×667, 390×844, 430×932, 667×375, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440, 3440×1440 e 3840×2160.
- Todos os viewports: `scrollWidth` igual à largura disponível e nenhum elemento ultrapassando lateralmente.
- Estado real de erro de autenticação: aprovado sem overflow horizontal.
- Estado real de carregamento: botão desabilitado e indicador visível sem overflow horizontal.
- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

A tela de login se adapta de 320px a 4K, preserva o design e mantém o conteúdo acessível verticalmente quando a altura não comporta tudo de uma vez.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Ajuste da rolagem em desktop baixo

Objetivo:

Eliminar a rolagem vertical desnecessária exibida nas capturas em uma janela desktop com altura reduzida.

Alterações:

- Em viewports desktop de até 920px de altura, reduzidos apenas os espaçamentos verticais do painel privado.
- Ajustados cabeçalho, introdução, cartão de visitante, separador, campos, botão e rodapé para a composição caber inteira quando houver espaço suficiente.
- Mantida a rolagem vertical como fallback apenas quando o conteúdo realmente ultrapassar a altura disponível.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, 0 falhas.
- `git diff --check`: aprovado; os avisos são apenas conversões normais de LF para CRLF do Git.

Resultado:

Em desktops e notebooks baixos, a tela de login não exibe mais rolagem desnecessária para alcançar o rodapé.

Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Entrada com prévia animada do Kyro

Objetivo:

Reconstruir a entrada com o acesso à direita e uma apresentação que mostre a organização real do produto, preservando as fontes e o vermelho do Kyro.

Alterações:

- Substituído o JSX das apresentações anteriores por cabeçalho, apresentação, formulário à direita e rodapé em um único fundo grafite sólido.
- Criado `PreviaKyro.tsx`: janelas HTML com perspectiva CSS, alternância entre Empresa, Pessoal e Conexões a cada sete segundos e uma representação da ilha sem personagens.
- A apresentação é explicitamente identificada como ilustrativa e não consulta dados de contas nem mostra métricas inventadas.
- Adicionados seleção manual dos ambientes e botão de pausa. A troca automática respeita movimento reduzido, configuração do Kyro e visibilidade do documento.
- Criado `entrada.css` com estilos exclusivos, campos móveis de 16px, áreas de toque de 44px, foco visível, largura fluida e adaptações por largura e altura. Em celular, o formulário aparece antes da prévia.
- Removidas cerca de cinco mil linhas de composições antigas de `login.css`, preservando os estilos compartilhados dos diálogos de instalação e recuperação.
- Atualizadas as frases da apresentação e do formulário. Login, visitante, instalação, convite e recuperação mantêm os mesmos handlers e endpoints.

Validação:

- `pnpm verificar`: aprovado.
- `pnpm build`: aprovado.
- `pnpm test`: 368 aprovados, zero falhas.
- `git diff --check`: aprovado, apenas com os avisos de final de linha já existentes.
- Tentada conferência visual pela habilidade computer-use. A ferramenta bloqueou a inspeção porque não conseguiu determinar com segurança a URL atual do Chrome; a tentativa foi encerrada.

Resultado:

Implementada a nova entrada com tipografia Geist, Bricolage Grotesque e Geist Mono, superfícies sólidas, vermelho do Kyro e apresentação animada da interface em profundidade. Nenhum personagem ou gradiente foi adicionado à entrada.

Pendências:

- Conferência visual dos viewports e interação com a nova apresentação no navegador. Não declarar rolagem, zoom, teclado móvel ou autenticação ponta a ponta como validados nesta etapa.
- Nenhum commit, push, deploy ou alteração remota de banco foi executado.

## 2026-11-10 — v0.2.36 — Ilha expansível na apresentação do login

Objetivo:

Evoluir a composição aprovada pelo usuário mostrando a ilha aparecer, expandir e recolher em sintonia com a prévia do Kyro.

Alterações:

- Criado `IlhaNaEntrada.tsx`, uma representação ilustrativa e isolada da ilha com abas Hoje, Foco e Conexões, sem personagens ou dados de sessão.
- A ilha entra na cena, expande após 1,3 segundo, mostra o conteúdo correspondente ao ambiente e recolhe após 5,6 segundos; a apresentação continua alternando os ambientes a cada sete segundos.
- A janela de fundo recebe menos destaque durante a expansão, dando presença à ilha.
- Adicionado o controle “Explorar a ilha”, que pausa o rodízio e permite abrir/recolher manualmente. O botão de retomada continua disponível.
- A expansão fica sobreposta dentro da área de demonstração, sem alterar a altura do layout do formulário. Os controles se adaptam a larguras pequenas.
- Temporizadores são cancelados ao pausar, mudar de ambiente, ocultar o documento ou desmontar. Preferências de movimento reduzido do sistema e do Kyro também desativam as transições da ilha.

Validação:

- `pnpm build`: aprovado, incluindo verificação TypeScript e build de produção.
- `git diff --check -- src/componentes/login`: aprovado; somente os avisos habituais de LF/CRLF.
- A suíte completa não foi repetida nesta mudança visual; os 368 testes aprovados pertencem à etapa anterior.

Resultado:

A prévia agora apresenta a ilha compacta e expandida, com conteúdo ilustrativo de Agenda, Foco e Conexões. Mantidos o layout aprovado, o acesso à direita, as fontes e o vermelho do Kyro.

Pendências:

- Conferir visualmente a nova animação no navegador, incluindo a expansão em telas estreitas.
- Nenhum commit, push ou deploy foi executado.

## 2026-11-10 — v0.2.36 — Prévia maior no desktop e carregamento alinhado ao login

Objetivo:

Aumentar a apresentação no computador conforme a captura do usuário e substituir a tela branca de carregamento pela identidade aprovada para o login.

Alterações:

- Removidos os limites de 620px/740px da prévia em desktops baixos e reduzido o vão até o formulário. Em 1536×681 CSS, a prévia passou a ocupar 956px; em 1920×851, 1218px.
- Reorganizada a apresentação em telas largas e baixas: título e descrição podem ficar em uma linha e o conteúdo das janelas se distribui horizontalmente para ocupar a largura disponível.
- Reposicionada a ilha para a direita da demonstração e mantida a janela de fundo mais clara durante sua expansão.
- Corrigidos os espaçamentos do desktop e da barra lateral ilustrativa para caber na altura disponível sem cortar o formulário ou gerar barra vertical desnecessária.
- Criado `carregamento.css` compartilhado pela abertura HTML e pelo componente React `CarregamentoKyro`, com grafite sólido, fontes Geist/Bricolage/Geist Mono locais, janelas em perspectiva, ilha e indicador indeterminado vermelho.
- Atualizado `index.html` para mostrar a nova apresentação antes de carregar o aplicativo. A verificação de sessão em `AreaDeTrabalho.tsx` usa o mesmo componente, substituindo o spinner azul isolado.
- Mantidos os estados reais de carregamento: nenhuma porcentagem inventada ou espera artificial foi adicionada. Movimento reduzido é respeitado.

Validação:

- `pnpm verificar`: aprovado antes da implementação do carregamento; o build final voltou a executar TypeScript para todas as mudanças.
- `pnpm build`: aprovado no estado final.
- `node --test scripts/configuracao-vite.test.mjs`: cinco testes aprovados, incluindo a rota local de autenticação e a ponte.
- Layout exercitado em Chrome headless com perfil e cache temporários, montando o componente real de login com as fontes e estilos do app; requisições de API e externas foram interceptadas, sem contas ou dados reais.
- Login testado com ilha aberta/recolhida em 1536×681, 1920×851, 1366×768, 1280×720, 1024×768, 768×1024, 390×844, 320×568 e 2560×1440: sem overflow horizontal.
- Após o ajuste final de altura, repetidos 1536×681, 1920×851 e 1366×768: `scrollWidth === clientWidth` e `scrollHeight === clientHeight`, com ilha aberta e recolhida.
- Carregamento testado em 320×568, 390×844, 667×375, 1366×768, 1536×681, 1920×851 e 2560×1440: sem rolagem horizontal; rolagem vertical apenas no cenário baixo 667×375.
- Capturas do login ampliado e do novo carregamento inspecionadas visualmente. Nenhum erro de execução foi observado nos cenários isolados.
- `git diff --check`: aprovado, apenas avisos de LF/CRLF.

Resultado:

A prévia ocupa melhor o desktop, a ilha fica mais legível e o carregamento mantém a mesma identidade do login desde a abertura inicial até a checagem de sessão. As pendências anteriores de conferência visual da apresentação foram verificadas nos cenários descritos acima.

Pendências:

- Autenticação com contas reais, teclado virtual físico, zoom real do navegador e Safari não foram testados nesta etapa.
- A suíte completa de 368 testes não foi repetida; foram executados build, cinco testes focados e verificações de layout.
- Nenhum commit, push, deploy ou alteração remota de banco foi executado.

## 2026-11-10 — v0.2.36 — Painel web em tela inteira e separação do desktop

Objetivo:

Separar a apresentação do aplicativo instalado, da web no computador e da web no celular. No navegador, o painel deve preencher a aba sem papel de parede nem moldura de janela.

Alterações:

- `AreaDeTrabalho.tsx` mantém o painel web montado e identifica os modos `web-computador` e `web-celular` conforme o espaço disponível.
- `JanelaSistema.tsx` compartilha a navegação e o conteúdo entre uma página web permanente e a janela nativa. A página web não monta os controles de minimizar, maximizar, fechar ou redimensionar.
- Criado `sistemaWeb.css` para preencher a área disponível, remover o papel de parede somente da web e respeitar as áreas seguras no celular. Mantida a navegação responsiva existente.
- `interface.ts` impede que estados antigos de painel fechado ou minimizado deixem o navegador vazio. O modo nativo preserva fechamento, minimização e geometria.
- `usarAtalhos.ts` direciona o atalho do painel para foco no navegador. `geometria.ts` considera toda a área da aba ao calcular a cobertura do painel web.
- Acrescentados dois testes em `scripts/interface.test.mjs` para a sessão web antiga fechada, redimensionamento e preservação do comportamento nativo.

Validação:

- `pnpm verificar`: aprovado; o build final também executou TypeScript.
- `node --test scripts/interface.test.mjs`: 22 testes aprovados.
- `pnpm build`: aprovado no estado final.
- `pnpm test`: 370 testes aprovados, nenhuma falha.
- Chrome headless com perfil e cache temporários, montando os componentes reais da área de trabalho com dados locais de prévia e bloqueando requisições externas/API: 1536×870, 1920×970, 1366×768, 1024×768, 768×1024, 390×844, 320×568 e 667×375.
- Nos oito tamanhos, o painel apresentou origem 0,0 e largura/altura iguais às do viewport; sem papel de parede, controles de janela, overflow horizontal da página ou do conteúdo principal. Geometria antiga preservada e nenhum erro de execução observado.
- Capturas de computador e celular inspecionadas visualmente.
- `git diff --check`: aprovado após remover uma linha vazia no fim do arquivo de testes; avisos de conversão LF/CRLF permanecem.

Resultado:

O navegador apresenta o painel diretamente em toda a aba, com barra lateral no computador e navegação reorganizada no celular. A janela nativa continua no caminho próprio do aplicativo instalado.

Pendências:

- O executável instalado não foi compilado nem iniciado nesta etapa; seu estado foi verificado pelos testes e pela compilação do código compartilhado.
- Autenticação com contas reais, Safari e dispositivos móveis físicos não foram testados nesta etapa.
- Nenhum commit, push, deploy ou alteração remota de banco foi executado.

## 2026-11-11 — v0.2.36 — Refinamento visual do sistema e das três partes da ilha

Objetivo:

Melhorar o acabamento do painel e das partes central, esquerda e direita da ilha, preservando as funções existentes e a identidade Kyro. O usuário autorizou a implementação e pediu que seja possível voltar se não gostar.

Alterações:

- Criado `src/estilos/visualKyro.css`, importado ao final dos estilos em `src/main.tsx`. Nenhum componente funcional ou regra de negócio foi alterado nesta etapa.
- Refinados os espaçamentos, a marca e a seleção da navegação lateral. O indicador mantém sua animação existente, agora com superfície sólida suave em lugar do gradiente e do brilho.
- Separados os cartões do Início, com bordas discretas, sombras suaves e espaçamento próprio. Corrigido o espaçamento do foco para evitar empilhamento desnecessário no desktop.
- Refinadas a hierarquia dos títulos, a apresentação dos números, as divisórias, os botões e os cartões compartilhados entre páginas. As fontes já existentes foram preservadas.
- Na paleta padrão, tema claro com fundo neutro e cartões brancos; tema escuro com grafite e maior contraste dos textos secundários. As outras paletas continuam usando suas cores configuradas.
- Refinados contornos, abas, botões, painéis e tipografia da ilha central e das laterais, respeitando as cores personalizadas, a geometria e o comportamento existentes. Nenhum efeito decorativo em gradiente foi acrescentado.
- Mantida a adaptação ao celular e a separação entre painel web e janela nativa. O login não recebeu alterações nesta revisão.

Reversão:

- Esta revisão visual é desativada retirando somente o import de `visualKyro.css` no `main.tsx`. O arquivo novo também pode ser removido em seguida.
- Cópia do `main.tsx` anterior à revisão guardada em `node_modules/.kyro-revisoes/visual-2026-11-11/main.tsx`. Não restaurar esse arquivo inteiro se houver trabalho posterior no `main.tsx`; retirar o import é suficiente.
- As alterações anteriores do usuário e das outras tarefas foram preservadas.

Validação:

- `pnpm build`: aprovado no estado final, incluindo TypeScript e build de produção.
- `node --test scripts/interface.test.mjs scripts/ilha.test.mjs scripts/animacoes-ilha.test.mjs scripts/midia.test.mjs`: 64 testes aprovados, nenhuma falha. Houve aviso de porta WebSocket de testes já em uso, sem falha dos testes.
- Chrome headless isolado com cache e perfil temporários, componentes reais e dados fictícios de prévia. Chamadas à API, à ponte e a serviços externos foram bloqueadas, sem autenticação ou dados reais.
- Início testado nos temas claro e escuro em 320×568, 390×844, 667×375, 768×1024, 1024×768, 1366×768, 1536×900, 1920×1080 e 2560×1440: 18 combinações, sem overflow horizontal da página ou do conteúdo principal. O painel continuou preenchendo o viewport.
- Verificados navegação para Empresa/Escritório e acesso a Rotina, Finanças e Ajustes; as três últimas também foram verificadas em 390×844, sem overflow horizontal do conteúdo principal.
- Ilha expandida verificada com as duas laterais presentes; abertos os painéis de Materiais e controles rápidos. Ilha no celular permaneceu dentro da largura disponível.
- Capturas de antes/depois, claro, escuro, celular, Empresa, ilha e controles rápidos inspecionadas visualmente. Nenhum erro de execução observado na rodada final da prévia.
- `git diff --check`: aprovado, apenas os avisos LF/CRLF já existentes.

Resultado:

Aplicada uma revisão visual sóbria, com superfícies sólidas, cartões separados e hierarquia mais clara, preservando os controles e comportamentos. A revisão pode ser retirada de forma independente.

Pendências:

- A aprovação estética cabe ao usuário após conferir o resultado no sistema.
- O executável nativo, ações reais dos controles do Windows, autenticação com contas reais, Safari e aparelhos físicos não foram exercitados nesta etapa.
- A suíte completa de 370 testes não foi repetida; foram executados os 64 testes pertinentes e o build final.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Nova composição do painel e da ilha após revisão visual

Objetivo:

Atender à correção do usuário: o refinamento anterior foi sutil demais e manteve a mesma aparência. Implementar uma mudança evidente de composição, mantendo as funções e evitando gradientes decorativos.

Alterações:

- Reescrito `src/estilos/visualKyro.css`, substituindo a revisão anterior. Menu em grafite nos dois temas, marca com maior presença, seleção sólida e nova organização dos espaçamentos.
- `Inicio.tsx` agora agrupa a visão geral em uma seção e o cabeçalho em uma abertura própria. O cabeçalho tem superfície grafite, tipografia ampliada, marca d'água decorativa e os mesmos controles de Funções, Personalizar e Agentes.
- Acrescentados os ícones já existentes aos cabeçalhos dos blocos e uma seta à ação do Kyro. A ordem, a visibilidade dos blocos, seus dados e suas ações permanecem vinculados às configurações anteriores.
- A grade no computador passa a usar dois painéis amplos por linha, em vez de três colunas equivalentes. Foco tem superfície própria em grafite, e Hoje, Finanças e Revisões têm cartões independentes.
- Ilha expandida no computador com abas em coluna vertical e ferramentas no rodapé. Dicas dos controles passam a abrir acima do rodapé para permanecer dentro da ilha. No celular, as abas continuam no topo.
- Laterais esquerda e direita da ilha passam a ser cápsulas separadas. `BarraDoTopo.tsx` ajusta a altura de 30 para 42px e reposiciona os painéis pela mesma medida, mantendo as ações existentes.
- Nenhuma alteração no login, nas permissões, no banco ou nas APIs.

Validação:

- `pnpm build`: aprovado e repetido após o ajuste final das dicas da ilha.
- `pnpm test`: suíte completa com 370 testes aprovados, nenhuma falha. Após essa execução houve somente o ajuste CSS das dicas/rolagem das abas, conferido no build e na rodada visual final.
- Chrome headless isolado, com perfil e cache temporários, dados fictícios e bloqueio das APIs/ponte/serviços externos: temas claro e escuro em 320×568, 390×844, 667×375, 768×1024, 1024×768, 1366×768, 1536×960, 1920×1080 e 2560×1440. As 18 combinações ficaram sem overflow horizontal da página e do conteúdo principal.
- Aberto o painel Personalizar pelos controles reais da nova abertura; verificada a presença das opções e o fechamento com Escape. Navegação para Empresa/Escritório exercitada.
- Ilha testada em Hoje, Foco, Conexões e Time. Após estabilizar as animações, as áreas de Foco (660×176), Conexões (660×350) e Time (780×430) tiveram dimensões de rolagem iguais às dimensões disponíveis, sem conteúdo externo ao contêiner.
- Verificados os dois lados da ilha, abertura de Materiais e controles rápidos e apresentação da ilha no celular dentro dos limites horizontais. Nenhum erro de execução na rodada final.
- Requisições HTTP ao servidor já existente em `localhost:5420` confirmaram o import da folha visual e a entrega dos estilos da nova abertura e do menu grafite.
- Capturas inspecionadas visualmente; prévias e arquivos anteriores guardados em `node_modules/.kyro-revisoes/visual-2026-11-11-v2/`. Os arquivos anteriores são `visualKyro.css`, `Inicio.tsx` e `BarraDoTopo.tsx`; preservam o estado imediatamente anterior a esta revisão.
- `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

Aplicada uma nova composição perceptível no painel e na ilha, substituindo o refinamento rejeitado. As capturas mostram menu grafite, abertura destacada, cartões amplos e a navegação vertical da ilha.

Pendências:

- A aprovação estética permanece com o usuário após ver a nova composição.
- Aplicativo instalado, ações reais do Windows, autenticação real, Safari e aparelhos físicos não foram exercitados nesta etapa.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Revelação das laterais da ilha pelo mouse

Objetivo:

Permitir revelar as laterais superiores passando o mouse nos cantos esquerdo e direito, sem clicar ou abrir a ilha central.

Alterações:

- `BarraDoTopo.tsx` mantém áreas de detecção nos dois cantos superiores. Quando as cápsulas aparecem, essas áreas se reduzem para não cobrir seus botões.
- O estado de uso das laterais passa a participar da decisão em `visibilidadeDaBarra.ts`, permitindo revelação mesmo com a ilha central escondida e o painel em foco. As preferências de ativação, saudação e tela cheia continuam sendo respeitadas.
- Adicionado um atraso de 250ms ao sair com o ponteiro, cancelado ao entrar novamente. Painéis abertos mantêm a barra visível; temporizadores e estado de uso são limpos ao desmontar.
- `Ilha.tsx` habilita os gatilhos somente fora do modo móvel e inclui suas áreas no registro de interação do aplicativo nativo.
- `barra.css` define as áreas de hover e `scripts/ilha.test.mjs` verifica a nova regra de visibilidade e seus bloqueios.

Validação:

- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- `node --test scripts/ilha.test.mjs scripts/animacoes-ilha.test.mjs scripts/interface.test.mjs`: 61 testes aprovados, nenhuma falha.
- Chrome headless isolado com componentes reais, dados fictícios e APIs/ponte/serviços externos bloqueados. Testados movimentos e cliques de ponteiro, sem simular eventos diretamente nos elementos.
- Em 1536×900, verificados os dois cantos: hover revela as laterais mantendo o estado da central compacto; mover aos botões mantém a barra; abrir Materiais/controles rápidos e mover o mouse para fora mantém os painéis abertos; Escape fecha e permite recolher.
- Verificado que sair do canto sem clicar também recolhe as laterais. Em 390×844, os gatilhos laterais não são montados e não cobrem os controles móveis.
- Nenhum erro de execução na conferência isolada. `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

Os dois cantos superiores agora revelam as laterais diretamente pelo mouse, independentemente de abrir a ilha central.

Pendências:

- A interação no executável instalado e em aparelhos físicos não foi exercitada; o código nativo compartilhado foi compilado e os gatilhos incluídos no registro de áreas interativas.
- A suíte completa não foi repetida nesta correção; executados os 61 testes pertinentes e a conferência de interação no navegador.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Continuidade da faixa superior entre as ilhas

Objetivo:

Restaurar a ligação visual entre as laterais e a ilha central conforme as duas capturas enviadas pelo usuário, preservando o hover dos cantos e a revisão visual interna.

Alterações:

- `visualKyro.css`: removidas as regras que escondiam a faixa superior, afastavam as cápsulas das bordas e suprimiam seus encaixes. A geometria conectada de `barra.css` volta a ser usada.
- `BarraDoTopo.tsx`: altura da faixa e raio dos encaixes passam a acompanhar a escala da ilha, evitando desalinhamento nos tamanhos pequeno e grande.
- `Ilha.tsx` e `BarraDoTopo.tsx`: quando a central está escondida, a faixa não recebe o recorte central. Assim, revelar apenas as laterais pelo mouse mantém a faixa contínua em toda a largura.
- Mantidos navegação vertical, controles no rodapé, estilos internos e gatilhos de mouse implementados nas etapas anteriores.

Validação:

- Comparadas as capturas `011347` e `011448` fornecidas pelo usuário.
- `pnpm build`: aprovado e repetido após o ajuste final do recorte.
- `node --test scripts/ilha.test.mjs`: 27 testes aprovados, nenhuma falha.
- Chrome headless isolado com componentes reais, dados fictícios e chamadas à API/ponte/serviços externos bloqueadas: 1920×900 (média), 1536×900 (pequena e grande), 1366×900 (média) e 2560×900 (média).
- Verificados faixa visível, laterais encostadas nas bordas do viewport, mesma cor nas três partes e alinhamento da faixa e dos encaixes. Nas escalas 0,85, 1 e 1,15, as junções ficaram respectivamente em 4,25px, 5px e 5,75px, com raios correspondentes em 8,5px, 10px e 11,5px.
- Hover real nos cantos esquerdo e direito conferido com a central recolhida: laterais aparecem sem abrir a central, faixa sem recorte vazio e recolhimento ao sair. Em 390×844 não são montados faixa ou gatilhos laterais.
- Capturas da barra conectada e da revelação pelo hover inspecionadas visualmente. Nenhum erro de execução na rodada isolada. Prévias em `node_modules/.kyro-revisoes/conexao-2026-11-11/`.
- `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

Restaurada a faixa contínua com encaixes arredondados, ligando as laterais à ilha central. O hover dos dois cantos continua disponível.

Pendências:

- Executável instalado e aparelhos físicos não foram iniciados nesta etapa. A suíte completa não foi repetida; executados o build, os 27 testes da ilha e a conferência visual descrita acima.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Cadastro dos seis sistemas em Apps Empresa

Objetivo:

Substituir os aplicativos provisórios de Apps Empresa pelos nomes e endereços fornecidos pelo usuário. Manter o Início como está nesta etapa e indicar Armários geral em manutenção.

Alterações:

- `aplicativosEmpresaConfig.ts`: cadastrados Registros de limpeza e Calendário Limpeza com `https://registros-limpeza.brasalrefrigerantes.com.br/`; Solicitação de material com `https://inventario-internoo.vercel.app/manutencao.html`; Sistema de requisições com `https://sistema-requisicoes.vercel.app/`; Avaliação NPS com `https://avalia-ai-seven.vercel.app/`; Armários geral sem URL e em manutenção.
- Mantidos dois atalhos distintos para limpeza, com o mesmo endereço, exatamente conforme informado. Mantido o identificador `materiais`, usado pelo formulário público existente.
- `AplicativosEmpresa.tsx`: botões com nomes acessíveis e abertura pelo mecanismo `abrirLink` do Kyro, que usa nova aba na web e o comando nativo no aplicativo instalado. Armários tem ícone de manutenção e botão desativado.
- A lista de pedidos existente foi identificada como “Solicitações recebidas no Kyro”, com indicação do formulário público, para deixar clara a origem desses dados. Nenhuma sincronização com as APIs dos sistemas externos foi implementada.
- `escritorio.css`: grade adaptável de uma, duas ou três colunas, cartões com botões alinhados e largura intrínseca adequada ao celular.
- O catálogo continua compartilhado com o portal público; seu formulário próprio de materiais não foi substituído nesta etapa.

Validação:

- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- Chrome headless isolado com componentes reais, dados fictícios e chamadas de API/ponte/serviços externos bloqueadas.
- Dono e gerência verificados separadamente: seis cartões com nomes esperados; cliques de ponteiro nos cinco botões ativos acionaram as URLs exatas com `_blank` e `noopener,noreferrer`; clicar no botão de Armários não acionou abertura.
- O `window.open` da prévia foi interceptado para conferir os argumentos sem navegar nos sistemas externos. Nenhuma conta real foi usada.
- Temas claro e escuro em 320×568, 390×844, 768×1024, 1024×768, 1366×768, 1536×1000 e 1920×1080: 14 combinações sem overflow horizontal da página ou do conteúdo principal. Capturas de computador e celular inspecionadas visualmente.
- Nenhum erro de execução observado na prévia. Capturas em `node_modules/.kyro-revisoes/apps-empresa-2026-11-11/`.
- `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

Os seis sistemas aparecem em Empresa → Apps Empresa, com cinco atalhos configurados e Armários geral em manutenção. Registros e Calendário Limpeza usam o mesmo destino informado.

Pendências:

- O usuário ainda não informou um endereço para Armários geral.
- A ferramenta de navegação não conseguiu acessar os quatro endereços externos distintos. Disponibilidade, autenticação e funcionalidades internas desses sistemas não foram validadas.
- Executável instalado e aparelhos físicos não foram iniciados; o fluxo compartilhado foi compilado e os destinos conferidos na web. A suíte completa não foi repetida nesta alteração de catálogo.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Endereço do Calendário Limpeza atualizado

Objetivo:

Aplicar o endereço informado para Calendário Limpeza, separando seu destino de Registros de limpeza.

Alteração:

- `aplicativosEmpresaConfig.ts`: Calendário Limpeza passa a abrir `https://calendario-dpa.vercel.app/`. Registros de limpeza permanece em `https://registros-limpeza.brasalrefrigerantes.com.br/`.

Validação:

- Conferência executada com Node importando o catálogo real e comparando os dois destinos aos endereços informados: aprovada.
- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

Os dois atalhos têm destinos distintos no catálogo compartilhado.

Pendências:

- A ferramenta de navegação não conseguiu acessar o novo endereço; autenticação e funcionalidades internas do calendário não foram validadas.
- Nenhum commit, push, deploy ou alteração de banco foi executado.

## 2026-11-11 — v0.2.36 — Prévia dos sistemas abrindo dentro do Kyro

Objetivo:

Permitir ao usuário experimentar os sistemas dentro da área Apps Empresa, preservando a navegação do Kyro e uma alternativa de abertura externa.

Alterações:

- `AplicativosEmpresa.tsx`: o botão dos cinco aplicativos ativos agora seleciona o sistema para abertura interna. Armários permanece desativado. Voltar restaura o catálogo e sua lista de solicitações.
- Criados `SistemaEmpresaAberto.tsx` e `sistemaEmpresaAberto.css`: visualizador que ocupa a área principal, com título do aplicativo, iframe, Voltar aos apps, Recarregar, Nova aba e atalho de foco para o sistema.
- Layout adaptável, sem escala artificial. Em alturas insuficientes, a área principal permite rolagem para preservar o quadro e os controles.
- O iframe permite scripts, formulários, origem própria, janelas auxiliares, downloads e diálogos. A navegação do topo permanece bloqueada pelo sandbox. Não são enviados tokens ou credenciais do Kyro para os sistemas externos.
- `src-tauri/tauri.conf.json`: acrescentadas somente as cinco origens cadastradas à diretiva `frame-src`, preservando as permissões existentes de PDF e os demais controles. A política do build web continua derivando dessa configuração.
- `scripts/pre-lancamento.test.mjs`: reforçada a verificação da política, exigindo correspondência exata entre as origens dos aplicativos ativos e a lista permitida para frames.
- O carregamento não anuncia autenticação ou integração concluída. A ajuda oferece Nova aba caso o conteúdo não apareça; não há redirecionamento automático nem tentativa de contornar bloqueios dos sites.

Validação:

- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- `node --test scripts/pre-lancamento.test.mjs scripts/configuracao-vite.test.mjs`: 24 testes aprovados, nenhuma falha.
- Chrome headless isolado com perfil/cache temporários e dados fictícios do Kyro. Primeiro usados documentos externos simulados e a diretiva real de `frame-src`, com APIs do Kyro/ponte bloqueadas, para conferir os controles sem contas reais.
- Dono e gerência: cinco aberturas internas, recarga do quadro e volta ao catálogo; a abertura interna não chama `window.open`. Alternativa Nova aba conferida separadamente com URL, `_blank` e `noopener,noreferrer`.
- Simulado um site com `X-Frame-Options: DENY`: os controles do Kyro e a alternativa externa continuaram disponíveis, sem redirecionamento automático.
- Temas claro e escuro em 320×568, 390×844, 667×375, 768×1024, 1024×768, 1366×768, 1536×1000 e 1920×1080: 16 combinações sem overflow horizontal do Kyro e com área útil do quadro preservada. Capturas de computador e celular inspecionadas.
- Em seguida, tentada a abertura real das cinco páginas públicas no visualizador, sem login ou envio de formulário. Todas responderam HTTP 200, sem bloqueio de frame observado nas páginas iniciais.
- Inspecionadas as páginas reais: entrada de Registros de limpeza; login do Calendário; manutenção no endereço fornecido para Material; login de Requisições; portal de seleção de áreas do NPS.
- O NPS apareceu em branco numa captura inicial. Conferido com espera maior em frame com/sem sandbox e em acesso direto; o portal apareceu nas três situações. Houve uma resposta HTTP 400 de recurso do próprio site nos três modos, sem impedir a apresentação. Repetida a captura dentro do próprio Kyro, com o portal visível após carregar.
- Prévias em `node_modules/.kyro-revisoes/apps-internos-2026-11-11/`. `git diff --check`: aprovado, com os avisos LF/CRLF já existentes.

Resultado:

A prévia permite experimentar os cinco sites na área central do Kyro com a navegação lateral preservada. Material mostra a página de manutenção informada pelo usuário. Armários continua em manutenção.

Autenticação e continuidade:

- Durante a tarefa, o usuário perguntou sobre manter login salvo. Confirmado no código que o Kyro persiste a sessão no navegador e cria sessões com validade de 30 dias; validade, revogação e saída continuam sob controle do servidor.
- As sessões dos aplicativos externos não foram testadas com contas reais nem alteradas. Lembrar o login de cada aplicativo depende da persistência de cada sistema e das regras de armazenamento do navegador. Login único entre todos exige integração própria; não foi implementado nesta prévia.
- O Início foi mantido conforme a orientação mais recente: cartão do Kyro informativo, com seta/clique para chat retirados anteriormente; Mapa do ano permanece no sistema.

Pendências:

- Validar logins e fluxos autenticados com contas reais, incluindo persistência de sessão nos sistemas externos.
- A responsividade interna de cada site continua sendo responsabilidade de seu próprio código. O Calendário mostrou rolagem horizontal dentro do frame na captura de desktop; o contêiner do Kyro não apresentou overflow horizontal.
- Executável instalado, Safari e dispositivos físicos não foram exercitados. A suíte completa não foi repetida; executados build, os 24 testes pertinentes e as conferências descritas.
- Nenhum commit, push, deploy, alteração de banco ou modificação dos sites externos foi executado.

## 2026-11-11 — v0.2.36 → v0.2.37 planejada — Comandos de publicação

Objetivo:

Orientar o usuário a publicar as mudanças atuais como v0.2.37 pelo fluxo do README, com geração dos instaladores pelo GitHub Actions.

Conferência:

- Lidos o checklist do README, os scripts de sincronização/verificação e o workflow `pacotes-windows.yml`.
- `pnpm lancar:verificar`: as quatro versões locais continuam sincronizadas em 0.2.36.
- Branch local `main`, remoto `origin` em `Pablofellype/kyro`; nenhuma tag local v0.2.37 encontrada.
- `git ls-remote --tags origin refs/tags/v0.2.37`: sem resultado, confirmando ausência dessa tag no remoto no momento da consulta.

Resultado e pendências:

- A sequência orientada começa com sincronização para 0.2.37, verificações, testes e build, seguida de commit, rebase, push da main e criação/push da tag v0.2.37. O push da tag aciona o workflow Windows.
- Esta etapa forneceu orientação; sincronização, commit, push e publicação da v0.2.37 não foram executados pelo assistente.
- A suíte completa deve passar antes de o usuário enviar a nova versão. Login único entre os sistemas permanece para uma etapa futura, conforme sua orientação.

