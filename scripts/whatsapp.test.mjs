import test, { after } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, crc32 } from "node:zlib";
import { createHmac } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { criarServidorDeTeste } from "./vite-para-testes.mjs";

const vite = await criarServidorDeTeste({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } });
after(() => vite.close());

const caixa = await vite.ssrLoadModule("/servidor/whatsapp/caixa.ts");
const zip = await vite.ssrLoadModule("/servidor/whatsapp/zip.ts");
const gowa = await vite.ssrLoadModule("/servidor/whatsapp/gowa.ts");

function conexaoIsolada(t, responder, configuracoes = {}) {
  const pasta = fs.mkdtempSync(path.join(tmpdir(), "kyro-whatsapp-teste-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(pasta)), path.resolve(tmpdir()));
    assert.match(path.basename(pasta), /^kyro-whatsapp-teste-/);
    fs.rmSync(pasta, { recursive: true, force: true });
  });
  let agora = 1_800_000_000_000;
  const chamadas = [];
  const temporizadores = new Map();
  for (const [id, config] of Object.entries(configuracoes)) {
    const diretorio = id === "1" || id === "local" ? pasta : path.join(pasta, "usuarios", id);
    fs.mkdirSync(diretorio, { recursive: true });
    fs.writeFileSync(path.join(diretorio, "whatsapp.json"), JSON.stringify(config));
  }
  const contexto = vm.createContext({
    ...fs, ...path, ...caixa, AsyncLocalStorage, Buffer, URL, AbortSignal, queueMicrotask,
    Date: class extends Date { static now() { return agora; } },
    process: { pid: process.pid, env: { NIKO_GOWA_URL: "https://gateway.example", NIKO_GOWA_BASIC_AUTH: "teste:teste", NIKO_GOWA_WEBHOOK_SECRET: "teste" } },
    pastaDados: () => pasta, portaDaPonte: () => 1,
    alvoDaPlataforma: () => ({ so: "windows", arq: "amd64" }),
    gowaInstalado: () => true, gowaRodando: () => true, pararGowa() {},
    instalacao: { etapa: "parado", megabytes: 0, versao: "", erro: "" },
    setInterval: () => ({ unref() {} }), clearInterval() {},
    setTimeout: (fn) => { const h = { unref() {} }; temporizadores.set(h, fn); return h; },
    clearTimeout: (h) => temporizadores.delete(h),
    fetch: async (url, opcoes) => {
      chamadas.push({ caminho: url.pathname, consulta: url.search, metodo: opcoes.method, dispositivo: opcoes.headers["x-device-id"], corpo: opcoes.body });
      return responder(url, opcoes, () => { agora += 20_000; });
    },
  });
  const codigo = stripTypeScriptTypes(fs.readFileSync("servidor/whatsapp/whatsapp.ts", "utf8"))
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm, "").replace(/^export /gm, "");
  vm.runInContext(`${codigo}\nglobalThis.api = { comWhatsappUsuario, ligarWhatsapp, iniciarWhatsapp, estadoDoWhatsapp, passo, enviarMensagem, definirFiltrosDoWhatsapp, ignorarConversa, nomesDeGruposDoGateway };`, contexto);
  const api = contexto.api;
  return {
    chamadas,
    avancar: (ms) => { agora += ms; },
    ligar: async (id = "7") => api.comWhatsappUsuario(id, async () => { api.ligarWhatsapp(true); await api.iniciarWhatsapp(); }),
    atualizar: (id = "7") => api.comWhatsappUsuario(id, () => api.passo()),
    estado: (id = "7") => api.comWhatsappUsuario(id, () => api.estadoDoWhatsapp()),
    enviar: (jid, texto, id = "7") => api.comWhatsappUsuario(id, () => api.enviarMensagem(jid, texto)),
    desligar: (id = "7") => api.comWhatsappUsuario(id, () => api.ligarWhatsapp(false)),
    filtros: (dados, id = "7") => api.comWhatsappUsuario(id, () => api.definirFiltrosDoWhatsapp(dados)),
    configSalva: (id = "7") => JSON.parse(fs.readFileSync(path.join(pasta, "usuarios", id, "whatsapp.json"), "utf8")),
    dispararConfirmacoes: async () => {
      const funcoes = [...temporizadores.values()]; temporizadores.clear();
      for (const fn of funcoes) fn();
      await new Promise((resolver) => setImmediate(resolver));
    },
    temporizadores,
    api,
  };
}

