import assert from "node:assert/strict";
import test from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import { EMAIL_PROPRIETARIO } from "../src/servicos/autenticacao.ts";
import { tratarAplicativosEmpresa } from "../src/servicos/aplicativosEmpresa.ts";
import { consultarInventario, InventarioIndisponivel, lerHistoricoInventario } from "../src/servicos/inventarioIntegracao.ts";

const pedidoApi = { protocolo: "MAT-100", solicitante: "Pessoa de Teste", tipo: "DML", itens: "Pano de limpeza", local: "Comercial", data_solicitacao: "22/11/2026" };
const pedidoNormalizado = { chave: "protocolo:MAT-100", protocolo: "MAT-100", solicitante: "Pessoa de Teste", tipo: "DML", itens: "Pano de limpeza", local: "Comercial", data: "22/11/2026" };

test("o inventário inicia sem cursor, preserva o cursor zero e rejeita uma página inválida", async (t) => {
  const tokenAnterior = process.env.INVENTARIO_INTEGRACAO_TOKEN;
  process.env.INVENTARIO_INTEGRACAO_TOKEN = "token-de-teste";
  t.after(() => {
    if (tokenAnterior === undefined) delete process.env.INVENTARIO_INTEGRACAO_TOKEN;
    else process.env.INVENTARIO_INTEGRACAO_TOKEN = tokenAnterior;
  });
  const consultar = async (url, opcoes) => {
    assert.equal(url.origin, "https://inventario-internoo.vercel.app");
    assert.equal(opcoes.method, "GET");
    assert.equal(opcoes.headers.Authorization, "Bearer token-de-teste");
    assert.equal(opcoes.redirect, "error");
    if (!url.searchParams.has("cursor")) return Response.json({ proximo_cursor: 0, eventos: [], tem_mais: false });
    assert.equal(url.searchParams.get("cursor"), "0");
    return Response.json({ proximo_cursor: "3", eventos: [
      { id: 1, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, telefone: "não deve ser encaminhado" } },
      { id: 2, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, protocolo: "mat-100", itens: "Luvas" } },
      { id: 3, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, protocolo: "MAT-101", solicitante: undefined } },
      { id: 4, tipo: "solicitacao.atualizada", solicitacao: {} },
    ], tem_mais: false });
  };
  assert.deepEqual(await consultarInventario(undefined, consultar), { cursor: "0", quantidade: 0, solicitacoes: [], temMais: false });
  assert.deepEqual(await consultarInventario("0", consultar), {
    cursor: "3", quantidade: 2, temMais: false,
    solicitacoes: [
      { ...pedidoNormalizado, itens: "Pano de limpeza · Luvas" },
      { ...pedidoNormalizado, chave: "protocolo:MAT-101", protocolo: "MAT-101", solicitante: "" },
    ],
  });
  await assert.rejects(consultarInventario("2", async () => new Response(null, { status: 401 })), {
    message: "inventario_token_rejeitado",
  });
  await assert.rejects(consultarInventario("2", async () => Response.json({ proximo_cursor: "3" })), InventarioIndisponivel);
  await assert.rejects(consultarInventario("2", async () => Response.json({ proximo_cursor: "2", eventos: [{ id: 2, tipo: "solicitacao.recebida" }] })), InventarioIndisponivel);
  const historico = await lerHistoricoInventario(async (url) => {
    const cursor = url.searchParams.get("cursor");
    const eventos = [{ tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, protocolo: cursor === "0" ? "MAT-99" : "MAT-100" } }];
    if (cursor !== "0") eventos.push({ tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, protocolo: "MAT-99", itens: "Luvas" } });
    return Response.json({ eventos, proximo_cursor: cursor === "0" ? "1" : "2", tem_mais: cursor === "0" });
  });
  assert.deepEqual(historico.pedidos.map((pedido) => pedido.protocolo), ["MAT-100", "MAT-99"]);
  assert.equal(historico.pedidos[1].itens, "Pano de limpeza · Luvas");
  assert.equal(historico.parcial, false);
});

