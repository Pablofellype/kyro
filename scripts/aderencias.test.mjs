import test from "node:test";
import assert from "node:assert/strict";
import { construirMensagem, slotAderenciaDevido } from "../servidor/aderencias.ts";
import { configuracaoAderenciasValida, planilhaAderenciaValida } from "../src/modulos/escritorio/aderenciasTipos.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { WebSocketServer } from "ws";
import { ClienteCdp } from "../servidor/aderencias.ts";
import { criarFilaDeCapturas, escalasDaCaptura, MAXIMO_PIXELS_DA_CAPTURA, TELA_DA_CAPTURA } from "../servidor/capturaAderencias.ts";

const planilha = (parcial = {}) => planilhaAderenciaValida({ nome: "P1", ...parcial }, "p1");

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
