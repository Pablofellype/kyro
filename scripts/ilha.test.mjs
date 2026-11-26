import test, { after } from "node:test";
import assert from "node:assert/strict";
import { criarServidorDeTeste as createServer } from "./vite-para-testes.mjs";
import { readFileSync } from "node:fs";

globalThis.BroadcastChannel = undefined;
globalThis.localStorage = { getItem: () => null, setItem: () => undefined };
globalThis.window = Object.assign(new EventTarget(), { setTimeout, clearTimeout, innerWidth: 1366 });
const servidor = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } });
after(() => servidor.close());
const { abaVizinha, alternarAbaDaBarra, criarAlternadorDoIniciar } = await servidor.ssrLoadModule("/src/janelas/ilha/barra/acoesDaBarra.ts");
const { useIlha } = await servidor.ssrLoadModule("/src/estado/ilha.ts");
const { atrasoDeFechamento, editandoNaIlha } = await servidor.ssrLoadModule("/src/janelas/ilha/fechamento.ts");
const { controle, sistema } = await servidor.ssrLoadModule("/src/ponte/ponteLocal.ts");
const { areaDeTrabalhoNaFrente, focoDaAreaPeloElemento, mostrarLateraisDaIlha } = await servidor.ssrLoadModule("/src/janelas/ilha/barra/visibilidadeDaBarra.ts");

test("eventos e lembretes da Empresa entram na fila, inclusive quando têm o mesmo título e horário", async (t) => {
  const { eventoDisparaEm, verificarAvisosDoCalendario } = await servidor.ssrLoadModule("/src/servicos/servicos.ts");
  const { useAgentes } = await servidor.ssrLoadModule("/src/estado/agentes.ts");
  const { useAuth } = await servidor.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useConfig } = await servidor.ssrLoadModule("/src/estado/configuracoes.ts");
  const { useInterface } = await servidor.ssrLoadModule("/src/estado/interface.ts");
  const { useOrganizacao } = await servidor.ssrLoadModule("/src/estado/organizacao.ts");
  const estados = [useAgentes, useAuth, useConfig, useInterface, useOrganizacao].map((s) => [s, s.getState()]);
  t.mock.method(window, "setTimeout", () => 0);
  t.after(() => {
    while (useIlha.getState().revelacao) useIlha.getState().dispensarRevelacao();
    for (const [store, estado] of estados) store.setState(estado);
  });
  useAuth.setState({ usuario: { id: 7, perfil: "gerencia" } });
  useConfig.setState((s) => ({ sons: { ...s.sons, ligado: false } }));
  useAgentes.setState({ alertas: [] });
  const agora = new Date(2026, 10, 22, 9, 0);
  const base = { id: "dia", titulo: "Reunião", data: "2026-11-22", tipo: "evento", repeticao: "nenhuma", area: "empresa" };
  assert.equal(eventoDisparaEm(base, agora), agora.toISOString());
  assert.equal(eventoDisparaEm({ ...base, hora: "10:00" }, agora), null);
  assert.equal(eventoDisparaEm({ ...base, feitos: [base.data] }, agora), null);
  const recorrente = { ...base, repeticao: "diaria", data: "2015-01-01", hora: "09:00", ultimoDisparo: new Date(2026, 10, 21, 9, 0).toISOString() };
  assert.equal(eventoDisparaEm(recorrente, agora), agora.toISOString());
  assert.equal(eventoDisparaEm({ ...recorrente, excecoes: [base.data] }, agora), null);
  useOrganizacao.setState({ eventos: [
    base,
    { ...base, id: "pessoal", area: "pessoal" },
    ...Array.from({ length: 5 }, (_, i) => ({ ...base, id: `lembrete-${i}`, tipo: "lembrete", hora: "09:00" })),
  ] });
  verificarAvisosDoCalendario(agora);
  verificarAvisosDoCalendario(agora);
  assert.equal(useAgentes.getState().alertas.length, 6);
  assert.ok(useAgentes.getState().alertas.every((alerta) => alerta.area === "empresa"));
  assert.equal(useOrganizacao.getState().eventos.find((e) => e.id === "pessoal").ultimoDisparo, undefined);
  const pedido = { texto: "Nova solicitação de material", tipo: "info", aba: "materiais" };
  assert.equal(useIlha.getState().revelar(pedido), true);
  const revelacoes = [];
  while (useIlha.getState().revelacao) {
    revelacoes.push(useIlha.getState().revelacao);
    useIlha.getState().dispensarRevelacao();
  }
  assert.deepEqual(revelacoes.pop(), pedido);
  assert.equal(revelacoes.length, 6);
  assert.ok(revelacoes.every((aviso) => aviso.categoria === "lembretes" && aviso.texto.startsWith("Empresa")));
  useAuth.setState({ usuario: { id: 1, perfil: "dono" } });
  useInterface.getState().definirArea("pessoal");
  useInterface.getState().irParaLocal("calendario", { area: "empresa" });
  assert.equal(useInterface.getState().area, "empresa");
});

