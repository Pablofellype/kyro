import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { criarServidorDeTeste } from "./vite-para-testes.mjs";

globalThis.BroadcastChannel = undefined;
const vite = await criarServidorDeTeste({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } });
after(() => vite.close());
const microsoft = await vite.ssrLoadModule("/servidor/outlook.ts");
const corporativo = await vite.ssrLoadModule("/servidor/microsoftCorporativo.ts");
const { plataforma } = await vite.ssrLoadModule("/servidor/plataforma/index.ts");
const clienteId = "12345678-1234-4234-8234-123456789abc";
const credencial = (servico, refresh = "credencial-de-teste") => JSON.stringify({ clienteId, refresh, servico });
const resposta = (dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });

test("login Microsoft valida estado e PKCE e mantém os escopos separados por conexão", async (t) => {
  const abrirAntes = plataforma.abrirNoNavegador, fetchAntes = globalThis.fetch;
  t.after(() => { plataforma.abrirNoNavegador = abrirAntes; globalThis.fetch = fetchAntes; });
  for (const servico of ["outlook", "teams", "planner"]) {
    let urlLogin, retorno, troca;
    const statusRetorno = [];
    plataforma.abrirNoNavegador = (href) => {
      urlLogin = new URL(href);
      retorno = (async () => {
        const ruim = new URL(urlLogin.searchParams.get("redirect_uri"));
        ruim.search = new URLSearchParams({ code: "codigo-teste", state: "incorreto" });
        statusRetorno.push((await fetchAntes(ruim)).status);
        const correta = new URL(urlLogin.searchParams.get("redirect_uri"));
        correta.search = new URLSearchParams({ code: "codigo-teste", state: urlLogin.searchParams.get("state") });
        statusRetorno.push((await fetchAntes(correta)).status);
      })();
    };
    globalThis.fetch = async (url, opcoes) => {
      troca = { url: String(url), corpo: new URLSearchParams(opcoes.body) };
      return resposta({ access_token: `acesso-${servico}`, refresh_token: `refresh-${servico}`, expires_in: 3600 });
    };
    const c = await microsoft.autorizarMicrosoft(clienteId, servico);
    await retorno;
    assert.deepEqual(statusRetorno, [404, 200]);
    assert.equal(urlLogin.searchParams.get("code_challenge_method"), "S256");
    assert.equal(urlLogin.searchParams.get("code_challenge"), createHash("sha256").update(troca.corpo.get("code_verifier")).digest("base64url"));
    assert.equal(troca.corpo.get("redirect_uri"), urlLogin.searchParams.get("redirect_uri"));
    assert.equal(troca.corpo.get("scope"), urlLogin.searchParams.get("scope"));
    const escopos = urlLogin.searchParams.get("scope").split(" ");
    assert.ok(escopos.includes("User.Read"));
    assert.ok(!escopos.some((s) => /Write|Send|All/.test(s)));
    if (servico === "outlook") assert.deepEqual(escopos.slice(-2), ["Mail.Read", "Calendars.Read"]);
    else {
      assert.equal(urlLogin.pathname, "/organizations/oauth2/v2.0/authorize");
      assert.equal(escopos.at(-1), servico === "teams" ? "Chat.Read" : "Tasks.Read");
      assert.ok(!escopos.includes("Mail.Read"));
    }
    assert.equal(c.servico, servico);
    assert.equal(c.refresh, `refresh-${servico}`);
  }
});

test("tokens Microsoft renovam uma vez por conexão e recusam links externos antes de enviar credenciais", async (t) => {
  const fetchAntes = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchAntes; });
  const chamadas = [];
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push({ url: String(url), opcoes });
    if (String(url).startsWith("https://login.microsoftonline.com/")) {
      const scope = new URLSearchParams(opcoes.body).get("scope");
      return resposta({ access_token: scope.includes("Chat.Read") ? "token-teams" : "token-planner", expires_in: 3600 });
    }
    return resposta({ ok: true });
  };
  const c = microsoft.lerCredencialMicrosoft(credencial("teams", "nova"), "teams");
  await Promise.all([microsoft.apiMicrosoft(c, "/me"), microsoft.apiMicrosoft(c, "/me/chats")]);
  assert.equal(chamadas.filter((x) => x.url.includes("/token")).length, 1);
  assert.ok(chamadas.filter((x) => x.url.includes("graph.microsoft.com")).every((x) => x.opcoes.headers.authorization === "Bearer token-teams" && x.opcoes.redirect === "error"));
  const planner = microsoft.lerCredencialMicrosoft(credencial("planner", "nova"), "planner");
  await microsoft.apiMicrosoft(planner, "/me/planner/tasks");
  assert.equal(chamadas.filter((x) => x.url.includes("/token")).length, 2);
  assert.equal(chamadas.at(-1).opcoes.headers.authorization, "Bearer token-planner");
  const antes = chamadas.length;
  for (const url of ["https://evil.example/v1.0/me", "https://graph.microsoft.com.evil.example/v1.0/me", "https://graph.microsoft.com/beta/me", "https://u:p@graph.microsoft.com/v1.0/me"]) await assert.rejects(microsoft.apiMicrosoft(c, url), /microsoft_resposta_invalida/);
  assert.equal(chamadas.length, antes);
  globalThis.fetch = async () => resposta({ error: { message: "detalhe privado" } }, 403);
  await assert.rejects(microsoft.apiMicrosoft(c, "/me"), /^Error: microsoft_sem_permissao$/);
  assert.throws(() => microsoft.lerCredencialMicrosoft(credencial("outlook"), "teams"), /autorizacao_diferente/);
  assert.equal(microsoft.lerCredencialMicrosoft(JSON.stringify({ clienteId, refresh: "legado" }), "outlook").refresh, "legado");
  assert.throws(() => microsoft.lerCredencialMicrosoft("segredo que não pode aparecer no erro", "teams"), /^Error: credencial_invalida$/);
  await assert.rejects(microsoft.autorizarMicrosoft("invalido", "teams"), /cliente_id_invalido/);
});

