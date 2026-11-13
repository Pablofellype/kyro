# Retomada do Kyro

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

As pendências de publicação e criação de swap das entradas anteriores do histórico foram superadas pelos resultados abaixo. **O teste real do robô ainda está pendente.**

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