test("gerência e dono mantêm todas as abas pessoais configuradas, incluindo avisos sem notificações", async () => {
  const { abasVisiveisDaIlha } = await servidor.ssrLoadModule("/src/janelas/ilha/abasDaIlha.ts");
  const { CONFIG_PADRAO } = await servidor.ssrLoadModule("/src/estado/configuracoes.ts");
  const esperado = ["hoje", "time", "conexoes", "whatsapp", "materiais", "midia", "foco", "avisos"];
  for (const perfil of ["dono", "gerencia"]) assert.deepEqual(abasVisiveisDaIlha({ perfil }, CONFIG_PADRAO.ilha, []), esperado);
  assert.deepEqual(abasVisiveisDaIlha({ perfil: "visitante" }, CONFIG_PADRAO.ilha, []), []);
  assert.deepEqual(abasVisiveisDaIlha(null, CONFIG_PADRAO.ilha, []), []);
});

test("configurações antigas recebem a aba de materiais e preservam a ordem das outras abas", async () => {
  const { CONFIG_PADRAO } = await servidor.ssrLoadModule("/src/estado/configuracoes.ts");
  const { configuracoesValidas } = await servidor.ssrLoadModule("/src/utilitarios/configuracoesValidas.ts");
  const antiga = { ilha: { ordemAbas: ["midia", "time", "hoje", "avisos"], blocos: { avisos: false } } };
  const atual = configuracoesValidas(antiga, CONFIG_PADRAO);
  assert.deepEqual(atual.ilha.ordemAbas, ["midia", "time", "hoje", "avisos", "materiais"]);
  assert.equal(atual.ilha.blocos.materiais, true);
  assert.equal(atual.ilha.blocos.avisos, false);
});

test("a prévia leva o nome e a referência de foto do pedido, com ícone para pedidos sem foto", async (t) => {
  const { mostrarPreviaLocal } = await servidor.ssrLoadModule("/src/janelas/ilha/VisaoSolicitacoesMaterial.tsx");
  const { useAuth } = await servidor.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useConfig } = await servidor.ssrLoadModule("/src/estado/configuracoes.ts");
  const estados = [useIlha, useAuth, useConfig].map((s) => [s, s.getState()]);
  t.mock.method(window, "setTimeout", () => 0);
  t.mock.method(globalThis, "fetch", async () => assert.fail("A prévia não consulta o Inventário"));
  t.after(() => {
    while (useIlha.getState().revelacao) useIlha.getState().dispensarRevelacao();
    for (const [store, estado] of estados) store.setState(estado);
  });
  useAuth.setState({ usuario: { id: 42, nome: "Pessoa de teste", perfil: "dono" } });
  useConfig.setState((s) => ({ naoPerturbe: false, ilha: { ...s.ilha, notificacoes: "todas" }, foto: "data:image/png;base64,AQID" }));
  useIlha.getState().abrir("materiais");
  const pedido = { protocolo: "MAT-9", data: "", solicitante: "Pessoa do Inventário", local: "Comercial", tipo: "EPI_UNIFORME", itens: "2× Abafador concha", fotoEvento: "9" };
  mostrarPreviaLocal({ ...pedido, solicitante: "" });
  assert.equal(useIlha.getState().revelacao, null);
  mostrarPreviaLocal(pedido);
  const ilha = useIlha.getState();
  assert.equal(ilha.estado, "compacta");
  assert.equal(ilha.revelacao.destinatarioId, 42);
  assert.equal(ilha.revelacao.texto, "Pessoa do Inventário solicitou equipamento pessoal (EPI)");
  assert.match(ilha.revelacao.detalhe, /^Prévia local · 2× Abafador concha/);
  assert.equal(ilha.revelacao.fotoEvento, "9");
  assert.ok(!JSON.stringify(ilha.revelacao).includes("AQID"));
  ilha.dispensarRevelacao();
  mostrarPreviaLocal({ ...pedido, tipo: "MATERIAL", fotoEvento: undefined });
  assert.equal(useIlha.getState().revelacao.texto, "Pessoa do Inventário solicitou material DML");
  assert.equal(useIlha.getState().revelacao.fotoEvento, undefined);
});

