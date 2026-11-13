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

## 2026-11-11 — v0.2.37 — Correção das falhas de teste e versão no GitHub Actions

Objetivo:

Corrigir as duas falhas mostradas nas cinco capturas: a tag v0.2.37 apontando para um projeto ainda em 0.2.36 e o teste de autenticação recebendo HTTP 500 em vez de 400 no Windows e no Linux.

Diagnóstico:

- O commit local e remoto `6006c30` tem mensagem “Prepara release 0.2.37”, mas mantinha os quatro arquivos de versão em 0.2.36. A main e a tag v0.2.37 apontam para esse commit.
- A ponte preparava o banco antes de validar e-mail/senha. Com as configurações locais, o teste passava; sem DATABASE_URL/POSTGRES_URL, como no CI, a preparação lançava erro e retornava 500.
- O teste de regressão foi primeiro executado com as duas variáveis de banco removidas e reproduziu exatamente `500 !== 400` antes da correção.
- API pública do GitHub: repositório acessível (200) e release v0.2.37 inexistente (404). O empacotamento falhou antes de publicar os instaladores.

Alterações:

- `servidor/ponte.ts` e `api/auth.ts`: login valida primeiro a presença e o tipo de e-mail e senha. A preparação do banco ocorre depois dessa validação. Credenciais inválidas retornam 400 sem consultar o banco; indisponibilidade da preparação retorna 503. As verificações de origem e da ponte continuam antes do login local.
- `scripts/configuracao-vite.test.mjs`: o teste remove explicitamente as configurações de banco durante sua execução e as restaura no encerramento. Exercita campos vazios, ausentes, tipos incorretos, e-mail em branco e indisponibilidade de banco, tanto na ponte quanto na API.
- Executado `pnpm versao:sincronizar 0.2.37`, atualizando package.json, tauri.conf.json, Cargo.toml, Cargo.lock e o badge do README.
- A instalação automática acionada pelo pnpm após a alteração do manifesto falhou por restrição de rede do sandbox. Dependências restauradas com `pnpm install --frozen-lockfile --prod=false`, com acesso autorizado; nenhum pacote ou lockfile foi atualizado.

Validação:

- Teste focado de autenticação sem banco: aprovado após reproduzir a falha original.
- `pnpm test`: 371 testes aprovados, nenhuma falha.
- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- `pnpm lancar:verificar`: quatro arquivos sincronizados em 0.2.37.
- `git diff --check`: aprovado, apenas avisos LF/CRLF.
- `git ls-remote`: main e tag remotas ainda apontam para `6006c30`; a correção local não foi publicada pelo assistente.

Resultado:

Correções prontas localmente, com a versão correta e a suíte completa aprovada. O usuário precisa enviar o commit corrigido e recriar a tag v0.2.37 para disparar uma nova execução do empacotamento.

Pendências:

- Ainda não houve nova execução corrigida do GitHub Actions; o resultado no CI depende do envio pelo usuário.
- Nenhum commit, push, remoção/recriação de tag ou publicação foi executado pelo assistente. Nenhuma credencial ou banco remoto foi alterado.

## 2026-11-11 — v0.2.37 — Correções no vínculo e na renovação do QR do WhatsApp

Objetivo:

Investigar a falha de conexão por QR Code relatada pelo usuário e corrigir problemas reproduzíveis no fluxo existente. A mensagem exata e o ambiente da tentativa real ainda não foram informados.

Diagnóstico:

- `dispositivoDoGateway` reutilizava outro dispositivo quando o identificador solicitado não existia. Isso podia impedir a criação da sessão correta e misturar contas.
- O QR vencido continuava sendo entregue pelo estado, inclusive depois de erro na renovação. O download da imagem iniciava uma nova contagem e o mínimo fixo de 20 segundos prolongava códigos curtos.
- A interface exibia somente `gateway_fora` entre os erros de estado. Outros erros recebidos pelo worker não eram apresentados no modal.
- Conferido o código oficial do GOWA v9.6.0: `qr_duration` corresponde à metade do tempo do código. A conversão para o tempo real foi preservada, com margem de cinco segundos; não se tratava simplesmente de remover o multiplicador. Fonte: https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v9.6.0/src/usecase/app.go.
- Tentada consulta somente de leitura ao estado de `kyro-gowa.service` e `kyro-worker.service`, com a chave existente do gateway. A conexão SSH ao host conhecido expirou; nenhum registro remoto nem versão instalada do GOWA foi obtido. Não se pode atribuir a falha real a uma versão ou a um erro específico do VPS sem essa evidência.

Alterações:

- `servidor/whatsapp/caixa.ts`: busca exata quando há dispositivo solicitado, retornando ausência em vez de selecionar outra conta; validação de duração numérica positiva e finita.
- `servidor/whatsapp/whatsapp.ts`: remove o QR antigo antes da renovação; calcula o vencimento antes de baixar a imagem; não publica imagem vencida ou inválida; impede entregar QR vencido/desligado; inclui `qrExpira` no estado.
- `src/ponte/whatsapp.ts`: campo opcional `qrExpira` para compatibilidade com workers anteriores.
- `ConexaoWhatsapp.tsx`: retira o QR ao vencer, faz uma única consulta nesse momento e apresenta os demais erros do gateway com `role="alert"`.
- `src/textos/textos.ts`: mensagens para falhas de QR, autenticação e configuração de acesso ao gateway.
- `scripts/whatsapp.test.mjs`: sete regressões com gateway, relógio e dados isolados. Nenhuma conta real ou mensagem foi usada. Limpeza dos diretórios de teste verifica o caminho temporário antes de remover.

Validação:

- Antes da correção: quatro testes reproduziram seleção de outra conta, QR vencido visível, imagem antiga após falha e vencimento prolongado por download lento.
- Após a correção: os 11 testes de WhatsApp passaram, incluindo criação do dispositivo correto, recuperação após falha, confirmação do vínculo e rejeição de imagem inválida.
- `pnpm test`: 378 testes aprovados, nenhuma falha. Execução inicialmente bloqueada por `spawn EPERM` no sandbox; repetida com autorização e concluída com sucesso. Registro em `node_modules/.kyro-revisoes/whatsapp-qr-2026-11-11/testes.log`.
- `pnpm build`: aprovado, incluindo TypeScript e build de produção.
- Chrome headless com perfil temporário, componente real e chamadas de API simuladas: erro de QR visível, imagem retirada no vencimento, exatamente uma consulta ao vencer, novo QR visível e confirmação de conexão retirando a imagem. Nenhum erro de execução observado. Nenhuma sessão de navegador do usuário foi utilizada.
- Prévia isolada em `node_modules/.kyro-revisoes/whatsapp-qr-2026-11-11/`. Script temporário de automação removido após o teste.
- `git diff --check`: aprovado, apenas aviso LF/CRLF existente.

