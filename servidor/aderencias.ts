import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { lerTudo, gravar } from "./banco.ts";
import { enviarImagemNoWhatsapp, estadoDoWhatsapp, iniciarWhatsapp } from "./whatsapp/whatsapp.ts";
import { configuracaoAderenciasValida, planilhaAderenciaValida, type ConfiguracaoAderencias, type PlanilhaAderencia } from "../src/modulos/escritorio/aderenciasTipos.ts";

interface CelulaAderencia {
  texto: string;
  area: string;
  predio: string;
  cor: "vermelho" | "amarelo";
}

interface CapturaAderencia {
  bytes: Buffer;
  celulas: CelulaAderencia[];
}

interface CdpResposta {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message?: string };
}

const MAXIMO_PLANILHAS = 30;
const LIMITE_IMAGEM = 16 * 1024 * 1024;
// O chatbot antigo usava DPR 3; mantemos a mesma densidade de pixels.
const ESCALAS_DA_CAPTURA = [1] as const;
let relogioAgendamento: ReturnType<typeof setInterval> | null = null;
let execucaoAgendada = false;
const slotsExecutados = new Set<string>();

function portaLivre(): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const servidor = createServer();
    servidor.once("error", rejeitar);
    servidor.listen(0, "127.0.0.1", () => {
      const endereco = servidor.address();
      const porta = typeof endereco === "object" && endereco ? endereco.port : 0;
      servidor.close(() => porta ? resolver(porta) : rejeitar(new Error("sem_porta")));
    });
  });
}