test("a aba de materiais não lista reservas a partir da memória dos avisos", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { VisaoSolicitacoesMaterial, materiaisDaReserva } = await servidor.ssrLoadModule("/src/janelas/ilha/VisaoSolicitacoesMaterial.tsx");
  const { useAuth } = await servidor.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useEstadoNotificacoesApps, avisoDaSolicitacao } = await servidor.ssrLoadModule("/src/modulos/escritorio/notificacoesAppsEmpresa.ts");
  const auth = useAuth.getInitialState(), estado = useEstadoNotificacoesApps.getInitialState();
  const { usuario } = auth;
  const { consultas, vistos } = estado;
  try {
    auth.usuario = { id: 7, perfil: "gerencia" };
    const pedido = { ordem: 4, protocolo: "MAT-10", solicitante: "Pessoa de Teste", tipo: "DML", itens: "Pano de limpeza", local: "Comercial", data: "" };
    estado.consultas = { inventario: { usuarioId: 7, situacao: "conectado", notificacao: { assinatura: "atual", total: 4, recentes: [pedido] } } };
    estado.vistos = { 7: { assinatura: "atual", total: 3 } };
    const renderizar = () => renderToStaticMarkup(createElement(VisaoSolicitacoesMaterial));
    assert.match(renderizar(), /Verificar agora/);
    assert.match(renderizar(), /Abrir inventário/);
    assert.doesNotMatch(renderizar(), /Pessoa de Teste|Pano de limpeza|MAT-10|1 nova solicitação/);
    assert.deepEqual(materiaisDaReserva("(2x) BOTA PRETA [37] [7003127] | Pano [000112] | Luvas"), [
      { material: "(2x) BOTA PRETA [37]", codigo: "7003127" },
      { material: "Pano", codigo: "000112" },
      { material: "Luvas" },
    ]);
    assert.deepEqual(avisoDaSolicitacao({ ...pedido, tipo: "MATERIAL", fotoEvento: "71" }), {
      texto: "Pessoa de Teste solicitou material DML",
      detalhe: "Pano de limpeza · Comercial · MAT-10",
      fotoEvento: "71",
    });
    assert.equal(avisoDaSolicitacao({ ...pedido, tipo: "EPI_UNIFORME" }, 2).texto, "Pessoa de Teste solicitou equipamento pessoal (EPI) (+1)");
    assert.equal(avisoDaSolicitacao({ ...pedido, solicitante: "", tipo: "", local: "" }).texto, "Nova solicitação de material");
    auth.usuario = { id: 8, perfil: "dono" };
    assert.doesNotMatch(renderizar(), /1 nova solicitação/);
    assert.doesNotMatch(renderizar(), /Pessoa de Teste/);
  } finally {
    auth.usuario = usuario;
    estado.consultas = consultas;
    estado.vistos = vistos;
  }
});

test("restaurar as abas da gerência respeita ordem e opções desligadas pelo usuário", async () => {
  const { abasVisiveisDaIlha } = await servidor.ssrLoadModule("/src/janelas/ilha/abasDaIlha.ts");
  const { CONFIG_PADRAO } = await servidor.ssrLoadModule("/src/estado/configuracoes.ts");
  const cfg = { ...CONFIG_PADRAO.ilha, ordemAbas: ["midia", "hoje", "foco", "whatsapp", "avisos", "chat", "claude"], blocos: { ...CONFIG_PADRAO.ilha.blocos, foco: false, chat: true, claude: true } };
  const antes = structuredClone(cfg);
  assert.deepEqual(abasVisiveisDaIlha({ perfil: "gerencia" }, cfg, []), ["midia", "hoje", "whatsapp", "avisos"]);
  assert.deepEqual(abasVisiveisDaIlha({ perfil: "gerencia" }, cfg, ["journal", "calendario"]), ["midia", "whatsapp", "avisos"]);
  assert.deepEqual(cfg, antes);
});

