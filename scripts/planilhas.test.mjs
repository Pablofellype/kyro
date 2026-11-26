import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { criarServidorDeTeste } from "./vite-para-testes.mjs";

globalThis.BroadcastChannel = undefined;
const vite = await criarServidorDeTeste({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true }, plugins: [{
  name: "portais-planilhas-estaticos", enforce: "pre", transform(codigo, id) {
    if (id.replaceAll("\\", "/").endsWith("/src/componentes/basicos.tsx")) return codigo.replace('import { createPortal } from "react-dom";', "const createPortal = (conteudo: ReactNode) => conteudo;");
  },
}] });
after(() => vite.close());
const google = await vite.ssrLoadModule("/servidor/planilhasGoogle.ts");
const { plataforma } = await vite.ssrLoadModule("/servidor/plataforma/index.ts");
const id = "planilha_de_teste_1234567890", outro = "outra_planilha_1234567890";
const clienteId = "123456.apps.googleusercontent.com", segredo = "segredo-apenas-do-teste";
const link = (id, gid) => `https://docs.google.com/spreadsheets/d/${id}/edit${gid !== undefined ? `#gid=${gid}` : ""}`;
const credencial = (planilhas = [{ id }]) => JSON.stringify({ clienteId, segredo, refresh: "refresh-teste-planilhas", servico: "planilhas", planilhas });
const documento = { spreadsheetId: id, properties: { title: "Controle de materiais" }, sheets: [{ properties: { sheetId: 0, title: "Materiais", gridProperties: { rowCount: 1000, columnCount: 26 } } }, { properties: { sheetId: 8, title: "Equipe d'água", gridProperties: { rowCount: 30, columnCount: 3 } } }, { properties: { sheetId: 10, title: "Gráfico", sheetType: "OBJECT" } }] };
const valores = { range: "Materiais!A1:T100", values: [["Material", "Quantidade"], ["Papel", "3"], ["Luvas", "5"]] };
const resposta = (dados) => new Response(JSON.stringify(dados), { headers: { "content-type": "application/json" } });

test("Planilhas da empresa agrupa documentos completos e conserva o link compartilhado sem gid", async () => {
  const { planilhasDasAderencias } = await vite.ssrLoadModule("/src/modulos/escritorio/planilhasDaEmpresa.ts");
  const registro = (nome, sheetUrl, tabUrl = "") => Object.freeze({ nome, sheetUrl, tabUrl });
  const original = registro("Controle de materiais", `${link(id)}?usp=sharing&resourcekey=chave-teste&gid=0#gid=0`, link(id, 8));
  const grupo = (...planilhas) => ({ planilhas });
  const config = { grupos: [
    grupo(original, registro("Outra aba do mesmo arquivo", link(id, 7))),
    grupo(registro("Segundo arquivo", link(outro, 3)), original, registro("URL inválida", "https://outro.example/spreadsheets/d/arquivo/edit")),
    grupo(registro("Publicado na web", "https://docs.google.com/spreadsheets/d/e/exemplo/pubhtml")),
  ], planilhas: [original] };
  const antes = JSON.stringify(config);
  assert.deepEqual(planilhasDasAderencias(config), [
    { id, nome: "Controle de materiais", url: `${link(id)}?usp=sharing&resourcekey=chave-teste`, previa: `https://docs.google.com/spreadsheets/d/${id}/preview?resourcekey=chave-teste` },
    { id: outro, nome: "Segundo arquivo", url: link(outro), previa: `https://docs.google.com/spreadsheets/d/${outro}/preview` },
  ]);
  assert.equal(JSON.stringify(config), antes);
  assert.equal(planilhasDasAderencias({ grupos: [], planilhas: [original] }).length, 1);
});

