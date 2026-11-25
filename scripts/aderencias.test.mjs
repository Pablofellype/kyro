import test from "node:test";
import assert from "node:assert/strict";
import { construirMensagem, enviarAderencia, executarAderencias, slotAderenciaDevido } from "../servidor/aderencias.ts";
import { configuracaoAderenciasValida, planilhaAderenciaValida } from "../src/modulos/escritorio/aderenciasTipos.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { WebSocketServer } from "ws";
import { ClienteCdp } from "../servidor/aderencias.ts";
import { criarFilaDeCapturas, escalasDaCaptura, MAXIMO_PIXELS_DA_CAPTURA, MAXIMO_PIXELS_DO_PNG_ORIGINAL, TELA_DA_CAPTURA } from "../servidor/capturaAderencias.ts";
import { aplicarRascunhoAderencias, copiarPlanilhasAderencias, criarRascunhoAderencias } from "../src/modulos/escritorio/edicaoAderencias.ts";

const planilha = (parcial = {}) => planilhaAderenciaValida({ nome: "P1", ...parcial }, "p1");

const configuracaoDeEdicao = () => configuracaoAderenciasValida({
  destinoJid: "120363@g.us", destinoNome: "Grupo de teste",
  grupos: [{ id: "manha", nome: "Manhã", ativo: true, frequencia: "diaria", hora: "07:00", diasSemana: [1, 3, 5],
    ultimoAgendamento: "2026-11-13T07:00:manha:diaria", ultimoResultado: { executadoEm: "2026-11-13T10:00:00Z", planilhasEnviadas: 1 },
    planilhas: [planilha({ sheetUrl: "https://docs.google.com/spreadsheets/d/teste/edit", tabUrl: "https://docs.google.com/spreadsheets/d/teste/edit#gid=42", colEnd: "G", rowEnd: 65, headerLinha: 3, yellowEnabled: false, soPrint: true })] }],
});

test("duplicação copia links, intervalos e alertas sem ativar ou alterar a rotina original", () => {
  const config = configuracaoDeEdicao();
  const antes = structuredClone(config);
  const copia = criarRascunhoAderencias(config, config.grupos[0], true);
  assert.equal(copia.novo, true);
  assert.notEqual(copia.grupo.id, config.grupos[0].id);
  assert.equal(copia.grupo.ativo, false);
  assert.equal(copia.grupo.ultimoAgendamento, "");
  assert.equal(copia.grupo.ultimoResultado, null);
  assert.equal(copia.grupo.destinoJid, config.grupos[0].destinoJid);
  assert.notEqual(copia.grupo.planilhas[0].id, config.grupos[0].planilhas[0].id);
  assert.deepEqual({ ...copia.grupo.planilhas[0], id: "p1" }, config.grupos[0].planilhas[0]);
  copia.grupo.nome = "Tarde"; copia.grupo.hora = "14:00"; copia.grupo.diasSemana.push(6);
  copia.grupo.planilhas[0].rowEnd = 70;
  assert.deepEqual(config, antes);
  const salva = aplicarRascunhoAderencias(config, copia);
  assert.deepEqual(salva.grupos[0], config.grupos[0]);
  assert.equal(salva.grupos[1].hora, "14:00");
  assert.equal(salva.grupos[1].planilhas[0].rowEnd, 70);
});

