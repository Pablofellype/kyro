import test, { after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { criarServidorDeTeste } from "./vite-para-testes.mjs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const canalAnterior = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} close() {} };
after(() => { globalThis.BroadcastChannel = canalAnterior; });

const opcoes = { configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true } };
const vite = await criarServidorDeTeste(opcoes);
after(() => vite.close());
const { LimiteDeErro } = await vite.ssrLoadModule("/src/componentes/LimiteDeErro.tsx");
const { circuloDoTema, animarTrocaDeTema } = await vite.ssrLoadModule("/src/utilitarios/transicaoTema.ts");

test("Importados aparece na área Pessoal do dono e preserva opções reutilizáveis e filtros por moeda", async (t) => {
  const { BarraLateral } = await vite.ssrLoadModule("/src/janelas/sistema/BarraLateral.tsx");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useInterface } = await vite.ssrLoadModule("/src/estado/interface.ts");
  const { useImportados, filtrarImportados, listarOpcoesImportados } = await vite.ssrLoadModule("/src/estado/importados.ts");
  const { lerBackup } = await vite.ssrLoadModule("/src/utilitarios/backupValido.ts");
  const auth = useAuth.getInitialState(), ui = useInterface.getInitialState();
  const usuarioAnterior = auth.usuario, areaAnterior = ui.area;
  const estado = useImportados.getState();
  const armazenamentoAnterior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const itens = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (nome) => itens.get(nome) ?? null, setItem: (nome, valor) => itens.set(nome, valor) } });
  t.after(() => {
    auth.usuario = usuarioAnterior; ui.area = areaAnterior;
    useImportados.setState(estado);
    if (armazenamentoAnterior) Object.defineProperty(globalThis, "localStorage", armazenamentoAnterior);
    else delete globalThis.localStorage;
  });
  auth.usuario = { id: 1, perfil: "dono" };
  ui.area = "pessoal";
  const barra = () => renderToStaticMarkup(createElement(BarraLateral, { recolhida: false }));
  assert.match(barra(), /data-rota="importados"/);
  ui.area = "empresa";
  assert.doesNotMatch(barra(), /data-rota="importados"/);
  auth.usuario = { id: 2, perfil: "gerencia" };
  ui.area = "pessoal";
  assert.doesNotMatch(barra(), /data-rota="importados"/);

  const { adicionarOpcao, salvarProduto, excluirProduto } = useImportados.getState();
  assert.equal(adicionarOpcao("categoria", "Eletrônicos"), true);
  assert.equal(adicionarOpcao("categoria", " eletronicos "), false);
  const base = { nome: "Câmera compacta", link: "https://loja.example/camera", foto: "", preco: 7250, moeda: "CNY", categoria: "eletronicos", plataforma: "Alibaba", fornecedor: "Fornecedor A", origem: "Shenzhen", nota: "Caixa pequena" };
  assert.equal(salvarProduto(base), true);
  assert.equal(salvarProduto({ ...base, nome: "Câmera USB", preco: 7000, moeda: "USD" }), true);
  assert.equal(salvarProduto({ ...base, link: "javascript:alert(1)" }), false);
  const { produtos, opcoes } = useImportados.getState();
  const filtros = { busca: "camera shenzhen", moeda: "CNY", minimo: 7000, maximo: 8000, categoria: "eletronicos", plataforma: "Alibaba", origem: "", fornecedor: "Fornecedor A" };
  const filtrados = filtrarImportados(produtos, filtros);
  assert.deepEqual(filtrados.map((produto) => produto.nome), ["Câmera compacta"]);
  assert.equal(filtrados[0].categoria, "Eletrônicos");
  assert.equal(salvarProduto({ ...base, preco: 9000 }, filtrados[0].id), true);
  assert.deepEqual(filtrarImportados(useImportados.getState().produtos, filtros), []);
  assert.equal(JSON.parse(itens.get("niko:importados")).state.produtos.find((produto) => produto.id === filtrados[0].id).preco, 9000);
  excluirProduto(filtrados[0].id);
  assert.deepEqual(listarOpcoesImportados(opcoes).fornecedor, ["Fornecedor A"]);
  const dados = { "niko:importados": JSON.stringify({ state: { produtos, opcoes }, version: 0 }) };
  assert.deepEqual(lerBackup({ tipo: "niko-backup", versao: 1, dados }).dados, dados);

  const fotoAntiga = "data:image/jpeg;base64,AAAA";
  const { fotos: _fotos, ...produtoLegado } = produtos[0];
  const legado = { "niko:importados": JSON.stringify({ state: { produtos: [{ ...produtoLegado, foto: fotoAntiga }], opcoes }, version: 0 }) };
  assert.deepEqual(lerBackup({ tipo: "niko-backup", versao: 1, dados: legado }).dados, legado);
  itens.set("niko:importados", legado["niko:importados"]);
  await useImportados.persist.rehydrate();
  assert.deepEqual(useImportados.getState().produtos[0].fotos, [fotoAntiga]);

  const salvarFornecedor = useImportados.getState().salvarFornecedor;
  const fornecedor = { nome: "Fornecedor A", categoria: "Eletrônicos", plataforma: "Alibaba", link: "https://loja.example/fornecedor" };
  assert.equal(salvarFornecedor(fornecedor), true);
  assert.equal(salvarFornecedor({ ...fornecedor, nome: " fornecedor a " }), false);
  assert.equal(salvarFornecedor({ ...fornecedor, nome: "Inválido", link: "javascript:alert(1)" }), false);
  const novo = useImportados.getState().fornecedores[0];
  assert.equal(salvarFornecedor({ ...fornecedor, nome: "Fornecedor atualizado" }, novo.id), true);
  const produto = useImportados.getState().produtos[0];
  assert.equal(produto.fornecedor, "Fornecedor atualizado");
  const fotos = [fotoAntiga, "data:image/jpeg;base64,BBBB", "data:image/jpeg;base64,CCCC", "data:image/jpeg;base64,DDDD"];
  assert.equal(salvarProduto({ ...produto, fotos }, produto.id), true);
  await useImportados.persist.rehydrate();
  assert.deepEqual(useImportados.getState().produtos[0].fotos, fotos.slice(0, 3));
  assert.equal(useImportados.getState().fornecedores[0].link, fornecedor.link);
  const atualizado = { "niko:importados": itens.get("niko:importados") };
  assert.deepEqual(lerBackup({ tipo: "niko-backup", versao: 1, dados: atualizado }).dados, atualizado);
});