test("o catálogo da empresa preserva os ajustes de planilhas e só lê o Robô para contas autorizadas", async (t) => {
  const { carregarPlanilhasEmpresa } = await vite.ssrLoadModule("/src/modulos/escritorio/catalogoPlanilhasEmpresa.ts");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const { aderenciasPonte } = await vite.ssrLoadModule("/src/ponte/aderencias.ts");
  const antes = useAuth.getState();
  t.after(() => useAuth.setState(antes, true));
  const api = t.mock.method(globalThis, "fetch", async (url, opcoes) => {
    assert.match(String(url), /acao=planilhas-catalogo$/);
    assert.equal(opcoes.method, "GET");
    return resposta({ ajustes: [] });
  });
  const leitura = t.mock.method(aderenciasPonte, "configuracao", async (signal) => {
    assert.equal(signal.aborted, false);
    return { configuracao: { grupos: [], planilhas: [{ nome: "Teste", sheetUrl: link(id) }] } };
  });
  useAuth.setState({ token: "teste", usuario: { id: 2, perfil: "gerencia", roboAderencias: false } });
  await carregarPlanilhasEmpresa();
  assert.equal(leitura.mock.callCount(), 0);
  assert.equal(api.mock.callCount(), 0);
  useAuth.setState({ usuario: { id: 2, perfil: "gerencia", roboAderencias: true } });
  await carregarPlanilhasEmpresa();
  assert.equal(leitura.mock.callCount(), 1);
  assert.equal(api.mock.callCount(), 1);
});

test("ajustes do Kyro valem para o menu sem alterar a lista do Robô", async () => {
  const { combinarPlanilhas, planilhaPeloLink } = await vite.ssrLoadModule("/src/modulos/escritorio/planilhasDaEmpresa.ts");
  const { GerenciarPlanilhasEmpresa } = await vite.ssrLoadModule("/src/modulos/escritorio/GerenciarPlanilhasEmpresa.tsx");
  const manual = { ...planilhaPeloLink("Cadastro manual", link("documento_manual")), id: "kyro:exemplo", origemRobo: false, ativa: true };
  const originais = [planilhaPeloLink("Do Robô", link(id)), planilhaPeloLink("Outro arquivo", link(outro))];
  const ajustes = [{ ...originais[0], nome: "Nome editado", ativa: false, origemRobo: true }, { id: outro, oculta: true }, manual];
  const listaDoDono = combinarPlanilhas(originais, ajustes, true);
  assert.deepEqual(listaDoDono.map(({ nome, ativa }) => [nome, ativa]), [["Nome editado", false], ["Cadastro manual", true]]);
  assert.deepEqual(combinarPlanilhas(originais, ajustes, false), [manual]);
  assert.deepEqual(combinarPlanilhas(originais, [{ ...ajustes[0], ativa: true }], false).map(({ nome }) => nome), ["Outro arquivo", "Nome editado"]);
  assert.deepEqual(combinarPlanilhas([], [{ ...ajustes[0], ativa: true }], false), []);
  assert.deepEqual(originais.map(({ nome }) => nome), ["Do Robô", "Outro arquivo"]);
  const painel = renderToStaticMarkup(createElement(GerenciarPlanilhasEmpresa, { token: "dono", planilhas: listaDoDono }));
  assert.match(painel, /Adicionar planilha/);
  assert.match(painel, /Reativar Nome editado/);
  assert.match(painel, /Editar Cadastro manual/);
  assert.match(painel, /Inativar Cadastro manual/);
  assert.match(painel, /Remover Cadastro manual/);
});

test("links de planilhas validam domínio, identificador, quantidade e aba antes de acessar a rede", () => {
  assert.deepEqual(google.fontesDasPlanilhas(`${link(id, 0)}\n${link(id, 0)}\n${link(outro)}`), [{ id, gid: 0 }, { id: outro }]);
  for (const ruim of ["http://docs.google.com/spreadsheets/d/" + id, "https://docs.google.com.evil.example/spreadsheets/d/" + id, "https://eu:senha@docs.google.com/spreadsheets/d/" + id, "https://docs.google.com/spreadsheets/d/e/pubhtml", "http://localhost/a", link(id, "-1"), link(id, "1e4")]) assert.throws(() => google.fontesDasPlanilhas(ruim), /planilhas_/);
  assert.throws(() => google.fontesDasPlanilhas(""), /quantidade_invalida/);
  assert.throws(() => google.fontesDasPlanilhas(Array(6).fill(link(id)).join("\n")), /quantidade_invalida/);
});