test("edição e remoção permanecem no rascunho até aplicar; preserva dados novos do agendador", () => {
  const config = configuracaoDeEdicao();
  const rascunho = criarRascunhoAderencias(config, config.grupos[0]);
  rascunho.grupo.hora = "09:00";
  rascunho.grupo.planilhas = [];
  rascunho.grupo.destinoJid = "outro@g.us";
  assert.equal(config.grupos[0].hora, "07:00");
  assert.equal(config.grupos[0].planilhas.length, 1);
  assert.equal(config.destinoJid, "120363@g.us");
  config.grupos[0].ultimoAgendamento = "novo-slot";
  config.grupos[0].ultimoResultado.planilhasEnviadas = 5;
  const salva = aplicarRascunhoAderencias(config, rascunho);
  assert.equal(salva.grupos[0].hora, "09:00");
  assert.equal(salva.grupos[0].planilhas.length, 0);
  assert.equal(salva.grupos[0].destinoJid, "outro@g.us");
  assert.equal(salva.grupos[0].ultimoAgendamento, "novo-slot");
  assert.equal(salva.grupos[0].ultimoResultado.planilhasEnviadas, 5);
  rascunho.excluir = true;
  assert.equal(config.grupos.length, 1);
  const excluida = aplicarRascunhoAderencias(config, rascunho);
  assert.equal(excluida.grupos.length, 0);
  assert.equal(excluida.planilhas.length, 0);
  assert.equal(excluida.ativo, false);
  assert.equal(excluida.frequencia, "manual");
  assert.equal(slotAderenciaDevido(excluida, { data: "2026-11-13", hora: "07:00", dia: 5 }), null);
});

test("nova rotina reutiliza somente as planilhas escolhidas, com IDs independentes", () => {
  const config = configuracaoDeEdicao();
  const nova = criarRascunhoAderencias(config);
  nova.grupo.planilhas = copiarPlanilhasAderencias([config.grupos[0].planilhas[0]]);
  nova.grupo.planilhas[0].nome = "Outro nome";
  assert.equal(config.grupos.length, 1);
  assert.equal(config.grupos[0].planilhas[0].nome, "P1");
  const salva = aplicarRascunhoAderencias(config, nova);
  assert.equal(salva.grupos.length, 2);
  assert.equal(salva.grupos[1].ativo, false);
  assert.equal(salva.grupos[1].destinoJid, "");
  assert.equal(salva.grupos[1].planilhas[0].nome, "Outro nome");
});

test("salvamento rejeita excessos e rotina removida sem truncar as configurações", () => {
  const config = configuracaoDeEdicao();
  const nova = criarRascunhoAderencias(config);
  nova.grupo.planilhas = Array.from({ length: 31 }, (_, i) => planilha({ id: `p${i}` }));
  assert.throws(() => aplicarRascunhoAderencias(config, nova), /30 planilhas/);
  nova.grupo.planilhas = [];
  assert.throws(() => aplicarRascunhoAderencias({ ...config, grupos: Array.from({ length: 30 }, () => config.grupos[0]) }, nova), /30 rotinas/);
  const edicao = criarRascunhoAderencias(config, config.grupos[0]);
  assert.throws(() => aplicarRascunhoAderencias({ ...config, grupos: [] }, edicao), /não existe/);
  edicao.grupo.hora = "29:80";
  assert.throws(() => aplicarRascunhoAderencias(config, edicao), /horário/);
});

test("salvar sem editar o destino mantém o destino mais recente da própria rotina", () => {
  const config = configuracaoDeEdicao();
  const edicao = criarRascunhoAderencias(config, config.grupos[0]);
  edicao.grupo.nome = "Manhã revisada";
  const baseNova = configuracaoAderenciasValida({ ...config, grupos: [
    { ...config.grupos[0], destinoJid: "novo@g.us", destinoNome: "Novo destino" },
    { id: "noite", nome: "Noite", hora: "21:00", ativo: true, frequencia: "diaria", destinoJid: "noite@g.us" },
  ] });
  const salva = aplicarRascunhoAderencias(baseNova, edicao);
  assert.equal(salva.grupos[0].destinoJid, "novo@g.us");
  assert.equal(salva.grupos[0].destinoNome, "Novo destino");
  assert.deepEqual(salva.grupos[1], baseNova.grupos[1]);
  assert.equal(salva.grupos[0].nome, "Manhã revisada");
});

