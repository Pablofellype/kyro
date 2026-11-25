import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Unzip, UnzipInflate, zipSync, strToU8, strFromU8 } from "fflate";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { create } from "zustand";

const estabilizar = () => new Promise((r) => setImmediate(r));

function armazenamentoIsolado(nativo = false, sessao = null, memoria = new Map(), desenvolvimento = false) {
  const timers = new Map();
  let proximo = 0;
  const janela = Object.assign(new EventTarget(), {
    location: { search: "" },
    setTimeout: (fn) => { const id = ++proximo; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn) => { const id = ++proximo; timers.set(id, fn); return id; },
    clearInterval: (id) => timers.delete(id),
  });
  if (nativo) janela.__TAURI_INTERNALS__ = {};
  if (sessao) {
    memoria.set("kyro_token", "t".repeat(32));
    memoria.set("kyro_usuario", JSON.stringify({ id: sessao.id ?? 1 }));
    if (sessao.fila) memoria.set(`niko:sincronia-pendente:${sessao.id ?? 1}`, JSON.stringify(sessao.fila));
  }
  const ouvintes = new Map();
  const comandos = [];
  const eventos = { listen: async (nome, fn) => { ouvintes.set(nome, fn); return () => ouvintes.delete(nome); } };
  const contexto = vm.createContext({
    window: janela, document: Object.assign(new EventTarget(), { body: { inert: false } }), URLSearchParams, AbortController, AbortSignal, CustomEvent, TextEncoder,
    eventos, nativo: { invoke: async (nome, dados) => { comandos.push({ nome, dados }); } }, urlApi: (caminho) => caminho,
    BroadcastChannel: undefined, createJSONStorage: (fn) => fn(), objeto: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    localStorage: new Proxy({ getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) }, {
      ownKeys: () => [...memoria.keys()],
      getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    }),
    fetch: async () => ({ ok: true, json: async () => ({ dados: {} }) }),
  });
  const codigo = stripTypeScriptTypes(readFileSync("src/ponte/armazenamento.ts", "utf8")).replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "")
    .replace("import.meta.env.DEV", String(desenvolvimento))
    .replaceAll('await import("@tauri-apps/api/event")', "globalThis.eventos").replaceAll('await import("@tauri-apps/api/core")', "globalThis.nativo");
  vm.runInContext(`${codigo}\nglobalThis.api = { iniciarArmazenamento, salvarAgora, gravarChave, lerChave, zerarTudo, aoPrepararSaida, aoMudarDeFora };`, contexto);
  return { api: contexto.api, contexto, janela, timers, ouvintes, comandos, eventos, memoria };
}

test("desenvolvimento autenticado grava em banco local isolado sem consumir a fila remota", async () => {
  const fila = { versao: "0", itens: { "niko:financas": "versao-de-producao" } };
  const a = armazenamentoIsolado(false, { id: 7, fila }, new Map(), true);
  const chamadas = [];
  a.contexto.fetch = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return { ok: true, json: async () => ({ dados: {} }) };
  };
  await a.api.iniciarArmazenamento();
  a.api.gravarChave("niko:financas", "versao-de-teste");
  await a.api.salvarAgora();
  assert.deepEqual(chamadas.map(({ url }) => url), ["/ponte/dados", "/ponte/dados"]);
  for (const { opcoes } of chamadas) {
    assert.equal(opcoes.headers["x-niko-banco"], "desenvolvimento");
    assert.equal(opcoes.headers.Authorization, undefined);
  }
  assert.deepEqual(JSON.parse(chamadas[1].opcoes.body).itens, { "niko:financas": "versao-de-teste" });
  assert.deepEqual(JSON.parse(a.memoria.get("niko:sincronia-pendente:7")), fila);
});