Resultado e pendências:

- Correções prontas e verificadas localmente. A conexão real com o telefone não foi concluída nem declarada resolvida.
- Falta receber o erro exato, saber se a tentativa é no navegador ou no aplicativo instalado e consultar os registros/versão do gateway remoto quando ele estiver acessível.
- Para aplicar no ambiente publicado, será necessário enviar estas alterações e atualizar o worker no VPS; isso não foi realizado nesta tarefa. Não foi alterado o número da versão.
- Nenhum commit, push, deploy, reinício de serviço, exclusão de sessão, troca de credencial, envio de mensagem ou alteração de banco remoto foi executado.

## 2026-11-11 — v0.2.37 — Mensagem de vínculo recusado confirmada no celular

Objetivo:

Direcionar o diagnóstico a partir da informação exata do usuário: o QR aparece no Kyro, mas o WhatsApp do celular informa “não é possível conectar novos dispositivos no momento, tente novamente mais tarde”.

Conferência e resultado:

- A recusa acontece na etapa de vínculo após a leitura do QR. A mensagem não comprova, sozinha, bloqueio da conta, limite de dispositivos ou incompatibilidade do gateway.
- Consultadas fontes primárias: central oficial do WhatsApp sobre dispositivos conectados e discussão #718 do GOWA sobre vínculos recusados em contas específicas. Os relatos do GOWA mostram que a confirmação do vínculo pode falhar mesmo quando a conexão e a emissão do QR funcionam; não constituem diagnóstico desta conta sem registros da tentativa.
- Solicitado teste com o mesmo número no WhatsApp Web oficial. Se funcionar, priorizar o gateway/sessão e seus registros; se também falhar, investigar o fluxo oficial, dispositivos conectados e condições do celular/rede/conta. O teste é uma forma de direcionar a investigação, não uma prova definitiva da causa.
- Fontes: https://faq.whatsapp.com/378279804439436/?cms_platform=android&locale=pt_BR e https://github.com/aldinokemal/go-whatsapp-web-multidevice/discussions/718.

Alterações, validação e pendências:

- Acrescentado somente este registro; nenhum novo ajuste funcional ou teste de código nesta continuação. As correções locais e os 378 testes aprovados da entrada anterior permanecem.
- Aguardar o resultado do teste oficial e a identificação do ambiente usado (web ou executável). A versão instalada do GOWA e os registros do VPS continuam desconhecidos após o timeout SSH da investigação anterior.
- Nenhuma sessão foi apagada, nenhum dispositivo foi desvinculado e nenhum serviço remoto foi alterado.

## 2026-11-11 — v0.2.37 — WhatsApp Web oficial conectou com o mesmo número

Objetivo:

Prosseguir na investigação do vínculo recusado pelo celular após o usuário confirmar que o mesmo número conectou normalmente no WhatsApp Web oficial.

Conferência:

- O teste comprova que o número conseguiu realizar um vínculo pelo fluxo oficial naquele momento. Direciona a investigação para a sessão, versão, comunicação e compatibilidade do gateway usado pelo Kyro, sem provar uma causa específica nem excluir restrições aplicadas somente ao gateway.
- Confirmado em `whatsappRemotoAtivo` que o perfil de dono usa normalmente o VPS tanto no navegador quanto no executável; o modo nativo local depende da configuração explícita de desenvolvimento.
- Repetida consulta SSH somente de leitura ao host conhecido: conexão à porta 22 expirou novamente. Não foram obtidos estado dos serviços, versão instalada nem registros de pareamento. Esse timeout do SSH não comprova que o gateway HTTP esteja parado.
- Conferidas as releases oficiais do GOWA: há mudanças de autenticação e TLS a partir da v9.8.0. Não foi feita atualização automática sem conhecer a versão/configuração existente. Fonte: https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/tag/v9.8.0.

Alterações e validação:

- Acrescentado somente este registro. Nenhuma nova alteração funcional nem nova execução de testes nesta continuação; os resultados de 378 testes e build da correção local anterior continuam registrados acima.
- Nenhum commit, deploy, reinício, atualização do GOWA, limpeza de sessão ou mudança de conta foi executado.

Resultado e pendências:

- Necessário obter os registros recentes de `kyro-gowa.service` pelo console do Droplet na DigitalOcean, já que o acesso SSH daqui não está disponível. Esses registros devem direcionar a correção, antes de apagar sessões ou trocar versões.
- A conexão real do Kyro permanece pendente. O êxito do WhatsApp Web oficial não foi tratado como êxito do gateway.

## 2026-11-12 — v0.2.37 local — Estado do VPS identificado pelo console

Objetivo:

Continuar a atualização do servidor e do gateway, autorizada pelo usuário, a partir da captura `Captura de tela 2026-11-12 104102.png`.

Conferência:

- Console em `/opt/kyro`, sem alterações apresentadas por `git status --short`.
- HEAD e referências locais do VPS em `096e5a1`, mensagem “Prepara release 0.2.31”. Conferido esse commit no repositório local: seu package.json informa 0.2.31. As referências `origin/main` mostradas no VPS ainda dependem de fetch; não indicam que o GitHub atual esteja nessa versão.
- Executável ativo do GOWA identificado por `/proc`: `/root/.local/share/com.niko.empresa/whatsapp/gowa`.
- O checkout do computador permanece em `9676182`, versão 0.2.37, com as correções de WhatsApp da investigação anterior ainda sem commit/push. Um pull da main no VPS não inclui essas alterações locais.
- Conferidas as diferenças de dependências entre 0.2.31 e a main local: adições de `@vercel/blob` e `@vercel/node`. Instalação/reinício no servidor devem ser acompanhados, sem presumir que o processo já carregou a versão nova.
- Release oficial mais recente do GOWA consultada nesta data: v9.9.0, com notas que remetem às mudanças de autenticação/TLS da v9.8.0. A versão instalada no VPS continua desconhecida.

Alterações e validação:

- Acrescentado somente este registro; nenhuma nova alteração funcional ou teste local nesta etapa.
- Orientada atualização inicial do checkout com `git pull --ff-only origin main`, seguida de conferência da versão do projeto, arquitetura e versão do executável GOWA identificado. Esses comandos ainda não tiveram resultado observado.
- Nenhuma atualização, parada, reinício, alteração de configuração ou exclusão de dados no VPS foi executada pelo assistente.

Pendências:

- Receber a saída do pull e das verificações para atualizar o GOWA com binário da arquitetura correta, conferência de integridade e cópia de segurança antes da substituição.
- Concluir dependências/carregamento do worker conforme sua forma de execução, conferir health check e validar o vínculo real com o celular após a atualização.

## 2026-11-12 — v0.2.37 — Versões do checkout e do GOWA confirmadas no VPS

Objetivo:

Prosseguir na atualização autorizada a partir da captura `Captura de tela 2026-11-12 104430.png`.

Conferência:

- O package.json no console do VPS agora informa 0.2.37. A captura não mostra a saída do pull nem comprova que o worker em execução já carregou esse código.
- Arquitetura retornada por `uname -m`: x86_64.
- `/root/.local/share/com.niko.empresa/whatsapp/gowa version`: 9.7.0.
- Pacote oficial selecionado: `whatsapp_9.9.0_linux_amd64.zip`, release v9.9.0. SHA-256 publicado pelo GitHub: `b3a0afc3cd2721198de60032a21f7f0aa78e58d0a478a7b00566d1604b7aa574`. Origem: https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/expanded_assets/v9.9.0.
- Conferido no código oficial v9.9.0 que o subcomando `version` pula a inicialização de configuração e armazenamento. A extração usa somente a entrada `linux-amd64`, o mesmo nome esperado pelo instalador do projeto.

Alterações e validação:

- Acrescentado somente este registro, sem mudanças funcionais ou testes de código nesta continuação.
- Preparada orientação para baixar e conferir o ZIP em pasta separada, extrair o novo executável sem substituir o atual, confirmar sua versão e consultar somente diretórios/arquivos de ambiente declarados nos serviços. Não se solicita o conteúdo das credenciais.
- Esses comandos de preparação ainda não tiveram resultado observado. Nenhum serviço foi parado/reiniciado nem binário ativo foi substituído pelo assistente.

Pendências:

- Obter os diretórios e arquivos de ambiente dos serviços para preservar a instalação real durante o backup e conferir as mudanças de autenticação/TLS antes da substituição.
- Concluir atualização do GOWA, dependências/carregamento do worker, health check e teste de pareamento com o telefone. O simples número 0.2.37 do checkout não comprova a atualização do processo ativo.

## 2026-11-12 — v0.2.37 — Pacote GOWA 9.9.0 conferido e troca preparada

Objetivo:

Prosseguir com backup e substituição do gateway após a captura `Captura de tela 2026-11-12 105029.png`.

Conferência:

- O ZIP oficial Linux amd64 terminou o download e `sha256sum -c` retornou `whatsapp_9.9.0_linux_amd64.zip: OK`.
- O executável separado `/root/kyro-gowa-9.9.0/gowa-novo` retornou 9.9.0. Isso ainda não comprova que o serviço ativo foi atualizado.
- Ambos os serviços usam `/etc/kyro-gateway/gowa.env`. Diretório de trabalho do GOWA: `/root/.local/share/com.niko.empresa/whatsapp`; do worker: `/opt/kyro`.

Preparação:

- Bloco de atualização preparado em arquivo local ignorado pelo Git: `node_modules/.kyro-revisoes/gowa-vps/atualizar-gowa.sh`.
- Confere o candidato 9.9.0 e consulta ambiente/argumentos do processo para detectar armazenamento PostgreSQL e a porta do GOWA, sem imprimir credenciais. Se detectar PostgreSQL, interrompe antes de parar os serviços para preparar o backup adequado desse banco.
- Atualiza dependências com o mesmo comando da CI e recompila a ponte caso a unidade do worker aponte para o bundle `src-tauri/recursos/ponte.mjs`.
- Com serviços parados, copia a pasta completa do WhatsApp e o arquivo de configuração para um diretório privado e exclusivo em `/root/kyro-backup-gowa-*`.
- Substitui somente o executável, inicia o GOWA e confere `/health`, depois inicia o worker e verifica seu estado e `/api/health`.
- Em falha durante a troca/inicialização, tenta parar os serviços, preservar a tentativa em outra pasta, recolocar a pasta anterior e iniciar novamente. Nenhum diretório de sessão é apagado.

Validação e resultado:

- `bash --noprofile --norc -n`: sintaxe aprovada. A execução inicial no sandbox falhou por restrição de criação do signal pipe; repetida com autorização e aprovada. O script não foi executado contra serviços reais nem foi feito teste de restauração real.
- Nenhuma nova alteração funcional no Kyro nem repetição da suíte de testes; acrescentado somente este histórico e o artefato de orientação ignorado pelo Git.
- O usuário ainda precisa executar o bloco no console do VPS e enviar a saída. Não foi observado backup, substituição ou reinício no servidor nesta etapa.

Pendências:

- Conferir versão do processo ativo, estados dos dois serviços e health check após a execução.
- Confirmar o vínculo real no WhatsApp do celular. As correções locais de QR feitas anteriormente continuam sem publicação e não foram incluídas no pull já realizado.

## 2026-11-12 — v0.2.37 — Atualização do gateway para GOWA 9.9.0 confirmada

Objetivo:

Conferir o resultado da atualização executada pelo usuário no console da DigitalOcean, apresentado em `Captura de tela 2026-11-12 110745.png`.

Resultado observado:

- Instalação de dependências concluída com pnpm 10.34.9, incluindo `@vercel/blob` 2.8.2 e `@vercel/node` 29.0.1.
- O bloco informou o diretório privado de backup com prefixo `/root/kyro-backup-gowa-` e, ao final, confirmou sua preservação. O conteúdo do backup não foi inspecionado separadamente.
- Houve uma primeira tentativa de conexão recusada na porta 3000 durante a inicialização do GOWA; a nova tentativa retornou `OK`. Isso corresponde ao retry previsto no bloco, não a uma falha final da atualização.
- Executável GOWA após a troca: 9.9.0.
- `kyro-gowa.service`: ActiveState=active e SubState=running.
- `kyro-worker.service`: ActiveState=active e SubState=running.
- Health check do worker retornou `ok:true`, `api:"ok"` e `banco:"ok"`, com data `2026-11-12T14:07:39.526Z`.
- A sequência chegou ao final e devolveu o prompt do terminal. Não há indicação de execução da restauração de falha.