const respostaJson = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const imagemQr = () => new Response(Buffer.from("89504e470d0a1a0a", "hex"));

function gatewayComQr(url) {
  if (url.pathname === "/devices") return respostaJson({ results: [{ id: "niko-user-7", state: "disconnected" }] });
  if (url.pathname.endsWith("/login")) return respostaJson({ results: { qr_link: "/statics/qrcode/teste.png", qr_duration: 10 } });
  if (url.pathname === "/statics/qrcode/teste.png") return imagemQr();
  assert.fail(`Chamada inesperada: ${url.pathname}`);
}

test("dispositivo ausente nunca reutiliza a sessão de outra conta", () => {
  const dispositivos = { results: [{ id: "niko", state: "logged_in", jid: "5511999990000@s.whatsapp.net" }] };
  assert.equal(caixa.dispositivoDoGateway(dispositivos, "niko-user-7"), null);
  assert.equal(caixa.dispositivoDoGateway(dispositivos, "niko").id, "niko");
});

test("QR vencido deixa de ser exibido mesmo antes da próxima consulta ao gateway", async (t) => {
  const conexao = conexaoIsolada(t, gatewayComQr);
  await conexao.ligar();
  assert.match(conexao.estado().qr, /^data:image\/png;base64,/);
  await conexao.atualizar();
  assert.equal(conexao.chamadas.filter((c) => c.caminho.endsWith("/login")).length, 1);
  conexao.avancar(15_000);
  assert.equal(conexao.estado().qr, null);
});

test("falha ao renovar QR remove a imagem antiga e preserva o erro recebido", async (t) => {
  let falhar = false;
  const conexao = conexaoIsolada(t, (url) => falhar && url.pathname.endsWith("/login")
    ? respostaJson({ code: "QR_CHANNEL_ERROR" }, 500) : gatewayComQr(url));
  await conexao.ligar();
  falhar = true;
  conexao.avancar(60_000);
  await conexao.atualizar();
  assert.equal(conexao.estado().erro, "QR_CHANNEL_ERROR");
  assert.equal(conexao.estado().qr, null);
});

test("download lento não prolonga a validade nem publica um QR que já venceu", async (t) => {
  const conexao = conexaoIsolada(t, (url, _opcoes, demorar) => {
    if (url.pathname === "/statics/qrcode/teste.png") demorar();
    return gatewayComQr(url);
  });
  await conexao.ligar();
  assert.equal(conexao.estado().qr, null);
});

test("conectar uma conta nova cria somente seu próprio dispositivo", async (t) => {
  const conexao = conexaoIsolada(t, (url, opcoes) => {
    if (url.pathname === "/devices" && opcoes.method === "GET") return respostaJson({ results: [{ id: "niko", state: "logged_in", jid: "5511999990000@s.whatsapp.net" }] });
    if (url.pathname === "/devices" && opcoes.method === "POST") return respostaJson({ results: { id: "niko-user-7" } });
    return gatewayComQr(url);
  });
  await conexao.ligar();
  assert.equal(conexao.estado().eu, null);
  assert.equal(conexao.estado().vinculo, "precisa_qr");
  assert.match(conexao.estado().qr, /^data:image\/png;base64,/);
  assert.ok(conexao.chamadas.every((c) => c.dispositivo === "niko-user-7"));
  assert.equal(JSON.parse(conexao.chamadas.find((c) => c.metodo === "POST").corpo).device_id, "niko-user-7");
});