function caminhoDoNavegador(): string | null {
  const candidatos = [
    process.env.KYRO_CHROME_PATH,
    process.env.CHROME_PATH,
    process.platform === "win32" ? join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "win32" ? join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "win32" ? join(process.env["PROGRAMFILES(X86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    process.platform === "linux" ? "google-chrome" : "",
    process.platform === "linux" ? "chromium" : "",
    process.platform === "linux" ? "chromium-browser" : "",
  ].filter((c): c is string => Boolean(c));
  return candidatos.find((c) => c.includes("\\") || c.includes("/") ? existsSync(c) : true) ?? null;
}

async function esperar(ms: number) {
  await new Promise((resolver) => setTimeout(resolver, ms));
}

interface PaginaDoDebugger {
  type?: string;
  webSocketDebuggerUrl?: string;
}

async function abrirDebugger(porta: number): Promise<{ webSocketDebuggerUrl?: string }> {
  const limite = Date.now() + 10000;
  while (Date.now() < limite) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/json/list`);
      if (resposta.ok) {
        const paginas = await resposta.json() as PaginaDoDebugger[];
        const pagina = paginas.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
        if (pagina?.webSocketDebuggerUrl) return { webSocketDebuggerUrl: pagina.webSocketDebuggerUrl };
      }
    } catch {
      // O Chromium ainda está iniciando.
    }
    await esperar(100);
  }
  throw new Error("navegador_nao_respondeu");
}

class ClienteCdp {
  private readonly socket: WebSocket;
  private sequencia = 0;
  private readonly pendentes = new Map<number, { resolver: (v: CdpResposta) => void; rejeitar: (e: Error) => void }>();

  private constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on("message", (dados) => {
      let resposta: CdpResposta;
      try { resposta = JSON.parse(dados.toString()) as CdpResposta; } catch { return; }
      if (!resposta.id) return;
      const pendente = this.pendentes.get(resposta.id);
      if (!pendente) return;
      this.pendentes.delete(resposta.id);
      if (resposta.error) pendente.rejeitar(new Error(resposta.error.message || "falha_cdp"));
      else pendente.resolver(resposta);
    });
  }

  static abrir(url: string): Promise<ClienteCdp> {
    return new Promise((resolver, rejeitar) => {
      const cliente = new ClienteCdp(url);
      const abrir = () => { cliente.socket.off("error", erro); resolver(cliente); };
      const erro = (e: Error) => rejeitar(e);
      cliente.socket.once("open", abrir);
      cliente.socket.once("error", erro);
    });
  }

  comando(metodo: string, parametros: Record<string, unknown> = {}): Promise<CdpResposta> {
    const id = ++this.sequencia;
    return new Promise((resolver, rejeitar) => {
      this.pendentes.set(id, { resolver, rejeitar });
      this.socket.send(JSON.stringify({ id, method: metodo, params: parametros }), (erro) => {
        if (erro) {
          this.pendentes.delete(id);
          rejeitar(erro);
        }
      });
    });
  }

  async avaliar<T>(expressao: string): Promise<T> {
    const resposta = await this.comando("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true });
    const resultado = resposta.result?.result as { value?: T; description?: string; objectId?: string } | undefined;
    if (!resultado || !Object.hasOwn(resultado, "value")) throw new Error("resposta_da_planilha_invalida");
    return resultado.value as T;
  }

  fechar() {
    try { this.socket.close(); } catch { return; }
  }
}

async function aguardarProcesso(processo: ChildProcess, limiteMs = 4000) {
  if (processo.exitCode !== null || processo.signalCode !== null) return;
  await new Promise<void>((resolver) => {
    let concluido = false;
    const terminar = () => {
      if (concluido) return;
      concluido = true;
      clearTimeout(relogio);
      resolver();
    };
    const relogio = setTimeout(() => {
      try { processo.kill("SIGKILL"); } catch { /* o processo já encerrou */ }
      terminar();
    }, limiteMs);
    relogio.unref();
    processo.once("exit", terminar);
    processo.once("error", terminar);
  });
}

function removerPastaTemporaria(caminho: string) {
  try {
    rmSync(caminho, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
  } catch {
    // O Windows pode liberar o perfil alguns instantes depois; a pasta é descartável.
  }
}

async function iniciarNavegador(): Promise<{ processo: ChildProcess; cliente: ClienteCdp; pasta: string }> {
  const executavel = caminhoDoNavegador();
  if (!executavel) throw new Error("navegador_nao_encontrado");
  const porta = await portaLivre();
  const pasta = mkdtempSync(join(tmpdir(), "kyro-aderencias-"));
  const processo = spawn(executavel, [
    "--headless=new", "--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox", "--hide-scrollbars",
    "--force-device-scale-factor=3", "--window-size=2400,1600", "--remote-allow-origins=*", `--remote-debugging-port=${porta}`,
    `--user-data-dir=${pasta}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  try {
    const versao = await abrirDebugger(porta);
    if (!versao.webSocketDebuggerUrl) throw new Error("debugger_sem_url");
    const cliente = await ClienteCdp.abrir(versao.webSocketDebuggerUrl);
    await cliente.comando("Emulation.setDeviceMetricsOverride", {
      width: 2400,
      height: 1600,
      deviceScaleFactor: 3,
      mobile: false,
      screenWidth: 2400,
      screenHeight: 1600,
    });
    return { processo, cliente, pasta };
  } catch (erro) {
    processo.kill();
    await aguardarProcesso(processo);
    removerPastaTemporaria(pasta);
    throw erro;
  }
}

async function fecharNavegador(navegador: { processo: ChildProcess; cliente: ClienteCdp; pasta: string }) {
  navegador.cliente.fechar();
  try { navegador.processo.kill(); } catch { /* o processo já encerrou */ }
  await aguardarProcesso(navegador.processo);
  removerPastaTemporaria(navegador.pasta);
}

function idDaPlanilha(url: string): string {
  const id = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url)?.[1] ?? "";
  if (!id) throw new Error("link_da_planilha_invalido");
  return id;
}

function gidDaPlanilha(url: string): string {
  return /[?#&]gid=(\d+)/.exec(url)?.[1] ?? "0";
}

function validarPlanilha(valor: unknown): PlanilhaAderencia {
  const planilha = planilhaAderenciaValida(valor, "planilha");
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(planilha.sheetUrl)) throw new Error("link_da_planilha_invalido");
  if (!planilha.nome || planilha.nome === "Planilha sem nome") throw new Error("nome_da_planilha_obrigatorio");
  idDaPlanilha(planilha.sheetUrl);
  return planilha;
}

const SCRIPT_DA_TABELA = (planilha: PlanilhaAderencia) => `(() => {
  const config = ${JSON.stringify(planilha)};
  const tabela = document.querySelector('table');
  if (!tabela) return { clip: null, celulas: [] };
  const linhas = [...tabela.querySelectorAll('tr')];
  const colIndex = (valor) => { let n = 0; for (const letra of String(valor).toUpperCase()) n = n * 26 + letra.charCodeAt(0) - 64; return Math.max(0, n - 1); };
  const colStart = colIndex(config.colStart), colEnd = colIndex(config.colEnd);
  const inicio = Math.max(0, Number(config.rowStart || 1) - 1), fim = Math.min(linhas.length - 1, Number(config.rowEnd || linhas.length) - 1);
  const headerLinha = config.headerLinha === null ? null : Number(config.headerLinha) - 1;
  const primeira = linhas[Math.min(inicio, linhas.length - 1)];
  const ultima = linhas[Math.min(Math.max(inicio, fim), linhas.length - 1)];
  const cabecalhos = primeira?.querySelectorAll('td,th') || [];
  const inicioCelula = cabecalhos[Math.min(colStart, Math.max(0, cabecalhos.length - 1))];
  const fimCelula = cabecalhos[Math.min(colEnd, Math.max(0, cabecalhos.length - 1))];
  const a = inicioCelula?.getBoundingClientRect(), b = fimCelula?.getBoundingClientRect(), c = primeira?.getBoundingClientRect(), d = ultima?.getBoundingClientRect();
  const clip = a && b && c && d ? { x: Math.max(0, a.left - 6), y: Math.max(0, c.top - 6), width: Math.max(1, b.right - a.left + 12), height: Math.max(1, d.bottom - c.top + 12), scale: 1 } : null;
  const celulas = [];
  for (let r = inicio; r <= fim; r++) {
    if (r === headerLinha) continue;
    const linha = linhas[r]; if (!linha) continue;
    const cells = [...linha.querySelectorAll('td,th')];
    for (let i = 0; i < cells.length; i++) {
      if (i < colStart || i > colEnd) continue;
      const cell = cells[i], cor = getComputedStyle(cell).backgroundColor;
      const m = cor.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/); if (!m) continue;
      const red = Number(m[1]), green = Number(m[2]), blue = Number(m[3]);
      const amarelo = red >= 150 && green >= 130 && red >= green && green - blue >= 20;
      const vermelho = red >= 150 && red - green >= 30 && red - blue >= 30 && Math.abs(green - blue) <= 15;
      if (!amarelo && !vermelho) continue;
      celulas.push({ texto: cell.innerText.trim(), area: cells[i - 1]?.innerText.trim() || '', predio: headerLinha === null ? '' : linhas[headerLinha]?.querySelectorAll('td,th')[i]?.innerText.trim() || '', cor: vermelho ? 'vermelho' : 'amarelo' });
    }
  }
  return { clip, celulas };
})()`;

async function capturar(planilha: PlanilhaAderencia): Promise<CapturaAderencia> {
  const navegador = await iniciarNavegador();
  try {
    await navegador.cliente.comando("Page.enable");
    await navegador.cliente.comando("Runtime.enable");
    const id = idDaPlanilha(planilha.sheetUrl);
    const url = planilha.tabUrl
      ? `https://docs.google.com/spreadsheets/d/${id}/preview/sheet?gid=${gidDaPlanilha(planilha.tabUrl)}`
      : `https://docs.google.com/spreadsheets/d/${id}/preview`;
    await navegador.cliente.comando("Page.navigate", { url });
    const limite = Date.now() + 30000;
    let pronto = false;
    while (Date.now() < limite) {
      pronto = await navegador.cliente.avaliar<boolean>("Boolean(document.querySelector('table'))").catch(() => false);
      if (pronto) break;
      await esperar(500);
    }
    if (!pronto) throw new Error("planilha_sem_tabela");
    await esperar(1200);
    const dados = await navegador.cliente.avaliar<{ clip: { x: number; y: number; width: number; height: number; scale: number } | null; celulas: CelulaAderencia[] }>(SCRIPT_DA_TABELA(planilha));
    for (const escala of ESCALAS_DA_CAPTURA) {
      const parametros = dados.clip
        ? { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { ...dados.clip, scale: escala } }
        : { format: "png", fromSurface: true, captureBeyondViewport: true };
      const imagem = await navegador.cliente.comando("Page.captureScreenshot", parametros);
      const base64 = (imagem.result?.data as string | undefined) ?? "";
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 0 && bytes.length <= LIMITE_IMAGEM) {
        return { bytes, celulas: Array.isArray(dados.celulas) ? dados.celulas : [] };
      }
    }
    throw new Error("print_invalido");
  } finally {
    await fecharNavegador(navegador);
  }
}

