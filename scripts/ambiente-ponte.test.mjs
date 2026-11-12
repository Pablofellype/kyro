import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { create } from "zustand";

function modulo(caminho, nomes, dependencias = {}) {
  const codigo = stripTypeScriptTypes(readFileSync(caminho, "utf8"))
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm, "")
    .replace(/^export /gm, "");
  const contexto = vm.createContext({ ...dependencias });
  vm.runInContext(`${codigo}\nglobalThis.api = { ${nomes.join(", ")} };`, contexto);
  return contexto.api;
}

function disponibilidade(dev, janela) {
  const codigo = stripTypeScriptTypes(readFileSync("src/ponte/ambiente.ts", "utf8"))
    .replaceAll("import.meta.env.DEV", String(dev)).replace(/^export /gm, "");
  const contexto = vm.createContext(janela === undefined ? {} : { window: janela });
  vm.runInContext(`${codigo}\nglobalThis.api = ponteLocalDisponivel;`, contexto);
  return contexto.api();
}

test("ponte local fica disponível no desenvolvimento e no app instalado, sem ser presumida no site", () => {
  assert.equal(disponibilidade(false, {}), false);
  assert.equal(disponibilidade(false, undefined), false);
  assert.equal(disponibilidade(true, {}), true);
  assert.equal(disponibilidade(false, { __TAURI_INTERNALS__: {} }), true);
});

function pontes(locais) {
  const chamadas = [];
  const dependencias = {
    create, ponteLocalDisponivel: () => locais,
    cabecalhosNiko: () => ({}), exigirConexaoDisponivel() {}, T: {},
    fetch: async (url) => { chamadas.push(url); return Response.json({ sessao: false }); },
  };
  return {
    chamadas,
    ...modulo("src/ponte/ponteLocal.ts", ["sistema"], dependencias),
    ...modulo("src/ponte/conexoesReais.ts", ["conexoesPonte"], dependencias),
    ...modulo("src/estado/midia.ts", ["useMidia"], dependencias),
  };
}

test("site não faz consultas nem comandos de mídia, sistema e Notion nas rotas locais", async () => {
  const a = pontes(false);
  await assert.rejects(a.sistema.estado(), /precisa do aplicativo Kyro/);
  await assert.rejects(a.conexoesPonte.ler("notion"), /precisa do aplicativo Kyro/);
  await a.useMidia.getState().sincronizar();
  await a.useMidia.getState().alternar();
  await a.useMidia.getState().proxima();
  await a.useMidia.getState().buscar(10);
  assert.deepEqual(a.chamadas, []);
  assert.equal(a.useMidia.getState().disponivel, false);
});

test("aplicativo e desenvolvimento mantêm as consultas locais existentes", async () => {
  const a = pontes(true);
  await a.sistema.estado();
  await a.conexoesPonte.ler("notion");
  await a.useMidia.getState().sincronizar();
  assert.deepEqual(a.chamadas, ["/ponte/sistema/estado", "/ponte/conexoes/notion", "/ponte/midia"]);
});

test("serviços do site preservam configurações locais sem consultar nem desativar conexões salvas", async () => {
  const a = modulo("src/servicos/servicos.ts", ["acertarConexoes", "lerConexoes", "atualizarConexaoAgora", "verificarLimitesPlanos"], {
    ponteLocalDisponivel: () => false,
    useComunicacao: { getState: () => assert.fail("Não deve alterar conexões locais no site") },
    useConfig: { getState: () => assert.fail("Não deve consultar a ponte local no site") },
    conexoesPonte: { estado: () => assert.fail("Não deve acessar /ponte/conexoes no site") },
  });
  await a.acertarConexoes();
  a.lerConexoes();
  await a.atualizarConexaoAgora("notion");
  await a.verificarLimitesPlanos();
});
