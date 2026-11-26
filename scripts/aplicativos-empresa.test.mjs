import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { neonConfig } from "@neondatabase/serverless";
import { getPayloadFromClientToken } from "@vercel/blob/client";
import { alterarPerfilProfissional, criarConviteUsuario, EMAIL_PROPRIETARIO, redefinirSenhaComToken, reenviarConviteUsuario } from "../src/servicos/autenticacao.ts";
import { tratarAplicativosEmpresa } from "../src/servicos/aplicativosEmpresa.ts";
import { consultarInventario, InventarioIndisponivel, lerFotoDoInventario, lerHistoricoInventario } from "../src/servicos/inventarioIntegracao.ts";
import { criarInventarioLocal } from "../servidor/inventarioLocal.ts";

const pedidoApi = { protocolo: "MAT-100", solicitante: "Pessoa de Teste", tipo: "DML", itens: "Pano de limpeza", local: "Comercial", data_solicitacao: "22/11/2026" };
const pedidoNormalizado = { chave: "protocolo:MAT-100", protocolo: "MAT-100", solicitante: "Pessoa de Teste", tipo: "DML", itens: "Pano de limpeza", local: "Comercial", data: "22/11/2026" };
const reservaNormalizada = { ...pedidoNormalizado, codigoSap: "", fotoDisponivel: false };

test("o Inventário local lê o histórico e inicia avisos em memória a partir do cursor atual", async (t) => {
  const tokenAnterior = process.env.INVENTARIO_INTEGRACAO_TOKEN;
  process.env.INVENTARIO_INTEGRACAO_TOKEN = "token-local-simulado";
  t.after(() => { if (tokenAnterior === undefined) delete process.env.INVENTARIO_INTEGRACAO_TOKEN; else process.env.INVENTARIO_INTEGRACAO_TOKEN = tokenAnterior; });
  const consultar = t.mock.method(globalThis, "fetch", async (url, opcoes) => {
    assert.equal(url.origin, "http://127.0.0.1:33318");
    assert.equal(opcoes.redirect, "error");
    if (url.searchParams.has("reservas_atuais")) return Response.json({ reservas: [] });
    const cursor = url.searchParams.get("cursor");
    return Response.json({
      proximo_cursor: cursor === null ? "5" : "6",
      eventos: cursor === null ? [] : [{ id: "6", tipo: "solicitacao.recebida", solicitacao: pedidoApi }],
    });
  });
  assert.throws(() => criarInventarioLocal("https://inventario.example/api/integracoes/solicitacoes"), /127\.0\.0\.1/);
  const inventario = criarInventarioLocal("http://127.0.0.1:33318/api/integracoes/solicitacoes");
  assert.deepEqual((await inventario.historico()).pedidos, []);
  assert.equal((await inventario.acompanhar(7)).total, 0);
  const notificacoes = await Promise.all([inventario.acompanhar(7), inventario.acompanhar(7)]);
  assert.equal(consultar.mock.callCount(), 3);
  assert.equal(notificacoes[0].total, 1);
  assert.equal(notificacoes[0].recentes[0].solicitante, pedidoApi.solicitante);
  assert.equal(notificacoes[0], notificacoes[1]);
  assert.equal(inventario.notificacao(8), null);
  inventario.alterarPreferencia(7, false);
  assert.equal(await inventario.acompanhar(7), null);
});