export function construirMensagem(planilha: PlanilhaAderencia, celulas: CelulaAderencia[]) {
  const nome = planilha.nome.toUpperCase();
  if (planilha.soPrint) return { texto: `🚨 *PRINT DE ADERÊNCIA · ${nome}*`, alertas: 0, urgentes: 0 };
  const urgentes: CelulaAderencia[] = [];
  const alertas: CelulaAderencia[] = [];
  for (const celula of celulas) {
    const dias = Number.parseInt(celula.texto.trim(), 10);
    if (!Number.isFinite(dias)) continue;
    if (celula.cor === "vermelho" && dias >= planilha.redThreshold) urgentes.push(celula);
    else if (planilha.yellowEnabled && dias >= planilha.yellowThreshold) alertas.push(celula);
  }
  if (!urgentes.length && !alertas.length) return { texto: `🚨 *ALERTA DE LIMPEZA · ${nome}*\n\n✅ *Tudo em dia!*`, alertas: 0, urgentes: 0 };
  const linha = (c: CelulaAderencia) => `*${Number.parseInt(c.texto, 10) || c.texto}d* ➜ ${(c.predio ? `${c.predio} - ${c.area}` : c.area).trim().toUpperCase()}`;
  const partes = [`🚨 *ALERTA DE LIMPEZA · ${nome}*`];
  if (urgentes.length) partes.push(`\n🔴 *CRÍTICO*\n${urgentes.map(linha).join("\n")}`);
  if (alertas.length) partes.push(`\n🟡 *ATENÇÃO*\n${alertas.map(linha).join("\n")}`);
  return { texto: partes.join("\n"), alertas: alertas.length, urgentes: urgentes.length };
}