test("renovação se recupera de falha e confirmação do vínculo retira o QR", async (t) => {
  let modo = "qr";
  let logins = 0;
  const conexao = conexaoIsolada(t, (url) => {
    if (url.pathname.endsWith("/login")) {
      logins++;
      if (modo === "erro") return respostaJson({ code: "QR_CHANNEL_ERROR" }, 500);
    }
    if (modo === "conectado" && url.pathname === "/devices") return respostaJson({ results: [{ id: "niko-user-7", state: "logged_in", jid: "5511888880000@s.whatsapp.net" }] });
    if (url.pathname === "/chats") return respostaJson({ results: { data: [] } });
    return gatewayComQr(url);
  });
  await conexao.ligar();
  modo = "erro";
  conexao.avancar(60_000);
  await conexao.atualizar();
  assert.equal(conexao.estado().qr, null);
  modo = "qr";
  await conexao.atualizar();
  assert.equal(conexao.estado().erro, "");
  assert.match(conexao.estado().qr, /^data:image\/png;base64,/);
  modo = "conectado";
  await conexao.atualizar();
  assert.equal(conexao.estado().vinculo, "conectado");
  assert.equal(conexao.estado().eu, "5511888880000@s.whatsapp.net");
  assert.equal(conexao.estado().qr, null);
  assert.equal(conexao.estado().qrExpira, null);
  assert.equal(logins, 3);
});

test("imagem inválida do gateway informa a falha sem publicar um QR", async (t) => {
  const conexao = conexaoIsolada(t, (url) => url.pathname === "/statics/qrcode/teste.png"
    ? new Response("não é PNG") : gatewayComQr(url));
  await conexao.ligar();
  assert.equal(conexao.estado().erro, "qr_indisponivel");
  assert.equal(conexao.estado().qr, null);
});

function zipComArquivo(nome, conteudo, compactar) {
  const dados = compactar ? deflateRawSync(conteudo) : conteudo;
  const nomeB = Buffer.from(nome);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(compactar ? 8 : 0, 8);
  local.writeUInt32LE(crc32(conteudo), 14);
  local.writeUInt32LE(dados.length, 18);
  local.writeUInt32LE(conteudo.length, 22);
  local.writeUInt16LE(nomeB.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(compactar ? 8 : 0, 10);
  central.writeUInt32LE(crc32(conteudo), 16);
  central.writeUInt32LE(dados.length, 20);
  central.writeUInt32LE(conteudo.length, 24);
  central.writeUInt16LE(nomeB.length, 28);
  central.writeUInt32LE(0, 42);
  const inicioCentral = local.length + nomeB.length + dados.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nomeB.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);
  return Buffer.concat([local, nomeB, dados, central, nomeB, fim]);
}

const configPreservada = (extra = {}) => ({ ligado: true, silenciarGrupos: false, ignoradas: ["5511999990000@s.whatsapp.net"], lerAoAbrir: false, esconderArquivadas: false, esconderGrupos: false, mostrarFotos: false, ...extra });
const JID_TESTE = "5511888880000@s.whatsapp.net";
const GRUPO_TESTE = "120363@g.us";

function gatewayDeConversas({ conversas, mensagens, grupos, enviar } = {}) {
  return (url, opcoes) => {
    const usuario = opcoes.headers["x-device-id"] === "niko-user-8" ? "8" : "7";
    if (url.pathname === "/devices") return respostaJson({ results: ["7", "8"].map((id) => ({ id: `niko-user-${id}`, state: "logged_in", jid: `551188888000${id}@s.whatsapp.net` })) });
    if (url.pathname === "/chats") return respostaJson({ results: { data: conversas?.(usuario) ?? [{ jid: JID_TESTE, name: "Colega", last_message_time: "2026-11-12T10:00:00Z" }, { jid: GRUPO_TESTE, name: "Nome antigo", last_message_time: "2026-11-12T09:00:00Z" }] } });
    if (url.pathname === "/user/my/groups") return respostaJson({ results: { data: grupos?.(usuario) ?? [{ JID: GRUPO_TESTE, Name: `Equipe ${usuario}` }] } });
    if (/^\/chat\/.+\/messages$/.test(url.pathname)) return respostaJson({ results: { data: mensagens?.(usuario, decodeURIComponent(url.pathname.split("/")[2])) ?? [] } });
    if (url.pathname === "/send/message") return respostaJson({ results: { message_id: enviar?.(usuario, JSON.parse(opcoes.body)) ?? `envio-${usuario}` } });
    if (/^\/message\/.+\/read$/.test(url.pathname)) return respostaJson({ results: {} });
    assert.fail(`Pedido não previsto: ${url.pathname}`);
  };
}