test("rascunho de Importados conserva texto e fotos ao recarregar e o câmbio usa o preço original", async (t) => {
  const { guardarRascunhoProduto, lerRascunhoProduto } = await vite.ssrLoadModule("/src/modulos/importados/rascunhoProduto.ts");
  const { converterPrecoImportado } = await vite.ssrLoadModule("/src/modulos/importados/usarCambioImportados.ts");
  const anterior = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const itens = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => itens.set(chave, valor),
    removeItem: (chave) => itens.delete(chave),
  } });
  t.after(() => {
    if (anterior) Object.defineProperty(globalThis, "sessionStorage", anterior);
    else delete globalThis.sessionStorage;
  });
  const rascunho = { chave: "novo", produtoId: null, aberto: true, preco: "100,", dados: {
    nome: "Câmera", link: "https://loja.", fotos: ["data:image/jpeg;base64,AAAA"], moeda: "CNY",
    preco: null, categoria: "Eletrônicos", plataforma: "", fornecedor: "", origem: "", nota: "Buscar URL",
  } };
  guardarRascunhoProduto(1, rascunho);
  assert.deepEqual(lerRascunhoProduto(1), rascunho);
  assert.equal(lerRascunhoProduto(2), null);
  guardarRascunhoProduto(1, null);
  assert.equal(lerRascunhoProduto(1), null);

  const cambio = { taxas: { BRL: 1, USD: 5, CNY: 0.7, EUR: 6 }, atualizadaEm: "2026-11-22T18:00:00.000Z" };
  assert.equal(converterPrecoImportado(10_000, "CNY", "USD", cambio), 1400);
  assert.equal(converterPrecoImportado(10_000, "CNY", "BRL", cambio), 7000);
  assert.equal(converterPrecoImportado(10_000, "CNY", "CNY", cambio), 10_000);
  assert.equal(converterPrecoImportado(10_000, "CNY", "BRL", { ...cambio, taxas: { ...cambio.taxas, CNY: 0.8 } }), 8000);
  assert.equal(converterPrecoImportado(10_000, "CNY", "BRL"), null);
});

test("gerência acessa configurações pessoais sem receber acesso administrativo ou à área pessoal", async () => {
  const { podeAcessarRota, podeAcessarConfiguracao } = await vite.ssrLoadModule("/src/servicos/permissoes.ts");
  const gerencia = { perfil: "gerencia" };
  for (const rota of ["configuracoes", "atualizacao", "escritorio", "calendario", "conexoes", "whatsapp"]) {
    assert.equal(podeAcessarRota(gerencia, rota, "empresa"), true, rota);
    assert.equal(podeAcessarRota(gerencia, rota, "pessoal"), false, rota);
  }
  for (const rota of ["financas", "ia", "consumo", "agentes"]) assert.equal(podeAcessarRota(gerencia, rota, "empresa"), false, rota);
  for (const secao of ["geral", "aparencia", "ilha", "dock", "assistive", "sons", "atalhos", "privacidade", "sobre"]) {
    assert.equal(podeAcessarConfiguracao(gerencia, secao), true, secao);
    assert.equal(podeAcessarConfiguracao({ perfil: "visitante" }, secao), false, secao);
  }
  for (const secao of ["admin", "dados", "desenvolvedor", "agentes"]) {
    assert.equal(podeAcessarConfiguracao(gerencia, secao), false, secao);
    assert.equal(podeAcessarConfiguracao({ perfil: "dono" }, secao), true, secao);
  }
});

test("dono encontra conexões nas duas áreas e gerência mantém o acesso apenas na empresa", async (t) => {
  const janelaAnterior = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (janelaAnterior) Object.defineProperty(globalThis, "window", janelaAnterior);
    else delete globalThis.window;
  });
  const { BarraLateral } = await vite.ssrLoadModule("/src/janelas/sistema/BarraLateral.tsx");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useInterface } = await vite.ssrLoadModule("/src/estado/interface.ts");
  const { rotaDisponivelNaArea } = await vite.ssrLoadModule("/src/janelas/sistema/areas.ts");
  const { podeAcessarRota } = await vite.ssrLoadModule("/src/servicos/permissoes.ts");
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const auth = useAuth.getInitialState(), ui = useInterface.getInitialState();
  const usuarioAnterior = auth.usuario, areaAnterior = ui.area, rotaAnterior = ui.rota;
  t.after(() => { auth.usuario = usuarioAnterior; ui.area = areaAnterior; ui.rota = rotaAnterior; });

  for (const perfil of ["dono", "gerencia"]) {
    auth.usuario = { id: 7, nome: "Pessoa de teste", perfil };
    for (const area of ["pessoal", "empresa"]) {
      ui.area = area;
      for (const rota of ["conexoes", "whatsapp"]) {
        const permitido = perfil === "dono" || area === "empresa";
        assert.equal(rotaDisponivelNaArea(rota, area) && podeAcessarRota(auth.usuario, rota, area), permitido, `${perfil}/${area}/${rota}`);
        if (!permitido) continue;
        ui.rota = rota;
        for (const recolhida of [false, true]) {
          const menu = renderToStaticMarkup(createElement(BarraLateral, { recolhida }));
          assert.equal((menu.match(/data-rota="conexoes"/g) ?? []).length, 1);
          assert.equal((menu.match(/data-rota="whatsapp"/g) ?? []).length, 1);
          assert.match(menu, new RegExp(`data-rota="${rota}"[^>]*aria-current="page"`));
          assert.equal((menu.match(/aria-current="page"/g) ?? []).length, 1);
          if (perfil === "gerencia") assert.doesNotMatch(menu, /role="tab"[^>]*title="Pessoal"|title="Pessoal"[^>]*role="tab"/);
        }
      }
    }
  }
  for (const rota of ["conexoes", "whatsapp"]) {
    for (const area of ["pessoal", "empresa"]) assert.equal(podeAcessarRota({ perfil: "visitante" }, rota, area), false);
  }
});