test("autorização de Planilhas pede apenas leitura e preserva credenciais ao alterar os links", async () => {
  let chamadas = 0;
  const texto = await google.credencialDasPlanilhas({ clienteId, segredo, links: link(id) }, null, async (cliente, chave, escopos, nome) => {
    chamadas++;
    assert.equal(cliente, clienteId); assert.equal(chave, segredo); assert.equal(nome, "Google Planilhas");
    assert.deepEqual(escopos, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
    return { clienteId, segredo, refresh: "refresh-teste" };
  });
  const atualizado = await google.credencialDasPlanilhas({ clienteId, segredo: "", links: link(outro, 8) }, texto, async () => assert.fail("Não deve autorizar de novo para trocar links"));
  assert.equal(chamadas, 1);
  assert.equal(JSON.parse(atualizado).refresh, "refresh-teste");
  assert.deepEqual(JSON.parse(atualizado).planilhas, [{ id: outro, gid: 8 }]);
  const publica = google.configuracaoPublicaPlanilhas(atualizado);
  assert.equal(publica.links, link(outro, 8));
  assert.ok(!JSON.stringify(publica).includes(segredo) && !JSON.stringify(publica).includes("refresh-teste"));
  await assert.rejects(google.credencialDasPlanilhas({ clienteId: "outro.apps.googleusercontent.com", links: link(id) }, texto), /autorizacao_invalida/);
  assert.throws(() => google.lerCredencialPlanilhas(JSON.stringify({ clienteId, segredo, refresh: "outro" })), /credencial_invalida/);
});

test("login Google Planilhas verifica estado e PKCE sem ativar o Google Workspace", async (t) => {
  const fetchAntes = globalThis.fetch, abrirAntes = plataforma.abrirNoNavegador;
  t.after(() => { globalThis.fetch = fetchAntes; plataforma.abrirNoNavegador = abrirAntes; });
  let login, token, retorno;
  const status = [];
  plataforma.abrirNoNavegador = (href) => {
    login = new URL(href);
    retorno = (async () => {
      const callback = new URL(login.searchParams.get("redirect_uri"));
      callback.search = new URLSearchParams({ state: "errado", code: "teste" });
      status.push((await fetchAntes(callback)).status);
      callback.search = new URLSearchParams({ state: login.searchParams.get("state"), code: "teste" });
      status.push((await fetchAntes(callback)).status);
    })();
  };
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(String(url), "https://oauth2.googleapis.com/token");
    token = new URLSearchParams(opcoes.body);
    return resposta({ access_token: "acesso-falso-planilhas", refresh_token: "refresh-falso-planilhas", expires_in: 3600 });
  };
  const texto = await google.credencialDasPlanilhas({ clienteId, segredo, links: link(id) });
  await retorno;
  assert.deepEqual(status, [404, 200]);
  assert.equal(login.searchParams.get("scope"), "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.equal(login.searchParams.get("code_challenge"), createHash("sha256").update(token.get("code_verifier")).digest("base64url"));
  assert.equal(token.get("redirect_uri"), login.searchParams.get("redirect_uri"));
  assert.equal(JSON.parse(texto).servico, "planilhas");
  const { conexaoEmTestes } = await vite.ssrLoadModule("/src/utilitarios/disponibilidadeConexoes.ts");
  assert.equal(conexaoEmTestes("google"), true);
  assert.equal(conexaoEmTestes("planilhas"), false);
});

let dados;
test("consulta preserva posições e formatação, limita a prévia e sinaliza falhas sem inventar dados", async () => {
  const caminhos = [];
  dados = await google.lerPlanilhasGoogle(credencial([{ id }, { id: outro }]), async (_, caminho) => {
    caminhos.push(caminho);
    if (caminho.includes(outro)) throw new Error("http_403 detalhe privado");
    if (caminho.includes("/values/")) return valores;
    return documento;
  });
  assert.equal(dados.planilhas[0].titulo, documento.properties.title);
  assert.equal(dados.planilhas[0].abas.length, 2);
  assert.deepEqual(dados.planilhas[0].previa.valores, valores.values);
  assert.equal(dados.planilhas[0].previa.limitada, true);
  assert.equal(dados.planilhas[1].previa, null);
  assert.equal(dados.planilhas[1].erro, "planilhas_sem_permissao");
  assert.ok(caminhos.some((c) => decodeURIComponent(c).includes("'Materiais'!A1:T100") && c.includes("FORMATTED_VALUE")));
  const aba = await google.lerAbaPlanilhaGoogle(credencial(), id, 8, async (_, caminho) => {
    if (caminho.includes("/values/")) { assert.ok(decodeURIComponent(caminho).includes("'Equipe d''água'!A1:C30")); return { range: "Equipe!A1:C30", values: [[0, false, null, '<img src=x onerror="roubar()">']] }; }
    return documento;
  });
  assert.deepEqual(aba.previa.valores[0], ["0", "false", "", '<img src=x onerror="roubar()">']);
  await assert.rejects(google.lerAbaPlanilhaGoogle(credencial(), outro, 0, async () => assert.fail("Planilha não configurada")), /nao_configurada/);
  await assert.rejects(google.lerPlanilhasGoogle(credencial(), async () => { throw new Error("http_404"); }), /nao_encontrada/);
  await assert.rejects(google.lerPlanilhasGoogle(credencial(), async (_, c) => c.includes("/values/") ? {} : documento), /resposta_invalida/);
  const vazia = await google.lerPlanilhasGoogle(credencial(), async (_, c) => c.includes("/values/") ? { range: "Materiais!A1:T100" } : documento);
  assert.deepEqual(vazia.planilhas[0].previa.valores, []);
});

test("catálogo, ilha e links diretos respeitam o perfil e a retirada das conexões", async (t) => {
  const { default: Conexoes } = await vite.ssrLoadModule("/src/modulos/conexoes/Conexoes.tsx");
  const { VisaoConexoes } = await vite.ssrLoadModule("/src/janelas/ilha/Visoes.tsx");
  const { JanelaConexao } = await vite.ssrLoadModule("/src/modulos/conexoes/JanelaConexao.tsx");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useInterface } = await vite.ssrLoadModule("/src/estado/interface.ts");
  const { useComunicacao } = await vite.ssrLoadModule("/src/estado/comunicacao.ts");
  const { T } = await vite.ssrLoadModule("/src/textos/textos.ts");
  const { conexaoVisivelPara } = await vite.ssrLoadModule("/src/utilitarios/visibilidadeConexoes.ts");
  const auth = useAuth.getInitialState(), ui = useInterface.getInitialState();
  const antes = auth.usuario, parametrosAntes = ui.parametros;
  const documentoAntes = Object.getOwnPropertyDescriptor(globalThis, "document");
  globalThis.document = { body: {}, getElementById: () => null };
  t.after(() => {
    auth.usuario = antes; ui.parametros = parametrosAntes;
    if (documentoAntes) Object.defineProperty(globalThis, "document", documentoAntes); else delete globalThis.document;
  });
  const configuracaoAntes = JSON.stringify(useComunicacao.getState().conexoes);
  const ocultas = ["github", "vercel", "railway", "supabase", "cloudflare", "resend", "n8n", "linear", "stripe", "cripto", "strava", "reddit", "discord"];
  for (const perfil of ["gerencia", "dono"]) {
    auth.usuario = { id: 7, perfil, nome: "Pessoa de teste" };
    ui.parametros = { servico: "github" };
    const pagina = renderToStaticMarkup(createElement(Conexoes));
    const ilha = renderToStaticMarkup(createElement(VisaoConexoes, { aberta: null, aoSelecionar() {} }));
    for (const servico of ocultas) {
      assert.equal(conexaoVisivelPara(auth.usuario, servico), perfil === "dono");
      for (const html of [pagina, ilha]) assert.equal(html.includes(T.conexoes.servicos[servico].nome), perfil === "dono", `${perfil}/${servico}`);
    }
    assert.ok(pagina.includes(T.conexoes.servicos.calendario.nome));
    for (const servico of ["outlook", "teams", "planner", "planilhas"]) {
      const nome = T.conexoes.servicos[servico].nome;
      assert.equal(pagina.includes(nome), false);
      assert.equal(ilha.includes(nome), false);
      assert.equal(renderToStaticMarkup(createElement(VisaoConexoes, { aberta: servico, aoSelecionar() {} })).includes(nome), false);
      assert.equal(renderToStaticMarkup(createElement(JanelaConexao, { janela: { id: servico, minimizada: false } })), "");
    }
    if (perfil === "gerencia") {
      assert.doesNotMatch(pagina, /role="dialog"[^>]*GitHub/);
      assert.doesNotMatch(renderToStaticMarkup(createElement(VisaoConexoes, { aberta: "github", aoSelecionar() {} })), /GitHub/);
      assert.equal(renderToStaticMarkup(createElement(JanelaConexao, { janela: { id: "github", minimizada: false } })), "");
    }
  }
  assert.equal(JSON.stringify(useComunicacao.getState().conexoes), configuracaoAntes);
});