test("Time da gerência mantém tarefas e foco sem anunciar acesso ao chat restrito", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { VisaoTime } = await servidor.ssrLoadModule("/src/janelas/ilha/VisaoTime.tsx");
  const { useAuth } = await servidor.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useInterface } = await servidor.ssrLoadModule("/src/estado/interface.ts");
  const { T } = await servidor.ssrLoadModule("/src/textos/textos.ts");
  const auth = useAuth.getInitialState(), ui = useInterface.getInitialState();
  const usuario = auth.usuario, area = ui.area;
  try {
    ui.area = "empresa";
    auth.usuario = { id: 7, perfil: "gerencia" };
    const gerente = renderToStaticMarkup(createElement(VisaoTime));
    assert.ok(gerente.includes(T.inicio.novaTarefa));
    assert.ok(gerente.includes(T.pomodoro.iniciar));
    assert.ok(!gerente.includes(T.ilha.conversar));
    auth.usuario = { id: 1, perfil: "dono" };
    assert.ok(renderToStaticMarkup(createElement(VisaoTime)).includes(T.ilha.conversar));
  } finally {
    auth.usuario = usuario;
    ui.area = area;
  }
});

test("fechamento permite sair imediatamente ou esperar menos de cinco segundos, preservando Nunca", () => {
  assert.equal(atrasoDeFechamento(0, "hoje"), null);
  for (const aba of ["hoje", "chat", "time", "claude"]) assert.equal(atrasoDeFechamento(-1, aba), 0);
  for (const s of [.5, 1, 2, 3, 5, 15]) assert.equal(atrasoDeFechamento(s, "hoje"), s * 1000);
  assert.equal(atrasoDeFechamento(5, "time"), null);
  assert.equal(atrasoDeFechamento(5, "claude"), null);
  for (const valor of [NaN, Infinity, -2]) assert.equal(atrasoDeFechamento(valor, "hoje"), null);
});

test("edição protege inputs, texto, seletores e conteúdo editável, mas não foco fora da ilha", () => {
  const raiz = { contains: (foco) => foco.dentro === true };
  for (const tag of ["input", "textarea", "select", "contenteditable"]) {
    const foco = { dentro: true, closest: (seletor) => { assert.match(seletor, /input, textarea, select/); return tag; } };
    assert.equal(editandoNaIlha(raiz, foco), true);
    assert.equal(editandoNaIlha(raiz, { ...foco, dentro: false }), false);
    // Campo focado, mas a pessoa já clicou em outro app: a ilha pode recolher.
    assert.equal(editandoNaIlha(raiz, foco, false), false);
  }
  assert.equal(editandoNaIlha(raiz, null), false);
  assert.equal(editandoNaIlha(raiz, { dentro: true, closest: () => null }), false);
});

test("ilha aberta mantém uma moldura comum e cabe em celulares nas duas orientações", async () => {
  const { DIMENSOES_ILHA_EXPANDIDA, limitarIlhaATela } = await servidor.ssrLoadModule("/src/janelas/ilha/dimensoesDaIlha.ts");
  for (const tela of [{ largura: 390, altura: 844 }, { largura: 844, altura: 390 }, { largura: 240, altura: 180 }, { largura: 1920, altura: 1080 }]) {
    const ajustada = limitarIlhaATela(DIMENSOES_ILHA_EXPANDIDA, tela);
    assert.ok(ajustada.w > 0 && ajustada.h > 0);
    assert.ok(ajustada.w <= tela.largura - 16);
    assert.ok(ajustada.h <= tela.altura - 24);
    assert.ok(ajustada.w <= DIMENSOES_ILHA_EXPANDIDA.w);
    assert.ok(ajustada.h <= DIMENSOES_ILHA_EXPANDIDA.h);
    assert.equal(ajustada.r, DIMENSOES_ILHA_EXPANDIDA.r);
  }
  assert.deepEqual(limitarIlhaATela(DIMENSOES_ILHA_EXPANDIDA, { largura: 1920, altura: 1080 }), DIMENSOES_ILHA_EXPANDIDA);
  assert.ok(Object.isFrozen(DIMENSOES_ILHA_EXPANDIDA));
});