test("melhorias preservam filtros, grupos ignorados e configurações independentes por usuário", async (t) => {
  const configs = { "7": configPreservada(), "8": configPreservada({ silenciarGrupos: true, esconderArquivadas: true }) };
  const conexao = conexaoIsolada(t, gatewayDeConversas(), configs);
  await conexao.ligar("7"); await conexao.ligar("8");
  assert.deepEqual(conexao.configSalva("7"), configs["7"]);
  assert.deepEqual(conexao.configSalva("8"), configs["8"]);
  assert.equal(conexao.estado("7").conversas.find((c) => c.id === GRUPO_TESTE).nome, "Equipe 7");
  assert.equal(conexao.estado("8").conversas.find((c) => c.id === GRUPO_TESTE).nome, "Equipe 8");
  conexao.avancar(61_000);
  await conexao.atualizar("7"); await conexao.atualizar("8");
  assert.equal(conexao.chamadas.filter((c) => c.caminho === "/user/my/groups").length, 2);
  assert.equal(conexao.estado("7").conversas.find((c) => c.id === GRUPO_TESTE).nome, "Equipe 7");
  conexao.filtros({ lerAoAbrir: true }, "7");
  assert.equal(conexao.configSalva("7").lerAoAbrir, true);
  assert.deepEqual(conexao.configSalva("8"), configs["8"]);
});

test("lista mantém até 40 conversas individuais e 25 grupos, respeitando os filtros salvos", async (t) => {
  const lista = [...Array.from({ length: 45 }, (_, i) => ({ jid: `5511777${String(i).padStart(4, "0")}@s.whatsapp.net`, name: `Pessoa ${i}`, last_message_time: "2026-11-12T10:00:00Z" })), ...Array.from({ length: 30 }, (_, i) => ({ jid: `120363${i}@g.us`, name: `Grupo ${i}`, last_message_time: "2026-11-12T09:00:00Z" }))];
  const conexao = conexaoIsolada(t, gatewayDeConversas({ conversas: () => lista }), { "7": configPreservada() });
  await conexao.ligar();
  assert.equal(conexao.estado().conversas.filter((c) => !c.grupo).length, 40);
  assert.equal(conexao.estado().conversas.filter((c) => c.grupo).length, 25);
  assert.ok(conexao.chamadas.some((c) => c.caminho === "/chats" && c.consulta.includes("limit=80")));
  conexao.filtros({ esconderGrupos: true });
  assert.ok(conexao.estado().conversas.every((c) => !c.grupo));
});

test("confirmação dos horários pertence ao usuário certo e é cancelada ao desligar", async (t) => {
  let contar = 0;
  const mensagens = (id) => [{ id: `envio-${id}`, chat_jid: JID_TESTE, sender_jid: `551188888000${id}@s.whatsapp.net`, content: `Texto ${id}`, timestamp: "2026-11-12T10:00:00Z", is_from_me: true }];
  const conexao = conexaoIsolada(t, gatewayDeConversas({ mensagens: () => contar ? mensagens("7") : [], enviar: (id) => { contar++; return `envio-${id}`; } }), { "7": configPreservada(), "8": configPreservada() });
  await conexao.ligar("7"); await conexao.ligar("8");
  await conexao.enviar(JID_TESTE, "Texto 7", "7");
  assert.equal(conexao.temporizadores.size, 1);
  await conexao.dispararConfirmacoes();
  const enviada = conexao.estado("7").conversas.find((c) => c.id === JID_TESTE).mensagens.find((m) => m.id === "envio-7");
  assert.equal(enviada.data, "2026-11-12T10:00:00.000Z");
  assert.equal(enviada.local, false);
  assert.equal(conexao.estado("8").conversas.find((c) => c.id === JID_TESTE).mensagens.length, 0);
  await conexao.enviar(JID_TESTE, "Mais uma", "7");
  const antes = conexao.chamadas.length;
  conexao.desligar("7");
  assert.equal(conexao.temporizadores.size, 0);
  await conexao.dispararConfirmacoes();
  assert.equal(conexao.chamadas.length, antes);
});

test("limite interno de 30 envios é separado por conta", async (t) => {
  let numero = 0;
  const conexao = conexaoIsolada(t, gatewayDeConversas({ enviar: (id) => `m-${id}-${++numero}` }), { "7": configPreservada(), "8": configPreservada() });
  await conexao.ligar("7"); await conexao.ligar("8");
  for (let i = 0; i < 30; i++) await conexao.enviar(JID_TESTE, `Mensagem ${i}`, "7");
  await assert.rejects(() => conexao.enviar(JID_TESTE, "Excedeu", "7"), /resposta_muitas/);
  await conexao.enviar(JID_TESTE, "Outra conta", "8");
  assert.equal(numero, 31);
});

