# Retomada do Kyro

## Estado atual — 22/11/2026 — v0.2.43

- Base confirmada no repositório local pelo usuário e pelo commit **1ec6bfe — Prepara Kyro 0.2.43**, com tag **v0.2.43**.
- O menu do Kyro no celular passou a abrir em um painel vertical com toque, indicação da página ativa e seleção Pessoal/Empresa. Cabeçalho compacto com atalhos de Menu e Ajustes. A posição da ilha acompanha o cabeçalho.
- No celular, o login usa um cartão próprio para o formulário. A ilha abre e fecha com animação pela seta **Ilha** logo abaixo do cabeçalho. Se houver solicitações por ver, o contador aparece junto da seta e o painel abre na aba de materiais. A primeira consulta da sessão carrega os pedidos no contador e no histórico. Solicitações que chegam durante a sessão geram um aviso resumido.
- Em Apps Empresa no celular, o título e o botão de opções ficam em uma linha. O aplicativo incorporado ocupa a altura restante e as ações ficam no botão de três pontos.
- No web para computador e no Windows, a Ilha fica como uma tirinha em repouso, mostra a versão compacta ao passar o mouse e abre por completo ao clicar. No Windows, a janela da Ilha fica ancorada na borda superior do monitor selecionado, independentemente do aplicativo em primeiro plano.
- Eventos e lembretes registrados nos calendários Pessoal e Empresa entram na fila de avisos. Eventos sem horário avisam às 9h locais. No computador o aviso aparece na Ilha compacta, e no celular aparece no rodapé. A compilação e o teste do executável Windows ficam pendentes pelo SDK e linker ausentes.
- No computador, solicitações de material também tiram a Ilha do repouso e exibem o aviso compacto. A entrega na Ilha é registrada separadamente do rodapé e do Windows. A fila preserva esses pedidos quando outro aviso está sendo exibido.
- A Ilha no computador consulta o inventário ativo a cada 15 segundos, mesmo recolhida. Em teste com a Ilha em repouso, a consulta periódica mostrou um pedido após cerca de 15 segundos, sem interação, e a Ilha voltou à tirinha.
- A API real do inventário havia reiniciado a sequência em zero, e a assinatura do dono ainda apontava para uma posição anterior. A posição foi corrigida no banco com autorização, preservando o histórico e o total de 7. O código local reconhece esse reinício automaticamente em futuras consultas. Na verificação após o ajuste, a fonte ainda estava sem pedidos pendentes.
- Os ajustes de celular estão locais. A conferência no aparelho do usuário fica para depois da atualização do site.
- A área Pessoal do dono tem o catálogo **Importados** com foto, nome, link, preço, moeda, categoria, plataforma, fornecedor, origem e observações. As opções podem ser cadastradas no produto ou em **Opções dos filtros** e ficam disponíveis para reutilização. A busca combina os campos e a faixa de valor usa a moeda escolhida. Implementação local.

### Instaladores para celular — pendência futura

- **Android.** Gerar e disponibilizar o APK assinado. Configurar `VITE_KYRO_ANDROID_APK_URL` com o link HTTPS direto para o arquivo `.apk`.
- **iPhone.** Preparar e distribuir a versão de teste pelo TestFlight. Configurar `VITE_KYRO_IOS_TESTFLIGHT_URL` com o link HTTPS de convite `testflight.apple.com/join/…`.
- Na versão atual, o botão **Baixar Kyro** mostra **Em breve** para cada opção cujo link está ausente ou inválido. Quando os links estiverem disponíveis, gerar uma nova build web com as variáveis configuradas e conferir a instalação em cada plataforma.

## Histórico de 16/11/2026 — v0.2.41 publicada

Este registro descreve a publicação e as verificações da 0.2.41. As seções seguintes preservam os registros de 13/11 e 12/11.

### Publicação e repositório