test("WhatsApp em tempo real descarta eventos da conta que já saiu", async () => {
  const a = armazenamentoIsolado(false, { id: 7 });
  const sockets = [];
  const recebidos = [];
  a.contexto.endpointTempoReal = () => "ws://127.0.0.1/teste";
  a.contexto.useWhatsapp = { getState: () => ({ definir: (e) => recebidos.push(e) }) };
  a.contexto.WebSocket = class extends EventTarget {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 1;
    constructor() { super(); sockets.push(this); }
    send() {}
  };
  await a.api.iniciarArmazenamento();
  assert.equal(sockets.length, 1);
  const publicar = (id) => sockets[0].dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ tipo: "whatsapp", estado: { dono: id } }) }));
  publicar(7);
  assert.equal(recebidos.length, 1);
  a.memoria.set("kyro_token", "sessao-da-conta-8");
  publicar(7);
  assert.equal(recebidos.length, 1);
  a.memoria.delete("kyro_token");
  publicar(7);
  assert.equal(recebidos.length, 1);
});

test("saída nativa aguarda a ação pendente antes de travar escrita e confirmar gravação", async () => {
  const a = armazenamentoIsolado(true);
  await a.api.iniciarArmazenamento();
  let concluir;
  a.api.aoPrepararSaida(() => new Promise((r) => { concluir = r; }));
  const gravados = [];
  a.contexto.fetch = async (_url, opcoes) => { gravados.push(JSON.parse(opcoes.body)); return { ok: true }; };
  const saindo = a.ouvintes.get("niko://saindo")({ payload: { tentativa: 4 } });
  assert.equal(a.contexto.document.body.inert, true);
  assert.equal(a.comandos.filter((c) => c.nome === "confirmar_salvamento").length, 0);
  a.api.gravarChave("niko:resultado", "ação concluída");
  concluir();
  await saindo;
  assert.equal(gravados[0].itens["niko:resultado"], "ação concluída");
  assert.equal(a.comandos.at(-1).dados.sucesso, true);
  assert.equal(a.comandos.at(-1).dados.tentativa, 4);
  a.api.gravarChave("niko:resultado", "não deve sobrescrever");
  assert.equal(a.api.lerChave("niko:resultado"), "ação concluída");
});

test("saída cancelada libera a interface e não volta a bloquear por resposta atrasada", async () => {
  const a = armazenamentoIsolado(true);
  await a.api.iniciarArmazenamento();
  let concluir;
  a.api.aoPrepararSaida(() => new Promise((r) => { concluir = r; }));
  const saindo = a.ouvintes.get("niko://saindo")({ payload: { tentativa: 5 } });
  a.ouvintes.get("niko://salvar-falhou")();
  concluir();
  await saindo;
  assert.equal(a.contexto.document.body.inert, false);
  a.api.gravarChave("niko:novo", "permitido");
  assert.equal(a.api.lerChave("niko:novo"), "permitido");
  assert.equal(a.comandos.filter((c) => c.nome === "confirmar_salvamento").length, 0);
});

test("falha parcial nos ouvintes nativos desfaz inscrições antes de repetir inicialização", async () => {
  const a = armazenamentoIsolado(true);
  const original = a.eventos.listen;
  a.eventos.listen = async (nome, fn) => {
    if (nome === "niko://saindo") throw new Error("falha parcial");
    return original(nome, fn);
  };
  assert.equal(await a.api.iniciarArmazenamento(), "local");
  assert.equal(a.ouvintes.size, 0);
  a.eventos.listen = original;
  assert.equal(await a.api.iniciarArmazenamento(), "banco");
  assert.equal(a.ouvintes.size, 3);
  await a.api.iniciarArmazenamento();
  assert.equal(a.ouvintes.size, 3);
});