const perfil = { id: "eu", displayName: "Pessoa", mail: "pessoa@empresa.example", userPrincipalName: "pessoa@empresa.example" };
const mensagem = { id: "m1", messageType: "message", createdDateTime: "2026-11-15T12:00:00Z", from: { user: { id: "ana", displayName: "Ana" } }, body: { contentType: "html", content: '<p>Olá &amp; bom trabalho <at id="0">Pessoa</at></p><script>roubar()</script>' }, mentions: [{ mentioned: { user: { id: "eu" } } }], webUrl: "https://evil.example/roubar" };
let dadosTeams;
test("Teams consulta somente conversas da conta, transforma HTML em texto e preserva falhas parciais", async () => {
  const caminhos = [];
  dadosTeams = await corporativo.lerTeams(credencial("teams"), async (_, caminho) => {
    caminhos.push(caminho);
    if (caminho.startsWith("/me?")) return perfil;
    if (caminho.startsWith("/me/chats?")) return { value: [{ id: "chat 1", members: [{ userId: "eu", displayName: "Pessoa" }, { userId: "ana", displayName: "Ana" }], chatType: "oneOnOne", webUrl: "javascript:alert(1)" }, { id: "chat2", topic: "Operação", chatType: "group" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/chats?mais=1" };
    if (caminho.startsWith("/chats/chat%201/")) return { value: [mensagem, { ...mensagem, id: "m2", from: { user: { id: "eu", displayName: "Pessoa" } } }, { ...mensagem, id: "apagada", deletedDateTime: "2026-11-15T13:00:00Z" }, { ...mensagem, id: "evento", messageType: "systemEventMessage" }] };
    throw new Error("microsoft_sem_permissao");
  });
  assert.equal(dadosTeams.conta, perfil.mail);
  assert.equal(dadosTeams.conversas[0].titulo, "Ana");
  assert.equal(dadosTeams.conversas[1].erro, "microsoft_sem_permissao");
  assert.equal(dadosTeams.mensagens.length, 2);
  assert.equal(dadosTeams.mensagens[0].texto, "Olá & bom trabalho Pessoa");
  assert.ok(dadosTeams.mensagens[0].mencionaMe);
  assert.ok(dadosTeams.mensagens[1].minha);
  assert.ok(dadosTeams.mensagens[0].link.startsWith("https://teams.microsoft.com/"));
  assert.equal(dadosTeams.parcial, true);
  assert.ok(!Object.hasOwn(dadosTeams, "naoLidas"));
  assert.equal(caminhos.filter((c) => c.includes("/messages?")).length, 2);
  assert.equal(corporativo.textoDaMensagemTeams("&#x110000;&#55296;A &lt;b&gt; B"), "A <b> B");
  await assert.rejects(corporativo.lerTeams(credencial("planner"), async () => assert.fail("Não deveria consultar")), /autorizacao_diferente/);
  await assert.rejects(corporativo.lerTeams(credencial("teams"), async () => ({})), /resposta_invalida/);
});

const tarefa = { id: "t1", planId: "plano1", title: "Conferir entrega", percentComplete: 0, priority: 3, createdDateTime: "2026-11-13T12:00:00Z", dueDateTime: "2026-11-14T12:00:00Z" };
let dadosPlanner;
test("Planner segue a paginação, ordena pendências e mantém tarefas quando o nome do plano falha", async () => {
  const caminhos = [];
  dadosPlanner = await corporativo.lerPlanner(credencial("planner"), async (_, caminho) => {
    caminhos.push(caminho);
    if (caminho.startsWith("/me?")) return perfil;
    if (caminho === "/me/planner/tasks") return { value: [tarefa], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/planner/tasks?pagina=2" };
    if (caminho.includes("pagina=2")) return { value: [{ ...tarefa, id: "t2", planId: "plano2", title: "Entrega concluída", percentComplete: 100 }, { ...tarefa, id: "t3", title: "Revisar pedidos", percentComplete: 50, dueDateTime: null }] };
    if (caminho === "/planner/plans/plano1") return { title: "Operação" };
    throw new Error("microsoft_sem_permissao");
  });
  assert.deepEqual(dadosPlanner.tarefas.map((t) => t.id), ["t1", "t3", "t2"]);
  assert.equal(dadosPlanner.tarefas[0].plano, "Operação");
  assert.equal(dadosPlanner.tarefas[2].plano, "Plano indisponível");
  assert.equal(dadosPlanner.planosIndisponiveis, 1);
  assert.equal(dadosPlanner.parcial, false);
  assert.ok(dadosPlanner.tarefas[0].link.startsWith("https://tasks.office.com/empresa.example/Home/Task/"));
  assert.equal(caminhos.filter((c) => c === "/planner/plans/plano1").length, 1);
  const mock = (valor) => async (_, caminho) => caminho.startsWith("/me?") ? perfil : valor;
  await assert.rejects(corporativo.lerPlanner(credencial("planner"), mock({ value: [{ ...tarefa, percentComplete: "50" }] })), /resposta_invalida/);
  await assert.rejects(corporativo.lerPlanner(credencial("planner"), mock({ value: [], "@odata.nextLink": "/me/planner/tasks" })), /resposta_invalida/);
});

test("telas Microsoft filtram os dados reais e não renderizam HTML ou links de terceiros", async () => {
  const { ConteudoTeams, ConteudoPlanner } = await vite.ssrLoadModule("/src/modulos/conexoes/ConteudoMicrosoft.tsx");
  const men = renderToStaticMarkup(createElement(ConteudoTeams, { dados: dadosTeams, aba: "mencoes", filtro: "" }));
  assert.match(men, /Ana/);
  assert.doesNotMatch(men, /roubar\(\)|evil\.example|<script|>Pessoa<\/strong>/);
  assert.match(men, /Consulta parcial/);
  const conversas = renderToStaticMarkup(createElement(ConteudoTeams, { dados: dadosTeams, aba: "conversas", filtro: "Operação" }));
  assert.match(conversas, /administrador da empresa/);
  assert.doesNotMatch(conversas, />Ana</);
  const planner = renderToStaticMarkup(createElement(ConteudoPlanner, { dados: dadosPlanner, aba: "atrasadas", filtro: "", agora: new Date("2026-11-15T15:00:00Z") }));
  assert.match(planner, /Conferir entrega|Prazo vencido/);
  assert.doesNotMatch(planner, /Entrega concluída|Revisar pedidos/);
  assert.match(planner, /planos Premium/);
  assert.match(planner, /<progress[^>]+value="0"/);
});

test("catálogo e restauração de contas antigas incluem Teams e Planner sem ligá-los automaticamente", async () => {
  const { useComunicacao, SERVICOS } = await vite.ssrLoadModule("/src/estado/comunicacao.ts");
  const { SERVICOS: backend } = await vite.ssrLoadModule("/servidor/conexoes.ts");
  const { resumoDe, ocorrenciasDe, SERVICOS_DO_MICROSOFT } = await vite.ssrLoadModule("/src/ponte/conexoesReais.ts");
  const { T } = await vite.ssrLoadModule("/src/textos/textos.ts");
  const anterior = useComunicacao.getState();
  const storageAnterior = useComunicacao.persist.getOptions().storage;
  useComunicacao.persist.setOptions({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  try {
    useComunicacao.getState().substituir({ conexoes: [{ id: "outlook", ligada: true, chaveSalva: true, status: "conectado" }] });
    for (const servico of ["teams", "planner"]) {
      assert.ok(SERVICOS.includes(servico) && backend.includes(servico) && SERVICOS_DO_MICROSOFT.includes(servico));
      const c = useComunicacao.getState().conexoes.find((c) => c.id === servico);
      assert.equal(c.ligada, false);
      assert.equal(c.chaveSalva, false);
      assert.equal(c.status, "sem_chave");
      assert.ok(T.conexoes.guias[servico].length > 0);
      assert.ok(T.janelaConexao.abas[servico]);
    }
    assert.match(resumoDe("teams", dadosTeams), /Consulta parcial/);
    assert.equal(ocorrenciasDe("teams", dadosTeams).length, 1);
    assert.match(resumoDe("planner", dadosPlanner), /2 tarefas abertas/);
  } finally { useComunicacao.setState(anterior, true); useComunicacao.persist.setOptions({ storage: storageAnterior }); }
});

test("resposta de Teams da conta anterior é descartada após trocar a sessão", async (t) => {
  const { conexoesPonte } = await vite.ssrLoadModule("/src/ponte/conexoesReais.ts");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const estadoAntes = useAuth.getState(), fetchAntes = globalThis.fetch;
  t.after(() => { useAuth.setState(estadoAntes, true); globalThis.fetch = fetchAntes; });
  let entregar;
  globalThis.fetch = () => new Promise((resolve) => { entregar = resolve; });
  useAuth.setState({ usuario: { id: 7, perfil: "gerencia" }, token: "sessao-7" });
  const consulta = conexoesPonte.ler("teams");
  useAuth.setState({ usuario: { id: 8, perfil: "gerencia" }, token: "sessao-8" });
  entregar(resposta(dadosTeams));
  await assert.rejects(consulta, /conexao_sessao_alterada/);
});