test("migrar e editar o destino de uma rotina mantém o grupo das demais", () => {
  const antiga = configuracaoAderenciasValida({
    destinoJid: "origem@g.us", destinoNome: "Grupo anterior",
    grupos: [{ id: "manha", nome: "Manhã" }, { id: "tarde", nome: "Tarde" }],
  });
  assert.deepEqual(antiga.grupos.map((grupo) => grupo.destinoJid), ["origem@g.us", "origem@g.us"]);

  const manha = criarRascunhoAderencias(antiga, antiga.grupos[0]);
  const tarde = criarRascunhoAderencias(antiga, antiga.grupos[1]);
  manha.grupo.destinoJid = "manha@g.us";
  manha.grupo.destinoNome = "Grupo da manhã";
  tarde.grupo.destinoJid = "tarde@g.us";
  tarde.grupo.destinoNome = "Grupo da tarde";
  const primeira = aplicarRascunhoAderencias(antiga, manha);
  assert.equal(primeira.grupos[1].destinoJid, "origem@g.us");
  const salva = aplicarRascunhoAderencias(primeira, tarde);
  const reaberta = configuracaoAderenciasValida(JSON.parse(JSON.stringify(salva)));
  assert.deepEqual(reaberta.grupos.map((grupo) => [grupo.destinoJid, grupo.destinoNome]), [
    ["manha@g.us", "Grupo da manhã"], ["tarde@g.us", "Grupo da tarde"],
  ]);
});

test("envio individual e execução usam apenas o destino da rotina escolhida", async () => {
  const semDestino = planilha({ id: "p2", nome: "P2" });
  const comDestino = planilha({ id: "p1", nome: "P1" });
  const config = configuracaoAderenciasValida({ destinoJid: "legado@g.us", grupos: [
    { id: "manha", destinoJid: "manha@g.us", planilhas: [comDestino] },
    { id: "tarde", nome: "Tarde", destinoJid: "", planilhas: [semDestino] },
  ] });
  assert.equal(config.grupos[1].destinoJid, "");
  await assert.rejects(enviarAderencia(config, semDestino, "tarde"), /destino_do_whatsapp_obrigatorio/);
  await assert.rejects(enviarAderencia(config, semDestino, "manha"), /planilha_nao_encontrada_na_rotina/);
  await assert.rejects(executarAderencias(config, "tarde"), /destino_do_whatsapp_obrigatorio/);
  const { resultado } = await executarAderencias(config);
  assert.deepEqual(resultado.erros, ["P1: link_da_planilha_invalido", "Tarde: destino_do_whatsapp_obrigatorio"]);
});

test("a ordem editada sobrevive ao salvamento e é seguida na execução da rotina", async () => {
  const config = configuracaoDeEdicao();
  const grupo = config.grupos[0];
  grupo.planilhas = Array.from({ length: 5 }, (_, i) => planilha({ id: `p${i + 1}`, nome: `P${i + 1}` }));
  const rascunho = criarRascunhoAderencias(config, grupo);
  rascunho.grupo.planilhas = [grupo.planilhas[4], ...grupo.planilhas.slice(0, 4)];
  const salva = aplicarRascunhoAderencias(config, rascunho);
  const reaberta = configuracaoAderenciasValida(JSON.parse(JSON.stringify(salva)));
  const ordem = ["P5", "P1", "P2", "P3", "P4"];
  assert.deepEqual(reaberta.grupos[0].planilhas.map((item) => item.nome), ordem);
  assert.deepEqual(grupo.planilhas.map((item) => item.nome), ["P1", "P2", "P3", "P4", "P5"]);
  // Links vazios fazem a validação falhar em sequência, sem abrir o navegador ou enviar mensagens.
  const { resultado } = await executarAderencias(reaberta, grupo.id);
  assert.deepEqual(resultado.erros.map((erro) => erro.split(":")[0]), ordem);
});