test("eventos extras do gateway são mantidos ao habilitar reações, leitura e presença", () => {
  const base = { WHATSAPP_WEBHOOK_EVENTS: "device.logged_out,message,message.edited" };
  const ambiente = gowa.ambienteDoGowa({ porta: 51234, acesso: "niko:x", urlDoWebhook: "http://127.0.0.1:1/w", segredoDoWebhook: "s" }, base);
  const eventos = ambiente.WHATSAPP_WEBHOOK_EVENTS.split(",");
  assert.ok(eventos.includes("device.logged_out"));
  assert.deepEqual(new Set(eventos), new Set(["device.logged_out", ...gowa.EVENTOS_WHATSAPP]));
  assert.equal(eventos.length, new Set(eventos).size);
  assert.equal(base.WHATSAPP_WEBHOOK_EVENTS, "device.logged_out,message,message.edited");
});

async function estadoFrontendIsolado(t) {
  const { useWhatsapp } = await vite.ssrLoadModule("/src/estado/whatsapp.ts");
  const { whatsappPonte } = await vite.ssrLoadModule("/src/ponte/whatsapp.ts");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const original = whatsappPonte.estado;
  const ignorarOriginal = whatsappPonte.ignorar;
  const authAntes = useAuth.getState();
  useAuth.setState({ usuario: { id: 7, perfil: "gerencia", nome: "Teste", email: "teste@example.invalid" }, token: "sessao-teste-7" });
  useWhatsapp.setState({ estado: null, pedidoEm: 0, falhou: false, erroCarregamento: null });
  t.after(() => { whatsappPonte.estado = original; whatsappPonte.ignorar = ignorarOriginal; useAuth.setState({ usuario: authAntes.usuario, token: authAntes.token }); });
  return { useWhatsapp, whatsappPonte, useAuth };
}

test("respostas concorrentes no mesmo milissegundo não substituem estado mais recente", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  t.mock.method(Date, "now", () => 1_800_000_000_000);
  const respostas = [];
  whatsappPonte.estado = () => new Promise((resolver) => respostas.push(resolver));
  const antiga = useWhatsapp.getState().carregar();
  const recente = useWhatsapp.getState().carregar();
  respostas[1]({ naoLidas: 2 }); await recente;
  respostas[0]({ naoLidas: 1 }); await antiga;
  assert.equal(useWhatsapp.getState().estado.naoLidas, 2);
});

test("atualização em tempo real prevalece sobre consulta iniciada antes dela", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  let concluir;
  whatsappPonte.estado = () => new Promise((resolver) => { concluir = resolver; });
  const pendente = useWhatsapp.getState().carregar();
  useWhatsapp.getState().definir({ naoLidas: 8 });
  concluir({ naoLidas: 1 }); await pendente;
  assert.equal(useWhatsapp.getState().estado.naoLidas, 8);
});

test("troca de conta limpa somente o estado transitório e descarta a resposta da sessão anterior", async (t) => {
  const { useWhatsapp, whatsappPonte, useAuth } = await estadoFrontendIsolado(t);
  let concluir;
  whatsappPonte.estado = () => new Promise((resolver) => { concluir = resolver; });
  useWhatsapp.getState().definir({ naoLidas: 5 });
  const pendente = useWhatsapp.getState().carregar();
  useAuth.setState({ usuario: { id: 8, perfil: "gerencia" }, token: "sessao-teste-8" });
  assert.equal(useWhatsapp.getState().estado, null);
  concluir({ naoLidas: 99 }); await pendente;
  assert.equal(useWhatsapp.getState().estado, null);
  assert.equal(useWhatsapp.getState().falhou, false);
});