test("permissões do catálogo e notificações do inventário são aplicadas por conta", async (t) => {
  const bancoAnterior = process.env.DATABASE_URL;
  const fetchAnterior = neonConfig.fetchFunction;
  const inventarioAnterior = process.env.INVENTARIO_INTEGRACAO_TOKEN;
  process.env.DATABASE_URL = "postgresql://teste:teste@neon.example/kyro";
  process.env.INVENTARIO_INTEGRACAO_TOKEN = "token-de-teste";
  t.after(() => {
    neonConfig.fetchFunction = fetchAnterior;
    if (bancoAnterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = bancoAnterior;
    if (inventarioAnterior === undefined) delete process.env.INVENTARIO_INTEGRACAO_TOKEN;
    else process.env.INVENTARIO_INTEGRACAO_TOKEN = inventarioAnterior;
  });

  const persistidos = new Map();
  const assinaturas = new Map();
  const cursores = [];
  let tokenAceito = true;
  t.mock.method(globalThis, "fetch", async (url) => {
    const cursor = url.searchParams.get("cursor");
    cursores.push(cursor);
    if (!tokenAceito) return new Response(null, { status: 401 });
    if (cursor === "6") return Response.json({ proximo_cursor: "7", eventos: [{ id: 7, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, itens: "Luvas" } }], tem_mais: false });
    return Response.json(cursor === "5" || cursor === "0"
      ? { proximo_cursor: "6", eventos: [{ id: 6, tipo: "solicitacao.recebida", solicitacao: pedidoApi }], tem_mais: false }
      : { proximo_cursor: cursor ?? "5", eventos: [], tem_mais: false });
  });
  const resultado = (nomes, rows, tipos = { publico: 16 }) => ({
    fields: nomes.map((name) => ({ name, dataTypeID: tipos[name] ?? 25 })),
    rows,
  });
  neonConfig.fetchFunction = async (_url, opcoes) => {
    const { query, params, queries } = JSON.parse(opcoes.body);
    if (queries) return Response.json({ results: queries.map(() => resultado([], [])) });
    if (query.includes("FROM sessoes")) {
      const email = params[0] === "dono" ? EMAIL_PROPRIETARIO : "gerencia@example.com";
      const id = { dono: "1", gerencia: "2", visitante: "3" }[params[0]];
      return Response.json(resultado(["id", "email", "nome", "perfil"], id ? [[id, email, "Conta", params[0]]] : [], { id: 23 }));
    }
    if (query.includes("INSERT INTO aplicativos_empresa")) {
      if (!query.includes("DO NOTHING") || !persistidos.has(params[0])) persistidos.set(params[0], params);
      return Response.json(resultado([], []));
    }
    if (query.includes("FROM aplicativos_empresa")) {
      return Response.json(resultado(["id", "nome", "descricao", "url", "status", "publico"], [...persistidos.values()]));
    }
    if (query.includes("SELECT cursor, assinatura, total")) {
      const linha = assinaturas.get(params[0]);
      return Response.json(resultado(["cursor", "assinatura", "total", "recentes", "contagem"], linha ? [linha] : [], { recentes: 3802, contagem: 3802 }));
    }
    if (query.includes("SELECT fonte")) {
      return Response.json(resultado(["fonte"], assinaturas.has(params[0]) ? [["inventario"]] : []));
    }
    if (query.includes("INSERT INTO notificacoes_apps_empresa")) {
      if (!assinaturas.has(params[0])) assinaturas.set(params[0], [params[2], params[3], "0", "[]", null]);
      return Response.json(resultado([], []));
    }
    if (query.includes("UPDATE notificacoes_apps_empresa")) {
      const [cursor, total, recentes, contagem, id, , assinatura, anterior] = params;
      const linha = assinaturas.get(id);
      if (linha?.[0] === anterior && linha[1] === assinatura) assinaturas.set(id, [cursor, assinatura, total, recentes, contagem]);
      return Response.json(resultado([], []));
    }
    if (query.includes("DELETE FROM notificacoes_apps_empresa")) {
      assinaturas.delete(params[0]);
      return Response.json(resultado([], []));
    }
    throw new Error("Consulta inesperada");
  };

  const lerCatalogo = (token = "") => tratarAplicativosEmpresa("GET", "catalogo", token, async () => ({}));
  const salvar = (token, corpo) => tratarAplicativosEmpresa("POST", "catalogo", token, async () => corpo);
  const materiais = { id: "materiais", nome: "Materiais internos", descricao: "", url: "https://novo.example/", status: "disponivel", publico: false };
  assert.equal((await salvar("gerencia", materiais)).status, 403);
  assert.equal((await salvar("", materiais)).status, 403);
  assert.equal((await salvar("dono", { ...materiais, url: "javascript:alert(1)" })).status, 400);
  assert.equal((await salvar("dono", materiais)).status, 200);
  const novo = { ...materiais, id: null, criacaoId: "11111111-2222-4333-a444-555555555555", nome: "Ferramenta", publico: true };
  assert.equal((await salvar("dono", novo)).status, 200);
  assert.equal((await salvar("dono", novo)).status, 200);

  const interno = (await lerCatalogo("gerencia")).dados.aplicativos;
  assert.equal(interno.find((app) => app.id === "materiais").url, "https://novo.example/");
  const publico = (await lerCatalogo()).dados.aplicativos;
  assert.equal(publico.some((app) => app.id === "materiais"), false);
  assert.equal(publico.filter((app) => app.nome === "Ferramenta").length, 1);

  const preferencia = (token, ativa) => tratarAplicativosEmpresa("POST", "preferencias", token, async () => ({ fonte: "inventario", ativa }));
  const acompanhar = (token) => tratarAplicativosEmpresa("POST", "notificacoes", token, async () => ({ fonte: "inventario" }));
  assert.equal((await preferencia("visitante", true)).status, 403);
  assert.deepEqual((await preferencia("gerencia", true)).dados, { fontesAtivas: ["inventario"] });
  assert.deepEqual((await acompanhar("dono")).dados, { notificacao: null });
  assert.deepEqual(cursores, [null]);
  tokenAceito = false;
  assert.deepEqual(await acompanhar("gerencia"), { status: 503, dados: { erro: "inventario_token_rejeitado" } });
  tokenAceito = true;
  const simultaneas = await Promise.all([acompanhar("gerencia"), acompanhar("gerencia")]);
  assert.deepEqual(simultaneas.map(({ dados }) => dados.notificacao.total), [1, 1]);
  const persistido = (await acompanhar("gerencia")).dados.notificacao;
  assert.equal(persistido.total, 1);
  assert.deepEqual(persistido.recentes, [{ ...pedidoNormalizado, ordem: 1, itens: "Pano de limpeza · Luvas" }]);
  assert.ok(cursores.includes("6"));
  const anterior = assinaturas.get("2");
  assinaturas.set("2", [anterior[0], anterior[1], "2", JSON.stringify([
    { ...pedidoNormalizado, chave: undefined, itens: "Luvas", ordem: 2 },
    { ...pedidoNormalizado, chave: undefined, ordem: 1 },
  ]), null]);
  const corrigido = (await acompanhar("gerencia")).dados.notificacao;
  assert.equal(corrigido.total, 1);
  assert.equal(corrigido.corrigidas, 1);
  assert.deepEqual(corrigido.ordensCorrigidas, [2]);
  assert.equal(corrigido.recentes[0].itens, "Pano de limpeza · Luvas");
  assert.deepEqual((await preferencia("gerencia", false)).dados, { fontesAtivas: [] });
  assert.deepEqual((await acompanhar("gerencia")).dados, { notificacao: null });
  const historico = (token) => tratarAplicativosEmpresa("GET", "historico-inventario", token, async () => ({}));
  assert.equal((await historico("")).status, 401);
  assert.equal((await historico("visitante")).status, 403);
  assert.deepEqual((await historico("gerencia")).dados, { pedidos: [pedidoNormalizado], parcial: false, notificacao: null });
  assert.deepEqual((await acompanhar("gerencia")).dados, { notificacao: null });
});