test("menu e página de configurações da gerência mostram personalização e protegem links diretos", async (t) => {
  const nomes = ["window", "document", "getComputedStyle", "localStorage"];
  const anteriores = nomes.map((nome) => Object.getOwnPropertyDescriptor(globalThis, nome));
  globalThis.window = Object.assign(new EventTarget(), { location: { search: "" }, innerWidth: 1366, innerHeight: 768, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  globalThis.document = Object.assign(new EventTarget(), { documentElement: { dataset: { tema: "claro" } }, getElementById: () => null });
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "#ffffff" });
  const memoria = new Map();
  globalThis.localStorage = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) };
  const servidor = await criarServidorDeTeste({ ...opcoes, plugins: [{
    name: "portais-no-render-estatico", enforce: "pre",
    transform(codigo, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/componentes/basicos.tsx")) {
        return codigo.replace('import { createPortal } from "react-dom";', "const createPortal = (conteudo: ReactNode) => conteudo;");
      }
    },
  }] });
  t.after(() => servidor.close());
  t.after(() => nomes.forEach((nome, i) => {
    if (anteriores[i]) Object.defineProperty(globalThis, nome, anteriores[i]);
    else delete globalThis[nome];
  }));
  const { useAuth } = await servidor.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useInterface } = await servidor.ssrLoadModule("/src/estado/interface.ts");
  const { BarraLateral } = await servidor.ssrLoadModule("/src/janelas/sistema/BarraLateral.tsx");
  const { default: Configuracoes } = await servidor.ssrLoadModule("/src/modulos/configuracoes/Configuracoes.tsx");
  const auth = useAuth.getInitialState(), ui = useInterface.getInitialState();
  const usuarioAnterior = auth.usuario, areaAnterior = ui.area, parametrosAnteriores = ui.parametros, rotaAnterior = ui.rota;
  try {
    auth.usuario = { id: 7, nome: "Gerente", email: "gerente@example.com", perfil: "gerencia" };
    ui.area = "empresa";
    ui.rota = "appsEmpresa";
    ui.parametros = { app: "materiais" };
    for (const recolhida of [false, true]) {
      const menu = renderToStaticMarkup(createElement(BarraLateral, { recolhida }));
      assert.match(menu, /data-tour="ajustes"/);
      assert.match(menu, /title="Editar perfil"/);
      assert.doesNotMatch(menu, /class="barra-perfil"[^>]*disabled/);
      assert.match(menu, /barra-item-texto cortar">WhatsApp<\/span>/);
      assert.match(menu, /barra-item-texto cortar">Escritório<\/span>/);
      if (recolhida) {
        assert.match(menu, /aria-label="Sistemas"[^>]*aria-haspopup="dialog"/);
        assert.match(menu, /barra-item-texto cortar">Sistemas<\/span>/);
        assert.doesNotMatch(menu, /data-app=/);
        assert.equal((menu.match(/aria-current="page"/g) ?? []).length, 1);
      } else {
        assert.match(menu, /data-app="materiais" aria-current="page"/);
        assert.match(menu, /barra-apps-estado">Manutenção/);
        assert.doesNotMatch(menu, /Solicitações recebidas/);
        assert.doesNotMatch(menu, /barra-subitem/);
      }
    }
    for (const secao of ["geral", "aparencia", "ilha", "dock", "admin", "dados", "desenvolvedor"]) {
      ui.parametros = { secao };
      const html = renderToStaticMarkup(createElement(Configuracoes));
      assert.doesNotMatch(html, /Administração|Desenvolvedor|Contas autorizadas|Apagar todos os dados/);
      assert.match(html, />Aparência<|>Aparência<\/h2>/);
      if (["admin", "dados", "desenvolvedor"].includes(secao)) assert.match(html, /id="ajustes-cartao-titulo"[^>]*>Geral<\/h2>/);
      if (secao === "ilha") assert.match(html, /aria-label="Tamanho"/);
      if (secao === "dock") assert.match(html, /Opacidade/);
    }
    auth.usuario = { ...auth.usuario, perfil: "dono" };
    ui.parametros = { secao: "admin" };
    const dono = renderToStaticMarkup(createElement(Configuracoes));
    assert.match(dono, /Administração/);
    assert.match(dono, /Desenvolvedor/);
  } finally {
    auth.usuario = usuarioAnterior;
    ui.area = areaAnterior;
    ui.parametros = parametrosAnteriores;
    ui.rota = rotaAnterior;
  }
});

test("novidades da 0.2.2 incluem o time, segurança e agradecimentos, sem antecipar a instalação", async () => {
  const { novidadesAte, temNovidadesDe } = await vite.ssrLoadModule('/src/utilitarios/novidades.ts');
  assert.equal(temNovidadesDe('0.2.2'), true);
  assert.equal(novidadesAte('0.2.1').some(v => v.versao === '0.2.2'), false);
  const novidades = novidadesAte('0.2.2');
  assert.equal(novidades[0].versao, '0.2.2');
  const textos = novidades[0].mudancas.map(([, texto]) => texto);
  const completo = textos.join('\n');
  for (const trecho of ['27 acessórios', 'Escritório de IAs', 'Tauri/Tokio', '@gustavowalkersgroup', '@landreussi', 'issue #5', 'desativado, em testes']) assert.ok(completo.includes(trecho), trecho);
  assert.doesNotMatch(completo, /Google Workspace: Gmail/);
  const descricao = readFileSync('docs/releases/0.2.2.md', 'utf8');
  for (const texto of textos.filter(t => !t.startsWith('Agradecimento'))) assert.ok(descricao.includes(texto), texto);
  assert.match(descricao, /https:\/\/github.com\/Pablofellype\/Niko\/issues\/5/);
  assert.match(descricao, /https:\/\/github.com\/Pablofellype\/Niko\/pull\/8/);
});

const origemDoTema = { getBoundingClientRect: () => ({ left: 180, top: 670, width: 40, height: 40 }) };

function prepararTransicao(t, opcoes = {}) {
  const anteriores = ["window", "document"].map((nome) => Object.getOwnPropertyDescriptor(globalThis, nome));
  const eventos = new Map();
  const consulta = { matches: opcoes.reduzirSistema ?? false, addEventListener: (tipo, fn) => eventos.set(`consulta:${tipo}`, fn), removeEventListener: (tipo, fn) => { if (eventos.get(`consulta:${tipo}`) === fn) eventos.delete(`consulta:${tipo}`); } };
  const animacoes = [];
  const transicoes = [];
  const raiz = {
    dataset: { tema: "claro", reduzirAnimacoes: opcoes.reduzirApp ? "sim" : "nao" },
    animate: (quadros, configuracao) => {
      if (opcoes.falharAnimacao) throw new Error("animação indisponível");
      const animacao = { quadros, configuracao, cancelada: false, cancel() { this.cancelada = true; } };
      animacoes.push(animacao);
      return animacao;
    },
  };
  const doc = {
    documentElement: raiz, visibilityState: opcoes.oculto ? "hidden" : "visible",
    addEventListener: (tipo, fn) => eventos.set(`documento:${tipo}`, fn),
    removeEventListener: (tipo, fn) => { if (eventos.get(`documento:${tipo}`) === fn) eventos.delete(`documento:${tipo}`); },
  };
  if (!opcoes.semApi) doc.startViewTransition = (aplicar) => {
    if (opcoes.falharInicio) throw new Error("transição indisponível");
    const pronta = Promise.withResolvers();
    const final = Promise.withResolvers();
    const transicao = {
      ready: pronta.promise, finished: final.promise, aplicar,
      preparar() { aplicar(); pronta.resolve(); },
      falhar() { aplicar(); pronta.reject(new Error("transição ignorada")); final.resolve(); },
      terminar: () => final.resolve(),
      ignorada: false,
      skipTransition() { this.ignorada = true; pronta.reject(new Error("transição interrompida")); final.resolve(); },
    };
    transicoes.push(transicao);
    return transicao;
  };
  globalThis.document = doc;
  globalThis.window = {
    innerWidth: 1200, innerHeight: 800, matchMedia: () => consulta,
    addEventListener: (tipo, fn) => eventos.set(`janela:${tipo}`, fn),
    removeEventListener: (tipo, fn) => { if (eventos.get(`janela:${tipo}`) === fn) eventos.delete(`janela:${tipo}`); },
  };
  t.after(async () => {
    animarTrocaDeTema(null, () => {}, false);
    await Promise.resolve();
    await Promise.resolve();
    ["window", "document"].forEach((nome, i) => {
      if (anteriores[i]) Object.defineProperty(globalThis, nome, anteriores[i]);
      else delete globalThis[nome];
    });
  });
  return { raiz, doc, consulta, animacoes, transicoes, eventos };
}

test("círculo do tema nasce no centro do botão e cobre os quatro cantos mesmo perto da borda", () => {
  const { x, y, raio } = circuloDoTema(origemDoTema, 1200, 800);
  assert.deepEqual([x, y], [200, 690]);
  for (const [cx, cy] of [[0, 0], [1200, 0], [0, 800], [1200, 800]]) assert.ok(raio >= Math.hypot(cx - x, cy - y));
  assert.deepEqual(circuloDoTema(null, 1200, 800), { x: 600, y: 400, raio: 722 });
});

test("claro e escuro são revelados para fora sobre a imagem anterior e liberam a tela no fim", async (t) => {
  const c = prepararTransicao(t);
  for (const tema of ["escuro", "claro"]) {
    animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = tema; });
    assert.notEqual(c.raiz.dataset.tema, tema);
    c.transicoes.at(-1).preparar();
    await Promise.resolve();
    assert.equal(c.raiz.dataset.tema, tema);
    const { quadros, configuracao } = c.animacoes.at(-1);
    assert.deepEqual(quadros.clipPath, ["circle(0px at 200px 690px)", "circle(1215px at 200px 690px)"]);
    assert.equal(configuracao.pseudoElement, "::view-transition-new(root)");
    assert.equal(configuracao.duration, 1000);
    assert.equal(c.raiz.dataset.transicaoTema, "sim");
    c.transicoes.at(-1).terminar();
    await Promise.resolve();
    assert.equal(c.raiz.dataset.transicaoTema, undefined);
    assert.equal(c.eventos.size, 0);
  }
});