test("o Inventário entrega a foto por evento sem expor o caminho privado", async (t) => {
  const tokenAnterior = process.env.INVENTARIO_INTEGRACAO_TOKEN;
  const token = "token-simulado";
  process.env.INVENTARIO_INTEGRACAO_TOKEN = token;
  t.after(() => { if (tokenAnterior === undefined) delete process.env.INVENTARIO_INTEGRACAO_TOKEN; else process.env.INVENTARIO_INTEGRACAO_TOKEN = tokenAnterior; });
  const { solicitacoes } = await consultarInventario("0", async () => Response.json({
    proximo_cursor: "7", eventos: [{ id: "7", tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, foto_disponivel: true } }],
  }));
  assert.deepEqual(solicitacoes, [{ ...pedidoNormalizado, fotoEvento: "7" }]);
  assert.equal(await lerFotoDoInventario("7", async (url, opcoes) => {
    assert.equal(url.searchParams.get("foto_evento"), "7");
    assert.equal(opcoes.headers.Authorization, `Bearer ${token}`);
    assert.equal(opcoes.redirect, "error");
    return new Response(Uint8Array.of(1, 2, 3), { headers: { "content-type": "image/png" } });
  }), "data:image/png;base64,AQID");
  assert.equal(await lerFotoDoInventario("7", async () => new Response("inválida", { headers: { "content-type": "image/svg+xml" } })), null);
  assert.equal(await lerFotoDoInventario("7", async () => new Response("grande", { headers: { "content-type": "image/jpeg", "content-length": "2097153" } })), null);
  assert.equal(await lerFotoDoInventario("../7", async () => assert.fail("ID inválido não consulta a rede")), null);
});

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
  const relatorioAnterior = process.env.KYRO_POWER_BI_REPORT_URL;
  const relatorioDoisAnterior = process.env.KYRO_POWER_BI_REPORT_URL_2;
  const resendAnterior = process.env.RESEND_API_KEY;
  const remetenteAnterior = process.env.RESEND_FROM_EMAIL;
  const blobAnterior = process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN;
  process.env.DATABASE_URL = "postgresql://teste:teste@neon.example/kyro";
  process.env.INVENTARIO_INTEGRACAO_TOKEN = "token-de-teste";
  t.after(() => {
    neonConfig.fetchFunction = fetchAnterior;
    if (bancoAnterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = bancoAnterior;
    if (inventarioAnterior === undefined) delete process.env.INVENTARIO_INTEGRACAO_TOKEN;
    else process.env.INVENTARIO_INTEGRACAO_TOKEN = inventarioAnterior;
    if (relatorioAnterior === undefined) delete process.env.KYRO_POWER_BI_REPORT_URL;
    else process.env.KYRO_POWER_BI_REPORT_URL = relatorioAnterior;
    if (relatorioDoisAnterior === undefined) delete process.env.KYRO_POWER_BI_REPORT_URL_2;
    else process.env.KYRO_POWER_BI_REPORT_URL_2 = relatorioDoisAnterior;
    if (resendAnterior === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = resendAnterior;
    if (remetenteAnterior === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = remetenteAnterior;
    if (blobAnterior === undefined) delete process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN;
    else process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN = blobAnterior;
  });

  const persistidos = new Map();
  const relatoriosGravados = new Map();
  const planilhasGravadas = new Map();
  const acessosPowerBi = new Map([["2", null]]);
  const convitesPowerBi = new Map();
  let tokenDeConvite;
  const assinaturas = new Map();
  const cursores = [];
  let tokenAceito = true;
  let fimDaFila = "5";
  let inventarioReiniciado = false;
  t.mock.method(globalThis, "fetch", async (url, opcoes) => {
    if (url === "https://api.resend.com/emails") {
      tokenDeConvite = JSON.parse(opcoes.body).html.match(/convite=([a-f0-9]{64})/)?.[1];
      return Response.json({ id: "envio-simulado" });
    }
    if (url.searchParams.has("reservas_atuais")) return Response.json({ reservas: [pedidoApi] });
    const cursor = url.searchParams.get("cursor");
    cursores.push(cursor);
    if (!tokenAceito) return new Response(null, { status: 401 });
    if (inventarioReiniciado) {
      const eventos = cursor === "0" && fimDaFila !== "0"
        ? [{ id: 1, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, protocolo: "MAT-NOVO" } }]
        : [];
      return Response.json({ proximo_cursor: cursor === null || eventos.length > 0 ? fimDaFila : cursor, eventos, tem_mais: false });
    }
    if (cursor === "6") {
      fimDaFila = "7";
      return Response.json({ proximo_cursor: "7", eventos: [{ id: 7, tipo: "solicitacao.recebida", solicitacao: { ...pedidoApi, itens: "Luvas" } }], tem_mais: false });
    }
    return Response.json(cursor === "5" || cursor === "0"
      ? { proximo_cursor: "6", eventos: [{ id: 6, tipo: "solicitacao.recebida", solicitacao: pedidoApi }], tem_mais: false }
      : { proximo_cursor: cursor ?? fimDaFila, eventos: [], tem_mais: false });
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
      const id = { dono: "1", gerencia: "2", visitante: "3", novaGerencia: "4" }[params[0]];
      return Response.json(resultado(["id", "email", "nome", "perfil", "robo_aderencias"], id ? [[id, email, "Conta", params[0] === "novaGerencia" ? "gerencia" : params[0], params[0] === "gerencia" ? "t" : "f"]] : [], { id: 23, robo_aderencias: 16 }));
    }
    if (query.includes("FROM planilhas_empresa")) {
      return Response.json(resultado(["id", "origem_robo", "documento", "nome", "url", "ativa", "removida"], [...planilhasGravadas.values()], { origem_robo: 16, ativa: 16, removida: 16 }));
    }
    if (query.includes("INSERT INTO planilhas_empresa")) {
      const [id, documento, nome, url, ativa] = params;
      const anterior = planilhasGravadas.get(id);
      if (query.includes("removida = TRUE")) {
        planilhasGravadas.set(id, [id, "t", anterior?.[2] ?? documento, "", "", "f", "t"]);
        return Response.json(resultado([], []));
      }
      if (query.includes("DO NOTHING") && anterior) return Response.json(resultado([], []));
      if (anterior?.[6] === "t") return Response.json(resultado(["id"], []));
      if ([...planilhasGravadas.values()].some((item) => item[0] !== id && item[2] === documento && item[6] === "f")) {
        return Response.json({ message: "duplicate key", code: "23505" }, { status: 400 });
      }
      planilhasGravadas.set(id, [id, query.includes("FALSE,") ? "f" : "t", documento, nome, url, ativa === "true" ? "t" : "f", "f"]);
      return Response.json(resultado(["id"], [[id]]));
    }
    if (query.includes("UPDATE planilhas_empresa")) {
      if (query.includes("removida = TRUE")) {
        const anterior = planilhasGravadas.get(params[0]);
        if (anterior) planilhasGravadas.set(params[0], [...anterior.slice(0, 3), "", "", "f", "t"]);
        return Response.json(resultado([], []));
      }
      const [documento, nome, url, ativa, id] = params;
      const anterior = planilhasGravadas.get(id);
      if (!anterior || anterior[6] === "t") return Response.json(resultado(["id"], []));
      planilhasGravadas.set(id, [id, anterior[1], documento, nome, url, ativa === "true" ? "t" : "f", "f"]);
      return Response.json(resultado(["id"], [[id]]));
    }
    if (query.includes("FROM power_bi_relatorios")) {
      return Response.json(resultado(["id", "nome", "url"], [...relatoriosGravados.values()]));
    }
    if (query.includes("INSERT INTO power_bi_relatorios")) {
      relatoriosGravados.set(params[0], params.slice(0, 3));
      return Response.json(resultado([], []));
    }
    if (query.includes("SELECT power_bi_relatorios FROM usuarios")) {
      return Response.json(resultado(["power_bi_relatorios"], acessosPowerBi.has(params[0]) ? [[acessosPowerBi.get(params[0])]] : [], { power_bi_relatorios: 3802 }));
    }
    if (query.includes("UPDATE usuarios") && query.includes("power_bi_relatorios = COALESCE")) {
      const [cargo, setor, telefone, acesso, id] = params;
      if (acesso !== null) acessosPowerBi.set(id, acesso);
      return Response.json(resultado(["id", "nome", "cargo", "setor", "telefone", "power_bi_relatorios"], [[id, "Conta", cargo, setor, telefone, acessosPowerBi.get(id)]], { id: 23, power_bi_relatorios: 3802 }));
    }
    if (query.includes("SELECT id FROM usuarios WHERE email")) return Response.json(resultado(["id"], []));
    if (query.includes("UPDATE tokens_acesso") || query.includes("INSERT INTO sessoes") || query.includes("DELETE FROM sessoes")) {
      return Response.json(resultado([], []));
    }
    if (query.includes("INSERT INTO tokens_acesso")) {
      const [hash, email, nome, perfil, cargo, setor, telefone, , acessos] = params;
      convitesPowerBi.set(hash, [email, nome, perfil, cargo, setor, telefone, acessos]);
      return Response.json(resultado([], []));
    }
    if (query.includes("FROM tokens_acesso")) {
      const linha = query.includes("WHERE token_hash") ? convitesPowerBi.get(params[0]) : [...convitesPowerBi.values()].findLast((p) => p[0] === params[0]);
      const colunas = ["email", "nome", "perfil", "cargo", "setor", "telefone", "power_bi_relatorios", "tipo", "expira_em"];
      return Response.json(resultado(colunas, linha ? [[...linha, "convite", "2099-01-01"]] : [], { power_bi_relatorios: 3802 }));
    }
    if (query.includes("INSERT INTO usuarios") && query.includes("power_bi_relatorios")) {
      acessosPowerBi.set("4", params[6]);
      return Response.json(resultado(["id", "email", "nome", "perfil"], [["4", params[0], params[1], "gerencia"]], { id: 23 }));
    }
    if (query.includes("INSERT INTO aplicativos_empresa")) {
      const anterior = persistidos.get(params[0]);
      if (!query.includes("DO NOTHING") || !anterior) {
        const linha = params.slice(0, 7);
        if (params[7] === "true" && anterior) linha[6] = anterior[6];
        persistidos.set(params[0], linha);
      }
      return Response.json(resultado([], []));
    }
    if (query.includes("SELECT proposta FROM aplicativos_empresa")) {
      const linha = persistidos.get(params[0]);
      return Response.json(resultado(["proposta"], linha ? [[linha[6]]] : [], { proposta: 3802 }));
    }
    if (query.includes("FROM aplicativos_empresa")) {
      return Response.json(resultado(["id", "nome", "descricao", "url", "status", "publico", "proposta"], [...persistidos.values()], { publico: 16, proposta: 3802 }));
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
  const lerPowerBi = (token) => tratarAplicativosEmpresa("GET", "power-bi", token, async () => ({}));
  const catalogoPlanilhas = (token, corpo) => tratarAplicativosEmpresa(corpo ? "POST" : "GET", "planilhas-catalogo", token, async () => corpo ?? {});
  const documento = "Planilha_kyro_123456";
  const urlPlanilha = `https://docs.google.com/spreadsheets/d/${documento}/edit`;
  const novaPlanilha = { id: "kyro:11111111-2222-4333-a444-555555555555", acao: "adicionar", origemRobo: false, nome: "Relatórios mensais", url: `${urlPlanilha}?gid=3#gid=5`, ativa: true };
  assert.equal((await catalogoPlanilhas("")).status, 401);
  assert.equal((await catalogoPlanilhas("visitante")).status, 403);
  assert.equal((await catalogoPlanilhas("novaGerencia")).status, 403);
  assert.equal((await catalogoPlanilhas("gerencia", novaPlanilha)).status, 403);
  assert.equal((await catalogoPlanilhas("dono", { ...novaPlanilha, url: "https://outros.example/qualquer" })).status, 400);
  const adicionada = (await catalogoPlanilhas("dono", novaPlanilha)).dados.ajustes[0];
  assert.equal(adicionada.url, urlPlanilha);
  assert.equal(adicionada.ativa, true);
  assert.equal((await catalogoPlanilhas("dono", novaPlanilha)).dados.ajustes.length, 1);
  assert.equal((await catalogoPlanilhas("dono", { ...novaPlanilha, id: "kyro:11111111-2222-4333-a444-555555555556" })).status, 409);
  const editar = { ...novaPlanilha, acao: "salvar", nome: "Relatório atualizado", ativa: false };
  assert.equal((await catalogoPlanilhas("dono", editar)).dados.ajustes[0].nome, "Relatório atualizado");
  assert.deepEqual((await catalogoPlanilhas("gerencia")).dados.ajustes, [{ id: novaPlanilha.id, oculta: true, documento }]);
  assert.equal((await catalogoPlanilhas("dono", { ...editar, ativa: true })).dados.ajustes[0].ativa, true);
  assert.equal((await catalogoPlanilhas("dono", { ...novaPlanilha, acao: "remover" })).dados.ajustes[0].oculta, true);
  assert.equal((await catalogoPlanilhas("dono", editar)).status, 404);
  const idRobo = "Arquivo_do_robo";
  const doRobo = { ...editar, id: idRobo, origemRobo: true, url: `https://docs.google.com/spreadsheets/d/${idRobo}/edit` };
  assert.equal((await catalogoPlanilhas("dono", doRobo)).dados.ajustes[1].ativa, false);
  assert.equal((await catalogoPlanilhas("dono", { ...doRobo, acao: "remover" })).dados.ajustes[1].oculta, true);
  assert.equal((await catalogoPlanilhas("dono", { ...doRobo, ativa: true })).status, 404);
  const relatorio = "https://app.powerbi.com/reportEmbed?reportId=11111111-2222-4333-a444-555555555555&autoAuth=true";
  process.env.KYRO_POWER_BI_REPORT_URL = relatorio;
  assert.equal((await lerPowerBi("")).status, 401);
  assert.equal((await lerPowerBi("visitante")).status, 403);
  assert.deepEqual(await lerPowerBi("gerencia"), { status: 200, dados: { url: relatorio } });
  process.env.KYRO_POWER_BI_REPORT_URL = "https://app.powerbi.com/view?r=publico";
  assert.deepEqual(await lerPowerBi("dono"), { status: 503, dados: { erro: "power_bi_nao_configurado" } });
  process.env.KYRO_POWER_BI_REPORT_URL = relatorio;
  const segundoRelatorio = "https://app.powerbi.com/reportEmbed?reportId=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee&autoAuth=true";
  process.env.KYRO_POWER_BI_REPORT_URL_2 = segundoRelatorio;
  const catalogoPowerBi = (token, corpo) => tratarAplicativosEmpresa(corpo ? "POST" : "GET", "power-bi-catalogo", token, async () => corpo ?? {});
  assert.equal((await catalogoPowerBi("visitante")).status, 403);
  assert.equal((await catalogoPowerBi("gerencia", { nome: "Proibido", url: segundoRelatorio })).status, 403);
  assert.equal((await catalogoPowerBi("dono", { nome: "URL pública", url: "https://app.powerbi.com/view?r=publico" })).status, 400);
  const donoPowerBi = { id: 1, perfil: "dono", email: EMAIL_PROPRIETARIO, nome: "Dono", roboAderencias: true };
  const doDono = (await catalogoPowerBi("dono")).dados.relatorios;
  assert.equal(doDono.length, 2);
  const [sap, segundo] = doDono;
  assert.deepEqual((await catalogoPowerBi("gerencia")).dados.relatorios, [sap]);
  const editado = { ...segundo, nome: "Relatório de teste" };
  assert.equal((await catalogoPowerBi("dono", editado)).status, 200);
  assert.equal((await catalogoPowerBi("dono", { nome: "Duplicado", url: segundoRelatorio })).status, 409);
  await assert.rejects(alterarPerfilProfissional({ ...donoPowerBi, perfil: "gerencia" }, 2, { powerBiRelatorios: [segundo.id] }), /permissao_negada/);
  await assert.rejects(alterarPerfilProfissional(donoPowerBi, 2, { powerBiRelatorios: ["inexistente"] }), /acessos_power_bi_invalidos/);
  await alterarPerfilProfissional(donoPowerBi, 2, { powerBiRelatorios: [segundo.id] });
  assert.deepEqual((await catalogoPowerBi("gerencia")).dados.relatorios, [editado]);
  assert.equal((await lerPowerBi("gerencia")).status, 403);
  await alterarPerfilProfissional(donoPowerBi, 2, { cargo: "Coordenação" });
  assert.deepEqual((await catalogoPowerBi("gerencia")).dados.relatorios, [editado]);
  await alterarPerfilProfissional(donoPowerBi, 2, { powerBiRelatorios: [] });
  assert.deepEqual((await catalogoPowerBi("gerencia")).dados.relatorios, []);

  process.env.RESEND_API_KEY = "simulado";
  process.env.RESEND_FROM_EMAIL = "kyro@example.com";
  await criarConviteUsuario(donoPowerBi, "nova@example.com", "Nova pessoa", "https://kyro.example", { powerBiRelatorios: [segundo.id] });
  assert.ok(tokenDeConvite);
  await reenviarConviteUsuario(donoPowerBi, "nova@example.com", "https://kyro.example");
  await redefinirSenhaComToken(tokenDeConvite, "SenhaForte123!");
  assert.deepEqual((await catalogoPowerBi("novaGerencia")).dados.relatorios, [editado]);
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

  const prototipo = {
    ...novo, criacaoId: "prototipo-123", nome: "Projeto novo", url: "",
    status: "prototipo", proposta: { pdf: { origem: "link", url: "https://exemplo.test/proposta.pdf" }, video: { origem: "link", url: "https://exemplo.test/video" } },
  };
  assert.equal((await salvar("dono", { ...prototipo, proposta: { pdf: { origem: "link", url: "javascript:alert(1)" } } })).status, 400);
  assert.equal((await salvar("dono", { ...prototipo, proposta: { pdf: { origem: "arquivo", nome: "Proposta.pdf", caminho: "kyro/propostas/outro/11111111-2222-4333-a444-555555555555.pdf" } } })).status, 400);
  assert.equal((await salvar("dono", prototipo)).status, 200);
  const idPrototipo = `app-${prototipo.criacaoId}`;
  const lerPrototipo = async (token) => (await lerCatalogo(token)).dados.aplicativos.find((app) => app.id === idPrototipo);
  assert.equal((await lerPrototipo("gerencia")).status, "prototipo");
  assert.deepEqual((await lerPrototipo("gerencia")).proposta, prototipo.proposta);
  assert.equal(Object.hasOwn(await lerPrototipo(""), "proposta"), false);
  assert.equal((await salvar("dono", { ...prototipo, id: idPrototipo, url: "https://interno.test/", proposta: undefined })).status, 200);
  assert.deepEqual((await lerPrototipo("gerencia")).proposta, prototipo.proposta);
  assert.equal((await lerPrototipo("")).url, null);
  assert.equal((await salvar("dono", { ...prototipo, id: idPrototipo, proposta: {} })).status, 200);
  assert.deepEqual((await lerPrototipo("dono")).proposta, {});

  const autorizarUpload = (token, tipo = "pdf") => tratarAplicativosEmpresa("POST", "proposta-upload", token, async () => ({ id: idPrototipo, tipo }));
  assert.equal((await autorizarUpload("")).status, 401);
  assert.equal((await autorizarUpload("gerencia")).status, 403);
  assert.equal((await autorizarUpload("dono", "imagem")).status, 400);
  delete process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN;
  assert.deepEqual(await autorizarUpload("dono"), { status: 503, dados: { erro: "armazenamento_propostas_indisponivel" } });
  process.env.KYRO_PROPOSTAS_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_storeteste_chaveteste";
  const upload = await autorizarUpload("dono");
  assert.equal(upload.status, 200);
  assert.match(upload.dados.caminho, /^kyro\/propostas\/app-prototipo-123\/[a-f\d-]+\.pdf$/);
  const permissoes = getPayloadFromClientToken(upload.dados.token);
  assert.equal(permissoes.pathname, upload.dados.caminho);
  assert.deepEqual(permissoes.allowedContentTypes, ["application/pdf"]);
  assert.equal(permissoes.maximumSizeInBytes, 15 * 1024 * 1024);
  assert.equal(permissoes.allowOverwrite, false);
  const uploadVideo = await autorizarUpload("dono", "video");
  assert.equal(uploadVideo.status, 200);
  const tamanhoDoVideo = 82_647 * 1024;
  const permissoesVideo = getPayloadFromClientToken(uploadVideo.dados.token);
  assert.deepEqual(permissoesVideo.allowedContentTypes, ["video/mp4"]);
  assert.equal(permissoesVideo.maximumSizeInBytes, 100 * 1024 * 1024);
  assert.ok(tamanhoDoVideo <= permissoesVideo.maximumSizeInBytes);
  const baixar = (token) => tratarAplicativosEmpresa("GET", "proposta-arquivo", token, async () => ({}), new URLSearchParams({ app: idPrototipo, tipo: "pdf" }));
  assert.equal((await baixar("")).status, 401);
  assert.equal((await baixar("visitante")).status, 403);
  assert.equal((await baixar("gerencia")).status, 404);

  const require = createRequire(import.meta.url);
  const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = createRequire(require.resolve("@vercel/blob"))("undici");
  const despachanteAnterior = getGlobalDispatcher();
  const blob = new MockAgent();
  blob.disableNetConnect();
  setGlobalDispatcher(blob);
  t.after(async () => {
    setGlobalDispatcher(despachanteAnterior);
    await blob.close();
  });
  const conteudo = "%PDF-1.7\nArquivo de teste";
  const caminho = upload.dados.caminho;
  const urlArquivo = `https://storeteste.private.blob.vercel-storage.com/${caminho}`;
  blob.get("https://vercel.com").intercept({ method: "GET", path: `/api/blob?${new URLSearchParams({ url: caminho })}` }).reply(200, {
    url: urlArquivo, pathname: caminho, size: Buffer.byteLength(conteudo),
    contentType: "application/pdf", uploadedAt: "2026-11-26T00:00:00.000Z",
  }, { headers: { "content-type": "application/json" } });
  const propostaArquivo = { pdf: { origem: "arquivo", nome: "Proposta.pdf", caminho } };
  const caminhoVideo = uploadVideo.dados.caminho;
  blob.get("https://vercel.com").intercept({ method: "GET", path: `/api/blob?${new URLSearchParams({ url: caminhoVideo })}` }).reply(200, {
    url: `https://storeteste.private.blob.vercel-storage.com/${caminhoVideo}`,
    pathname: caminhoVideo, size: tamanhoDoVideo, contentType: "video/mp4", uploadedAt: "2026-11-26T00:00:00.000Z",
  }, { headers: { "content-type": "application/json" } });
  const proposta = { ...propostaArquivo, video: { origem: "arquivo", nome: "mascara_qr_video.mp4", caminho: caminhoVideo } };
  assert.equal((await salvar("dono", { ...prototipo, id: idPrototipo, proposta })).status, 200);
  assert.deepEqual((await lerPrototipo("gerencia")).proposta, proposta);
  assert.equal(Object.hasOwn(await lerPrototipo(""), "proposta"), false);
  blob.get("https://storeteste.private.blob.vercel-storage.com").intercept({ method: "GET", path: `/${caminho}` }).reply(200, conteudo, {
    headers: { "content-type": "application/pdf", "content-length": String(Buffer.byteLength(conteudo)) },
  });
  const arquivo = await baixar("gerencia");
  assert.equal(arquivo.status, 200);
  assert.equal(arquivo.arquivo.mime, "application/pdf");
  assert.equal(await new Response(arquivo.arquivo.stream).text(), conteudo);
  assert.equal((await salvar("dono", { ...prototipo, id: idPrototipo, proposta: {} })).status, 200);
  assert.equal((await baixar("gerencia")).status, 404);
  blob.assertNoPendingInterceptors();

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

  inventarioReiniciado = true;
  fimDaFila = "0";
  const retomado = (await acompanhar("gerencia")).dados.notificacao;
  assert.equal(assinaturas.get("2")[0], "0");
  assert.deepEqual(retomado, corrigido);

  // O processo também alcança pedidos que já chegaram após o reinício.
  assinaturas.get("2")[0] = "7";
  fimDaFila = "1";
  const pedidoNovo = (await acompanhar("gerencia")).dados.notificacao;
  assert.equal(assinaturas.get("2")[0], "1");
  assert.equal(pedidoNovo.assinatura, corrigido.assinatura);
  assert.equal(pedidoNovo.total, 2);
  assert.deepEqual(pedidoNovo.recentes.map((pedido) => pedido.protocolo), ["MAT-NOVO", "MAT-100"]);
  assert.equal((await acompanhar("gerencia")).dados.notificacao.total, 2);
  inventarioReiniciado = false;
  assert.deepEqual((await preferencia("gerencia", false)).dados, { fontesAtivas: [] });
  assert.deepEqual((await acompanhar("gerencia")).dados, { notificacao: null });
  const historico = (token) => tratarAplicativosEmpresa("GET", "historico-inventario", token, async () => ({}));
  assert.equal((await historico("")).status, 401);
  assert.equal((await historico("visitante")).status, 403);
  assert.deepEqual((await historico("gerencia")).dados, { pedidos: [reservaNormalizada], parcial: false, notificacao: null });
  assert.deepEqual((await acompanhar("gerencia")).dados, { notificacao: null });
});