test("configuração do robô normaliza planilhas e preserva o agendamento", () => {
  const resultado = configuracaoAderenciasValida({
    ativo: true,
    destinoJid: "5511999999999@s.whatsapp.net",
    frequencia: "semanal",
    hora: "07:30",
    diasSemana: [1, 5],
    planilhas: [{ nome: "P1", sheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit", redThreshold: "3" }],
  });
  assert.equal(resultado.ativo, true);
  assert.equal(resultado.frequencia, "semanal");
  assert.equal(resultado.hora, "07:30");
  assert.deepEqual(resultado.diasSemana, [1, 5]);
  assert.equal(resultado.planilhas[0].redThreshold, 3);
});

test("agendamento recupera o horario perdido enquanto o WhatsApp reconecta", () => {
  const grupo = { id: "manha", ativo: true, frequencia: "diaria", hora: "08:00", diasSemana: [1, 2, 3, 4, 5], planilhas: [planilha()] };
  assert.equal(slotAderenciaDevido(grupo, { data: "2026-10-27", hora: "08:00", dia: 2 }), "2026-10-27T08:00:manha:diaria");
  assert.equal(slotAderenciaDevido(grupo, { data: "2026-10-27", hora: "08:42", dia: 2 }), "2026-10-27T08:00:manha:diaria");
  assert.equal(slotAderenciaDevido(grupo, { data: "2026-10-27", hora: "09:01", dia: 2 }), null);
});

test("rotinas independentes preservam horários e planilhas diferentes", () => {
  const resultado = configuracaoAderenciasValida({
    destinoJid: "5511999999999@s.whatsapp.net",
    grupos: [
      { id: "manha", nome: "Manhã", ativo: true, frequencia: "diaria", hora: "08:00", planilhas: [{ id: "p1", nome: "P1", sheetUrl: "https://docs.google.com/spreadsheets/d/a/edit" }] },
      { id: "tarde", nome: "Tarde", ativo: true, frequencia: "diaria", hora: "14:00", planilhas: [{ id: "p2", nome: "P2", sheetUrl: "https://docs.google.com/spreadsheets/d/b/edit" }] },
    ],
  });
  assert.equal(resultado.grupos.length, 2);
  assert.equal(resultado.grupos[0].hora, "08:00");
  assert.equal(resultado.grupos[1].hora, "14:00");
  assert.equal(resultado.grupos[0].planilhas[0].id, "p1");
  assert.equal(resultado.grupos[1].planilhas[0].id, "p2");
});

test("robô separa alertas amarelos e vermelhos pelos limiares", () => {
  const resultado = construirMensagem(planilha({ redThreshold: 3, yellowThreshold: 1 }), [
    { texto: "1", area: "Sala A", predio: "P1", cor: "amarelo" },
    { texto: "2", area: "Sala B", predio: "P1", cor: "vermelho" },
    { texto: "3", area: "Sala C", predio: "P1", cor: "vermelho" },
  ]);
  assert.equal(resultado.alertas, 2);
  assert.equal(resultado.urgentes, 1);
  assert.match(resultado.texto, /ATENÇÃO/);
  assert.match(resultado.texto, /CRÍTICO/);
});

test("modo somente print não cria alertas", () => {
  const resultado = construirMensagem(planilha({ soPrint: true }), [{ texto: "9", area: "Sala", predio: "P1", cor: "vermelho" }]);
  assert.equal(resultado.alertas, 0);
  assert.equal(resultado.urgentes, 0);
  assert.match(resultado.texto, /PRINT DE ADERÊNCIA/);
});

test("captura usa densidade extra apenas no recorte e respeita o orçamento de pixels", () => {
  assert.equal(TELA_DA_CAPTURA.deviceScaleFactor, 1);
  for (const [width, height] of [[500, 600], [1600, 1000], [2000, 2000], [4000, 1000]]) {
    const escalas = escalasDaCaptura({ x: 0, y: 10, width, height });
    assert.ok(escalas.length > 0);
    for (const escala of escalas) {
      assert.ok(escala >= 1 && escala <= 2);
      assert.ok(width * height * escala ** 2 <= MAXIMO_PIXELS_DA_CAPTURA);
    }
  }
  assert.equal(escalasDaCaptura({ x: 0, y: 0, width: 500, height: 600 })[0], 2);
});

test("o PNG enviado ganha resolução sem aumentar a captura da prévia", () => {
  for (const [width, height] of [[500, 600], [1600, 1000], [4000, 1000], [8100, 480]]) {
    const area = { x: 0, y: 0, width, height };
    const escalas = escalasDaCaptura(area, true);
    assert.ok(escalas[0] >= escalasDaCaptura(area)[0]);
    assert.equal(escalas.at(-1), 1);
    for (const escala of escalas) {
      assert.ok(width * height * escala ** 2 <= MAXIMO_PIXELS_DO_PNG_ORIGINAL);
      assert.ok(Math.max(width, height) * escala <= 8192);
    }
  }
  assert.equal(escalasDaCaptura({ x: 0, y: 0, width: 500, height: 600 }, true)[0], 3);
  assert.equal(escalasDaCaptura({ x: 0, y: 0, width: 1600, height: 1000 }, true)[0], 2.5);
});

test("intervalos excessivos ou inválidos falham antes de criar o bitmap, sem gerar print ilegível", () => {
  for (const area of [
    { width: 3000, height: 3000 }, { width: 100, height: 9000 },
    { width: NaN, height: 100 }, { width: 0, height: 100 }, { width: 100, height: Infinity },
  ]) assert.throws(() => escalasDaCaptura({ x: 0, y: 0, ...area }), /intervalo|área|Divida/i);
});

test("capturas concorrentes são serializadas e mantêm a identidade de cada usuário", async () => {
  const contexto = new AsyncLocalStorage();
  const fila = criarFilaDeCapturas();
  const ordem = [];
  let liberar;
  const primeira = contexto.run("7", () => fila(async () => {
    ordem.push(`abriu:${contexto.getStore()}`);
    await new Promise((r) => { liberar = r; });
    ordem.push(`fechou:${contexto.getStore()}`);
    return "primeira";
  }));
  const segunda = contexto.run("8", () => fila(async () => { ordem.push(`abriu:${contexto.getStore()}`); return "segunda"; }));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(ordem, ["abriu:7"]);
  liberar();
  assert.deepEqual(await Promise.all([primeira, segunda]), ["primeira", "segunda"]);
  assert.deepEqual(ordem, ["abriu:7", "fechou:7", "abriu:8"]);
});

test("uma captura com falha libera a fila para a próxima planilha", async () => {
  const fila = criarFilaDeCapturas();
  const primeira = fila(async () => { throw new Error("falha simulada"); });
  const segunda = fila(async () => "continua");
  await assert.rejects(primeira, /falha simulada/);
  assert.equal(await segunda, "continua");
});

async function debuggerIsolado(t, aoReceber) {
  const servidor = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((r, j) => { servidor.once("listening", r); servidor.once("error", j); });
  servidor.on("connection", (socket) => socket.on("message", (dados) => aoReceber(socket, JSON.parse(String(dados)))));
  t.after(async () => {
    for (const socket of servidor.clients) socket.terminate();
    await new Promise((r) => servidor.close(r));
  });
  const cliente = await ClienteCdp.abrir(`ws://127.0.0.1:${servidor.address().port}`);
  t.after(() => cliente.fechar());
  return cliente;
}

test("navegador que não responde devolve erro com prazo, sem prender a rotina", async (t) => {
  const cliente = await debuggerIsolado(t, () => undefined);
  await assert.rejects(cliente.comando("Runtime.evaluate", {}, 20), /demorou demais/);
});

test("queda do navegador rejeita a captura pendente imediatamente", async (t) => {
  const cliente = await debuggerIsolado(t, (socket) => socket.close());
  await assert.rejects(cliente.comando("Page.captureScreenshot"), /navegador foi encerrado/);
});

test("resposta válida do navegador conclui o pedido e cancela seu prazo", async (t) => {
  const cliente = await debuggerIsolado(t, (socket, pedido) => socket.send(JSON.stringify({ id: pedido.id, result: { data: "imagem" } })));
  const resposta = await cliente.comando("Page.captureScreenshot", {}, 1000);
  assert.equal(resposta.result.data, "imagem");
});