for (const [nome, opcoes] of Object.entries({ "sem suporte": { semApi: true }, "redução do sistema": { reduzirSistema: true }, "redução do Niko": { reduzirApp: true }, "janela oculta": { oculto: true }, "falha ao iniciar": { falharInicio: true } })) {
  test(`troca o tema imediatamente ${nome}, sem sobreposição presa`, (t) => {
    const c = prepararTransicao(t, opcoes);
    let aplicacoes = 0;
    animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; aplicacoes++; });
    assert.equal(c.raiz.dataset.tema, "escuro");
    assert.equal(aplicacoes, 1);
    assert.equal(c.animacoes.length, 0);
    assert.equal(c.raiz.dataset.transicaoTema, undefined);
    assert.equal(c.eventos.size, 0);
  });
}

test("cliques rápidos não aplicam tema antigo nem removem os estilos da transição mais nova", async (t) => {
  const c = prepararTransicao(t);
  let antigo = 0;
  animarTrocaDeTema(origemDoTema, () => { antigo++; });
  const primeira = c.transicoes[0];
  animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; });
  primeira.aplicar();
  await Promise.resolve();
  assert.equal(antigo, 0);
  assert.equal(c.raiz.dataset.transicaoTema, "sim");
  assert.equal(primeira.ignorada, true);
  c.transicoes[1].preparar();
  await Promise.resolve();
  assert.equal(c.animacoes.length, 1);
  c.transicoes[1].terminar();
  await Promise.resolve();
  assert.equal(c.eventos.size, 0);
});

test("transição ignorada pelo navegador mantém a troca de tema e limpa sua marcação", async (t) => {
  const c = prepararTransicao(t);
  animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; });
  c.transicoes[0].falhar();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.raiz.dataset.tema, "escuro");
  assert.equal(c.raiz.dataset.transicaoTema, undefined);
  assert.equal(c.eventos.size, 0);
});

test("falha no efeito circular não deixa a interface congelada", async (t) => {
  const c = prepararTransicao(t, { falharAnimacao: true });
  animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; });
  c.transicoes[0].preparar();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.raiz.dataset.tema, "escuro");
  assert.equal(c.raiz.dataset.transicaoTema, undefined);
  assert.equal(c.eventos.size, 0);
});

test("redimensionar, ocultar ou reduzir movimento interrompe o efeito sem reverter o tema", async (t) => {
  const c = prepararTransicao(t);
  for (const evento of ["janela:resize", "documento:visibilitychange", "consulta:change"]) {
    c.doc.visibilityState = "visible";
    animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; });
    c.transicoes.at(-1).preparar();
    await Promise.resolve();
    c.doc.visibilityState = "hidden";
    c.eventos.get(evento)({ matches: true });
    await Promise.resolve();
    assert.equal(c.animacoes.at(-1).cancelada, true);
    assert.equal(c.raiz.dataset.tema, "escuro");
    assert.equal(c.raiz.dataset.transicaoTema, undefined);
    assert.equal(c.eventos.size, 0);
  }
});

test("escolher aparência equivalente cancela uma troca pendente sem aplicar estado atrasado", async (t) => {
  const c = prepararTransicao(t);
  animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "escuro"; });
  animarTrocaDeTema(origemDoTema, () => { c.raiz.dataset.tema = "claro"; }, false);
  c.transicoes[0].aplicar();
  await Promise.resolve();
  assert.equal(c.raiz.dataset.tema, "claro");
  assert.equal(c.raiz.dataset.transicaoTema, undefined);
});

test("servidores de teste usam caches distintos e nunca sobrescrevem o cache do localhost", async () => {
  const arquivos = [".vite", ".vite-niko"].map((nome) => new URL(`../node_modules/${nome}/deps/_metadata.json`, import.meta.url));
  const anteriores = arquivos.map((arquivo) => existsSync(arquivo) ? readFileSync(arquivo) : null);
  const isolado = await criarServidorDeTeste({ ...opcoes, cacheDir: vite.config.cacheDir });
  const caminho = isolado.config.cacheDir;
  try {
    assert.notEqual(caminho, vite.config.cacheDir);
    assert.match(caminho.replaceAll("\\", "/"), /\/node_modules\/\.vite-testes\/[^/]+$/);
    await isolado.ssrLoadModule("/src/utilitarios/contribuicoesGithub.ts");
  } finally {
    await isolado.close();
  }
  assert.equal(existsSync(caminho), false);
  assert.deepEqual(arquivos.map((arquivo) => existsSync(arquivo) ? readFileSync(arquivo) : null), anteriores);
});

