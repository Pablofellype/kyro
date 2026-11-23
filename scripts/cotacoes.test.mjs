import assert from "node:assert/strict";
import test from "node:test";

const mercado = {
  USDBRL: { bid: "5", timestamp: "1795198734" },
  CNYBRL: { bid: "0.8", timestamp: "1795198740" },
  EURBRL: { bid: "6", timestamp: "1795198741" },
};
const referencia = [
  { date: "2026-11-20", base: "BRL", quote: "USD", rate: 0.2 },
  { date: "2026-11-21", base: "BRL", quote: "CNY", rate: 1.25 },
  { date: "2026-11-21", base: "BRL", quote: "EUR", rate: 0.125 },
];

test("Importados usa cotação de mercado saudável e compartilha pedidos simultâneos", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(mercado));
  const { lerCotacoesImportados } = await import("../servidor/cotacoes.ts?mercado");
  const primeira = lerCotacoesImportados();
  assert.equal(lerCotacoesImportados(), primeira);
  assert.deepEqual(await primeira, {
    taxas: { BRL: 1, USD: 5, CNY: 0.8, EUR: 6 },
    atualizadaEm: new Date(1795198734000).toISOString(),
    fonte: "awesomeapi",
  });
  await lerCotacoesImportados();
  assert.equal(fetch.mock.callCount(), 1);
  assert.match(fetch.mock.calls[0].arguments[0], /economia\.awesomeapi\.com\.br/);
});

test("falha HTTP da fonte de mercado ativa a referência com as taxas na base esperada", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fetch = t.mock.method(globalThis, "fetch", async (url) => String(url).includes("awesomeapi")
    ? new Response(null, { status: 403 })
    : Response.json(referencia));
  const { lerCotacoesImportados } = await import("../servidor/cotacoes.ts?reserva");
  assert.deepEqual(await lerCotacoesImportados(), {
    taxas: { BRL: 1, USD: 5, CNY: 0.8, EUR: 8 },
    atualizadaEm: "2026-11-20T00:00:00.000Z",
    fonte: "frankfurter",
  });
  assert.equal(fetch.mock.callCount(), 2);
  assert.match(fetch.mock.calls[1].arguments[0], /frankfurter\.dev/);
});

test("respostas incompletas são rejeitadas e uma nova consulta pode recuperar a cotação", async (t) => {
  t.mock.method(console, "warn", () => {});
  let recuperado = false;
  t.mock.method(globalThis, "fetch", async (url) => String(url).includes("awesomeapi")
    ? Response.json(recuperado ? mercado : {})
    : Response.json(referencia.filter(({ quote }) => quote !== "CNY")));
  const { lerCotacoesImportados } = await import("../servidor/cotacoes.ts?recuperacao");
  await assert.rejects(lerCotacoesImportados, /frankfurter_cotacao_invalida_CNY/);
  recuperado = true;
  assert.equal((await lerCotacoesImportados()).fonte, "awesomeapi");
});