test("valor antigo da ponte não desfaz a mudança que acabou de chegar de outra janela", async () => {
  const a = armazenamentoIsolado(true);
  await a.api.iniciarArmazenamento();
  a.ouvintes.get("niko-dados")({ payload: { origem: "janela-principal", banco: "", chave: "niko:configuracoes", valor: "ligado" } });
  assert.equal(a.api.lerChave("niko:configuracoes"), "ligado");
  a.contexto.fetch = async () => ({ ok: true, json: async () => ({ dados: { "niko:configuracoes": "desligado", "niko:outra": "da ponte" } }) });
  a.janela.dispatchEvent(new Event("focus"));
  await estabilizar();
  await estabilizar();
  assert.equal(a.api.lerChave("niko:configuracoes"), "ligado");
  assert.equal(a.api.lerChave("niko:outra"), "da ponte");
});

test("salvar rejeita a falha e mantém alterações para uma tentativa posterior", async () => {
  const a = armazenamentoIsolado();
  await a.api.iniciarArmazenamento();
  a.api.gravarChave("niko:teste", "novo");
  a.contexto.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(a.api.salvarAgora());
  assert.equal(a.api.lerChave("niko:teste"), "novo");
  let recebido;
  a.contexto.fetch = async (_url, opcoes) => { recebido = JSON.parse(opcoes.body); return { ok: true }; };
  await a.api.salvarAgora();
  assert.equal(recebido.itens["niko:teste"], "novo");
});

test("fila persistida é reenviada depois de reabrir o armazenamento remoto", async () => {
  const a = armazenamentoIsolado(false, { fila: { versao: "0", itens: { "niko:pendente": "retentar" } } });
  const chamadas = [];
  a.contexto.fetch = async (url, opcoes = {}) => {
    chamadas.push({ url, metodo: opcoes.method ?? "GET", corpo: opcoes.body ? JSON.parse(opcoes.body) : null });
    return { ok: true, json: async () => ({ dados: {}, versao: "0" }) };
  };
  await a.api.iniciarArmazenamento();
  for (const fn of [...a.timers.values()]) fn();
  await estabilizar();
  await estabilizar();
  assert.ok(chamadas.some((chamada) => chamada.metodo === "POST" && chamada.corpo.itens["niko:pendente"] === "retentar"));
});

const visualPessoal = JSON.stringify({ version: 10, state: {
  tema: "escuro", paleta: "grafite", escala: 1.1,
  ilha: { ativa: true, tamanho: "pequena", opacidade: 0.35, fundo: "#101820", modo: "fixo" },
  dock: { ativo: true, escala: 0.8, opacidade: 0.45, mostrarBusca: false },
} });

test("visual nativo sobrevive ao fechamento antes do envio e volta no próximo login", async () => {
  const memoria = new Map();
  const primeira = armazenamentoIsolado(true, { id: 7 }, memoria);
  await primeira.api.iniciarArmazenamento();
  primeira.api.gravarChave("niko:configuracoes", visualPessoal);
  assert.equal(memoria.get("kyro:usuario:7:niko:configuracoes"), visualPessoal);
  assert.equal(memoria.has("niko:configuracoes"), false);

  const segunda = armazenamentoIsolado(true, { id: 7 }, memoria);
  const gravados = [];
  segunda.contexto.fetch = async (_url, opcoes = {}) => {
    if (opcoes.method === "POST") gravados.push(JSON.parse(opcoes.body).itens);
    return { ok: true, json: async () => ({ dados: {}, versao: "1" }) };
  };
  assert.equal(await segunda.api.iniciarArmazenamento(), "banco");
  assert.equal(segunda.api.lerChave("niko:configuracoes"), visualPessoal);
  assert.equal(gravados[0]["niko:configuracoes"], visualPessoal);
  assert.ok(gravados.every((itens) => Object.keys(itens).every((k) => /^niko:[a-z0-9_-]{1,60}$/.test(k))));
});