test("voltar, fechar ou trocar de aba limpa a seleção sem perder a rolagem dos commits", () => {
  const ilha = readFileSync(new URL("../src/janelas/ilha/Ilha.tsx", import.meta.url), "utf8");
  const visoes = readFileSync(new URL("../src/janelas/ilha/Visoes.tsx", import.meta.url), "utf8");
  const detalhes = readFileSync(new URL("../src/janelas/ilha/ConexaoNaIlha.tsx", import.meta.url), "utf8");
  assert.match(ilha, /estadoEfetivo !== "expandida" \|\| abaAtual !== "conexoes"\) setConexaoSelecionada\(null\)/);
  assert.match(ilha, /<VisaoConexoes aberta=\{conexaoSelecionada\} aoSelecionar=\{setConexaoSelecionada\}/);
  assert.match(visoes, /onClick=\{\(\) => aoSelecionar\(null\)\}/);
  assert.match(detalhes, /ilha-rolagem ilha-conexao-conteudo/);
});

test("laterais seguem o foco, não o tamanho da janela, e preservam foco ao usar sobreposições", () => {
  const area = { frente: "area_de_trabalho", telaCheia: false, maximizada: false, cobre: false };
  assert.equal(areaDeTrabalhoNaFrente(area, false), true);
  for (const maximizada of [false, true]) {
    assert.equal(areaDeTrabalhoNaFrente({ ...area, frente: "app", maximizada }, true), false);
  }
  for (const anterior of [true, false]) {
    assert.equal(areaDeTrabalhoNaFrente({ ...area, frente: "sobreposta" }, anterior), anterior);
  }
  assert.equal(areaDeTrabalhoNaFrente({ ...area, telaCheia: true, frente: "sobreposta" }, true), false);
});

test("controles ficam disponíveis na ilha aberta ou no próprio painel, respeitando bloqueios", () => {
  const base = { ativadas: true, estado: "compacta", saudando: false, telaCheia: false, areaEmFoco: false };
  assert.equal(mostrarLateraisDaIlha(base), false);
  assert.equal(mostrarLateraisDaIlha({ ...base, areaEmFoco: true }), true);
  assert.equal(mostrarLateraisDaIlha({ ...base, sistemaEmFoco: true }), true);
  assert.equal(mostrarLateraisDaIlha({ ...base, estado: "expandida" }), true);
  assert.equal(mostrarLateraisDaIlha({ ...base, estado: "escondida", areaEmFoco: true }), false);
  for (const bloqueio of [{ ativadas: false }, { saudando: true }, { telaCheia: true }]) {
    assert.equal(mostrarLateraisDaIlha({ ...base, estado: "expandida", areaEmFoco: true, ...bloqueio }), false);
  }
});

test("laterais começam recolhidas e cada seta revela somente o lado escolhido", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SetasLaterais } = await servidor.ssrLoadModule("/src/janelas/ilha/SetasLaterais.tsx");
  const { BarraDoTopo } = await servidor.ssrLoadModule("/src/janelas/ilha/barra/BarraDoTopo.tsx");
  const { aparenciaDeBorda } = await servidor.ssrLoadModule("/src/utilitarios/cores.ts");
  const props = { visivel: true, escala: 1, larguraDaIlha: 300, aparencia: aparenciaDeBorda("#fff9fa", 1, "#e40016"), aoUsar() {}, aoFechar() {} };
  const renderizar = (ladoAberto) => renderToStaticMarkup(createElement(BarraDoTopo, { ...props, ladoAberto }));
  assert.doesNotMatch(renderizar(null), /ilha-barra-aba|ilha-pop ilha/);
  for (const lado of ["esquerda", "direita"]) {
    const html = renderizar(lado);
    assert.ok(html.includes(`id="ilha-lateral-${lado}"`));
    assert.ok(!html.includes(`id="ilha-lateral-${lado === "esquerda" ? "direita" : "esquerda"}"`));
  }
  const clicados = [];
  const setas = SetasLaterais({ aberta: null, expandida: false, aoAlternar: (lado) => clicados.push(lado) });
  for (const botao of [setas.props.children[0], setas.props.children[2]]) {
    assert.equal(botao.props["aria-expanded"], false);
    botao.props.onClick();
  }
  assert.deepEqual(clicados, ["esquerda", "direita"]);
  const html = renderToStaticMarkup(createElement(SetasLaterais, { aberta: "direita", expandida: true, aoAlternar() {} }));
  assert.match(html, /aria-label="Recolher materiais à direita"[^>]*aria-expanded="true"/);
});