test("envio confirmado atualiza a conversa sem apagar filtros ou outra conversa", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  const filtros = configPreservada();
  const outra = { id: "outra", mensagens: [] };
  const inicial = { id: JID_TESTE, mensagens: [] };
  useWhatsapp.getState().definir({ filtros, conversas: [inicial, outra], abertas: [inicial], naoLidas: 5 });
  let concluir;
  whatsappPonte.estado = () => new Promise((resolver) => { concluir = resolver; });
  const pendente = useWhatsapp.getState().carregar();
  const atualizada = { ...inicial, mensagens: [{ id: "enviada", texto: "Olá" }] };
  useWhatsapp.getState().atualizarConversa(atualizada);
  concluir({ filtros, conversas: [inicial], abertas: [inicial] }); await pendente;
  assert.equal(useWhatsapp.getState().estado.conversas[0], atualizada);
  assert.equal(useWhatsapp.getState().estado.abertas[0], atualizada);
  assert.equal(useWhatsapp.getState().estado.conversas[1], outra);
  assert.equal(useWhatsapp.getState().estado.filtros, filtros);
});

test("ignorar conversa atualiza os filtros somente na sessão que pediu", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  const estado = { filtros: { ...configPreservada(), ignoradas: [JID_TESTE] }, conversas: [] };
  whatsappPonte.ignorar = async (jid, ignorar) => { assert.equal(jid, JID_TESTE); assert.equal(ignorar, true); return estado; };
  assert.equal(await useWhatsapp.getState().ignorar(JID_TESTE), true);
  assert.equal(useWhatsapp.getState().estado, estado);
});

test("ignorar conversa não publica uma resposta antiga depois da troca de conta", async (t) => {
  const { useWhatsapp, whatsappPonte, useAuth } = await estadoFrontendIsolado(t);
  let concluir;
  whatsappPonte.ignorar = () => new Promise((r) => { concluir = r; });
  const pendente = useWhatsapp.getState().ignorar(JID_TESTE);
  useAuth.setState({ usuario: { id: 8, perfil: "gerencia" }, token: "sessao-teste-8" });
  const atual = { filtros: configPreservada(), conversas: [] };
  useWhatsapp.getState().definir(atual);
  concluir({ filtros: { ignoradas: [JID_TESTE] }, conversas: [] });
  assert.equal(await pendente, false);
  assert.equal(useWhatsapp.getState().estado, atual);
});

test("falha ao carregar WhatsApp conserva a causa recebida sem inventar configuração ausente", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  for (const [codigo, trecho] of [
    ["gateway_remoto_nao_configurado", /Configure KYRO_GATEWAY_URL/],
    ["gateway_nao_autorizado", /segredos diferentes/],
    ["gateway_remoto_indisponivel", /VPS não respondeu/],
    ["http_401", /sessão expirou/],
    ["http_504", /API está indisponível/],
  ]) {
    whatsappPonte.estado = async () => { throw new Error(codigo); };
    assert.equal(await useWhatsapp.getState().carregar(), null);
    assert.equal(useWhatsapp.getState().falhou, true);
    assert.match(useWhatsapp.getState().erroCarregamento, trecho);
    if (codigo !== "gateway_remoto_nao_configurado") assert.doesNotMatch(useWhatsapp.getState().erroCarregamento, /Configure KYRO_GATEWAY_URL/);
  }
  whatsappPonte.estado = async () => ({ naoLidas: 0 });
  await useWhatsapp.getState().carregar();
  assert.equal(useWhatsapp.getState().falhou, false);
  assert.equal(useWhatsapp.getState().erroCarregamento, null);
});

test("erro atrasado de uma consulta não apaga o WhatsApp recuperado em tempo real", async (t) => {
  const { useWhatsapp, whatsappPonte } = await estadoFrontendIsolado(t);
  let rejeitar;
  whatsappPonte.estado = () => new Promise((_, r) => { rejeitar = r; });
  const antiga = useWhatsapp.getState().carregar();
  useWhatsapp.getState().definir({ naoLidas: 4 });
  rejeitar(new Error("gateway_remoto_indisponivel"));
  await antiga;
  assert.equal(useWhatsapp.getState().estado.naoLidas, 4);
  assert.equal(useWhatsapp.getState().falhou, false);
  assert.equal(useWhatsapp.getState().erroCarregamento, null);
});