test("sem rede, preferências locais ficam separadas por conta e voltam para a fila", async () => {
  const memoria = new Map([["niko:configuracoes", "visual antigo do dono"]]);
  const gerencia = armazenamentoIsolado(false, { id: 7 }, memoria);
  gerencia.contexto.fetch = async () => { throw new Error("offline"); };
  assert.equal(await gerencia.api.iniciarArmazenamento(), "local");
  assert.equal(gerencia.api.lerChave("niko:configuracoes"), null);
  gerencia.api.gravarChave("niko:configuracoes", visualPessoal);
  assert.equal(JSON.parse(memoria.get("niko:sincronia-pendente:7")).itens["niko:configuracoes"], visualPessoal);

  const outra = armazenamentoIsolado(false, { id: 8 }, memoria);
  outra.contexto.fetch = gerencia.contexto.fetch;
  await outra.api.iniciarArmazenamento();
  assert.equal(outra.api.lerChave("niko:configuracoes"), null);

  const retorno = armazenamentoIsolado(false, { id: 7 }, memoria);
  retorno.contexto.fetch = gerencia.contexto.fetch;
  await retorno.api.iniciarArmazenamento();
  assert.equal(retorno.api.lerChave("niko:configuracoes"), visualPessoal);
});

test("janela ignora configurações de outra conta e para de gravar depois da troca de sessão", async () => {
  const a = armazenamentoIsolado(true, { id: 7 });
  await a.api.iniciarArmazenamento();
  const mudou = [];
  a.api.aoMudarDeFora((chave) => mudou.push(chave));
  const receber = (usuarioId, valor) => a.ouvintes.get("niko-dados")({ payload: { origem: "outra-janela", banco: "", usuarioId, chave: "niko:configuracoes", valor } });
  receber("8", "de outra conta");
  assert.equal(a.api.lerChave("niko:configuracoes"), null);
  receber("7", visualPessoal);
  assert.equal(a.api.lerChave("niko:configuracoes"), visualPessoal);
  assert.equal(mudou.length, 1);

  a.memoria.set("kyro_token", "outro-token");
  a.memoria.set("kyro_usuario", JSON.stringify({ id: 8 }));
  a.api.gravarChave("niko:configuracoes", "valor da loja antiga");
  receber("8", "resposta atrasada");
  assert.equal(a.api.lerChave("niko:configuracoes"), null);
  assert.equal(a.memoria.has("kyro:usuario:8:niko:configuracoes"), false);
  assert.equal(a.memoria.get("kyro:usuario:7:niko:configuracoes"), visualPessoal);
});

test("resposta remota iniciada na conta anterior não substitui o visual da sessão nova", async () => {
  const a = armazenamentoIsolado(true, { id: 7 });
  await a.api.iniciarArmazenamento();
  let responder;
  a.contexto.fetch = () => new Promise((r) => { responder = r; });
  a.janela.dispatchEvent(new Event("focus"));
  a.memoria.set("kyro_token", "outro-token");
  a.memoria.set("kyro_usuario", JSON.stringify({ id: 8 }));
  responder({ ok: true, json: async () => ({ dados: { "niko:configuracoes": "atrasado" } }) });
  await estabilizar();
  assert.equal(a.memoria.has("kyro:usuario:8:niko:configuracoes"), false);
});

test("salvar agora inclui preferências pendentes nas outras janelas da mesma conta", async () => {
  const memoria = new Map();
  const principal = armazenamentoIsolado(true, { id: 7 }, memoria);
  const ilha = armazenamentoIsolado(true, { id: 7 }, memoria);
  await principal.api.iniciarArmazenamento();
  await ilha.api.iniciarArmazenamento();
  ilha.api.gravarChave("niko:configuracoes", visualPessoal);
  principal.api.gravarChave("niko:rotina", "tarefas da conta");
  let enviado;
  principal.contexto.fetch = async (_url, opcoes) => { enviado = JSON.parse(opcoes.body).itens; return { ok: true }; };
  await principal.api.salvarAgora();
  assert.equal(enviado["niko:configuracoes"], visualPessoal);
  assert.equal(enviado["niko:rotina"], "tarefas da conta");
  assert.equal(memoria.has("niko:sincronia-pendente:7"), false);
});