test("foco no localhost distingue área de trabalho, janelas e controles da ilha", () => {
  const elemento = (janela, area) => ({ closest: () => janela ? {} : null, matches: () => area });
  assert.equal(focoDaAreaPeloElemento(elemento(true, false)), false);
  assert.equal(focoDaAreaPeloElemento(elemento(false, true)), true);
  assert.equal(focoDaAreaPeloElemento(elemento(false, false)), undefined);
  assert.equal(focoDaAreaPeloElemento(null), undefined);
});

test("controles solicitados permanecem em uso sem abrir a ilha e respeitam os bloqueios", () => {
  const base = { ativadas: true, estado: "escondida", saudando: false, telaCheia: false, areaEmFoco: false };
  assert.equal(mostrarLateraisDaIlha(base), false);
  assert.equal(mostrarLateraisDaIlha({ ...base, emUso: true }), true);
  assert.equal(mostrarLateraisDaIlha({ ...base, estado: "compacta", emUso: true }), true);
  assert.equal(mostrarLateraisDaIlha({ ...base, emUso: false }), false);
  for (const bloqueio of [{ ativadas: false }, { saudando: true }, { telaCheia: true }]) {
    assert.equal(mostrarLateraisDaIlha({ ...base, emUso: true, ...bloqueio }), false);
  }
});

test("usar os controles das pontas não recolhe a ilha nem dispara o fechamento automático", () => {
  const codigo = readFileSync(new URL("../src/janelas/ilha/Ilha.tsx", import.meta.url), "utf8");
  assert.match(codigo, /sobre \|\| barraEmUso \|\| atraso === null \|\| fixada/);
  assert.match(codigo, /e\.target\.closest\("\.ilha-barra, \.ilha-pop"\)\) return/);
  assert.match(codigo, /!areaEmFocoNoNavegador && alguemCobre/);
});

test("a ilha coberta desaparece gradualmente e retorna sem atraso ou deslocamento residual", async () => {
  const { movimentoDaVisibilidade } = await servidor.ssrLoadModule("/src/janelas/ilha/animacoes/visibilidade.ts");
  const saida = movimentoDaVisibilidade(true, false);
  const entrada = movimentoDaVisibilidade(false, false);
  assert.equal(saida.animate.opacity, 0);
  assert.ok(saida.animate.y < 0);
  assert.ok(saida.transition.duration >= 0.25 && saida.transition.duration <= 0.4);
  assert.deepEqual(entrada.animate, { opacity: 1, y: 0 });
  assert.deepEqual(entrada.transition, saida.transition);
  assert.ok(!Object.hasOwn(entrada.transition, "delay"));
  assert.deepEqual(movimentoDaVisibilidade(true, false), saida);
});

test("movimento reduzido mantém a saída com fade curto, sem deslocar a ilha", async () => {
  const { movimentoDaVisibilidade } = await servidor.ssrLoadModule("/src/janelas/ilha/animacoes/visibilidade.ts");
  const saida = movimentoDaVisibilidade(true, true);
  assert.deepEqual(saida.animate, { opacity: 0, y: 0 });
  assert.ok(saida.transition.duration > 0 && saida.transition.duration <= 0.12);
  assert.deepEqual(movimentoDaVisibilidade(false, true).animate, { opacity: 1, y: 0 });
});

test("a ilha integra a saída animada sem zerar sua opacidade diretamente no estilo", () => {
  const fonte = readFileSync(new URL("../src/janelas/ilha/Ilha.tsx", import.meta.url), "utf8");
  assert.ok(!fonte.includes('opacity: coberta && estadoEfetivo === "escondida" ? 0 : 1'));
  assert.match(fonte, /<motion\.div\s+ref=\{raiz\}/);
  assert.match(fonte, /movimentoDaVisibilidade\(oculta, Boolean\(reduzirAnimacoes\)\)/);
  assert.match(fonte, /ilha-raiz-oculta/);
});

test("clicar novamente na mesma aba recolhe a ilha", () => {
  useIlha.setState({ estado: "compacta", aba: "hoje" });
  alternarAbaDaBarra("hoje");
  assert.equal(useIlha.getState().estado, "expandida");
  alternarAbaDaBarra("hoje");
  assert.equal(useIlha.getState().estado, "compacta");
});

