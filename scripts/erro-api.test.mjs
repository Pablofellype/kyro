import test, { after } from "node:test";
import assert from "node:assert/strict";
import { criarServidorDeTeste as createServer } from "./vite-para-testes.mjs";

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } });
const { mensagemDeErroApi, motivoDoErroApi } = await vite.ssrLoadModule("/src/utilitarios/erroApi.ts");
after(() => vite.close());

test("diagnóstico da API diferencia timeout, rede, sessão e servidor", () => {
  assert.equal(motivoDoErroApi(new DOMException("aborted", "AbortError")), "timeout");
  assert.equal(motivoDoErroApi(new TypeError("fetch failed")), "offline");
  assert.equal(motivoDoErroApi(undefined, 401), "nao_autorizado");
  assert.equal(motivoDoErroApi(undefined, 503), "servidor");
  assert.match(mensagemDeErroApi(undefined, 503), /API está indisponível/);
});