function previa(planilha: PlanilhaAderencia, captura: CapturaAderencia) {
  const mensagem = construirMensagem(planilha, captura.celulas);
  return { imagem: `data:image/png;base64,${captura.bytes.toString("base64")}`, texto: mensagem.texto, alertas: mensagem.alertas, urgentes: mensagem.urgentes };
}

export function navegadorDeAderenciasDisponivel() {
  return Boolean(caminhoDoNavegador());
}

export async function testarAderencia(valor: unknown) {
  const planilha = validarPlanilha(valor);
  return previa(planilha, await capturar(planilha));
}

export async function enviarAderencia(configuracaoValor: unknown, planilhaValor: unknown) {
  const configuracao = configuracaoAderenciasValida(configuracaoValor);
  if (!configuracao.destinoJid) throw new Error("destino_do_whatsapp_obrigatorio");
  const planilha = validarPlanilha(planilhaValor);
  const captura = await capturar(planilha);
  const resultado = previa(planilha, captura);
  await enviarImagemNoWhatsapp(configuracao.destinoJid, captura.bytes, `aderencia-${planilha.id}.png`, resultado.texto);
  return {
    previa: resultado,
    resultado: { executadoEm: new Date().toISOString(), planilhasEnviadas: 1, alertas: resultado.alertas, urgentes: resultado.urgentes, erros: [] },
  };
}

async function executarLista(destinoJid: string, itens: PlanilhaAderencia[]) {
  const previas: ReturnType<typeof previa>[] = [];
  const erros: string[] = [];
  let alertas = 0; let urgentes = 0; let enviadas = 0;
  for (const item of itens.slice(0, MAXIMO_PLANILHAS)) {
    try {
      const planilha = validarPlanilha(item);
      const captura = await capturar(planilha);
      const resultado = previa(planilha, captura);
      await enviarImagemNoWhatsapp(destinoJid, captura.bytes, `aderencia-${planilha.id}.png`, resultado.texto);
      previas.push(resultado); alertas += resultado.alertas; urgentes += resultado.urgentes; enviadas++;
    } catch (erro) {
      erros.push(`${item.nome || "Planilha"}: ${(erro as Error).message}`);
    }
  }
  return { resultado: { executadoEm: new Date().toISOString(), planilhasEnviadas: enviadas, alertas, urgentes, erros }, previas };
}

export async function executarAderencias(valor: unknown, grupoId?: string) {
  const configuracao = configuracaoAderenciasValida(valor);
  if (!configuracao.destinoJid) throw new Error("destino_do_whatsapp_obrigatorio");
  const grupos = configuracao.grupos.length
    ? (grupoId ? configuracao.grupos.filter((grupo) => grupo.id === grupoId) : configuracao.grupos)
    : [{ planilhas: configuracao.planilhas }];
  const listas = grupos.map((grupo) => grupo.planilhas).filter((planilhas) => planilhas.length > 0);
  if (!listas.length) throw new Error("nenhuma_planilha_configurada");
  const resultados = [];
  for (const lista of listas) {
    resultados.push(await executarLista(configuracao.destinoJid, lista));
  }
  return {
    resultado: {
      executadoEm: new Date().toISOString(),
      planilhasEnviadas: resultados.reduce((total, item) => total + item.resultado.planilhasEnviadas, 0),
      alertas: resultados.reduce((total, item) => total + item.resultado.alertas, 0),
      urgentes: resultados.reduce((total, item) => total + item.resultado.urgentes, 0),
      erros: resultados.flatMap((item) => item.resultado.erros),
    },
    previas: resultados.flatMap((item) => item.previas),
  };
}