test("saudação ao abrir considera primeira vez, dia, versão e troca de conta", async () => {
  const { decidirSaudacaoAoAbrir } = await servidor.ssrLoadModule("/src/janelas/ilha/animacoes/usarSaudacaoDiaria.ts");
  const hoje = "2026-10-07", versao = "0.2.1";
  const ultima = { dia: hoje, versao, usuarioId: 7 };
  assert.deepEqual(decidirSaudacaoAoAbrir(null, hoje, versao, 7), { saudar: true });
  assert.deepEqual(decidirSaudacaoAoAbrir({ dia: hoje, versao }, hoje, versao, 7), { saudar: true });
  assert.deepEqual(decidirSaudacaoAoAbrir(ultima, hoje, versao, 7), { saudar: false });
  assert.deepEqual(decidirSaudacaoAoAbrir(ultima, hoje, versao, 8), { saudar: true });
  assert.deepEqual(decidirSaudacaoAoAbrir(ultima, "2026-10-08", versao, 7), { saudar: true });
  assert.deepEqual(decidirSaudacaoAoAbrir(ultima, hoje, "0.2.2", 7), { saudar: true, versaoNova: "0.2.2" });
});

test("saudação na volta: só depois de 30 min longe ou do PC dormir, e quando a pessoa mexe de novo", async () => {
  const { voltouDepoisDeAusencia } = await servidor.ssrLoadModule("/src/janelas/ilha/animacoes/usarSaudacaoDiaria.ts");
  const minuto = 60_000;
  assert.deepEqual(voltouDepoisDeAusencia(minuto, 5_000, false), { ausente: false, voltou: false });
  assert.deepEqual(voltouDepoisDeAusencia(minuto, 40 * minuto, false), { ausente: true, voltou: false });
  assert.deepEqual(voltouDepoisDeAusencia(minuto, 10_000, true), { ausente: false, voltou: true });
  assert.deepEqual(voltouDepoisDeAusencia(8 * 60 * minuto, 3_000, false), { ausente: false, voltou: true });
  assert.deepEqual(voltouDepoisDeAusencia(minuto, 5 * minuto, true), { ausente: true, voltou: false });
});

test("volta ao PC: saúda no primeiro retorno do dia, só avisa depois de muito tempo fora e nunca atrapalha", async () => {
  const { reagirAVolta } = await servidor.ssrLoadModule("/src/janelas/ilha/animacoes/usarSaudacaoDiaria.ts");
  const hora = 3_600_000;
  const base = { jaSaudouHoje: false, ausenciaMs: hora, naoPerturbe: false, ilhaEmUso: false };
  assert.equal(reagirAVolta(base), "saudar");
  assert.equal(reagirAVolta({ ...base, naoPerturbe: true }), "nada");
  assert.equal(reagirAVolta({ ...base, ilhaEmUso: true }), "esperar");
  assert.equal(reagirAVolta({ ...base, jaSaudouHoje: true }), "nada");
  assert.equal(reagirAVolta({ ...base, jaSaudouHoje: true, ausenciaMs: 3 * hora }), "boasVindas");
});

test("subtítulo da saudação diz o que tem para hoje", async () => {
  const { T } = await servidor.ssrLoadModule("/src/textos/textos.ts");
  assert.equal(T.ilha.saudacao.hoje({ tarefas: 3, habitos: 1 }), "Hoje: 3 tarefas e 1 hábito.");
  assert.equal(T.ilha.saudacao.hoje({ tarefas: 1, habitos: 0 }), "Hoje: 1 tarefa.");
  assert.equal(T.ilha.saudacao.hoje({ tarefas: 0, habitos: 0 }), T.ilha.saudacao.equipe);
});

test("rolar sobre as abas anda uma aba por vez e para nas pontas", () => {
  const abas = ["hoje", "conexoes", "chat"];
  assert.equal(abaVizinha(abas, "hoje", 1), "conexoes");
  assert.equal(abaVizinha(abas, "conexoes", -1), "hoje");
  assert.equal(abaVizinha(abas, "chat", 1), "chat");
  assert.equal(abaVizinha(abas, "hoje", -1), "hoje");
  assert.equal(abaVizinha(abas, "midia", 1), "hoje");
  assert.equal(abaVizinha([], "hoje", 1), undefined);
});