test("perfil gerência não consulta os serviços ocultos na ponte nem em segundo plano", async (t) => {
  const { conexoesPonte } = await vite.ssrLoadModule("/src/ponte/conexoesReais.ts");
  const { atualizarConexaoAgora } = await vite.ssrLoadModule("/src/servicos/servicos.ts");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const anterior = useAuth.getState(), fetchAntes = globalThis.fetch;
  let chamadas = 0;
  t.after(() => { useAuth.setState(anterior, true); globalThis.fetch = fetchAntes; });
  globalThis.fetch = async () => { chamadas++; return resposta({ ok: true }); };
  useAuth.setState({ usuario: { id: 7, perfil: "gerencia" }, token: "teste" });
  await assert.rejects(conexoesPonte.ler("github"), /conexao_oculta_perfil/);
  await atualizarConexaoAgora("github");
  assert.equal(chamadas, 0);
  useAuth.setState({ usuario: { id: 1, perfil: "dono" }, token: "dono-teste" });
  await assert.rejects(conexoesPonte.ler("planilhas"), /conexao_oculta_perfil/);
  await assert.rejects(conexoesPonte.lerAbaPlanilha(id, 0), /conexao_oculta_perfil/);
  await atualizarConexaoAgora("planilhas");
  assert.equal(chamadas, 0);
  await conexoesPonte.ler("github");
  assert.equal(chamadas, 1);
});

test("dados de planilhas são exibidos como texto e erros permanecem distintos de uma aba vazia", async () => {
  const { ConteudoPlanilhas } = await vite.ssrLoadModule("/src/modulos/conexoes/ConteudoPlanilhas.tsx");
  const html = renderToStaticMarkup(createElement(ConteudoPlanilhas, { dados, filtro: "" }));
  for (const trecho of ["Controle de materiais", "Consultar aba", "Papel", "Luvas"]) assert.ok(html.includes(trecho), trecho);
  assert.match(html, /sua conta Google não tem acesso/i);
  assert.match(html, /100 linhas e 20 colunas/);
  assert.match(html, /Abrir no Google/);
  assert.doesNotMatch(html, /detalhe privado/);
  const perigosa = structuredClone(dados);
  perigosa.planilhas[0].previa.valores = [['<img src=x onerror="roubar()">']];
  const seguro = renderToStaticMarkup(createElement(ConteudoPlanilhas, { dados: perigosa, filtro: "" }));
  assert.doesNotMatch(seguro, /<img src="?x|<script/);
  assert.match(seguro, /&lt;img/);
});