test("confirmação de visual antigo não remove o ajuste mais recente de outra janela", async () => {
  const memoria = new Map();
  const principal = armazenamentoIsolado(true, { id: 7 }, memoria);
  const ilha = armazenamentoIsolado(true, { id: 7 }, memoria);
  await principal.api.iniciarArmazenamento();
  await ilha.api.iniciarArmazenamento();
  principal.api.gravarChave("niko:configuracoes", "antigo");
  let confirmar;
  principal.contexto.fetch = () => new Promise((r) => { confirmar = r; });
  const envio = principal.api.salvarAgora();
  ilha.api.gravarChave("niko:configuracoes", visualPessoal);
  confirmar({ ok: true, json: async () => ({ versao: "2" }) });
  await envio;
  assert.equal(JSON.parse(memoria.get("niko:sincronia-pendente:7")).itens["niko:configuracoes"], visualPessoal);
});

function autenticacaoIsolada(sessao = null) {
  const memoria = new Map();
  const chamadas = [];
  const ouvintes = new Map();
  if (sessao) {
    memoria.set("kyro_token", "token-anterior");
    memoria.set("kyro_usuario", JSON.stringify(sessao));
  }
  const contexto = vm.createContext({
    create, AbortSignal,
    window: { __TAURI_INTERNALS__: {}, location: { reload: () => chamadas.push("recarregar") } },
    localStorage: { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) },
    listen: async (nome, fn) => { ouvintes.set(nome, fn); },
    emit: async () => { chamadas.push("publicar"); },
    salvarAgora: async () => { assert.equal(memoria.get("kyro_token"), "token-anterior"); chamadas.push("salvar"); },
    fetch: async () => { chamadas.push("revogar"); return { ok: true }; },
    mensagemDeErroApi: () => "erro",
  });
  const codigo = stripTypeScriptTypes(readFileSync("src/estado/autenticacao.ts", "utf8"))
    .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "")
    .replaceAll("import.meta.env", "({})")
    .replace('await import("../ponte/armazenamento")', "({ salvarAgora: globalThis.salvarAgora })");
  vm.runInContext(`${codigo}\nglobalThis.api = useAuth;`, contexto);
  if (sessao) contexto.api.setState({ usuario: sessao });
  return { auth: contexto.api, contexto, memoria, chamadas, ouvintes };
}

test("login recebido pela ilha recarrega o armazenamento antes de exibir a conta", () => {
  const a = autenticacaoIsolada();
  a.ouvintes.get("niko://autenticacao")({ payload: { usuario: { id: 7, perfil: "gerencia" }, token: "novo-token" } });
  assert.deepEqual(a.chamadas, ["recarregar"]);
  assert.equal(a.auth.getState().usuario, null);
  assert.equal(JSON.parse(a.memoria.get("kyro_usuario")).id, 7);
});

test("logout salva preferências com a sessão válida antes de revogar e recarregar", async () => {
  const a = autenticacaoIsolada({ id: 7, perfil: "gerencia" });
  await a.auth.getState().logout();
  assert.deepEqual(a.chamadas, ["salvar", "revogar", "publicar", "recarregar"]);
  assert.equal(a.memoria.has("kyro_token"), false);
});

test("evento da mesma sessão mantém as lojas carregadas", () => {
  const a = autenticacaoIsolada({ id: 7, perfil: "gerencia" });
  a.ouvintes.get("niko://autenticacao")({ payload: { usuario: { id: 7, perfil: "gerencia", nome: "Nome atualizado" }, token: "token-anterior" } });
  assert.equal(a.chamadas.length, 0);
  assert.equal(a.auth.getState().usuario.nome, "Nome atualizado");
});

function moduloIsolado(caminho, globais, nomes) {
  const codigo = stripTypeScriptTypes(readFileSync(caminho, "utf8")).replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
  const contexto = vm.createContext(globais);
  vm.runInContext(`${codigo}\nglobalThis.api = { ${nomes.join(", ")} };`, contexto);
  return contexto.api;
}