test("botão de tarefas da barra abre a seção certa sem recolher outra seção do Hoje", () => {
  useIlha.setState({ estado: "expandida", aba: "hoje", secaoHoje: "agenda" });
  alternarAbaDaBarra("hoje", "tarefas");
  assert.equal(useIlha.getState().estado, "expandida");
  assert.equal(useIlha.getState().secaoHoje, "tarefas");
  alternarAbaDaBarra("hoje", "tarefas");
  assert.equal(useIlha.getState().estado, "compacta");
});

test("trocar de aba não recolhe uma ilha expandida", () => {
  useIlha.setState({ estado: "expandida", aba: "chat" });
  alternarAbaDaBarra("hoje");
  assert.equal(useIlha.getState().estado, "expandida");
  assert.equal(useIlha.getState().aba, "hoje");
});

test("Iniciar usa o estado capturado antes de o clique roubar o foco", async () => {
  const pedidos = [];
  const alternador = criarAlternadorDoIniciar(async () => ({ aberto: true }), async (abertoAntes) => pedidos.push(abertoAntes));
  alternador.preparar();
  await alternador.alternar();
  assert.deepEqual(pedidos, [true]);
});

test("cliques rápidos não acumulam comandos para o Iniciar", async () => {
  let finalizar;
  let pedidos = 0;
  const alternador = criarAlternadorDoIniciar(async () => ({ aberto: false }), async () => {
    pedidos++;
    await new Promise((resolver) => { finalizar = resolver; });
  });
  const primeiro = alternador.alternar();
  await new Promise((resolver) => setImmediate(resolver));
  await alternador.alternar();
  assert.equal(pedidos, 1);
  finalizar();
  await primeiro;
});

test("falha na leitura do Iniciar não inventa um estado aberto", async () => {
  const pedidos = [];
  const alternador = criarAlternadorDoIniciar(async () => { throw new Error("indisponivel"); }, async (estado) => pedidos.push(estado));
  alternador.preparar();
  await alternador.alternar();
  assert.deepEqual(pedidos, [undefined]);
});

test("segundo clique usa a confirmação real do Windows mesmo sem mover o mouse", async () => {
  const pedidos = [];
  const alternador = criarAlternadorDoIniciar(async () => ({ aberto: false }), async (abertoAntes) => {
    pedidos.push(abertoAntes);
    return { aberto: !abertoAntes };
  });
  alternador.preparar();
  await alternador.alternar();
  await alternador.alternar();
  assert.deepEqual(pedidos, [false, true]);
});

test("ponte preserva estado real do Bluetooth e o estado anterior do Iniciar", async () => {
  const pedidos = [];
  globalThis.fetch = async (url, opcoes) => {
    pedidos.push({ url, corpo: opcoes?.body ? JSON.parse(opcoes.body) : null });
    return Response.json(url.endsWith("bluetooth") ? { aparelhos: { id: "teste", nome: "Fone", ativo: false, conectado: null } } : { aberto: true });
  };
  assert.equal((await sistema.bluetooth())[0].conectado, null);
  assert.equal((await controle.iniciar()).aberto, true);
  await controle.alternarIniciar(true);
  assert.deepEqual(pedidos.at(-1).corpo, { nome: "iniciar", abertoAntes: true });
});

test("leitura nativa do Bluetooth não usa status do driver como conexão", { skip: process.platform !== "win32" }, async () => {
  const { listarBluetooth } = await servidor.ssrLoadModule("/servidor/sistema.ts");
  const resultado = await listarBluetooth();
  assert.ok(Array.isArray(resultado.aparelhos));
  for (const aparelho of resultado.aparelhos) {
    assert.equal(typeof aparelho.id, "string");
    assert.ok(aparelho.conectado === null || typeof aparelho.conectado === "boolean");
    assert.equal(aparelho.ativo, aparelho.conectado === true);
  }
});

test("detecção nativa do Iniciar compila e retorna um booleano sem abrir janelas", { skip: process.platform !== "win32" }, async () => {
  const { lerIniciar, encerrarControle } = await servidor.ssrLoadModule("/servidor/controleRapido.ts");
  try {
    assert.equal(typeof (await lerIniciar()).aberto, "boolean");
  } finally {
    encerrarControle();
  }
});