test("barreira mantém o conteúdo enquanto não há erro", () => {
  const conteudo = createElement("p", null, "Página funcionando");
  assert.equal(new LimiteDeErro({ children: conteudo }).render(), conteudo);
});

function comFalha(props = {}) {
  const limite = new LimiteDeErro({ children: createElement("p", null, "Conteúdo que falhou"), ...props });
  limite.state = LimiteDeErro.getDerivedStateFromError(new Error("mensagem com dados privados"));
  return limite;
}

test("falha geral apresenta recuperação sem expor detalhes do erro nem recarregar automaticamente", () => {
  const html = renderToStaticMarkup(comFalha().render());
  assert.match(html, /role="alert"/);
  assert.match(html, /Não foi possível exibir o Kyro/);
  assert.match(html, /Recarregar o Kyro/);
  assert.match(html, /ainda não salvas podem ser perdidas/);
  assert.doesNotMatch(html, /dados privados|Conteúdo que falhou|Voltar ao início/);
});

test("falha de página oferece retorno ao início e mantém a navegação fora da barreira", () => {
  let voltou = false;
  const limite = comFalha({ aoVoltar: () => { voltou = true; } });
  const arvore = limite.render();
  const html = renderToStaticMarkup(arvore);
  assert.match(html, /Não foi possível abrir esta página/);
  assert.match(html, /Voltar ao início/);
  arvore.props.children[3].props.children[0].props.onClick();
  assert.equal(voltou, true);
  const janela = readFileSync(new URL("../src/janelas/sistema/JanelaSistema.tsx", import.meta.url), "utf8");
  assert.match(janela, /<BarraLateral[^]*<LimiteDeErro key=\{chavePagina\}[^]*<Suspense[^]*<Pagina[^]*<\/LimiteDeErro>/);
  const principal = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.match(principal, /<LimiteDeErro>\s*<Raiz\s*\/>\s*<\/LimiteDeErro>/);
});

test("todos os testes com Vite passam pelo isolamento de cache", () => {
  for (const nome of ["validacoes", "escritorio", "personalizacao-agentes", "github", "configuracao-vite", "ilha"]) {
    const codigo = readFileSync(new URL(`./${nome}.test.mjs`, import.meta.url), "utf8");
    assert.match(codigo, /from "\.\/vite-para-testes\.mjs"/);
    assert.doesNotMatch(codigo, /import\s*\{[^}]*createServer[^}]*\}\s*from "vite"/);
  }
});