test("filtros da lista separam grupos e preservam a lista original", async () => {
  const { filtrarConversas, naoLidasDasConversas } = await vite.ssrLoadModule("/src/utilitarios/conversasWhatsapp.ts");
  const conversas = [{ id: "1", nome: "Juliana", grupo: false, naoLidas: 2 }, { id: "2", nome: "Família", grupo: true, naoLidas: 7 }, { id: "3", nome: "Marcos", grupo: false, naoLidas: 0 }];
  assert.deepEqual(filtrarConversas(conversas, "todas", "").map((c) => c.id), ["1", "3"]);
  assert.deepEqual(filtrarConversas(conversas, "grupos", "FAMÍ").map((c) => c.id), ["2"]);
  assert.deepEqual(filtrarConversas(conversas, "naoLidas", "").map((c) => c.id), ["1"]);
  assert.equal(naoLidasDasConversas(conversas), 2);
  assert.equal(conversas.length, 3);
});

test("extrator de zip tira o arquivo certo, com e sem compressão", () => {
  const conteudo = Buffer.from("binario do gateway ".repeat(200));
  for (const compactar of [false, true]) {
    const z = zipComArquivo("windows-amd64.exe", conteudo, compactar);
    assert.deepEqual(zip.nomesNoZip(z), ["windows-amd64.exe"]);
    assert.ok(zip.extrairDoZip(z, "windows-amd64.exe").equals(conteudo));
    assert.throws(() => zip.extrairDoZip(z, "outro"), /zip_sem_arquivo/);
  }
  assert.throws(() => zip.extrairDoZip(Buffer.from("nao e zip"), "x"), /zip_invalido/);
});

test("gateway do whatsapp escolhe o build certo e só baixa do github", () => {
  assert.deepEqual(gowa.alvoDaPlataforma("win32", "x64"), { so: "windows", arq: "amd64" });
  assert.deepEqual(gowa.alvoDaPlataforma("linux", "arm64"), { so: "linux", arq: "arm64" });
  assert.equal(gowa.alvoDaPlataforma("win32", "arm64"), null);
  assert.equal(gowa.alvoDaPlataforma("darwin", "x64"), null);
  const arquivos = [
    { nome: "whatsapp_9.6.0_windows_amd64.zip", url: "https://github.com/a", tamanho: 1, digest: `sha256:${"a".repeat(64)}` },
    { nome: "checksums.txt", url: "https://github.com/b", tamanho: 1 },
  ];
  const escolha = gowa.escolherArquivos(arquivos, "9.6.0", { so: "windows", arq: "amd64" });
  assert.equal(escolha.binario, "windows-amd64.exe");
  assert.equal(gowa.sha256Esperado(escolha.zip, `${"b".repeat(64)}  whatsapp_9.6.0_windows_amd64.zip\n`), "b".repeat(64));
  assert.equal(gowa.sha256Esperado(escolha.zip, null), "a".repeat(64));
  assert.equal(gowa.escolherArquivos(arquivos, "9.6.0", { so: "linux", arq: "amd64" }), null);
  assert.ok(gowa.hostDoGithub("https://objects.githubusercontent.com/x"));
  assert.ok(!gowa.hostDoGithub("https://github.com.evil.com/x"));
  const ambiente = gowa.ambienteDoGowa({ porta: 51234, acesso: "niko:x", urlDoWebhook: "http://127.0.0.1:1/w", segredoDoWebhook: "s" }, {});
  assert.equal(ambiente.APP_HOST, "127.0.0.1");
  assert.equal(ambiente.APP_UI_ENABLED, "false");
  assert.equal(ambiente.WHATSAPP_AUTO_DOWNLOAD_MEDIA, "false");
  assert.equal(ambiente.WHATSAPP_WEBHOOK_EVENTS, "message,message.revoked,message.edited,message.reaction,message.ack,chat_presence");
});