Alterações e validação:

- Atualização do VPS executada pelo usuário a partir do bloco preparado na etapa anterior. O assistente conferiu a saída na captura.
- Acrescentado somente este registro local, sem nova alteração funcional no Kyro nem nova execução da suíte de testes.
- A validação confirma versão, disponibilidade dos serviços e API/banco. Não confirma ainda um vínculo com o WhatsApp do celular nem o envio de mensagens.

Pendências:

- Atualizar a página ou reabrir o aplicativo Kyro, abrir Conexões → WhatsApp e testar a leitura de um QR novo pelo celular.
- Se o vínculo continuar recusado, consultar os registros recentes do GOWA 9.9.0 durante essa tentativa; a causa original de pareamento ainda não foi declarada resolvida.
- As correções de QR e isolamento feitas no checkout local continuam sem commit/push e não integraram esta atualização da main no VPS.

## 2026-11-12 — v0.2.37 — Melhorias do WhatsApp comparadas com o Niko

Objetivo:

Trazer as melhorias da referência local `C:\Users\pfmmelo\Downloads\Niko-main\Niko-main` para o Kyro, mantendo as configurações e a integração remota já existentes. O usuário confirmou que o vínculo real funcionou após a atualização anterior do GOWA no VPS.

Implementação:

- Ilha do WhatsApp com busca, filtros de conversas/não lidas/grupos, contador na aba, presença digitando/gravando, reações, confirmações de leitura e marcações de edição/exclusão. A aba abre a página completa do WhatsApp pelo atalho e recebe largura própria de 760 px, limitada pela estrutura responsiva existente.
- Envio de texto em fila, apresentação imediata da mensagem pendente, tentativa novamente/descarte em falha, prevenção de envio duplicado e colagem de imagem com confirmação do anexo. A fila não continua enviando sob a identidade de outra conta.
- Cache da interface com marcos monotônicos para descartar consultas atrasadas, atualização da conversa após envio e limpeza apenas do estado transitório ao trocar de conta. Eventos de WebSocket e respostas de ignorar conversa da sessão anterior são descartados.
- Servidor consulta até 80 chats e apresenta até 40 conversas individuais e 25 grupos, mantendo os filtros salvos. Nomes de grupos são consultados com cache de 15 minutos, separado por usuário.
- Mensagens enviadas recebem horário provisório ordenado e confirmação posterior pelo gateway. Os temporizadores são separados por usuário e cancelados ao desligar/desconectar. Limite interno de envio passa para 30 por minuto por conta, como na referência.
- Gateway local habilita os seis eventos necessários para mensagem, edição, exclusão, reação, confirmação e presença, preservando outros eventos já configurados. README documenta a conferência da lista no VPS ao publicar.
- Barra de busca e filtros usa composição por largura do contêiner: duas linhas em espaços pequenos e uma em espaços maiores. A confirmação de anexo quebra os controles em linhas, sem comprimir o nome e os botões.

Preservação:

- Nenhuma configuração real de usuário, credencial, banco de sessão ou arquivo do VPS foi regravado. Mantidos perfis, permissões, sessões por usuário, integração com a DigitalOcean e atualizações remotas por WebSocket, sem acrescentar polling HTTP frequente no navegador.
- As correções locais de QR feitas antes desta etapa foram preservadas. A referência Niko foi somente lida.
- Cópias dos arquivos anteriores à implementação em `node_modules/.kyro-revisoes/whatsapp-melhorias-2026-11-12/antes`, ignoradas pelo Git.

Arquivos principais:

- `src/janelas/ilha/VisaoWhatsapp.tsx`, `Ilha.tsx` e `ilha.css`; `src/estado/whatsapp.ts`; `src/ponte/armazenamento.ts`.
- `servidor/whatsapp/whatsapp.ts`, `caixa.ts` e `gowa.ts`; `scripts/whatsapp.test.mjs`, `scripts/pre-lancamento.test.mjs` e `README.md`.

Validação:

- `pnpm verificar`: aprovado. `pnpm build`: aprovado após as últimas alterações.
- `pnpm test`: 391 testes aprovados, 0 falhas, após as últimas alterações. Testes adicionais cobrem QR, filtros preservados, cache de nomes por usuário, confirmação de horários, consultas fora de ordem, WebSocket antigo e resposta de ignorar conversa após trocar de conta.
- A tentativa final de testes/build no sandbox encontrou bloqueio de criação de processos (`EPERM`); ambos foram repetidos com autorização fora do sandbox e aprovados. O primeiro ensaio visual precisou corrigir o ambiente isolado do React; os ensaios seguintes identificaram o problema real da barra em telas pequenas e confirmaram a correção.
- Chrome isolado com serviços simulados: busca, filtros, leitura/reações/edição/exclusão, envio em fila sem duplicação, falha e reenvio, colagem de imagem, troca de conta durante envio e preservação de filtros aprovados. Nenhuma mensagem real foi enviada.
- Lista validada em 320×568, 390×844, 667×375, 768×1024, 1024×768, 1366×768 e 1920×1080. Conversa com anexo validada em 320×568, 390×844, 667×375 e 1366×768. Detectado e corrigido o overflow da busca em larguras pequenas; após a correção, documento e painel respeitaram a largura disponível. Capturas e medidas em `node_modules/.kyro-revisoes/whatsapp-melhorias-2026-11-12/ui`.
- O roteiro visual temporário foi retirado da raiz após a execução. A validação em navegador usa dados simulados e não substitui um teste real após publicação.

Publicação:

- Nenhum commit, push, tag, deploy ou nova alteração na DigitalOcean nesta etapa. Versão mantida em 0.2.37.
- Ao publicar, atualizar também o worker do VPS e conferir os eventos documentados no README, mantendo os eventos adicionais e as demais variáveis existentes.

## 2026-11-12 — v0.2.37 — Robô de Aderências em Apps Empresa

Objetivo:

Mover o acesso ao Robô de Aderências do Escritório para Apps Empresa, conforme pedido do usuário.

Alterações:

- `src/modulos/escritorio/AplicativosEmpresa.tsx`: cartão próprio para abrir o Robô de Aderências dentro do Kyro, com botão “Voltar aos apps”. Mantida a permissão existente: dono e gerência com `roboAderencias` liberado.
- `src/modulos/escritorio/Escritorio.tsx`: removido o alternador de Aderências; a página mantém o painel de coordenação da empresa.
- O mesmo componente `Aderencias` continua usando as rotinas, planilhas, agendamentos, destino do WhatsApp e armazenamento existentes. Nenhuma configuração foi migrada, redefinida ou apagada. Os seis sistemas do catálogo e o portal público permanecem iguais; o robô é um acesso interno.

Validação:

- `pnpm verificar` e `pnpm build`: aprovados.
- `node --test scripts/aderencias.test.mjs`: 5 testes aprovados, 0 falhas.
- Checagem SSR temporária: cartão visível para dono e gerência autorizada, oculto para gerência sem liberação, visitante e sessão ausente. Confirmados os seis cartões externos, a retirada do alternador no Escritório e a preservação do catálogo público. Execução final aprovada; os primeiros ensaios exigiram ajustes no ambiente SSR, no usuário simulado e nos canais do processo. Roteiro temporário removido após a validação.
- `git diff --check`: aprovado.

Resultado e pendências:

- Novo caminho: Empresa → Apps Empresa → Robô de Aderências. A mudança está no código local, sem publicação, atualização do VPS ou alteração de versão.
- O problema informado de envios não realizados continua pendente de diagnóstico; esta tarefa mudou somente o local de acesso ao painel.

## 2026-11-12 — v0.2.38 — Chamadas locais indevidas no site e diagnóstico das aderências

Objetivo:

Investigar o acesso ao WhatsApp web após a publicação e os erros do console, além da execução manual de aderências informada pelo usuário.

Evidências:

- O usuário publicou a 0.2.38 e atualizou o VPS. O console confirmou o pull, a instalação de dependências e a alteração de `WHATSAPP_WEBHOOK_EVENTS` para os seis eventos previstos. Após reiniciar os serviços, o usuário informou que os estados e o health check esperados apareceram. Esse resultado não comprova envio de aderências.
- As primeiras capturas do WhatsApp mostravam falha de carregamento. A captura `155549.png` enviada depois mostra o WhatsApp conectado e conversas carregadas; a `155636.png` mostra `whatsapp?acao=estado` e as chamadas de configuração de aderências com HTTP 200.
- O console registra 404 em `/ponte/midia`, `/ponte/sistema/estado` e `/ponte/conexoes/notion`, rotas locais que não existem no site publicado. O serviço de mídia fazia consultas a cada 2,5 segundos.
- Na captura das aderências, `aderencias?acao=executar` ainda está pendente. A rotina está com frequência “Somente manual”; o horário configurado não gera disparo automático nessa opção. O cartão de último resultado mostra uma execução de 27/10, sem comprovar envio na tentativa atual.
- O 409 de `/api/dados` corresponde ao fluxo de conflito de versões para o qual já existe reconciliação no armazenamento. Não foi alterado esse mecanismo apenas pela ocorrência mostrada no console.

Correções locais:

- `src/ponte/ambiente.ts`: identificação da disponibilidade da ponte no aplicativo nativo e no desenvolvimento. Produção web deixa de presumir uma ponte local.
- `src/estado/midia.ts`, `src/ponte/ponteLocal.ts`, `src/ponte/conexoesReais.ts` e `src/servicos/servicos.ts`: evitam os pedidos locais no site e o agendamento de consultas locais de mídia. As configurações e as informações de credenciais das conexões são preservadas; serviços remotos de WhatsApp e aderências não foram bloqueados.
- `src/estado/whatsapp.ts` e `src/modulos/whatsapp/Whatsapp.tsx`: conservam e apresentam a causa recebida ao carregar o WhatsApp. Removida a indicação simultânea de VPS indisponível e configuração ausente, que era apresentada independentemente do erro real. Sucesso e troca de sessão limpam o erro transitório; respostas antigas continuam descartadas.
- `src/modulos/conexoes/ConexaoWhatsapp.tsx` e `src/textos/textos.ts`: instruções corretas para o gateway remoto, erro de carregamento com nova tentativa e ausência de alternador falsamente desligado quando ainda não há estado recebido.
- `src/modulos/escritorio/Aderencias.tsx`: mensagem acessível enquanto a prévia ou execução aguarda conclusão, sem anunciar envios concluídos.

Validação:

- `pnpm verificar`: aprovado.
- Execução de `ambiente-ponte`, `whatsapp`, `aderencias`, `conexoes-em-testes`, `midia` e `ilha`: 69 testes aprovados, 0 falhas. Os primeiros testes do ambiente precisaram separar os contextos da simulação; a execução corrigida passou.
- `pnpm build`: aprovado. Não foi executado um novo teste visual em navegador nem envio real de mensagens. O último ajuste posterior ao build foi somente o texto de andamento da rotina.
- Teste novo `scripts/ambiente-ponte.test.mjs` incluído no manifesto de `pnpm test`; confirma ausência de pedidos locais no site e continuidade das funções no desenvolvimento/aplicativo.

Resultado e pendências:

- Correções no código local, sem commit, push, tag, deploy ou alterações no VPS nesta tarefa. Versão mantida em 0.2.38.
- A tentativa de consultar o health público encontrou restrição de rede; a repetição com acesso solicitado foi interrompida pelo usuário. Não há resultado independente dessa consulta.
- Solicitados os estados/logs atuais do worker e, depois da captura mais recente, o Status e a aba Response da chamada `aderencias?acao=executar`. Ainda sem resposta; é necessário obter o resultado ou os logs para concluir a causa dos envios não realizados.
- A frequência não foi modificada automaticamente. Os 404 de funções locais não comprovam a causa de uma falha no envio remoto de aderências.

## 2026-11-12 — v0.2.38 — OOM confirmado no VPS e redução do custo das capturas

Objetivo:

Corrigir o consumo excessivo das capturas de aderências após obter os registros e a memória atual do VPS.

Diagnóstico confirmado pelo usuário:

- O journal de `kyro-worker.service` registra encerramentos por `oom-kill` em 12/11, às 15:53 e 16:07, seguidos de reinício automático. As execuções de captura ficam sem resposta e o serviço que atende o WhatsApp também fica temporariamente indisponível.
- `free -h`: 961 MiB de RAM total, 911 MiB usados e 49 MiB disponíveis. Nenhum swap ativo. Os limites `MemoryHigh`, `MemoryMax` e `MemorySwapMax` da unidade são `infinity`; o problema observado não é um limite menor configurado nessa unidade.
- O código anterior abria Chrome com viewport 2400×1600 e DPR 3, e tentava primeiro escala 3 no recorte. Execuções simultâneas podiam abrir mais de um navegador, e os pedidos CDP não tinham prazo nem rejeição ao perder a conexão.

Correções locais:

- Novo `servidor/capturaAderencias.ts`: viewport 1600×1000 com DPR 1; resolução extra aplicada somente ao recorte, até 2x e no máximo 4 milhões de pixels. Intervalos excessivos/invalidos retornam erro explicativo em vez de criar um bitmap sem limite ou reduzir o texto abaixo de 1x.
- Fila global por processo do worker para capturas manuais, prévias e agendamentos, inclusive entre usuários. A próxima captura só inicia depois do encerramento/limpeza da anterior, e uma falha libera a fila.
- `servidor/aderencias.ts`: captura somente do intervalo localizado; removido o fallback de capturar a página inteira sem recorte. Desabilitados recursos de fundo desnecessários no Chrome isolado.
- Pedidos CDP com prazo de 15 segundos, 30 segundos para screenshot e limite de um minuto na captura após iniciar o navegador. Queda/erro do socket rejeita os pedidos pendentes. Falha de inicialização e término do processo passam a ser tratados sem deixar a consulta aguardando indefinidamente.
- Remoção do perfil temporário verifica a pasta pai e o prefixo antes de executar a limpeza recursiva.
- Não foram regravados rotinas, planilhas, limiares, horários, destinos, credenciais ou sessões reais.

Validação:

- `node --test scripts/aderencias.test.mjs`: 12 testes aprovados. Inclui orçamento de pixels, intervalos inválidos, fila concorrente preservando AsyncLocalStorage por usuário, continuidade após falha, timeout, queda e resposta válida do navegador.
- `pnpm verificar`, `pnpm build` e `pnpm ponte:build`: aprovados.
- `pnpm test` após as correções do robô e do site: 404 testes aprovados, 0 falhas. `git diff --check`: aprovado.
- Chrome real isolado no Windows com uma tabela de teste local, sem Google, sessões do usuário ou envio ao WhatsApp: PNG 1320×1124, 1.483.680 pixels, 80.900 bytes; limite respeitado e legibilidade conferida na imagem. Artefatos em `node_modules/.kyro-revisoes/aderencias-memoria-2026-11-12`. Roteiro temporário retirado da raiz.

Resultado e pendências:

- Correção permanece local, junto com os ajustes anteriores de web/console, sem commit, tag, push ou deploy nesta etapa. Versão mantida em 0.2.38.
- Ainda não medido o pico de RAM da captura no VPS de 1 GB nem confirmado um envio real com esse código; o teste Windows valida a captura e o orçamento de pixels, sem garantir o consumo total do Chrome no Linux.
- Solicitado `df -h /` para verificar espaço em disco antes de preparar swap. Nenhum arquivo swap, fstab ou configuração de serviço do VPS foi alterado nesta etapa.
- Depois de publicar, atualizar o worker, verificar memória/journal durante uma captura e confirmar o recebimento real no destino. A frequência continua como estava configurada pelo usuário.

## 2026-11-12 — v0.2.39 — Publicação, swap e ponto de retomada para o dia seguinte

Objetivo:

Registrar o que foi efetivamente publicado e configurado depois do diagnóstico de OOM, e salvar o ponto exato para o usuário continuar no dia seguinte antes de desligar o computador.

Resultados confirmados pelas saídas enviadas pelo usuário:

- Publicação de `main` no commit `bcb5541` — `Corrige aderencias e acesso web na 0.2.39` — e da tag `v0.2.39` no GitHub.
- Pull no VPS em `/opt/kyro`, de `358837e` para `bcb5541`, com os 22 arquivos da correção. Dependências atualizadas com `pnpm install --frozen-lockfile --prod=false` e quatro versões confirmadas em 0.2.39 por `pnpm lancar:verificar`.
- Disco consultado antes de criar swap: volume de 24 GB, aproximadamente 19 GB livres. Criado e ativado `/swapfile-kyro`, com 2 GiB e permissões 600.
- Entrada confirmada na linha 5 do fstab: `/swapfile-kyro none swap sw,nofail 0 0`. Backup criado com prefixo `/etc/fstab.bak.`; `systemctl daemon-reload` concluído. Não houve reboot para testar a ativação automática.
- Worker reiniciado depois da atualização. `kyro-worker.service` e `kyro-gowa.service` retornaram `active`.
- Health do worker retornou `ok:true`, `api:"ok"`, `banco:"ok"`, com data `2026-11-12T20:43:52.117Z`.
- Após esse reinício: RAM total 961 MiB, usados 386 MiB, disponíveis 574 MiB; swap total 2 GiB, usados 0 B. Ainda não é uma medição durante a captura.

Resumo salvo:

- Criado `RESUMO_KYRO/RETOMADA.md` com as correções da última versão, o estado do servidor, validações concluídas, limitações e sequência para o próximo teste.
- `LEIA_PRIMEIRO.md` recebeu o link para o ponto de retomada. Entradas antigas deste histórico foram preservadas; suas pendências de publicação e swap foram superadas pelos resultados desta entrada.
- As alterações de encerramento destes documentos foram salvas somente no computador, depois do push; não foi feito novo commit, push ou deploy por causa do resumo.

Validação e limites:

- Código da correção passou anteriormente por 404 testes, checagem de tipos, build web, build da ponte e captura de uma tabela de teste em Chrome isolado. Nenhum envio real de aderências foi confirmado com o código novo.
- Nesta etapa de encerramento foram conferidos a versão local, o último commit e os documentos. As alterações novas são apenas de documentação; não foi repetida a suíte de testes nem executada nova ação no VPS.

Pendências prioritárias para retomar:

1. Atualizar o Kyro web com Ctrl + F5 e abrir Empresa → Apps Empresa → Robô de Aderências.
2. Clicar no olho da primeira planilha para gerar uma prévia. Esse foi o último passo orientado e o usuário ainda não informou o resultado.
3. Conferir memória e journal durante a captura; depois testar uma planilha e confirmar o recebimento no destino do WhatsApp.
4. Verificar a frequência das rotinas: a captura mostrava Rotina Manhã em “Somente manual”, apesar do horário 16:31. Não foi alterada automaticamente para diária/semanal. Rotina Tarde estava sem planilhas.
5. Conferir o console web e o deploy da Vercel após a atualização; conferir também o workflow/instaladores da v0.2.39 se for continuar pelo aplicativo desktop.

O envio real, o agendamento e a estabilidade durante a captura continuam pendentes de validação. Serviços ativos e health positivo não são confirmação de envio. Continuar com orientações curtas, um bloco de comandos por vez.

## 2026-11-13 — v0.2.39 local — Cards, cópia de aderências, edição explícita e imagem HD

Objetivo e confirmação do usuário:

- O usuário confirmou que os envios e os horários estão funcionando corretamente, inclusive com o sistema fechado. Essa informação supera as pendências de envio/agendamento registradas em 12/11; não foi um novo teste executado pelo assistente.
- Pedido: painel com cards de rotinas, duplicação de todas as planilhas para outro horário, reaproveitamento seletivo de planilhas existentes, edição liberada pelo lápis e aplicação somente em “Salvar alterações”. Melhorar também a imagem recebida no WhatsApp, preservando o envio e o agendador.

Alterações:

- `Aderencias.tsx` e `aderencias.css`: painel inicial com cards, horário, frequência, situação e quantidade de planilhas. Cada card abre os detalhes em modo de consulta; o lápis libera a edição da rotina e das planilhas.
- Retirado o efeito que enviava a configuração automaticamente a cada alteração. Nome, destino, ativação, frequência, dias, horário, inclusão, edição e remoção de planilhas ficam em um rascunho React. Apenas “Salvar alterações” aplica esse rascunho. Falha ao salvar conserva o rascunho; cancelar/voltar permite descartá-lo.
- `edicaoAderencias.ts`: cópias independentes com novos IDs, preservando links, abas, intervalos, cabeçalho e alertas. Duplicar uma rotina copia todas as planilhas, deixa a nova rotina pausada e limpa seus resultados/marcadores. A origem não é alterada. “Copiar de outra rotina” permite selecionar uma ou todas as planilhas.
- Salvamento relê a configuração remota e preserva resultados/marcadores recentes, demais rotinas e destino não editado. A exclusão da última rotina limpa também o espelho legado, para não manter uma rotina removida disponível ao worker.
- Envios manuais continuam registrando seus resultados, sem restaurar o salvamento automático dos campos. Respostas de uma sessão anterior são descartadas.
- `servidor/aderencias.ts`: apenas as duas chamadas de envio de imagem passaram a solicitar alta qualidade. `enviarImagemNoWhatsapp` aceita essa opção e acrescenta `hd=true` e `compress=false` ao formulário das aderências. Demais chamadas conservam o padrão anterior.
- Compatibilidade conferida na documentação e no código oficiais do [GOWA v9.9.0](https://github.com/aldinokemal/go-whatsapp-web-multidevice/blob/v9.9.0/docs/openapi.yaml): modo HD com maior lado de até 2560 px. Não foram aumentados viewport, DPR ou orçamento de 4 milhões de pixels da captura; fila, prazos, horários e lógica do agendador permaneceram intactos.

Validação:

- `pnpm test`: **410 testes aprovados, 0 falhas**, incluindo cópias independentes, isolamento do rascunho, preservação dos marcadores/demais rotinas, limites e pedido HD com destinatário, legenda e bytes preservados. As tentativas iniciais de suíte/build no sandbox falharam com `spawn EPERM`; as repetições autorizadas fora do isolamento passaram.
- `pnpm verificar`, `pnpm build`, `pnpm ponte:build` e `git diff --check`: aprovados.
- A conferência visual não foi concluída: o Computer Use encerrou o acesso porque não conseguiu determinar a URL atual do Chrome no Windows com confiança suficiente. Não houve tentativa de contornar o bloqueio.
- Preparado ensaio local com dados fictícios e envios desabilitados em `testes/aderencias-ui` (pasta ignorada pelo Git); o servidor de ensaio foi encerrado. Nenhum envio real ou alteração nas rotinas de produção foi feito nesta tarefa.

Resultado e pendências:

- Implementação somente no código local, versão mantida em 0.2.39. Sem commit, push, tag, publicação, atualização do VPS ou migração de banco.
- Conferir visualmente desktop/celular e os fluxos de duplicar, copiar, cancelar e salvar quando o acesso ao navegador estiver disponível.
- Depois da publicação autorizada do frontend e da ponte/worker, confirmar o recebimento em HD no WhatsApp. O teste simulado comprova os parâmetros do pedido, não a aparência final no aparelho.

## 2026-11-13 — v0.2.39 local — Informações somente dentro da rotina

Objetivo:

- A pedido do usuário, retirar os três cartões de resumo da tela inicial e exibi-los somente ao abrir uma rotina, como Aderências Manhã. Esclarecer o aviso de gateway no localhost.

Alterações e diagnóstico:

- `Aderencias.tsx`: quantidade de planilhas, destino e último resultado ficam na área de detalhes, abaixo de “Todas as rotinas”. Quantidade e resultado usam a rotina aberta; a tela inicial mantém o painel de cards de rotinas. O destino continua compartilhado conforme a configuração existente.
- Confirmadas ausentes/vazias no `.env.local` as variáveis de URL e segredo do gateway remoto. O encaminhamento local retorna `gateway_remoto_nao_configurado` nessa condição. Nenhum segredo foi exibido e nenhuma configuração local ou do VPS foi alterada.

Validação:

- `pnpm verificar`, `pnpm build` e `git diff --check`: aprovados. Alteração limitada à apresentação, sem repetir a suíte completa de 410 testes já aprovada na etapa anterior.
- Conferência visual do novo posicionamento não realizada nesta etapa.

Resultado e pendências:

- Ajuste concluído no código local, versão 0.2.39, sem publicação. A lógica de envio e agendamento não foi modificada.
- O localhost continua dependendo da configuração de acesso ao gateway para consultar/salvar rotinas remotas; configurar esse acesso não foi solicitado nesta etapa.

## 2026-11-13 — v0.2.39 local — Apps Empresa na sublista do menu lateral

Objetivo:

- Substituir a seleção de apps por cards dentro do painel por uma sublista expansível em Apps Empresa no menu de navegação. Um clique no aplicativo deve abrir seu conteúdo diretamente na área principal.

Alterações:

- Novo `AppsEmpresaNoMenu.tsx` com botão expansível, ícones, seleção ativa, rótulos acessíveis e indicação de manutenção. Inclui Robô de Aderências conforme a permissão existente, os seis sistemas do catálogo e Solicitações recebidas, que antes ficavam na página de apps.
- `aplicativosEmpresaConfig.ts`: catálogo dos itens do menu compartilhado com a seleção de conteúdo. O catálogo público e as URLs existentes foram preservados; o Robô continua restrito a dono ou gerência com permissão explícita.
- `AplicativosEmpresa.tsx`: seleção pelo parâmetro `app` da rota; abertura direta do robô, das solicitações ou do sistema cadastrado. Retirados os cards intermediários e o botão Voltar aos apps. A lista de solicitações continua disponível em item próprio.
- `BarraLateral.tsx` e `JanelaSistema.tsx`: integração da sublista, indicador ativo entre aplicativos, medição da altura dos grupos expandidos, nome do aplicativo no cabeçalho, retorno ao topo e reinício da página/barreira de erro ao trocar de app.
- Estilos contemplam a lateral recolhida e a navegação horizontal já utilizada no celular. Sistemas externos continuam no visualizador principal com Recarregar e Nova aba, sem nova janela automática e sem modificar a integração existente.
- Envios, agendador, rotinas e configurações do gateway não foram alterados nesta etapa.

Validação:

- `node --test scripts/interface.test.mjs`: 26 testes aprovados, incluindo quatro novos testes de catálogo/permissões, abertura direta, destinos inválidos/manutenção e navegação entre apps.
- `node --test scripts/pre-lancamento.test.mjs`: 20 testes aprovados, inclusive a correspondência entre catálogo e origens permitidas na CSP.
- `pnpm verificar`, `pnpm build` e `git diff --check`: aprovados.
- O primeiro ensaio de renderização do robô no servidor de testes encontrou o uso de portais do navegador. O teste foi corrigido para validar a seleção do componente autorizado sem renderizar seus modais fora do navegador. BroadcastChannel foi isolado no ambiente de testes para não manter o processo aberto.

Resultado e pendências:

- Fluxo implementado somente no código local, versão mantida em 0.2.39. Sem commit, push, tag ou publicação.
- Não foi feita conferência visual em navegador nesta etapa. Revisar o menu expandido/recolhido e o comportamento no celular quando o acesso visual estiver disponível.

## 2026-11-13 — v0.2.39 local — Mais espaço nos apps e cópia do link

Objetivo:

- Recolher o menu ao abrir um aplicativo, retirar o aviso/botão Ir para o sistema, substituir Nova aba por uma ação de copiar link e investigar a opção de lembrar email/senha para preencher as telas de login.

Alterações:

- `JanelaSistema.tsx` e `estado/interface.ts`: ao abrir um app disponível, a lateral do desktop se recolhe temporariamente. A seta e Ctrl+B permitem expandir/recolher durante o uso; sair dos aplicativos devolve a preferência geral. Esse estado não é salvo na configuração nem sincronizado como preferência do usuário. O menu horizontal do celular permanece visível.
- `BarraLateral.tsx`, `AppsEmpresaNoMenu.tsx` e `usarAtalhos.ts`: controles usam o estado temporário dentro dos apps e a configuração normal fora deles. Clicar em Apps Empresa com a lateral recolhida expande a navegação e apresenta sua sublista.
- `SistemaEmpresaAberto.tsx`: retirados Ir para o sistema e a faixa de ajuda redundante. Nova aba foi substituída por Copiar link do sistema, com confirmação após sucesso. Se a API de clipboard não estiver disponível ou recusar a cópia, aparece o URL em um campo selecionável, sem anunciar sucesso falso.
- `sistemaEmpresaAberto.css`: removidos os estilos da faixa retirada e acrescentado o espaço para cópia manual quando necessária.

Login salvo — investigação e informação pendente:

- Os sistemas externos estão em iframes de outros domínios. A [política de mesma origem](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) impede o Kyro web de ler/preencher diretamente os campos dessas páginas. Comunicação autorizada pode ser implementada nos dois lados, mas requer acesso ao código dos sistemas.
- O [WebView2 tem recursos próprios de salvar/preencher senhas](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2settings4), como alternativa específica do aplicativo Windows; o ajuste afeta o perfil compartilhado do WebView e precisa de desenho de isolamento por usuário antes de ser adotado. Nenhum ajuste nativo foi feito nesta etapa.
- Perguntado ao usuário se tem acesso ao código das telas de login ou se precisa funcionar sem alterar os sistemas. Até este registro, resposta pendente. O recurso de salvar/preencher email e senha ainda não foi implementado; não foram solicitadas, lidas, copiadas ou armazenadas senhas reais.

Validação:

- `node --test scripts/interface.test.mjs`: 27 testes aprovados, incluindo navegação/permissões, ausência dos comandos retirados, presença do botão de copiar e Ctrl+B alternando o menu temporário sem gravar a preferência geral.
- `pnpm verificar`, `pnpm build` e `git diff --check`: aprovados. Conferência visual não realizada nesta etapa.

Resultado e pendências:

- Ajustes de visualização e cópia implementados no código local, versão mantida em 0.2.39. Sem publicação e sem mudanças nos envios/agendador ou na configuração dos sistemas externos.
- Definir com o usuário o acesso aos códigos dos aplicativos e o ambiente desejado para o login salvo antes de implementar o armazenamento/preenchimento. Não adicionar controles que prometam um preenchimento indisponível.

## 2026-11-13 — v0.2.39 local — Decisão de manter os apps sem login salvo

- Objetivo e decisão: o usuário optou por deixar os aplicativos sem salvar/preencher email e senha. A investigação de integração de login foi encerrada; não há mais informação pendente sobre os códigos das telas para esse pedido.
- Alteração: registrada a decisão neste histórico e na retomada. Nenhuma mudança de código, credencial, configuração externa ou publicação.
- Validação: apenas documentação alterada; permanecem os 27 testes de interface, tipos e build aprovados da etapa anterior, sem repetir verificações de código.
- Resultado: ajustes de menu recolhido e Copiar link mantidos; login salvo não foi implementado. Código continua local, versão 0.2.39, ainda sem publicação. Conferência visual continua pendente.