export function configuracaoSalva(): ConfiguracaoAderencias {
  try {
    const bruto = JSON.parse(lerTudo()["niko:aderencias"] ?? "null") as { state?: unknown } | null;
    return configuracaoAderenciasValida(bruto?.state ?? bruto);
  } catch {
    return configuracaoAderenciasValida(null);
  }
}

export function salvarConfiguracaoAderencias(valor: unknown): ConfiguracaoAderencias {
  const configuracao = configuracaoAderenciasValida(valor);
  gravar({ "niko:aderencias": JSON.stringify({ state: configuracao, version: 1 }) });
  return configuracao;
}

function atualizarConfiguracaoSalva(parcial: Partial<ConfiguracaoAderencias>) {
  try {
    const todos = lerTudo();
    const anterior = JSON.parse(todos["niko:aderencias"] ?? "null") as { state?: Record<string, unknown>; version?: number } | null;
    const atual = configuracaoAderenciasValida(anterior?.state ?? anterior);
    const novo = { ...atual, ...parcial };
    gravar({ "niko:aderencias": JSON.stringify({ state: novo, version: anterior?.version ?? 1 }) });
  } catch {
    return;
  }
}

function dataHoraBrasilia() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date());
  const valor = (nome: string) => partes.find((p) => p.type === nome)?.value ?? "";
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data: `${valor("year")}-${valor("month")}-${valor("day")}`, hora: `${valor("hour")}:${valor("minute")}`, dia: mapa[valor("weekday")] ?? -1 };
}

async function verificarAgendamento() {
  if (execucaoAgendada) return;
  const config = configuracaoSalva();
  const agora = dataHoraBrasilia();
  const grupos = config.grupos.length ? config.grupos : (config.planilhas.length ? [{ id: "grupo-1", ativo: config.ativo, frequencia: config.frequencia, hora: config.hora, diasSemana: config.diasSemana, planilhas: config.planilhas, ultimoAgendamento: config.ultimoAgendamento }] : []);
  const devidos = grupos.filter((grupo) => grupo.ativo && grupo.frequencia !== "manual" && grupo.planilhas.length > 0 && grupo.hora === agora.hora && (grupo.frequencia !== "semanal" || grupo.diasSemana.includes(agora.dia)));
  if (!config.destinoJid || !devidos.length) return;
  if (estadoDoWhatsapp().vinculo !== "conectado") { iniciarWhatsapp(); return; }
  const devidosNovos = devidos.filter((grupo) => {
    const slot = `${agora.data}T${agora.hora}:${grupo.id}:${grupo.frequencia}`;
    return grupo.ultimoAgendamento !== slot && !slotsExecutados.has(slot);
  });
  if (!devidosNovos.length) return;
  for (const grupo of devidosNovos) slotsExecutados.add(`${agora.data}T${agora.hora}:${grupo.id}:${grupo.frequencia}`);
  execucaoAgendada = true;
  try {
    for (const grupo of devidosNovos) {
      const slot = `${agora.data}T${agora.hora}:${grupo.id}:${grupo.frequencia}`;
      const resposta = await executarAderencias(config, grupo.id);
      const gruposAtualizados = config.grupos.map((item) => item.id === grupo.id ? { ...item, ultimoAgendamento: slot, ultimoResultado: resposta.resultado } : item);
      atualizarConfiguracaoSalva({ grupos: gruposAtualizados });
    }
  } finally {
    execucaoAgendada = false;
    for (const antigo of [...slotsExecutados].filter((s) => !s.startsWith(agora.data))) slotsExecutados.delete(antigo);
  }
}

export function iniciarAgendadorAderencias() {
  if (relogioAgendamento) return;
  relogioAgendamento = setInterval(() => void verificarAgendamento().catch(() => undefined), 30000);
  relogioAgendamento.unref();
}

export function pararAgendadorAderencias() {
  if (relogioAgendamento) clearInterval(relogioAgendamento);
  relogioAgendamento = null;
}