const office = moduloIsolado("src/utilitarios/officeLimitado.ts", { Unzip, UnzipInflate }, ["descompactarOffice"]);

test("Office extrai somente o XML necessário para cada formato", () => {
  for (const [ext, nome] of [["docx", "word/document.xml"], ["pptx", "ppt/slides/slide1.xml"], ["xlsx", "xl/worksheets/sheet1.xml"], ["odt", "content.xml"]]) {
    const zip = zipSync({ [nome]: strToU8("<texto>Olá</texto>"), "assets/ignorado.xml": strToU8("ignorado"), "assets/imagem.bin": new Uint8Array(100000) });
    const partes = office.descompactarOffice(zip, ext);
    assert.deepEqual(Object.keys(partes), [nome]);
    assert.equal(strFromU8(partes[nome]), "<texto>Olá</texto>");
  }
});

test("Office recusa XML expandido acima do limite mesmo com metadados falsos", () => {
  const zip = zipSync({ "word/document.xml": new Uint8Array(5 * 1024 * 1024) });
  assert.throws(() => office.descompactarOffice(zip, "docx"), /office_grande/);
  const adulterado = zip.slice();
  new DataView(adulterado.buffer).setUint32(22, 1, true);
  assert.throws(() => office.descompactarOffice(adulterado, "docx"), /office_grande/);
});

test("Office limita a quantidade de entradas e o total expandido", () => {
  const muitas = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`assets/${i}`, new Uint8Array()]));
  assert.throws(() => office.descompactarOffice(zipSync(muitas), "docx"), /office_grande/);
  const grandes = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`ppt/slides/slide${i + 1}.xml`, new Uint8Array(4 * 1024 * 1024)]));
  assert.throws(() => office.descompactarOffice(zipSync(grandes), "pptx"), /office_grande/);
});

test("Office recusa arquivo comprimido muito grande antes de descompactar", () => {
  assert.throws(() => office.descompactarOffice(new Uint8Array(32 * 1024 * 1024 + 1), "docx"), /arquivo_grande/);
});

function bancoIsolado(pasta) {
  return moduloIsolado("servidor/banco.ts", { ...fs, DatabaseSync, join, pastaDados: () => pasta, process }, ["lerTudo", "gravar", "reservarConfirmacao", "backupManual", "zerarBanco", "fecharBanco"]);
}

test("confirmações persistentes impedem repetição entre conexões e reinícios", () => {
  const pasta = fs.mkdtempSync(join(tmpdir(), "niko-banco-teste-"));
  const a = bancoIsolado(pasta), b = bancoIsolado(pasta);
  try {
    assert.equal(a.reservarConfirmacao("conversa:mensagem:0", true).reservada, true);
    assert.equal(b.reservarConfirmacao("conversa:mensagem:0", false).reservada, false);
    assert.equal(b.reservarConfirmacao("conversa:mensagem:0", false).situacao, "confirmado");
    a.fecharBanco();
    assert.equal(a.reservarConfirmacao("conversa:mensagem:0", true).reservada, false);
    assert.equal(a.reservarConfirmacao("conversa:mensagem:0", true, "teste").reservada, true);
    assert.throws(() => a.reservarConfirmacao("../../fora", true), /confirmacao_invalida/);
  } finally { a.fecharBanco(); b.fecharBanco(); fs.rmSync(pasta, { recursive: true, force: true }); }
});