- Projeto: C:\Users\pfmmelo\Downloads\kyro.
- Versão atual: **0.2.41**, sincronizada em package.json, tauri.conf.json, Cargo.toml e Cargo.lock.
- Lançamento: **5b19a97 — Prepara release 0.2.41**, enviado pelo usuário com a tag **v0.2.41**.
- Correção posterior: **d4d9351 — Corrige fuso horario do teste do painel da empresa**, enviada pelo assistente para main a pedido do usuário.
- A tag permanece no commit de lançamento. A correção posterior alterou somente o teste; não exige trocar a tag ou gerar outra versão.
- [Release oficial da 0.2.41](https://github.com/Pablofellype/kyro/releases/tag/v0.2.41) confirmada, com EXE, MSI, respectivas assinaturas e latest.json.
- Este resumo foi atualizado localmente depois da publicação e da confirmação do VPS; suas alterações ainda não foram commitadas ou enviadas ao GitHub.

### Mudanças incluídas na entrega

- Gerência acessa configurações pessoais de aparência e comportamento, mantendo a administração exclusiva do dono. Preferências do aplicativo, incluindo aparência da ilha, são preservadas entre saída e novo login e isoladas por conta.
- Menu lateral revisto para facilitar a identificação da aba ativa, tanto expandido como recolhido. Ilha central com dimensões comuns entre abas, abas preservadas e controles laterais recolhidos inicialmente, abertos pelas respectivas setas. Retirado o caminho redundante no topo.
- Visual ajustado após o feedback do usuário: fundos claros quentes e verde, sem a névoa avermelhada nem excesso de vermelho decorativo. Vermelho permanece associado às situações de erro.
- Painel inicial da gerência com saudação. Escritório da empresa reorganizado com prioridades, atividades, agenda, solicitações e histórico, usando dados reais e respeitando permissões e a separação da área pessoal.
- Portal do visitante com retorno ao login e acessos mais claros, adaptado ao celular e ao aplicativo desktop.
- Dono encontra Conexões no menu das áreas Pessoal e Empresa; gerência conserva o acesso na Empresa.
- Teams e Planner implementados com login Microsoft e ícones próprios. Teams consulta conversas da conta; Planner consulta tarefas atribuídas. Escopos e credenciais são separados por integração, sem ampliar automaticamente o acesso do Outlook. São integrações de leitura.
- Google Planilhas implementado com login Google, até cinco links configurados, seleção de abas e prévia em tabela com busca/paginação. A autorização é somente de leitura; edição ocorre no Google. Dados, erros e abas vazias são apresentados de forma distinta.
- Gerência não vê nem consulta em segundo plano GitHub, Vercel, Railway, Supabase, Cloudflare, Resend, n8n, Linear, Stripe, Cripto, Strava, Reddit e Discord. A proteção abrange catálogo, ilha, janelas e ponte. Credenciais existentes foram preservadas; o dono mantém todas as conexões.
- Instruções das novas integrações: [Microsoft](../docs/conexoes-microsoft.md) e [Google Planilhas](../docs/conexoes-planilhas.md).

### Testes e GitHub confirmados

- Suíte completa após a correção: **455 testes aprovados, zero falhas**.
- O teste do Escritório misturava um horário local simulado com uma conclusão fixa em UTC; por isso passava em São Paulo e falhava no GitHub. A conclusão agora usa o mesmo fuso local do horário simulado.
- Acrescentada a verificação de que conclusões futuras continuam fora do histórico. O teste foi executado com sucesso em UTC e America/Sao_Paulo; não foi desativado nem ignorado.
- [Verificar #59](https://github.com/Pablofellype/kyro/actions/runs/43804517859): **sucesso no Windows e no Linux**, incluindo os passos de tipos, testes e Rust.
- [Pacotes Windows #49](https://github.com/Pablofellype/kyro/actions/runs/43802888969): **sucesso**, com instaladores e manifesto publicados.
- A execução antiga Verificar #58 permanece vermelha no histórico, anterior à correção. Não representa uma nova falha e não deve ser apagada ou reexecutada esperando código diferente.
- Build web e build da ponte aprovados durante a implementação. A geração dos instaladores assinados foi concluída no GitHub Actions.

### DigitalOcean — confirmação do usuário

O usuário executou os comandos no Console do Droplet como root. O assistente conferiu as saídas enviadas na conversa.

- Diretório: /opt/kyro.
- As quatro versões foram confirmadas em **0.2.41** por pnpm lancar:verificar. O hash exato do checkout do VPS não foi exibido.
- Reinício de kyro-gowa.service e kyro-worker.service executado.
- Ambos os serviços retornaram **active**.
- Health consultado em http://127.0.0.1:47831/api/health com o cabeçalho x-niko: 1:

    {"ok":true,"api":"ok","banco":"ok","data":"2026-11-16T04:38:45.469Z"}

- Publicação no GitHub e atualização da versão no VPS concluídas. Não repetir a instalação do gateway, a criação de swap ou a configuração de credenciais como pendências deste lançamento.
- GOWA 9.9.0, swap de 2 GiB e arquivo /etc/kyro-gateway/gowa.env são dados confirmados em etapas anteriores; não houve nova medição de memória, alteração dessas configurações ou reboot nesta entrega.

### Próxima retomada e limites de validação

- O usuário foi orientado a abrir o Kyro e instalar a atualização 0.2.41. A instalação no computador e o teste real das novidades após a atualização ainda não foram confirmados.
- Confirmar a autorização real de Teams, Planner e Google Planilhas com as contas do usuário. Os testes usaram dados simulados; os cadastros OAuth e permissões corporativas seguem as instruções dos documentos próprios. Não pedir ou expor segredos no resumo.
- Conferir no uso real a persistência das preferências após fechar/reabrir e os acessos de dono, gerência e visitante; houve validação automatizada, mas não confirmação final do usuário para todos os fluxos da versão publicada.
- A prévia de Planilhas foi conferida com dados fictícios em desktop, celular e tema escuro; isso não comprova acesso a uma planilha privada real.
- O usuário já confirmou em 13/11 que aderências e horários funcionam inclusive com o sistema fechado. Não reabrir essa questão como falha ativa. A qualidade HD final no WhatsApp e um teste prolongado de memória após esta versão ainda não foram confirmados.
- O deploy específico do frontend na Vercel não foi inspecionado nesta publicação. Se o site mostrar código antigo, conferir o deploy correspondente à main e os arquivos carregados.
- Mantida a decisão de não salvar/preencher email e senha dos sistemas externos.
- O usuário prefere instruções curtas e comandos um por vez. Ao aparecer (END) no PowerShell/Git, orientar a tecla q para sair do paginador.

## Registros anteriores

O conteúdo abaixo preserva o contexto de 13/11 e 12/11. Para versão, publicação, testes e estado do VPS, prevalecem os resultados de 16/11 acima.

## Atualização de 13/11/2026 — prioridade ao retomar

- O usuário confirmou que as aderências estão sendo enviadas corretamente nos horários, inclusive com o sistema fechado. As pendências de confirmação de envio/agendamento abaixo são históricas e foram superadas por essa confirmação.
- Novas melhorias estão somente no código local: cards de rotinas, duplicação completa, cópia seletiva de planilhas, consulta bloqueada até clicar no lápis e rascunho aplicado apenas em “Salvar alterações”. Cópias ficam pausadas até a ativação explícita. O agendador e os limites de memória das capturas não foram alterados.
- Ajuste seguinte de 13/11: os cartões de quantidade de planilhas, destino e último resultado aparecem apenas dentro da rotina aberta. Tipos e build aprovados. O aviso `gateway_remoto_nao_configurado` no localhost corresponde à ausência de URL/segredo do gateway nesse ambiente; não foi alterada a configuração do VPS.
- Apps Empresa agora funciona como menu expansível na navegação, com abertura direta dos aplicativos pelo parâmetro `app` da rota. Retirados os cards intermediários; Solicitações recebidas tem item próprio e o Robô mantém a permissão anterior. Nesta etapa passaram 26 testes de interface, 20 de pré-lançamento, tipos e build. Alteração local, sem publicação e ainda sem conferência visual do novo menu.
- Ajuste mais recente: ao abrir um app, a lateral do desktop se recolhe temporariamente e pode ser expandida pela seta/Ctrl+B. Retirados Ir para o sistema e a faixa redundante; Nova aba virou Copiar link do sistema, com campo selecionável se a cópia automática falhar. Passaram 27 testes de interface, tipos e build. O pedido de salvar/preencher email e senha ainda depende da resposta sobre acesso ao código das telas externas; foi feita essa pergunta, sem implementar coleta/armazenamento de senhas ou autofill falso.
- Decisão posterior do usuário em 13/11: deixar os aplicativos **sem salvar/preencher email e senha**. Essa decisão encerra a pendência de integração de login mencionada acima; não retomar nem solicitar os códigos das telas para esse recurso sem um novo pedido.
- Imagens de aderências passaram a solicitar HD ao GOWA (`hd=true`, `compress=false`). A qualidade recebida ainda precisa ser conferida no WhatsApp depois de uma publicação autorizada.
- Validações: 410 testes aprovados, tipos/build web/build da ponte aprovados. A conferência visual foi impedida pelo bloqueio do Computer Use ao identificar a URL do Chrome; ainda é necessário revisar desktop/celular e os fluxos do painel.
- Não houve commit, push, tag, deploy ou mudança no VPS. Versão local continua 0.2.39. As alterações anteriores de documentação foram preservadas. A entrada de 13/11 ao final do `HISTORICO.md` detalha esta tarefa.

O conteúdo a seguir preserva o estado registrado em 12/11.

Atualizado em 12/11/2026, ao encerrar o trabalho para continuar no dia seguinte.

## Ponto de partida

- Projeto: `C:\Users\pfmmelo\Downloads\kyro`.
- Versão atual: **0.2.39**.
- Commit publicado: **`bcb5541` — Corrige aderencias e acesso web na 0.2.39**.
- `main` e a tag **`v0.2.39`** foram enviados ao GitHub pelo usuário.
- O usuário atualizou o VPS para esse mesmo commit, instalou as dependências e conferiu as quatro versões em 0.2.39.
- Este resumo de encerramento foi salvo localmente depois da publicação. As alterações destes documentos ainda não foram enviadas ao GitHub.

As pendências de publicação e criação de swap daquele período foram superadas pelos resultados abaixo. O teste real do robô foi confirmado pelo usuário em 13/11.

## O que foi corrigido nesta última atualização

- O código web foi ajustado para evitar consultas às rotas locais de mídia do computador, controles do sistema e conexões como Notion. Essas funções continuam disponíveis no aplicativo instalado e no desenvolvimento. A alteração está no repositório publicado; a conferência final no site ainda precisa ser feita.
- O WhatsApp passou a mostrar a causa real da falha de carregamento, em vez de informar ao mesmo tempo que o VPS não respondeu e que faltava configuração na Vercel. A configuração remota também recebeu instruções adequadas ao servidor.
- O robô recebeu uma fila de capturas: somente um Chrome por vez por processo do worker, inclusive entre usuários, prévias e execuções manuais/agendadas.
- O navegador das capturas passou de 2400×1600 com DPR 3 para 1600×1000 com DPR 1. A resolução extra fica limitada ao recorte, até 2x e 4 milhões de pixels. Intervalos excessivos retornam erro explicativo.
- Foram acrescentados prazos para os comandos e capturas, tratamento da queda do navegador e limpeza do perfil temporário. A rotina passa a devolver erro em vez de esperar indefinidamente por um navegador que não responde.
- Mantidas as configurações, planilhas, horários, destinos, permissões e sessões existentes. A frequência das rotinas não foi alterada automaticamente.
- O Robô de Aderências já foi movido para **Empresa → Apps Empresa → Robô de Aderências**, com botão para voltar aos apps. O acesso continua para dono e gerência com o robô liberado.

As melhorias anteriores do WhatsApp, de busca/filtros/fila de envio e isolamento entre contas, também estão na versão publicada.

## O que foi confirmado na DigitalOcean

As operações foram executadas pelo usuário no Web Console; o assistente conferiu as saídas enviadas na conversa.

- Diretório do código: `/opt/kyro`.
- Gateway GOWA atualizado anteriormente para **9.9.0**.
- `kyro-worker.service` reiniciado depois do pull da 0.2.39.
- `kyro-worker.service`: **active**.
- `kyro-gowa.service`: **active**.
- Health retornou `{"ok":true,"api":"ok","banco":"ok","data":"2026-11-12T20:43:52.117Z"}`.
- RAM total: **961 MiB**. Após o último reinício: **386 MiB usados e 574 MiB disponíveis**. Isso é o estado antes do novo teste de captura, não uma medição de pico durante a execução.
- Swap de **2 GiB** ativo em **`/swapfile-kyro`**, com 0 B usados na última consulta.
- Persistência registrada na linha 5 de `/etc/fstab`: `/swapfile-kyro none swap sw,nofail 0 0`.
- Backup do fstab criado com o prefixo `/etc/fstab.bak.` e executado `systemctl daemon-reload`. A ativação após um reboot ainda não foi testada.
- Configuração do gateway em `/etc/kyro-gateway/gowa.env`. Eventos confirmados: `message,message.revoked,message.edited,message.reaction,message.ack,chat_presence`.

O problema identificado nos registros foi **falta de memória (OOM)**: o Linux encerrou processos do worker em 12/11 às 15:53 e 16:07. Isso interrompia as aderências e causava indisponibilidade temporária do WhatsApp. Antes do ajuste havia só 49 MiB de RAM disponíveis e nenhum swap; a unidade não tinha um limite de memória menor configurado.

Não é necessário recriar credenciais ou parear novamente o WhatsApp apenas para continuar o teste. Preservar os acessos e vínculos existentes.

## Primeiro passo ao retomar: testar uma prévia

O usuário parou **antes de informar o resultado deste teste**:

1. Abrir o Kyro web em `https://kyro-drab.vercel.app` e atualizar com **Ctrl + F5**.
2. Entrar em **Empresa → Apps Empresa → Robô de Aderências**.
3. Na primeira planilha, clicar no **olho — Gerar prévia**, e aguardar o print ou a mensagem de erro.

Depois da prévia, conferir o destino selecionado e testar o envio de **uma planilha**; confirmar o recebimento efetivo no WhatsApp antes de testar a rotina completa.

Para acompanhar o VPS durante o teste:

```bash
free -h
swapon --show
journalctl -u kyro-worker.service --since "10 minutes ago" --no-pager
```

É necessário conferir a memória durante a captura e procurar novos registros de `oom-kill`, reinícios ou erros de captura. Um health saudável sozinho não comprova que a planilha foi capturada ou enviada.

## Demais pendências

- **Confirmar a prévia real no VPS e o recebimento real do envio.** Ainda não declarar o problema dos envios resolvido.
- Verificar o agendamento: a última captura mostrava **Rotina Manhã** com três planilhas, horário **16:31**, mas frequência **Somente manual**. Essa opção não dispara automaticamente pelo horário. A periodicidade e os dias desejados precisam ser definidos com o usuário.
- A última tela tinha duas rotinas; **Rotina Tarde** estava sem planilhas. O último resultado de "1 enviada" mostrado era de **27/10/2026**, não da tentativa atual.
- Conferir o WhatsApp e o console do site depois de recarregar a versão publicada. Não confundir mensagens antigas preservadas no console com novos pedidos após a atualização.
- A publicação do frontend na Vercel depois do push da 0.2.39 não foi inspecionada separadamente. Se o site aparentar usar o código antigo, conferir o deploy e os arquivos carregados.
- A tag foi enviada, mas o resultado final do workflow **Pacotes Windows** e os instaladores da **v0.2.39** ainda não foram conferidos.
- Não houve reboot do VPS nem teste prolongado de várias rotinas depois do ajuste.

## Validações já executadas

- `pnpm test`: **404 testes aprovados, 0 falhas**.
- `pnpm verificar`, `pnpm build` e `pnpm ponte:build`: aprovados.
- Chrome real isolado no Windows com uma tabela de teste: captura legível de 1320×1124, dentro do orçamento de pixels. Esse ensaio não enviou mensagens nem usou planilhas reais do usuário.
- Conferência das versões da 0.2.39 e do health do VPS: confirmadas pelas saídas do usuário.

Não repetir instalação do gateway ou criação de swap como se essas etapas ainda estivessem pendentes. Retomar pelo teste da prévia. O usuário prefere orientação calma, com um bloco de comandos por vez.