function coresDoBloco(arquivo, seletor) {
  const css = readFileSync(new URL(arquivo, import.meta.url), "utf8");
  const inicio = css.indexOf(`${seletor} {`);
  assert.ok(inicio >= 0, seletor);
  const bloco = css.slice(inicio, css.indexOf("}", inicio));
  return Object.fromEntries([...bloco.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function luminancia(cor) {
  const canais = cor.slice(1).match(/../g).map((canal) => parseInt(canal, 16) / 255);
  const [r, g, b] = canais.map((canal) => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function verificarTomAcolhedor(cor) {
  const canais = cor.slice(1).match(/../g).map((canal) => parseInt(canal, 16));
  assert.equal(canais.length, 3, cor);
  assert.ok(canais[0] >= canais[1] && canais[1] >= canais[2], `A base ${cor} deve ter um tom quente sem puxar para rosa`);
}

test("tema claro mantém textos secundários legíveis sobre fundos suaves em todas as paletas", () => {
  const arquivo = "../src/estilos/estilo-sistema.css";
  const claro = coresDoBloco(arquivo, '[data-tema="claro"] .estilo-sistema');
  for (const token of ["--p-f", "--p-s", "--texto", "--texto-corpo", "--texto-2", "--texto-3", "--texto-4"]) verificarTomAcolhedor(claro[token]);
  const fundos = [claro["--p-f"], claro["--p-s"]];
  for (const paleta of ["areia", "grafite", "floresta", "oceano"]) {
    const cores = coresDoBloco(arquivo, `[data-tema="claro"][data-paleta="${paleta}"] .estilo-sistema`);
    fundos.push(cores["--p-f"], cores["--p-s"]);
  }
  for (const token of ["--texto", "--texto-corpo", "--texto-2", "--texto-3", "--texto-4"]) {
    for (const fundo of fundos) {
      const contraste = (luminancia(fundo) + 0.05) / (luminancia(claro[token]) + 0.05);
      assert.ok(contraste >= 4.5, `${token} sobre ${fundo}: ${contraste}`);
    }
  }
  assert.equal(claro["--p-s"], "#ffffff");
  assert.equal(claro["--borda"], "color-mix(in srgb, var(--p-f), #000 18%)");
  assert.equal(claro["--borda-controle"], "color-mix(in srgb, var(--p-f), #000 22%)");
});

test("tema escuro mantém tons quentes com leitura legível e calendário claro isolado", () => {
  const escuro = coresDoBloco("../src/estilos/estilo-sistema.css", '[data-tema="escuro"] .estilo-sistema');
  for (const token of ["--p-f", "--p-s", "--texto", "--texto-corpo", "--texto-2", "--texto-3", "--texto-4"]) verificarTomAcolhedor(escuro[token]);
  for (const token of ["--texto", "--texto-corpo", "--texto-2", "--texto-3", "--texto-4"]) {
    for (const fundo of [escuro["--p-f"], escuro["--p-s"]]) {
      assert.ok((luminancia(escuro[token]) + .05) / (luminancia(fundo) + .05) >= 4.5, `${token} sobre ${fundo}`);
    }
  }
  const css = readFileSync(new URL("../src/estilos/telas/calendario.css", import.meta.url), "utf8");
  assert.match(css, /\[data-tema="claro"\] \.estilo-sistema \.cl-mes\s*\{\s*background: var\(--borda\)/);
  assert.match(css, /\[data-tema="claro"\] \.estilo-sistema \.cl-dia\[data-fora="sim"\] \.cl-dia-numero\s*\{\s*color: var\(--texto-4\)/);
});

test("verde principal mantém leitura nos botões e se distingue do vermelho de erro", () => {
  const cores = coresDoBloco("../src/estilos/tokens.css", ":root");
  for (const verde of [cores["--marca-primaria"], cores["--marca-primaria-hover"], cores["--marca-primaria-profunda"]]) {
    assert.ok(1.05 / (luminancia(verde) + .05) >= 4.5, verde);
    const [r, g] = verde.slice(1).match(/../g).map((canal) => parseInt(canal, 16));
    assert.ok(g > r, verde);
  }
  assert.notEqual(cores["--marca-primaria"], cores["--erro"]);
});

test("painel da gerência recebe a pessoa pelo nome e oferece apenas atalhos permitidos", async () => {
  const { PainelCoordenacao } = await vite.ssrLoadModule("/src/modulos/escritorio/PainelCoordenacao.tsx");
  const { useAuth } = await vite.ssrLoadModule("/src/estado/autenticacao.ts");
  const { useConfig } = await vite.ssrLoadModule("/src/estado/configuracoes.ts");
  const { useInterface } = await vite.ssrLoadModule("/src/estado/interface.ts");
  const { saudacao } = await vite.ssrLoadModule("/src/utilitarios/datas.ts");
  const auth = useAuth.getInitialState(), config = useConfig.getInitialState(), ui = useInterface.getInitialState();
  const usuarioAnterior = auth.usuario, nomeAnterior = config.nome, areaAnterior = ui.area;
  try {
    auth.usuario = { id: 7, perfil: "gerencia", nome: "Mariana Silva" };
    ui.area = "empresa";
    config.nome = "";
    const html = renderToStaticMarkup(createElement(PainelCoordenacao));
    assert.ok(html.includes(`${saudacao()}, Mariana!`));
    for (const texto of ["Painel da gerência", "Personalizar meu espaço", "Precisa da sua atenção", "Na sua agenda", "Seus sistemas", "Registros de limpeza", "Sistema de requisições", "Power BI", "Nova atividade", "Novo compromisso", "Novo registro"]) assert.ok(html.includes(texto), texto);
    assert.doesNotMatch(html, /Abrir conversa|Administração|Provedores de IA|Gerenciar acessos|Equipe cadastrada|Robô de Aderências|Últimas atividades do Kyro|Membros cadastrados|Avisos e mensagens/);
    config.nome = "Mari";
    assert.ok(renderToStaticMarkup(createElement(PainelCoordenacao)).includes(`${saudacao()}, Mari!`));
    ui.area = "pessoal";
    assert.equal(renderToStaticMarkup(createElement(PainelCoordenacao)), "");
    ui.area = "empresa";
    auth.usuario = { id: 8, perfil: "visitante", nome: "Visitante" };
    assert.equal(renderToStaticMarkup(createElement(PainelCoordenacao)), "");
  } finally {
    auth.usuario = usuarioAnterior;
    config.nome = nomeAnterior;
    ui.area = areaAnterior;
  }
});

test("escritório diferencia os acessos do dono e mantém falhas da equipe distintas de listas vazias", async () => {
  const { VisaoDoEscritorio } = await vite.ssrLoadModule("/src/modulos/escritorio/PainelCoordenacao.tsx");
  const { resumirPainelEmpresa, DADOS_REMOTOS_VAZIOS } = await vite.ssrLoadModule("/src/modulos/escritorio/dadosDoPainelEmpresa.ts");
  const agora = new Date(2026, 10, 15, 10, 0);
  const props = { nome: "Ana", usuario: { perfil: "dono", nome: "Ana", roboAderencias: false }, agora, resumo: resumirPainelEmpresa([], [], agora), remoto: { ...DADOS_REMOTOS_VAZIOS, carregando: false, atualizadoEm: null, erroMembros: true }, mensagens: null, whatsappComErro: false, aoNavegar() {}, aoAtualizar() {}, aoConcluir() {} };
  const falhou = renderToStaticMarkup(createElement(VisaoDoEscritorio, props));
  for (const texto of ["Escritório da empresa", "Equipe cadastrada", "Gerenciar acessos", "Robô de Aderências", "Não foi possível consultar a equipe agora."]) assert.ok(falhou.includes(texto), texto);
  assert.doesNotMatch(falhou, /Pedidos no Kyro|Solicitações recebidas|Ver solicitações|online|Nenhuma conta ativa nesta consulta/);
  const rotinas = [{ id: "rotina-teste", nome: "Envio da manhã", ativo: true, frequencia: "diaria", ultimoResultado: { executadoEm: agora.toISOString(), planilhasEnviadas: 2, erros: ["falha de teste"] } }];
  const carregado = renderToStaticMarkup(createElement(VisaoDoEscritorio, {
    ...props, mensagens: 7,
    remoto: { ...props.remoto, membros: [], erroMembros: false, aderencias: { situacao: "prontas", rotinas } },
  }));
  assert.ok(carregado.includes("Nenhuma atividade pendente neste resumo"));
  assert.ok(carregado.includes("Nenhuma conta ativa nesta consulta"));
  assert.equal((carregado.match(/class="ee-metrica"/g) ?? []).length, 4);
  assert.match(carregado, /Mensagens não lidas<\/span><strong>7<\/strong>/);
  assert.match(carregado, /Agendamentos ativos<\/dt><dd>1<\/dd>/);
  assert.match(carregado, /Envio da manhã<\/strong><span>2 prints enviados · 1 falha/);
  assert.doesNotMatch(carregado, /Pedidos no Kyro|Solicitações recebidas|Ver solicitações/);
});

test("portal visitante oferece volta direta ao login e acessos com os destinos do catálogo", async () => {
  const { default: VisitantePublico } = await vite.ssrLoadModule("/src/modulos/publico/VisitantePublico.tsx");
  const { APLICATIVOS_EMPRESA } = await vite.ssrLoadModule("/src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const html = renderToStaticMarkup(createElement(VisitantePublico));
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(([tag, href]) => ({ tag, href }));
  assert.equal(links.filter((link) => link.href === "/").length, 2);
  assert.match(html, /Voltar ao login/);
  const disponiveis = APLICATIVOS_EMPRESA.filter((app) => app.publico && app.status === "disponivel" && app.url);
  assert.equal(links.filter((link) => /^https:/.test(link.href)).length, disponiveis.length);
  for (const app of disponiveis) {
    const link = links.find((item) => item.href === app.url);
    assert.ok(link, app.nome);
    assert.match(link.tag, /target="_blank"/);
    assert.match(link.tag, /rel="noopener noreferrer"/);
  }
  assert.equal((html.match(/Acessar sistema/g) ?? []).length, disponiveis.length);
  assert.match(html, /<article[^>]*aria-label="Armários geral: em manutenção"/);
  assert.doesNotMatch(html, /<form|visitante-material|<button/);
});

test("portal público não exibe sistemas privados nem oferece link para sistemas em manutenção", async () => {
  const { default: VisitantePublico } = await vite.ssrLoadModule("/src/modulos/publico/VisitantePublico.tsx");
  const { APLICATIVOS_EMPRESA } = await vite.ssrLoadModule("/src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const tamanho = APLICATIVOS_EMPRESA.length;
  try {
    APLICATIVOS_EMPRESA.push(
      { id: "privado-teste", nome: "Sistema privado de teste", descricao: "Privado", url: "https://privado.example/", status: "disponivel", publico: false },
      { id: "manutencao-teste", nome: "Manutenção de teste", descricao: "Manutenção", url: "https://manutencao.example/", status: "manutencao", publico: true },
    );
    const html = renderToStaticMarkup(createElement(VisitantePublico));
    assert.doesNotMatch(html, /Sistema privado de teste|privado\.example|manutencao\.example/);
    assert.match(html, /aria-label="Manutenção de teste: em manutenção"/);
  } finally {
    APLICATIVOS_EMPRESA.splice(tamanho);
  }
});

async function prepararModoVisualizacao(t, nativo) {
  const nomes = ["window", "document", "localStorage", "BroadcastChannel"];
  const anteriores = nomes.map((nome) => Object.getOwnPropertyDescriptor(globalThis, nome));
  const memoria = new Map([
    ["niko:sistema-aberto", "0"],
    ["niko:janela-v2", JSON.stringify({ x: 70, y: 44, w: 960, h: 600 })],
  ]);
  globalThis.BroadcastChannel = undefined;
  globalThis.localStorage = { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) };
  globalThis.window = Object.assign(new EventTarget(), {
    innerWidth: 1366, innerHeight: 768, setTimeout, clearTimeout,
    location: { search: "?banco=visualizacao" },
    ...(nativo ? { __TAURI_INTERNALS__: { metadata: { currentWindow: { label: "sistema" } } } } : {}),
  });
  globalThis.document = Object.assign(new EventTarget(), { querySelector: () => null, body: {} });
  const servidor = await criarServidorDeTeste(opcoes);
  t.after(async () => {
    await servidor.close();
    nomes.forEach((nome, i) => {
      if (anteriores[i]) Object.defineProperty(globalThis, nome, anteriores[i]);
      else delete globalThis[nome];
    });
  });
  const { useInterface } = await servidor.ssrLoadModule("/src/estado/interface.ts");
  const { retangulosAbertos } = await servidor.ssrLoadModule("/src/janelas/geometria.ts");
  return { useInterface, retangulosAbertos, memoria, servidor };
}

test("no desktop, o link do sistema abre no navegador e a volta ao login permanece no Kyro", async (t) => {
  const { servidor } = await prepararModoVisualizacao(t, true);
  window.location.origin = "http://tauri.localhost";
  const chamadas = [];
  let confirmarAbertura;
  const abertura = new Promise((resolve) => { confirmarAbertura = resolve; });
  window.__TAURI_INTERNALS__.invoke = async (comando, dados) => { chamadas.push({ comando, dados }); confirmarAbertura(); };
  const { desviarLinksExternos } = await servidor.ssrLoadModule("/src/desktop/desktop.ts");
  desviarLinksExternos();
  const clicar = (href) => {
    const evento = new Event("click", { cancelable: true });
    Object.defineProperty(evento, "target", { value: { closest: () => ({ href }) } });
    document.dispatchEvent(evento);
    return evento.defaultPrevented;
  };
  assert.equal(clicar("http://tauri.localhost/"), false);
  assert.deepEqual(chamadas, []);
  assert.equal(clicar("https://calendario-dpa.vercel.app/"), true);
  let prazo;
  try {
    await Promise.race([abertura, new Promise((_, reject) => { prazo = setTimeout(() => reject(new Error("O link externo não foi encaminhado ao navegador")), 2000); })]);
    assert.deepEqual(chamadas, [{ comando: "abrir_link", dados: { url: "https://calendario-dpa.vercel.app/" } }]);
  } finally {
    clearTimeout(prazo);
  }
});

test("web abre o painel inteiro mesmo com sessão antiga fechada e não permite ocultá-lo", async (t) => {
  const { useInterface, retangulosAbertos } = await prepararModoVisualizacao(t, false);
  assert.equal(useInterface.getState().sistemaAberto, true);
  useInterface.getState().definirSistema({ sistemaAberto: false, sistemaMinimizado: true });
  assert.equal(useInterface.getState().sistemaAberto, true);
  assert.equal(useInterface.getState().sistemaMinimizado, false);
  assert.deepEqual(retangulosAbertos(), [{ x: 0, y: 0, w: 1366, h: 768 }]);
  window.innerWidth = 390;
  window.innerHeight = 844;
  assert.deepEqual(retangulosAbertos(), [{ x: 0, y: 0, w: 390, h: 844 }]);
  assert.deepEqual(useInterface.getState().geometria, { x: 70, y: 44, w: 960, h: 600 });
});

test("app nativo preserva fechamento, minimização e geometria independente da página web", async (t) => {
  const { useInterface, retangulosAbertos, memoria } = await prepararModoVisualizacao(t, true);
  useInterface.getState().definirSistema({ sistemaAberto: false, sistemaMinimizado: true });
  assert.equal(useInterface.getState().sistemaAberto, false);
  assert.equal(useInterface.getState().sistemaMinimizado, true);
  assert.deepEqual(retangulosAbertos(), []);
  useInterface.getState().definirSistema({ sistemaAberto: true, sistemaMinimizado: false });
  assert.deepEqual(retangulosAbertos(), [{ x: 70, y: 44, w: 960, h: 600 }]);
  assert.equal(memoria.get("niko:sistema-aberto"), "0");
});

test("menu de apps preserva o catálogo, identifica manutenção e respeita a permissão do robô", async () => {
  const { APLICATIVOS_EMPRESA, itensDoMenuAppsEmpresa } = await import("../src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const comum = itensDoMenuAppsEmpresa({ perfil: "gerencia", roboAderencias: false });
  for (const app of APLICATIVOS_EMPRESA) {
    const item = comum.find((atual) => atual.id === app.id);
    assert.equal(item.nome, app.nome);
    assert.equal(item.disponivel, app.status === "disponivel" && !!app.url);
  }
  assert.equal(comum.some((app) => app.id === "aderencias"), false);
  assert.equal(comum.some((app) => app.id === "solicitacoes"), false);
  for (const usuario of [{ perfil: "dono", roboAderencias: false }, { perfil: "gerencia", roboAderencias: true }]) {
    assert.equal(itensDoMenuAppsEmpresa(usuario).some((app) => app.id === "aderencias" && app.disponivel), true);
  }
  assert.equal(itensDoMenuAppsEmpresa(null).some((app) => app.id === "aderencias"), false);
  assert.equal(itensDoMenuAppsEmpresa({ perfil: "visitante", roboAderencias: true }).some((app) => app.id === "aderencias"), false);
  assert.equal(new Set(comum.map((app) => app.id)).size, comum.length);
});

test("selecionar um sistema abre sua página diretamente e bloqueia destinos desconhecidos", async () => {
  const { ConteudoAplicativoEmpresa } = await vite.ssrLoadModule("/src/modulos/escritorio/AplicativosEmpresa.tsx");
  const { APLICATIVOS_EMPRESA } = await import("../src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const usuario = { perfil: "gerencia", roboAderencias: false };
  for (const app of APLICATIVOS_EMPRESA.filter((item) => item.status === "disponivel" && item.url)) {
    const html = renderToStaticMarkup(createElement(ConteudoAplicativoEmpresa, { appId: app.id, usuario }));
    assert.ok(html.includes(`src="${app.url}"`), app.nome);
    assert.equal((html.match(/<iframe\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /Voltar aos apps|Abrir sistema|apps-empresa-grade|role="dialog"|Ir para o sistema|Nova aba/);
    assert.match(html, /aria-label="Copiar link do sistema"/);
  }
  for (const appId of ["armarios", "https://destino.example", "inexistente"]) {
    const html = renderToStaticMarkup(createElement(ConteudoAplicativoEmpresa, { appId, usuario }));
    assert.doesNotMatch(html, /<iframe/);
    assert.match(html, /manutenção|não está disponível/);
  }
});

test("rota direta do robô continua protegida e solicitações recebidas ficam indisponíveis", async () => {
  const { ConteudoAplicativoEmpresa } = await vite.ssrLoadModule("/src/modulos/escritorio/AplicativosEmpresa.tsx");
  const { Aderencias } = await vite.ssrLoadModule("/src/modulos/escritorio/Aderencias.tsx");
  for (const usuario of [null, { perfil: "gerencia", roboAderencias: false }, { perfil: "visitante", roboAderencias: true }]) {
    const html = renderToStaticMarkup(createElement(ConteudoAplicativoEmpresa, { appId: "aderencias", usuario }));
    assert.match(html, /não está disponível/);
    assert.doesNotMatch(html, /aria-label="Robô de Aderências"/);
  }
  for (const usuario of [{ perfil: "dono", roboAderencias: false }, { perfil: "gerencia", roboAderencias: true }]) {
    const pagina = ConteudoAplicativoEmpresa({ appId: "aderencias", usuario });
    assert.equal(pagina.type, Aderencias);
  }
  const solicitacoes = renderToStaticMarkup(createElement(ConteudoAplicativoEmpresa, { appId: "solicitacoes", usuario: { perfil: "gerencia", roboAderencias: false } }));
  assert.match(solicitacoes, /não está disponível/);
  assert.doesNotMatch(solicitacoes, /Solicitações recebidas/);
  assert.doesNotMatch(solicitacoes, /<iframe|apps-empresa-grade/);
});

test("só o dono abre o gerenciador e um novo domínio abre pelo navegador", async () => {
  const { ConteudoAplicativoEmpresa } = await vite.ssrLoadModule("/src/modulos/escritorio/AplicativosEmpresa.tsx");
  const { GERENCIAR_APLICATIVOS } = await import("../src/modulos/escritorio/aplicativosEmpresaConfig.ts");
  const renderizar = (appId, perfil, aplicativos) => renderToStaticMarkup(createElement(ConteudoAplicativoEmpresa, {
    appId, usuario: { perfil, roboAderencias: false }, aplicativos,
  }));
  assert.match(renderizar(GERENCIAR_APLICATIVOS, "dono"), /Gerenciar aplicativos/);
  assert.match(renderizar(GERENCIAR_APLICATIVOS, "gerencia"), /não está disponível/);
  const app = { id: "app-teste", nome: "Ferramenta", descricao: "", url: "https://ferramenta.example/", status: "disponivel", publico: false };
  const html = renderizar(app.id, "gerencia", [app]);
  assert.match(html, /Ferramenta/);
  assert.match(html, /Abrir no navegador/);
  assert.doesNotMatch(html, /<iframe/);
});

test("navegação entre apps troca o aplicativo e limpa a seleção ao mudar de área do menu", async (t) => {
  const { useInterface, memoria } = await prepararModoVisualizacao(t, false);
  useInterface.getState().definirArea("pessoal");
  useInterface.getState().irPara("appsEmpresa", { app: "materiais" });
  assert.equal(useInterface.getState().area, "empresa");
  assert.equal(memoria.get("niko:area-sistema"), "empresa");
  assert.equal(useInterface.getState().rota, "appsEmpresa");
  assert.deepEqual(useInterface.getState().parametros, { app: "materiais" });
  useInterface.getState().irParaLocal("appsEmpresa", { app: "registros-limpeza" });
  assert.equal(useInterface.getState().rota, "appsEmpresa");
  assert.deepEqual(useInterface.getState().parametros, { app: "registros-limpeza" });
  useInterface.getState().irParaLocal("appsEmpresa", { app: "aderencias" });
  assert.deepEqual(useInterface.getState().parametros, { app: "aderencias" });
  useInterface.getState().irParaLocal("escritorio");
  assert.deepEqual(useInterface.getState().parametros, {});
});

test("Ctrl+B expande o menu do app sem alterar a preferência geral e volta ao comportamento normal ao sair", async (t) => {
  const { useInterface, memoria } = await prepararModoVisualizacao(t, false);
  const antes = [...memoria];
  let teclar;
  let gravacoes = 0;
  const cfg = { atalhosGlobais: {}, barraRecolhida: false, definir(parcial) { Object.assign(this, parcial); gravacoes++; } };
  const codigo = stripTypeScriptTypes(readFileSync("src/janelas/area-de-trabalho/usarAtalhos.ts", "utf8"))
    .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
  vm.runInNewContext(`${codigo}\nusarAtalhos();`, {
    useEffect: (acao) => acao(), useInterface, useConfig: { getState: () => cfg }, ACOES_GLOBAIS: [],
    window: { addEventListener: (_, fn) => { teclar = fn; }, removeEventListener() {} },
  });
  const ctrlB = () => teclar({ key: "b", ctrlKey: true, altKey: false, preventDefault() {} });
  useInterface.getState().definirBarraAppsRecolhida(true);
  ctrlB();
  assert.equal(useInterface.getState().barraAppsRecolhida, false);
  ctrlB();
  assert.equal(useInterface.getState().barraAppsRecolhida, true);
  assert.equal(gravacoes, 0);
  assert.equal(cfg.barraRecolhida, false);
  assert.deepEqual([...memoria], antes);
  useInterface.getState().definirBarraAppsRecolhida(null);
  ctrlB();
  assert.equal(cfg.barraRecolhida, true);
  assert.equal(gravacoes, 1);
});