test("migração preserva dados do WAL no backup anterior e cria o esquema novo", () => {
  const pasta = fs.mkdtempSync(join(tmpdir(), "niko-migracao-teste-"));
  const antigo = new DatabaseSync(join(pasta, "niko.db"));
  antigo.exec("PRAGMA journal_mode=WAL; CREATE TABLE meta(chave TEXT PRIMARY KEY, valor TEXT NOT NULL); INSERT INTO meta VALUES('versao', '1'); CREATE TABLE dados(chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado INTEGER NOT NULL); INSERT INTO dados VALUES('niko:teste', 'preservado', 1);");
  const a = bancoIsolado(pasta);
  try {
    assert.equal(a.lerTudo()["niko:teste"], "preservado");
    assert.equal(a.reservarConfirmacao("nova", true).reservada, true);
    const arquivos = fs.readdirSync(join(pasta, "backups"));
    assert.equal(arquivos.length, 1);
    const backup = new DatabaseSync(join(pasta, "backups", arquivos[0]), { readOnly: true });
    try {
      assert.equal(backup.prepare("SELECT valor FROM dados WHERE chave='niko:teste'").get().valor, "preservado");
      assert.equal(backup.prepare("SELECT valor FROM meta WHERE chave='versao'").get().valor, "1");
    } finally { backup.close(); }
  } finally { a.fecharBanco(); antigo.close(); fs.rmSync(pasta, { recursive: true, force: true }); }
});

test("backup diário e manual respeitam o banco selecionado", () => {
  const pasta = fs.mkdtempSync(join(tmpdir(), "niko-backup-teste-"));
  const a = bancoIsolado(pasta);
  try {
    a.gravar({ "niko:teste": "primeiro" }, "qa");
    const quantidade = fs.readdirSync(join(pasta, "backups")).length;
    a.gravar({ "niko:teste": "segundo" }, "qa");
    assert.equal(fs.readdirSync(join(pasta, "backups")).length, quantidade);
    a.backupManual("qa");
    assert.ok(fs.readdirSync(join(pasta, "backups")).every((nome) => nome.startsWith("niko-qa--")));
    assert.equal(a.lerTudo("qa")["niko:teste"], "segundo");
  } finally { a.fecharBanco(); fs.rmSync(pasta, { recursive: true, force: true }); }
});