test("caixa do whatsapp silencia grupos sem menção, ignora conversas e limita envios", () => {
  const c = new caixa.CaixaWhatsapp();
  const filtros = { silenciarGrupos: true, ignoradas: ["5511999990000@s.whatsapp.net"] };
  const m = (id, conversa, extra = {}) => ({ id, conversa, remetente: conversa, nomeRemetente: "Ana", texto: "oi", midia: "nenhuma", data: new Date(Date.now() + Number(id.slice(1)) * 1000).toISOString(), minha: false, mencionaMe: false, ...extra });
  assert.equal(c.adicionar(m("m1", "5511888880000@c.us"), filtros), "avisar");
  assert.equal(c.adicionar(m("m1", "5511888880000@c.us"), filtros), "repetida");
  assert.equal(c.adicionar(m("m2", "5511999990000:3@s.whatsapp.net"), filtros), "ignorada");
  assert.equal(c.adicionar(m("m3", "1203@g.us"), filtros), "silenciosa");
  assert.equal(c.adicionar(m("m4", "1203@g.us", { mencionaMe: true }), filtros), "avisar");
  assert.equal(c.adicionar(m("m5", "5511888880000@s.whatsapp.net", { minha: true }), filtros), "silenciosa");
  const pessoa = c.conversas.get("5511888880000@s.whatsapp.net");
  assert.equal(pessoa.nome, "Ana");
  assert.equal(pessoa.naoLidas, 0);
  assert.equal(c.naoLidasVisiveis(filtros), 2);
  c.registrarConversa("5511777770000@s.whatsapp.net", "Arquivo", new Date().toISOString(), filtros, true);
  assert.ok(!c.visiveis(filtros).some((x) => x.id === "5511777770000@s.whatsapp.net"));
  assert.ok(c.visiveis({ ...filtros, esconderArquivadas: false }).some((x) => x.id === "5511777770000@s.whatsapp.net"));
  assert.equal(c.adicionar(m("m6", "5511777770000@s.whatsapp.net"), filtros), "silenciosa");
  assert.ok(c.visiveis(filtros).some((x) => x.grupo));
  assert.ok(!c.visiveis({ ...filtros, esconderGrupos: true }).some((x) => x.grupo));
  assert.equal(c.adicionar(m("m7", "1203@g.us", { mencionaMe: true }), { ...filtros, esconderGrupos: true }), "silenciosa");
  assert.equal(caixa.recusaDaResposta("  ", "5511888880000@s.whatsapp.net", c), "vazia");
  assert.equal(caixa.recusaDaResposta("ok", "5500000000000@s.whatsapp.net", c), "sem_conversa");
  assert.equal(caixa.recusaDaResposta("ok", "5511888880000@c.us", c), null);
  const limite = new caixa.LimiteDeEnvios(2, 60_000);
  assert.ok(limite.permitir(0) && limite.permitir(1));
  assert.ok(!limite.permitir(2));
  assert.ok(limite.permitir(70_000));
  assert.equal(caixa.iniciais("Maria Clara"), "MC");
  assert.equal(caixa.iniciais("+55 11"), "#");
});

test("webhook do whatsapp só aceita a assinatura certa e lê a mensagem", () => {
  const corpo = Buffer.from(JSON.stringify({ event: "message", device_id: "5511777770000@s.whatsapp.net", payload: { id: "ABC", chat_id: "1203@g.us", from: "5511888880000@s.whatsapp.net", from_name: "Bia", body: "@5511777770000 olha", timestamp: "2026-10-22T10:00:00Z", is_from_me: false, image: {} } }));
  const assinatura = `sha256=${createHmac("sha256", "segredo").update(corpo).digest("hex")}`;
  assert.ok(caixa.webhookAutentico(corpo, assinatura, "segredo"));
  assert.ok(!caixa.webhookAutentico(corpo, assinatura, "outro"));
  assert.ok(!caixa.webhookAutentico(corpo, undefined, "segredo"));
  const msg = caixa.mensagemDoWebhook(JSON.parse(corpo.toString()));
  assert.equal(msg.midia, "imagem");
  assert.equal(msg.mencionaMe, true);
  assert.equal(msg.nomeRemetente, "Bia");
  assert.equal(caixa.mensagemDoWebhook({ event: "message.ack", payload: {} }), null);
  assert.deepEqual(caixa.dispositivoDoGateway({ results: [{ id: "niko", state: "logged_in", jid: "551@s.whatsapp.net" }] }), { id: "niko", vinculo: "conectado", eu: "551@s.whatsapp.net" });
  assert.equal(caixa.dispositivoDoGateway({ results: [{ id: "niko", state: "disconnected" }] }).vinculo, "precisa_qr");
  assert.deepEqual(caixa.caminhoDoQr({ results: { qr_link: "http://localhost:3000/statics/qrcode/x.png", qr_duration: 30 } }), { caminho: "/statics/qrcode/x.png", segundos: 30 });
});