test("script temporário é revalidado e reparado depois de adulteração", () => {
  const pasta = fs.mkdtempSync(join(tmpdir(), "niko-script-teste-"));
  const a = moduloIsolado("servidor/plataforma/windows/scriptsTemporarios.ts", { ...fs, createHash, randomBytes, join, tmpdir: () => pasta, process }, ["garantirScript"]);
  try {
    const caminho = a.garantirScript("niko-teste", "conteudo esperado");
    fs.writeFileSync(caminho, "adulterado");
    assert.equal(a.garantirScript("niko-teste", "conteudo esperado"), caminho);
    assert.equal(fs.readFileSync(caminho, "utf8"), "conteudo esperado");
    assert.throws(() => a.garantirScript("../../fora", "nada"), /script_invalido/);
    fs.unlinkSync(caminho);
    fs.mkdirSync(caminho);
    assert.throws(() => a.garantirScript("niko-teste", "conteudo esperado"), /script_invalido/);
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
});

test("CSP do HTML deriva da política nativa com permissões para PDF, mídia e workers", async () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  const politica = config.app.security.csp;
  for (const trecho of ["worker-src 'self' blob:", "'wasm-unsafe-eval'", "object-src 'none'", "media-src 'self' data: blob:", "frame-src 'self' blob:"]) assert.ok(politica.includes(trecho), trecho);
  const vite = readFileSync("vite.config.ts", "utf8");
  assert.match(vite, /JSON\.parse\(readFileSync\(new URL\("\.\/src-tauri\/tauri\.conf\.json"/);
  assert.doesNotMatch(politica, /'unsafe-eval'/);
  const { APLICATIVOS_EMPRESA } = await import("../src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const origens = [...new Set(APLICATIVOS_EMPRESA.filter((app) => app.status === "disponivel" && app.url).map((app) => new URL(app.url).origin))];
  const fontes = politica.split(";").find((diretiva) => diretiva.trim().startsWith("frame-src ")).trim().split(/\s+/).slice(1);
  assert.deepEqual(fontes.sort(), ["'self'", "blob:", ...origens, "https://app.powerbi.com"].sort(), "Somente as origens dos sistemas aprovados e do Power BI devem ser liberadas");
});

test("consulta de credenciais nativas tem prazo e não instala ponte sem token válido", async () => {
  const timers = new Map();
  let proximo = 0;
  const janela = {
    __TAURI_INTERNALS__: { metadata: { currentWindow: { label: "sistema" } } },
    location: { hostname: "tauri.localhost" },
    fetch: async () => ({ ok: true }),
    setTimeout: (fn) => { const id = ++proximo; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const contexto = vm.createContext({ window: janela, Headers, document: { querySelector: () => null }, nativo: { invoke: () => new Promise(() => {}) } });
  const codigo = stripTypeScriptTypes(readFileSync("src/desktop/desktop.ts", "utf8")).replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "").replaceAll('await import("@tauri-apps/api/core")', "globalThis.nativo");
  vm.runInContext(`${codigo}\nglobalThis.api = { prepararPonte };`, contexto);
  const original = janela.fetch;
  const pendente = contexto.api.prepararPonte();
  const rejeitou = assert.rejects(pendente, /ponte_indisponivel/);
  await estabilizar();
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  await rejeitou;
  assert.equal(timers.size, 0);
  assert.equal(janela.fetch, original);
  contexto.nativo.invoke = async (nome) => nome === "porta_ponte" ? 47831 : null;
  await assert.rejects(contexto.api.prepararPonte(), /ponte_indisponivel/);
  assert.equal(janela.fetch, original);
});

test("visibilidade do documento atualiza o snapshot e remove seu ouvinte", () => {
  const documento = Object.assign(new EventTarget(), { hidden: false });
  let parar;
  let mudou = 0;
  const api = moduloIsolado("src/personagens/visibilidade.ts", {
    document: documento,
    useSyncExternalStore: (ouvir, ler) => { parar = ouvir(() => { mudou++; }); return ler(); },
  }, ["usarVisibilidadeDocumento"]);
  assert.equal(api.usarVisibilidadeDocumento(), true);
  documento.hidden = true;
  documento.dispatchEvent(new Event("visibilitychange"));
  assert.equal(mudou, 1);
  parar();
  documento.dispatchEvent(new Event("visibilitychange"));
  assert.equal(mudou, 1);
  assert.equal(api.usarVisibilidadeDocumento(), false);
  parar();
});

test("flush concorrente espera e envia alterações novas na ordem", async () => {
  const a = armazenamentoIsolado();
  await a.api.iniciarArmazenamento();
  const pedidos = [];
  a.contexto.fetch = (_url, opcoes) => new Promise((r) => pedidos.push({ dados: JSON.parse(opcoes.body), resolver: r }));
  a.api.gravarChave("niko:teste", "primeiro");
  const primeiro = a.api.salvarAgora();
  await estabilizar();
  a.api.gravarChave("niko:teste", "segundo");
  let terminou = false;
  const segundo = a.api.salvarAgora().then(() => { terminou = true; });
  await estabilizar();
  assert.equal(terminou, false);
  assert.equal(pedidos.length, 1);
  pedidos[0].resolver({ ok: true });
  await estabilizar();
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.itens["niko:teste"], "segundo");
  pedidos[1].resolver({ ok: true });
  await Promise.all([primeiro, segundo]);
});

test("reset com erro de transporte preserva pendências e libera novas escritas", async () => {
  const a = armazenamentoIsolado();
  await a.api.iniciarArmazenamento();
  a.api.gravarChave("niko:antes", "preservado");
  a.contexto.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(a.api.zerarTudo(false));
  a.api.gravarChave("niko:depois", "novo");
  assert.equal(a.api.lerChave("niko:depois"), "novo");
  let dados;
  a.contexto.fetch = async (_url, opcoes) => { dados = JSON.parse(opcoes.body); return { ok: true }; };
  await a.api.salvarAgora();
  assert.equal(dados.itens["niko:antes"], "preservado");
  assert.equal(dados.itens["niko:depois"], "novo");
});
