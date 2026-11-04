import { randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pastaDados } from "../ia.ts";
import { lerSegredo, gravarSegredo, apagarSegredo } from "../segredos.ts";
import { porta as portaDaPonte } from "../claude.ts";
import {
  CaixaWhatsapp, LimiteDeEnvios, caminhoDoQr, conversasDoGateway, dispositivoDoGateway, ehGrupo, eventoDoWebhook, jidNormalizado,
  mensagensDoGateway, numeroParaExibir, recusaDaResposta, webhookAutentico, type ConversaWhatsapp, type EventoWhatsapp, type FiltrosWhatsapp, type MensagemWhatsapp, type RastroWhatsapp, type SituacaoDoVinculo,
} from "./caixa.ts";
import { aguardarGowaParar, alvoDaPlataforma, gowaInstalado, gowaRodando, iniciarGowa, instalacao, instalarGowa, pararGowa, pastaDoWhatsapp, portaLivre } from "./gowa.ts";

export const CAMINHO_DO_WEBHOOK = "/ponte/whatsapp/webhook";
const TICK_MS = 5000;
const SILENCIO_DO_WEBHOOK_MS = 90_000;
const STATUS_CONECTADO_MS = 60_000;
const VARREDURA_COM_WEBHOOK_MS = 60_000;
const VARREDURA_SEM_WEBHOOK_MS = 20_000;
const MAXIMO_DE_NOVIDADES = 50;
const GOWA_EXTERNO = (process.env.NIKO_GOWA_URL ?? "").trim().replace(/\/+$/, "");

type EstadoWhatsappInterno = {
  config: ConfigWhatsapp;
  porta: number;
  dispositivo: string;
  acesso: string;
  segredo: string;
  vinculo: SituacaoDoVinculo | "desligado" | "sem_gateway" | "iniciando";
  eu: string | null;
  qr: { png: string; expira: number } | null;
  erro: string;
  falhasSeguidas: number;
  historicoCarregado: boolean;
  ultimoWebhook: number;
  ultimaVarredura: number;
  ultimoStatus: number;
  conversasAbertas: Map<string, number>;
  nomesPedidos: Set<string>;
  novidades: { seq: number; jid: string; nome: string; grupo: boolean }[];
  seq: number;
};

const contextoWhatsapp = new AsyncLocalStorage<string>();
const idDaSessaoAtual = () => contextoWhatsapp.getStore() ?? (usaGowaExterno() ? "1" : "local");
const idSeguro = (valor: string) => valor.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "local";
const dispositivoDaSessao = (id: string) => id === "local" || id === "1" ? "niko" : `niko-user-${idSeguro(id)}`;
const pastaDosUsuarios = () => join(pastaDados(), "usuarios");
const pastaDaSessao = () => {
  const id = idDaSessaoAtual();
  return id === "local" || id === "1" ? pastaDados() : join(pastaDosUsuarios(), idSeguro(id));
};

export function comWhatsappUsuario<T>(usuarioId: number | string | undefined, trabalho: () => T): T {
  return contextoWhatsapp.run(usuarioId === undefined || usuarioId === null ? (usaGowaExterno() ? "1" : "local") : String(usuarioId), trabalho);
}

export function usuarioDaSessaoWhatsapp(dispositivo: unknown): string | null {
  if (typeof dispositivo !== "string") return null;
  if (dispositivo === "niko") return usaGowaExterno() ? "1" : "local";
  const encontrado = /^niko-user-([a-zA-Z0-9_-]+)$/.exec(dispositivo);
  if (encontrado?.[1]) return encontrado[1];
  const jid = jidNormalizado(dispositivo);
  for (const [id, atual] of estados) {
    if (atual.eu && jidNormalizado(atual.eu) === jid) return id;
  }
  return null;
}

function usaGowaExterno() {
  return Boolean(GOWA_EXTERNO);
}

function urlDoGateway(caminho: string): URL {
  if (GOWA_EXTERNO) return new URL(`${GOWA_EXTERNO}${caminho}`);
  if (!estado.porta) throw new Error("gateway_parado");
  return new URL(`http://127.0.0.1:${estado.porta}${caminho}`);
}

interface ConfigWhatsapp extends FiltrosWhatsapp {
  ligado: boolean;
  lerAoAbrir: boolean;
  mostrarFotos: boolean;
}

const PADRAO: ConfigWhatsapp = { ligado: false, silenciarGrupos: true, ignoradas: [], lerAoAbrir: true, esconderArquivadas: true, esconderGrupos: false, mostrarFotos: true };
const arquivoDeConfig = () => {
  return join(pastaDaSessao(), "whatsapp.json");
};

function lerConfig(): ConfigWhatsapp {
  try {
    if (!existsSync(arquivoDeConfig())) return { ...PADRAO };
    const lido = JSON.parse(readFileSync(arquivoDeConfig(), "utf8")) as Partial<ConfigWhatsapp>;
    return {
      ligado: lido.ligado === true,
      silenciarGrupos: lido.silenciarGrupos !== false,
      ignoradas: Array.isArray(lido.ignoradas) ? lido.ignoradas.filter((j): j is string => typeof j === "string").slice(0, 500) : [],
      lerAoAbrir: lido.lerAoAbrir !== false,
      esconderArquivadas: lido.esconderArquivadas !== false,
      esconderGrupos: lido.esconderGrupos === true,
      mostrarFotos: lido.mostrarFotos !== false,
    };
  } catch {
    return { ...PADRAO };
  }
}

function salvarConfig(c: ConfigWhatsapp) {
  mkdirSync(dirname(arquivoDeConfig()), { recursive: true });
  const temporario = `${arquivoDeConfig()}.${process.pid}.tmp`;
  writeFileSync(temporario, JSON.stringify(c, null, 2), "utf8");
  renameSync(temporario, arquivoDeConfig());
}

async function segredoGuardado(id: string, criar: () => string): Promise<string> {
  const atual = await lerSegredo(id);
  if (atual) return atual;
  const novo = criar();
  await gravarSegredo(id, novo);
  return novo;
}

const estados = new Map<string, EstadoWhatsappInterno>();
const caixas = new Map<string, CaixaWhatsapp>();
const limites = new Map<string, LimiteDeEnvios>();
let portaLocalCompartilhada = 0;
let acessoLocalCompartilhado = "";
let segredoLocalCompartilhado = "";
const relogios = new Map<string, ReturnType<typeof setInterval>>();
const ocupados = new Set<string>();
const primeirasPassadas = new Map<string, Promise<void>>();
const rastrosPorSessao = new Map<string, RastroWhatsapp[]>();
const digitandoPorSessao = new Map<string, Map<string, { nome: string; audio: boolean; ate: number }>>();
const unicasPorSessao = new Map<string, { conhecidas: Set<string>; abertas: Set<string> }>();
const unicasEmAndamentoPorSessao = new Map<string, Set<string>>();
type OuvinteWhatsapp = (pacote: PacoteWhatsapp) => void;
const ouvintesWhatsapp = new Map<string, Set<OuvinteWhatsapp>>();
const notificacoesWhatsappAgendadas = new Set<string>();

export type PacoteWhatsapp = {
  estado: ReturnType<typeof estadoDoWhatsapp>;
  novidades: ReturnType<typeof novidadesDoWhatsapp>["itens"];
};

export function assinarMudancasWhatsapp(usuarioId: number | string, ouvinte: OuvinteWhatsapp): () => void {
  const id = String(usuarioId);
  let ouvintes = ouvintesWhatsapp.get(id);
  if (!ouvintes) {
    ouvintes = new Set();
    ouvintesWhatsapp.set(id, ouvintes);
  }
  ouvintes.add(ouvinte);
  return () => {
    ouvintes?.delete(ouvinte);
    if (ouvintes?.size === 0) ouvintesWhatsapp.delete(id);
  };
}

function notificarMudancaWhatsapp() {
  const id = idDaSessaoAtual();
  if (!ouvintesWhatsapp.has(id) || notificacoesWhatsappAgendadas.has(id)) return;
  notificacoesWhatsappAgendadas.add(id);
  queueMicrotask(() => {
    notificacoesWhatsappAgendadas.delete(id);
    const ouvintes = ouvintesWhatsapp.get(id);
    if (!ouvintes || ouvintes.size === 0) return;
    const pacote = comWhatsappUsuario(id, () => pacoteWhatsapp());
    for (const ouvinte of ouvintes) ouvinte(pacote);
  });
}

function novoEstado(id: string): EstadoWhatsappInterno {
  return {
    config: lerConfig(), porta: 0, dispositivo: dispositivoDaSessao(id), acesso: "", segredo: "", vinculo: "desligado",
    eu: null, qr: null, erro: "", falhasSeguidas: 0, historicoCarregado: false, ultimoWebhook: 0, ultimaVarredura: 0,
    ultimoStatus: 0, conversasAbertas: new Map(), nomesPedidos: new Set(), novidades: [], seq: 0,
  };
}

function estadoDaSessao() {
  const id = idDaSessaoAtual();
  let atual = estados.get(id);
  if (!atual) { atual = novoEstado(id); estados.set(id, atual); }
  return atual;
}

function caixaDaSessao() {
  const id = idDaSessaoAtual();
  let atual = caixas.get(id);
  if (!atual) { atual = new CaixaWhatsapp(); caixas.set(id, atual); }
  return atual;
}

function limiteDaSessao() {
  const id = idDaSessaoAtual();
  let atual = limites.get(id);
  if (!atual) { atual = new LimiteDeEnvios(); limites.set(id, atual); }
  return atual;
}

function arquivoDeRastros() {
  return join(pastaDaSessao(), "whatsapp-rastros.json");
}

function rastrosDaSessao(): RastroWhatsapp[] {
  const id = idDaSessaoAtual();
  let atual = rastrosPorSessao.get(id);
  if (atual) return atual;
  try {
    const lido = existsSync(arquivoDeRastros()) ? JSON.parse(readFileSync(arquivoDeRastros(), "utf8")) as unknown : [];
    atual = Array.isArray(lido) ? lido.filter((r): r is RastroWhatsapp => Boolean(r) && typeof r.id === "string" && typeof r.conversa === "string" && (r.tipo === "apagada" || r.tipo === "editada")).slice(0, 300) : [];
  } catch {
    atual = [];
  }
  rastrosPorSessao.set(id, atual);
  return atual;
}

function salvarRastros(lista: RastroWhatsapp[]) {
  const atual = lista.slice(0, 300);
  rastrosPorSessao.set(idDaSessaoAtual(), atual);
  mkdirSync(dirname(arquivoDeRastros()), { recursive: true });
  const temporario = `${arquivoDeRastros()}.${process.pid}.tmp`;
  writeFileSync(temporario, JSON.stringify(atual), "utf8");
  renameSync(temporario, arquivoDeRastros());
}

function digitandoDaSessao() {
  const id = idDaSessaoAtual();
  let atual = digitandoPorSessao.get(id);
  if (!atual) { atual = new Map(); digitandoPorSessao.set(id, atual); }
  return atual;
}

function arquivoDeUnicas() {
  return join(pastaDaSessao(), "whatsapp-unicas.json");
}

function unicasDaSessao() {
  const id = idDaSessaoAtual();
  let atual = unicasPorSessao.get(id);
  if (atual) return atual;
  try {
    const lido = existsSync(arquivoDeUnicas()) ? JSON.parse(readFileSync(arquivoDeUnicas(), "utf8")) as Record<string, unknown> : {};
    atual = { conhecidas: new Set(Array.isArray(lido.conhecidas) ? lido.conhecidas.filter((v): v is string => typeof v === "string").slice(-2000) : []), abertas: new Set(Array.isArray(lido.abertas) ? lido.abertas.filter((v): v is string => typeof v === "string").slice(-2000) : []) };
  } catch {
    atual = { conhecidas: new Set(), abertas: new Set() };
  }
  unicasPorSessao.set(id, atual);
  return atual;
}

function salvarUnicas() {
  const atual = unicasDaSessao();
  const dados = { conhecidas: [...atual.conhecidas].slice(-2000), abertas: [...atual.abertas].slice(-2000) };
  mkdirSync(dirname(arquivoDeUnicas()), { recursive: true });
  const temporario = `${arquivoDeUnicas()}.${process.pid}.tmp`;
  writeFileSync(temporario, JSON.stringify(dados), "utf8");
  renameSync(temporario, arquivoDeUnicas());
}

const estado = new Proxy({} as EstadoWhatsappInterno, {
  get: (_alvo, propriedade) => Reflect.get(estadoDaSessao(), propriedade),
  set: (_alvo, propriedade, valor) => {
    const atual = estadoDaSessao();
    const anterior = Reflect.get(atual, propriedade);
    const resultado = Reflect.set(atual, propriedade, valor);
    if (resultado && anterior !== valor && typeof propriedade === "string" && new Set(["config", "vinculo", "eu", "qr", "erro", "historicoCarregado", "conversasAbertas", "novidades", "seq"]).has(propriedade)) notificarMudancaWhatsapp();
    return resultado;
  },
});
const caixa = new Proxy({} as CaixaWhatsapp, {
  get: (_alvo, propriedade) => {
    const atual = caixaDaSessao();
    const valor = Reflect.get(atual, propriedade);
    return typeof valor === "function" ? valor.bind(atual) : valor;
  },
});
const envios = new Proxy({} as LimiteDeEnvios, {
  get: (_alvo, propriedade) => {
    const atual = limiteDaSessao();
    const valor = Reflect.get(atual, propriedade);
    return typeof valor === "function" ? valor.bind(atual) : valor;
  },
});

function existeOutraSessaoLigada(id: string): boolean {
  return [...estados.entries()].some(([outroId, atual]) => outroId !== id && atual.config.ligado);
}

function relogioDaSessao() { return relogios.get(idDaSessaoAtual()) ?? null; }
function definirRelogio(valor: ReturnType<typeof setInterval> | null) {
  const id = idDaSessaoAtual();
  if (valor) relogios.set(id, valor); else relogios.delete(id);
}
function ocupadoDaSessao() { return ocupados.has(idDaSessaoAtual()); }
function definirOcupado(valor: boolean) {
  const id = idDaSessaoAtual();
  if (valor) ocupados.add(id); else ocupados.delete(id);
}

async function chamar(metodo: string, caminho: string, opcoes: { query?: Record<string, string>; json?: unknown; tempoMs?: number; binario?: boolean } = {}): Promise<{ status: number; corpo: unknown; bytes?: Buffer }> {
  const url = urlDoGateway(caminho);
  for (const [k, v] of Object.entries(opcoes.query ?? {})) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method: metodo,
    redirect: "manual",
    headers: {
      authorization: `Basic ${Buffer.from(estado.acesso).toString("base64")}`,
      "x-device-id": estado.dispositivo,
      accept: opcoes.binario ? "image/png" : "application/json",
      ...(opcoes.json === undefined ? {} : { "content-type": "application/json" }),
    },
    body: opcoes.json === undefined ? undefined : JSON.stringify(opcoes.json),
    signal: AbortSignal.timeout(opcoes.tempoMs ?? 10_000),
  });
  if (opcoes.binario) return { status: r.status, corpo: null, bytes: Buffer.from(await r.arrayBuffer()) };
  const corpo = await r.json().catch(() => null);
  return { status: r.status, corpo };
}

function codigoDeErro(corpo: unknown) {
  const c = (corpo as Record<string, unknown> | null)?.code;
  return typeof c === "string" ? c : "";
}

async function chamarComSucesso(metodo: string, caminho: string, opcoes: Parameters<typeof chamar>[2] = {}) {
  const r = await chamar(metodo, caminho, opcoes);
  if (r.status === 401) throw new Error("gateway_recusou_acesso");
  if (r.status < 200 || r.status >= 300) throw new Error(codigoDeErro(r.corpo) || `gateway_${r.status}`);
  return r.corpo;
}

function anunciar(m: MensagemWhatsapp) {
  const id = jidNormalizado(m.conversa);
  const conversa = caixa.conversas.get(id);
  if (!conversa) return;
  estado.seq += 1;
  estado.novidades = [...estado.novidades.filter((n) => n.jid !== id), { seq: estado.seq, jid: id, nome: conversa.nome, grupo: conversa.grupo }].slice(-MAXIMO_DE_NOVIDADES);
}

const CONVERSA_ABERTA_MS = 2 * 3600_000;

function conversaEstaAberta(jid: string, agora = Date.now()): boolean {
  const ate = estado.conversasAbertas.get(jid);
  if (ate === undefined) return false;
  if (ate > agora) return true;
  estado.conversasAbertas.delete(jid);
  return false;
}

function guardarRastro(r: RastroWhatsapp | null) {
  if (!r || estado.config.ignoradas.includes(r.conversa)) return;
  salvarRastros([r, ...rastrosDaSessao().filter((x) => !(x.id === r.id && x.tipo === r.tipo && x.quando === r.quando))]);
}

function registrarUnica(id: string) {
  const u = unicasDaSessao();
  if (u.conhecidas.has(id)) return;
  u.conhecidas.add(id);
  salvarUnicas();
}

function comMarcaDeUnica<M extends MensagemWhatsapp>(m: M, u = unicasDaSessao()): M {
  const unica = m.visualizacaoUnica === true || u.conhecidas.has(m.id);
  if (!unica) return m;
  return { ...m, visualizacaoUnica: true, ...(u.abertas.has(m.id) ? { unicaAberta: true } : {}) };
}

function aplicarEvento(e: EventoWhatsapp) {
  if (e.tipo === "mensagem") {
    if (e.mensagem.visualizacaoUnica) registrarUnica(e.mensagem.id);
    digitandoDaSessao().delete(jidNormalizado(e.mensagem.conversa));
    guardar([e.mensagem], true);
  } else if (e.tipo === "apagada") {
    guardarRastro(caixa.aplicarApagada(e.id, e.quando));
    notificarMudancaWhatsapp();
  } else if (e.tipo === "editada") {
    guardarRastro(caixa.aplicarEdicao(e.id, e.texto, e.quando));
    notificarMudancaWhatsapp();
  } else if (e.tipo === "reacao") {
    if (caixa.aplicarReacao(e.id, e.reacao)) notificarMudancaWhatsapp();
  } else if (e.tipo === "entrega") {
    caixa.aplicarEntrega(e.ids, e.estado);
    notificarMudancaWhatsapp();
  } else if (e.parou) {
    digitandoDaSessao().delete(e.conversa);
    notificarMudancaWhatsapp();
  } else {
    digitandoDaSessao().set(e.conversa, { nome: e.nome, audio: e.audio, ate: Date.now() + 12_000 });
    notificarMudancaWhatsapp();
  }
}

function quemDigita(): Record<string, { nome: string; audio: boolean }> {
  const agora = Date.now();
  const saida: Record<string, { nome: string; audio: boolean }> = {};
  for (const [jid, d] of digitandoDaSessao()) {
    if (d.ate < agora) digitandoDaSessao().delete(jid);
    else saida[jid] = { nome: d.nome, audio: d.audio };
  }
  return saida;
}

function guardar(mensagens: MensagemWhatsapp[], avisar: boolean) {
  for (const m of mensagens) {
    const id = jidNormalizado(m.conversa);
    const resultado = caixa.adicionar(m, estado.config, !avisar);
    if (resultado === "repetida" || resultado === "ignorada") continue;
    if (conversaEstaAberta(id) && !m.minha) {
      caixa.marcarLida(id);
      continue;
    }
    if (resultado === "avisar") anunciar(m);
    if (ehGrupo(id) && caixa.conversas.get(id)?.nome === numeroParaExibir(id) && !estado.nomesPedidos.has(id)) void nomearGrupo(id);
  }
  if (mensagens.length > 0) notificarMudancaWhatsapp();
}

async function nomearGrupo(jid: string) {
  estado.nomesPedidos.add(jid);
  try {
    const corpo = await chamarComSucesso("GET", "/group/info", { query: { group_id: jid } });
    const r = (corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined;
    const nome = typeof r?.Name === "string" ? r.Name : typeof r?.name === "string" ? r.name : "";
    if (nome) {
      caixa.renomear(jid, nome);
      notificarMudancaWhatsapp();
    }
  } catch {
    return;
  }
}

async function carregarHistorico() {
  const conversas = conversasDoGateway(await chamarComSucesso("GET", "/chats", { query: { limit: "40" } }));
  if (conversas.length === 0) return;
  for (const c of conversas) caixa.registrarConversa(c.jid, c.nome, c.ultima, estado.config, c.arquivada);
  for (const c of [...conversas].sort((a, b) => b.ultima.localeCompare(a.ultima)).slice(0, 8)) {
    const corpo = await chamarComSucesso("GET", `/chat/${encodeURIComponent(c.jid)}/messages`, { query: { limit: "10" } }).catch(() => null);
    for (const m of mensagensDoGateway(corpo, estado.eu)) caixa.adicionar(m, estado.config, true, ehGrupo(c.jid) ? c.nome || undefined : undefined);
  }
  caixa.marcarTodasLidas();
  estado.historicoCarregado = true;
  estado.ultimaVarredura = Date.now();
}

function horaDeVarrer() {
  const webhookCalado = Date.now() - estado.ultimoWebhook > SILENCIO_DO_WEBHOOK_MS;
  return Date.now() - estado.ultimaVarredura > (webhookCalado ? VARREDURA_SEM_WEBHOOK_MS : VARREDURA_COM_WEBHOOK_MS);
}

async function varrerSemWebhook() {
  const desde = new Date(estado.ultimaVarredura - 5000).toISOString();
  estado.ultimaVarredura = Date.now();
  const conversas = conversasDoGateway(await chamarComSucesso("GET", "/chats", { query: { limit: "40" } }));
  for (const c of conversas) caixa.registrarConversa(c.jid, c.nome, c.ultima, estado.config, c.arquivada);
  for (const c of conversas.filter((x) => x.ultima > desde).slice(0, 8)) {
    const corpo = await chamarComSucesso("GET", `/chat/${encodeURIComponent(c.jid)}/messages`, { query: { limit: "10", start_time: desde } }).catch(() => null);
    guardar(mensagensDoGateway(corpo, estado.eu).sort((a, b) => a.data.localeCompare(b.data)), true);
  }
}

function gatewayAindaConectando(corpo: unknown) {
  const mensagem = (corpo as Record<string, unknown> | null)?.message;
  return codigoDeErro(corpo) === "AUTHENTICATION_ERROR" && typeof mensagem === "string" && /reconnect/i.test(mensagem);
}

async function atualizarQr() {
  if (estado.qr && estado.qr.expira > Date.now()) return;
  const r = await chamar("GET", `/devices/${encodeURIComponent(estado.dispositivo)}/login`, { tempoMs: 45_000 });
  if (codigoDeErro(r.corpo) === "ALREADY_LOGGED_IN" || gatewayAindaConectando(r.corpo)) return;
  if (r.status < 200 || r.status >= 300) throw new Error(codigoDeErro(r.corpo) || `gateway_${r.status}`);
  const qr = caminhoDoQr(r.corpo);
  if (!qr) return;
  const imagem = await chamar("GET", qr.caminho, { binario: true });
  if (imagem.status !== 200 || !imagem.bytes || imagem.bytes.subarray(0, 4).toString("hex") !== "89504e47") return;
  estado.qr = { png: `data:image/png;base64,${imagem.bytes.toString("base64")}`, expira: Date.now() + Math.max(20, qr.segundos * 2 - 5) * 1000 };
}

async function prepararGateway() {
  if (usaGowaExterno()) {
    estado.porta = 1;
    estado.acesso ||= process.env.NIKO_GOWA_BASIC_AUTH?.trim() || process.env.APP_BASIC_AUTH?.trim() || "";
    estado.segredo ||= process.env.NIKO_GOWA_WEBHOOK_SECRET?.trim() || process.env.WHATSAPP_WEBHOOK_SECRET?.trim() || "";
    if (!estado.acesso || !estado.segredo) throw new Error("gateway_externo_sem_credenciais");
    return;
  }
  acessoLocalCompartilhado ||= await segredoGuardado("whatsapp-acesso", () => `niko:${randomBytes(18).toString("hex")}`);
  segredoLocalCompartilhado ||= await segredoGuardado("whatsapp-webhook", () => randomBytes(32).toString("hex"));
  if (!portaLocalCompartilhada) portaLocalCompartilhada = await portaLivre();
  estado.porta = portaLocalCompartilhada;
  estado.acesso = acessoLocalCompartilhado;
  estado.segredo = segredoLocalCompartilhado;
  if (!estado.config.ligado || !relogioDaSessao()) throw new Error("gateway_parado");
  iniciarGowa({ porta: portaLocalCompartilhada, acesso: acessoLocalCompartilhado, urlDoWebhook: `http://127.0.0.1:${portaDaPonte()}${CAMINHO_DO_WEBHOOK}`, segredoDoWebhook: segredoLocalCompartilhado });
}

async function passo() {
  if (ocupadoDaSessao() || !estado.config.ligado) return;
  definirOcupado(true);
  try {
    if (!usaGowaExterno() && !gowaInstalado()) {
      estado.vinculo = "sem_gateway";
      return;
    }
    await prepararGateway();
    if (estado.vinculo === "conectado" && estado.historicoCarregado && estado.falhasSeguidas === 0 && (usaGowaExterno() || gowaRodando()) && Date.now() - estado.ultimoStatus < STATUS_CONECTADO_MS) {
      if (horaDeVarrer()) await varrerSemWebhook();
      return;
    }
    let dispositivo = dispositivoDoGateway(await chamarComSucesso("GET", "/devices"), estado.dispositivo);
    estado.ultimoStatus = Date.now();
    if (!dispositivo) {
      await chamarComSucesso("POST", "/devices", { json: { device_id: estado.dispositivo } });
      dispositivo = { id: estado.dispositivo, vinculo: "precisa_qr", eu: null };
    }
    estado.dispositivo = dispositivo.id;
    estado.vinculo = dispositivo.vinculo;
    estado.eu = dispositivo.eu;
    estado.falhasSeguidas = 0;
    estado.erro = "";
    if (dispositivo.vinculo === "precisa_qr") {
      estado.historicoCarregado = false;
      await atualizarQr();
      return;
    }
    estado.qr = null;
    if (dispositivo.vinculo !== "conectado") return;
    if (!estado.historicoCarregado) await carregarHistorico();
    else if (horaDeVarrer()) await varrerSemWebhook();
  } catch (e) {
    const mensagem = (e as Error).message;
    const gatewayCaiu = /fetch failed|ECONNREFUSED|gateway_parado/i.test(mensagem);
    if (!gatewayCaiu) {
      if (!/aborted|timeout/i.test(mensagem)) estado.erro = mensagem;
      return;
    }
    estado.falhasSeguidas += 1;
    if (estado.falhasSeguidas > 2) {
      estado.erro = "gateway_fora";
      estado.vinculo = "iniciando";
    } else if (estado.vinculo !== "conectado") estado.vinculo = "iniciando";
  } finally {
    definirOcupado(false);
  }
}

function iniciarRelogio() {
  const id = idDaSessaoAtual();
  const passada = primeirasPassadas.get(id);
  if (relogioDaSessao()) return passada ?? Promise.resolve();
  const relogio = setInterval(() => void contextoWhatsapp.run(id, () => passo()), TICK_MS);
  relogio.unref?.();
  definirRelogio(relogio);
  const primeira = passo().finally(() => { primeirasPassadas.delete(id); });
  primeirasPassadas.set(id, primeira);
  void primeira;
  return primeira;
}

function pararTudo(esquecer: boolean) {
  const id = idDaSessaoAtual();
  const relogio = relogioDaSessao();
  if (relogio) clearInterval(relogio);
  definirRelogio(null);
  primeirasPassadas.delete(id);
  if (!existeOutraSessaoLigada(id)) {
    pararGowa();
    portaLocalCompartilhada = 0;
  }
  estado.vinculo = "desligado";
  estado.qr = null;
  estado.porta = 0;
  estado.historicoCarregado = false;
  if (esquecer) {
    caixa.limpar();
    fotos.clear();
    midias.clear();
    estado.novidades = [];
    estado.conversasAbertas.clear();
    digitandoDaSessao().clear();
    rastrosPorSessao.delete(id);
    unicasPorSessao.delete(id);
  }
}

function mapaDaSessao<T>(todas: Map<string, Map<string, T>>): Map<string, T> {
  const id = idDaSessaoAtual();
  let mapa = todas.get(id);
  if (!mapa) { mapa = new Map(); todas.set(id, mapa); }
  return mapa;
}

function conjuntoDaSessao(todos: Map<string, Set<string>>): Set<string> {
  const id = idDaSessaoAtual();
  let conjunto = todos.get(id);
  if (!conjunto) { conjunto = new Set(); todos.set(id, conjunto); }
  return conjunto;
}

function proxyMapa<T>(todas: Map<string, Map<string, T>>): Map<string, T> {
  return new Proxy(new Map<string, T>(), {
    get: (_alvo, propriedade) => {
      const atual = mapaDaSessao(todas);
      const valor = Reflect.get(atual, propriedade);
      return typeof valor === "function" ? valor.bind(atual) : valor;
    },
  });
}

function proxyConjunto(todos: Map<string, Set<string>>): Set<string> {
  return new Proxy(new Set<string>(), {
    get: (_alvo, propriedade) => {
      const atual = conjuntoDaSessao(todos);
      const valor = Reflect.get(atual, propriedade);
      return typeof valor === "function" ? valor.bind(atual) : valor;
    },
  });
}

export function iniciarWhatsapp() {
  if (estado.config.ligado) return iniciarRelogio();
  return Promise.resolve();
}

export function encerrarWhatsapp() {
  pararTudo(true);
}

const FOTO_VALIDA_MS = 6 * 3600_000;
const FOTO_FALHOU_MS = 3600_000;
const TAMANHO_MAXIMO_DA_FOTO = 300_000;
const fotosPorSessao = new Map<string, Map<string, { imagem: string | null; quando: number }>>();
const fotosPedidasPorSessao = new Map<string, Set<string>>();
const fotos = proxyMapa(fotosPorSessao);
const fotosPedidas = proxyConjunto(fotosPedidasPorSessao);

function fotoDoServidorDoWhatsapp(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "whatsapp.net" || u.hostname.endsWith(".whatsapp.net")) ? u.toString() : null;
  } catch {
    return null;
  }
}

async function buscarFoto(jid: string) {
  let imagem: string | null = null;
  try {
    const corpo = await chamarComSucesso("GET", "/user/avatar", { query: { phone: jid, is_preview: "true" }, tempoMs: 8000 });
    const resultado = (corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined;
    const url = fotoDoServidorDoWhatsapp(resultado?.url);
    if (url) {
      const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
      const tipo = r.headers.get("content-type") ?? "";
      const bytes = r.ok && /^image\/(jpeg|png|webp)$/.test(tipo) ? Buffer.from(await r.arrayBuffer()) : null;
      if (bytes && bytes.length <= TAMANHO_MAXIMO_DA_FOTO) imagem = `data:${tipo};base64,${bytes.toString("base64")}`;
    }
  } catch {
    imagem = null;
  }
  fotos.set(jid, { imagem, quando: Date.now() });
  fotosPedidas.delete(jid);
  notificarMudancaWhatsapp();
}

function pedirFotos(conversas: ConversaWhatsapp[]) {
  if (estado.config.mostrarFotos === false || estado.vinculo !== "conectado") return;
  for (const c of conversas) {
    if (fotosPedidas.size >= 2) return;
    const guardada = fotos.get(c.id);
    const validade = guardada?.imagem ? FOTO_VALIDA_MS : FOTO_FALHOU_MS;
    if (fotosPedidas.has(c.id) || (guardada && Date.now() - guardada.quando < validade)) continue;
    fotosPedidas.add(c.id);
    void buscarFoto(c.id);
  }
}

const MIDIAS_BAIXAVEIS = new Set(["imagem", "figurinha", "video", "audio"]);
const TAMANHO_MAXIMO_DA_MIDIA = 25 * 1024 * 1024;
const LIMITE_DAS_MIDIAS_NA_MEMORIA = 80 * 1024 * 1024;
const TIPOS_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", "3gp": "video/3gpp", mov: "video/quicktime",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
};

export function tipoPelosBytes(b: Buffer, midia: string): string | null {
  const hex = b.subarray(0, 4).toString("hex");
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex === "89504e47") return "image/png";
  if (hex === "47494638") return "image/gif";
  if (hex === "52494646" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (hex === "4f676753") return midia === "video" ? "video/ogg" : "audio/ogg";
  if (b.subarray(4, 8).toString("latin1") === "ftyp") return midia === "audio" ? "audio/mp4" : "video/mp4";
  if (hex.startsWith("494433") || hex.startsWith("fffb") || hex.startsWith("fff3")) return "audio/mpeg";
  return null;
}
type MidiaBaixada = { tipo: string; bytes: Buffer };
const midiasPorSessao = new Map<string, Map<string, MidiaBaixada>>();
const midiasEmAndamentoPorSessao = new Map<string, Map<string, Promise<MidiaBaixada>>>();
const midias = proxyMapa(midiasPorSessao);
const midiasEmAndamento = proxyMapa(midiasEmAndamentoPorSessao);

function guardarMidia(chave: string, midia: MidiaBaixada) {
  midias.delete(chave);
  midias.set(chave, midia);
  let total = [...midias.values()].reduce((soma, m) => soma + m.bytes.length, 0);
  for (const [antiga, m] of midias) {
    if (total <= LIMITE_DAS_MIDIAS_NA_MEMORIA || antiga === chave) break;
    total -= m.bytes.length;
    midias.delete(antiga);
  }
}

async function baixarMidia(jid: string, id: string, tipoDaMidia: string, guardar = true): Promise<MidiaBaixada> {
  const corpo = await chamarComSucesso("GET", `/message/${encodeURIComponent(id)}/download`, { query: { phone: jid }, tempoMs: 60_000 });
  const relativo = ((corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined)?.file_path;
  const pasta = resolve(pastaDoWhatsapp());
  const caminho = typeof relativo === "string" && relativo ? resolve(pasta, relativo) : "";
  if (!caminho.startsWith(pasta + sep)) throw new Error("midia_indisponivel");
  try {
    if (statSync(caminho).size > TAMANHO_MAXIMO_DA_MIDIA) throw new Error("midia_grande_demais");
    const bytes = readFileSync(caminho);
    const tipo = tipoPelosBytes(bytes, tipoDaMidia) ?? TIPOS_POR_EXTENSAO[extname(caminho).slice(1).toLowerCase()];
    if (!tipo) throw new Error("midia_formato");
    const midia = { tipo, bytes };
    if (guardar) guardarMidia(`${jid}/${id}`, midia);
    return midia;
  } finally {
    rmSync(caminho, { force: true });
  }
}

async function abrirUnica(conversa: string, mensagem: MensagemWhatsapp): Promise<MidiaBaixada> {
  const u = unicasDaSessao();
  const emAndamento = unicasEmAndamentoPorSessao.get(idDaSessaoAtual()) ?? new Set<string>();
  unicasEmAndamentoPorSessao.set(idDaSessaoAtual(), emAndamento);
  if (u.abertas.has(mensagem.id) || emAndamento.has(mensagem.id)) throw new Error("unica_ja_aberta");
  emAndamento.add(mensagem.id);
  try {
    const midia = await baixarMidia(conversa, mensagem.id, mensagem.midia, false).catch(() => { throw new Error("unica_indisponivel"); });
    u.conhecidas.add(mensagem.id);
    u.abertas.add(mensagem.id);
    salvarUnicas();
    return midia;
  } finally {
    emAndamento.delete(mensagem.id);
  }
}

export async function midiaDaMensagem(jid: unknown, id: unknown): Promise<MidiaBaixada> {
  if (typeof jid !== "string" || typeof id !== "string") throw new Error("pedido_invalido");
  const conversa = caixa.conversas.get(jidNormalizado(jid));
  const mensagem = conversa?.mensagens.find((m) => m.id === id) ?? (conversa ? caixa.mensagem(id) : undefined);
  if (!conversa || !mensagem || mensagem.conversa !== conversa.id || !MIDIAS_BAIXAVEIS.has(mensagem.midia)) throw new Error("midia_indisponivel");
  if (comMarcaDeUnica(mensagem).visualizacaoUnica) return abrirUnica(conversa.id, mensagem);
  if ((mensagem.tamanho ?? 0) > TAMANHO_MAXIMO_DA_MIDIA) throw new Error("midia_grande_demais");
  const chave = `${conversa.id}/${id}`;
  const guardada = midias.get(chave);
  if (guardada) {
    guardarMidia(chave, guardada);
    return guardada;
  }
  let pedido = midiasEmAndamento.get(chave);
  if (!pedido) {
    pedido = baixarMidia(conversa.id, id, mensagem.midia).finally(() => midiasEmAndamento.delete(chave));
    midiasEmAndamento.set(chave, pedido);
  }
  return pedido;
}

function resumoDaConversa(c: ConversaWhatsapp) {
  const foto = estado.config.mostrarFotos === false ? null : fotos.get(c.id)?.imagem ?? null;
  return { ...c, mensagens: c.mensagens.slice(-20).map((m) => comMarcaDeUnica(m)), foto };
}

export function estadoDoWhatsapp() {
  const filtros = estado.config;
  const visiveis = caixa.visiveis(filtros).slice(0, 30);
  const abertas = [...estado.conversasAbertas.keys()].filter((jid) => conversaEstaAberta(jid) && caixa.conversas.has(jid));
  const rastros = rastrosDaSessao();
  pedirFotos(visiveis);
  return {
    suportado: alvoDaPlataforma() !== null,
    ligado: estado.config.ligado,
    instalado: usaGowaExterno() || gowaInstalado(),
    instalacao: { ...instalacao },
    rodando: usaGowaExterno() || gowaRodando(),
    vinculo: estado.config.ligado ? estado.vinculo : "desligado",
    eu: estado.eu,
    qr: estado.vinculo === "precisa_qr" ? estado.qr?.png ?? null : null,
    erro: estado.erro,
    filtros: { silenciarGrupos: filtros.silenciarGrupos, lerAoAbrir: filtros.lerAoAbrir, esconderArquivadas: filtros.esconderArquivadas !== false, esconderGrupos: filtros.esconderGrupos === true, mostrarFotos: filtros.mostrarFotos !== false, ignoradas: filtros.ignoradas },
    conversas: visiveis.map(resumoDaConversa),
    abertas: abertas.map((jid) => caixa.conversas.get(jid)).filter((c): c is ConversaWhatsapp => Boolean(c)).map(resumoDaConversa),
    naoLidas: caixa.naoLidasVisiveis(filtros),
    seq: estado.seq,
    digitando: quemDigita(),
    rastros: rastros.length,
    ultimoRastro: rastros[0]?.quando,
  };
}

export function novidadesDoWhatsapp(desde: number) {
  return { seq: estado.seq, itens: estado.novidades.filter((n) => n.seq > desde) };
}

export function pacoteWhatsapp(): PacoteWhatsapp {
  return { estado: estadoDoWhatsapp(), novidades: [...estado.novidades] };
}

export async function instalarWhatsapp() {
  const versao = await instalarGowa(async () => {
    pararGowa();
    await aguardarGowaParar();
  });
  estado.porta = 0;
  portaLocalCompartilhada = 0;
  if (estado.config.ligado) iniciarRelogio();
  return { ok: true, versao };
}

export function ligarWhatsapp(ligado: boolean) {
  estado.config = { ...estado.config, ligado };
  salvarConfig(estado.config);
  if (ligado) iniciarRelogio();
  else pararTudo(true);
  return estadoDoWhatsapp();
}

export function definirFiltrosDoWhatsapp(dados: Record<string, unknown>) {
  estado.config = {
    ...estado.config,
    ...(typeof dados.silenciarGrupos === "boolean" ? { silenciarGrupos: dados.silenciarGrupos } : {}),
    ...(typeof dados.lerAoAbrir === "boolean" ? { lerAoAbrir: dados.lerAoAbrir } : {}),
    ...(typeof dados.esconderArquivadas === "boolean" ? { esconderArquivadas: dados.esconderArquivadas } : {}),
    ...(typeof dados.esconderGrupos === "boolean" ? { esconderGrupos: dados.esconderGrupos } : {}),
    ...(typeof dados.mostrarFotos === "boolean" ? { mostrarFotos: dados.mostrarFotos } : {}),
  };
  salvarConfig(estado.config);
  return estadoDoWhatsapp();
}

export function ignorarConversa(jid: unknown, ignorar: unknown) {
  if (typeof jid !== "string" || !jid.includes("@") || jid.length > 120) throw new Error("conversa_invalida");
  const id = jidNormalizado(jid);
  const ignoradas = new Set(estado.config.ignoradas);
  if (ignorar === false) ignoradas.delete(id);
  else {
    ignoradas.add(id);
    caixa.remover(id);
    estado.novidades = estado.novidades.filter((n) => n.jid !== id);
  }
  estado.config = { ...estado.config, ignoradas: [...ignoradas] };
  salvarConfig(estado.config);
  return estadoDoWhatsapp();
}

async function confirmarLeitura(jid: string) {
  const conversa = caixa.conversas.get(jid);
  const ultimaRecebida = [...(conversa?.mensagens ?? [])].reverse().find((m) => !m.minha);
  if (!ultimaRecebida) return;
  await chamarComSucesso("POST", `/message/${encodeURIComponent(ultimaRecebida.id)}/read`, { json: { phone: jid } }).catch(() => undefined);
}

export async function abrirConversa(jid: unknown) {
  if (typeof jid !== "string" || !caixa.conversas.has(jidNormalizado(jid))) throw new Error("conversa_invalida");
  const id = jidNormalizado(jid);
  estado.conversasAbertas.set(id, Date.now() + CONVERSA_ABERTA_MS);
  const tinhaNaoLidas = (caixa.conversas.get(id)?.naoLidas ?? 0) > 0;
  const recentes = await chamarComSucesso("GET", `/chat/${encodeURIComponent(id)}/messages`, { query: { limit: "20" } }).catch(() => null);
  for (const m of mensagensDoGateway(recentes, estado.eu)) caixa.adicionar(m, estado.config, true);
  caixa.marcarLida(id);
  estado.novidades = estado.novidades.filter((n) => n.jid !== id);
  if (estado.config.lerAoAbrir && tinhaNaoLidas) await confirmarLeitura(id);
  const conversa = caixa.conversas.get(id);
  return conversa ? resumoDaConversa(conversa) : null;
}

export function fecharConversa(jid?: unknown) {
  if (typeof jid === "string" && jid) estado.conversasAbertas.delete(jidNormalizado(jid));
  else estado.conversasAbertas.clear();
  return { ok: true };
}

export async function enviarMensagem(jid: unknown, texto: unknown) {
  if (typeof jid !== "string" || typeof texto !== "string") throw new Error("pedido_invalido");
  const id = jidNormalizado(jid);
  const recusa = recusaDaResposta(texto, id, caixa);
  if (recusa) throw new Error(`resposta_${recusa}`);
  if (!envios.permitir()) throw new Error("resposta_muitas");
  const corpo = await chamarComSucesso("POST", "/send/message", { json: { phone: id, message: texto.trim() } });
  const idDaMensagem = ((corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined)?.message_id;
  caixa.adicionar({ id: typeof idDaMensagem === "string" ? idDaMensagem : `niko-${randomBytes(6).toString("hex")}`, conversa: id, remetente: estado.eu ?? id, nomeRemetente: "", texto: texto.trim(), midia: "nenhuma", data: new Date().toISOString(), minha: true, mencionaMe: false }, estado.config);
  notificarMudancaWhatsapp();
  await confirmarLeitura(id);
  const conversa = caixa.conversas.get(id);
  return conversa ? resumoDaConversa(conversa) : null;
}

const MENSAGENS_POR_PAGINA = 40;

function conversaConhecida(jid: unknown): string {
  if (typeof jid !== "string" || jid.length > 120 || !caixa.conversas.has(jidNormalizado(jid))) throw new Error("conversa_invalida");
  return jidNormalizado(jid);
}

function idDeMensagem(id: unknown): string {
  if (typeof id !== "string" || !/^[\w.:-]{1,128}$/.test(id)) throw new Error("pedido_invalido");
  return id;
}

export async function historicoDaConversa(jid: unknown, deslocamento: unknown, busca: unknown) {
  const id = conversaConhecida(jid);
  const pular = Math.max(0, Math.min(10_000, Math.floor(Number(deslocamento) || 0)));
  const termo = typeof busca === "string" ? busca.trim().slice(0, 80) : "";
  const corpo = await chamarComSucesso("GET", `/chat/${encodeURIComponent(id)}/messages`, { query: { limit: String(MENSAGENS_POR_PAGINA), offset: String(pular), ...(termo ? { search: termo } : {}) } });
  const paginacao = ((corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined)?.pagination as Record<string, unknown> | undefined;
  const mensagens = mensagensDoGateway(corpo, estado.eu).map((m) => comMarcaDeUnica(caixa.conhecer(m))).sort((a, b) => a.data.localeCompare(b.data));
  return { mensagens, total: typeof paginacao?.total === "number" ? paginacao.total : null, fim: mensagens.length < MENSAGENS_POR_PAGINA };
}

function minhaMensagem(jid: unknown, idBruto: unknown) {
  const conversa = conversaConhecida(jid);
  const id = idDeMensagem(idBruto);
  const m = caixa.mensagem(id);
  if (!m || m.conversa !== conversa) throw new Error("mensagem_sumiu");
  if (!m.minha) throw new Error("mensagem_de_outra_pessoa");
  if (m.apagada) throw new Error("mensagem_ja_apagada");
  return { conversa, id, m };
}

export async function editarMensagem(jid: unknown, idBruto: unknown, texto: unknown) {
  const { conversa, id } = minhaMensagem(jid, idBruto);
  if (typeof texto !== "string") throw new Error("pedido_invalido");
  const recusa = recusaDaResposta(texto, conversa, caixa);
  if (recusa) throw new Error(`resposta_${recusa}`);
  await chamarComSucesso("POST", `/message/${encodeURIComponent(id)}/update`, { json: { phone: conversa, message: texto.trim() } });
  caixa.aplicarEdicao(id, texto.trim(), new Date().toISOString());
  notificarMudancaWhatsapp();
  return caixa.mensagem(id) ?? null;
}

export async function apagarMensagem(jid: unknown, idBruto: unknown) {
  const { conversa, id } = minhaMensagem(jid, idBruto);
  await chamarComSucesso("POST", `/message/${encodeURIComponent(id)}/revoke`, { json: { phone: conversa } });
  caixa.aplicarApagada(id, new Date().toISOString());
  notificarMudancaWhatsapp();
  return caixa.mensagem(id) ?? null;
}

export function rastrosDoWhatsapp() {
  return { rastros: rastrosDaSessao() };
}

export function limparRastros() {
  salvarRastros([]);
  return { rastros: [] };
}

const ANTECEDENCIA_MINIMA_MS = 60_000;
const ANTECEDENCIA_MAXIMA_MS = 365 * 24 * 3600_000;

function fusoDoSistema(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function quandoAgendavel(quando: unknown, agora = Date.now()): string | null {
  if (typeof quando !== "string") return null;
  const t = Date.parse(quando);
  if (Number.isNaN(t) || t < agora + ANTECEDENCIA_MINIMA_MS || t > agora + ANTECEDENCIA_MAXIMA_MS) return null;
  return new Date(t).toISOString();
}

function agendadaDoGateway(a: Record<string, unknown>) {
  const telefone = typeof a.phone === "string" ? a.phone : "";
  const jid = telefone.includes("@") ? jidNormalizado(telefone) : `${telefone.replace(/\D/g, "")}@s.whatsapp.net`;
  const conversa = caixa.conversas.get(jid);
  return {
    id: String(a.id ?? ""), jid, nome: conversa?.nome ?? numeroParaExibir(jid), resumo: typeof a.summary === "string" ? a.summary : "",
    tipo: typeof a.message_type === "string" ? a.message_type : "text", situacao: typeof a.status === "string" ? a.status : "active",
    quando: typeof a.scheduled_at === "string" ? a.scheduled_at : "", proxima: typeof a.next_run_at === "string" ? a.next_run_at : null,
    erro: typeof a.last_error === "string" ? a.last_error : "",
  };
}

export async function listarAgendadas() {
  const corpo = await chamarComSucesso("GET", "/send/schedules", { query: { limit: "50" } });
  const lista = ((corpo as Record<string, unknown> | null)?.results as Record<string, unknown> | undefined)?.data;
  return { agendadas: Array.isArray(lista) ? lista.filter((a) => a && typeof a === "object" && (a as Record<string, unknown>).id !== undefined).map((a) => agendadaDoGateway(a as Record<string, unknown>)) : [] };
}

export async function agendarMensagem(jid: unknown, texto: unknown, quandoBruto: unknown) {
  const id = conversaConhecida(jid);
  if (typeof texto !== "string") throw new Error("pedido_invalido");
  const recusa = recusaDaResposta(texto, id, caixa);
  if (recusa) throw new Error(`resposta_${recusa}`);
  const quando = quandoAgendavel(quandoBruto);
  if (!quando) throw new Error("agenda_horario_invalido");
  if (!envios.permitir()) throw new Error("resposta_muitas");
  await chamarComSucesso("POST", "/send/message", { json: { phone: id, message: texto.trim(), scheduled_at: quando, timezone: fusoDoSistema() } });
  return listarAgendadas();
}

export async function cancelarAgendada(idBruto: unknown) {
  if (typeof idBruto !== "string" || !/^[\w-]{1,80}$/.test(idBruto)) throw new Error("pedido_invalido");
  await chamarComSucesso("POST", `/send/schedules/${encodeURIComponent(idBruto)}/cancel`);
  return listarAgendadas();
}

const TAMANHO_MAXIMO_DO_ENVIO = 16 * 1024 * 1024;

export async function enviarImagemNoWhatsapp(jid: unknown, bytes: Buffer, nome = "imagem.png", legenda = "") {
  if (typeof jid !== "string") throw new Error("pedido_invalido");
  const id = jidNormalizado(jid);
  if (!jid.includes("@") || !caixa.conversas.has(id)) throw new Error("resposta_sem_conversa");
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new Error("arquivo_vazio");
  if (bytes.length > TAMANHO_MAXIMO_DO_ENVIO) throw new Error("arquivo_grande_demais");
  if (!envios.permitir()) throw new Error("resposta_muitas");
  if (!estado.porta) throw new Error("gateway_parado");
  const tipo = tipoPelosBytes(bytes, "");
  if (tipo !== "image/png" && tipo !== "image/jpeg") throw new Error("imagem_formato");
  const arquivo = nome.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "imagem.png";
  const texto = legenda.trim().slice(0, 1024);
  const formulario = new FormData();
  formulario.set("phone", id);
  if (texto) formulario.set("caption", texto);
  formulario.set("image", new Blob([new Uint8Array(bytes)], { type: tipo }), arquivo);
  const r = await fetch(urlDoGateway("/send/image"), {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(estado.acesso).toString("base64")}`, "x-device-id": estado.dispositivo },
    body: formulario,
    signal: AbortSignal.timeout(120_000),
  });
  const corpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) throw new Error(codigoDeErro(corpo) || `gateway_${r.status}`);
  const idDaMensagem = (corpo?.results as Record<string, unknown> | undefined)?.message_id;
  const idFinal = typeof idDaMensagem === "string" ? idDaMensagem : `niko-${randomBytes(6).toString("hex")}`;
  guardarMidia(`${id}/${idFinal}`, { tipo, bytes });
  caixa.adicionar({ id: idFinal, conversa: id, remetente: estado.eu ?? id, nomeRemetente: "", texto, midia: "imagem", nomeDoArquivo: arquivo, tamanho: bytes.length, data: new Date().toISOString(), minha: true, mencionaMe: false }, estado.config);
  notificarMudancaWhatsapp();
  const conversa = caixa.conversas.get(id);
  return conversa ? resumoDaConversa(conversa) : null;
}

function lerBytes(req: IncomingMessage, limite: number): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    let partes: Buffer[] = [];
    let tamanho = 0;
    req.on("data", (p: Buffer) => {
      tamanho += p.length;
      if (tamanho > limite) partes = [];
      else partes.push(p);
    });
    req.on("end", () => (tamanho > limite ? rejeitar(new Error("arquivo_grande_demais")) : resolver(Buffer.concat(partes))));
    req.on("error", rejeitar);
  });
}

function rotaDoEnvio(bytes: Buffer): { caminho: string; campo: string; midia: MensagemWhatsapp["midia"] } {
  const tipo = tipoPelosBytes(bytes, "");
  if (tipo === "image/jpeg" || tipo === "image/png") return { caminho: "/send/image", campo: "image", midia: "imagem" };
  if (tipo === "video/mp4") return { caminho: "/send/video", campo: "video", midia: "video" };
  return { caminho: "/send/file", campo: "file", midia: "documento" };
}

export async function enviarArquivoNoWhatsapp(req: IncomingMessage, consulta: URLSearchParams) {
  const jid = consulta.get("jid") ?? "";
  const nome = (consulta.get("nome") ?? "arquivo").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "arquivo";
  const legenda = (consulta.get("legenda") ?? "").trim().slice(0, 1024);
  const id = jidNormalizado(jid);
  if (!jid.includes("@") || !caixa.conversas.has(id)) throw new Error("resposta_sem_conversa");
  const bytes = await lerBytes(req, TAMANHO_MAXIMO_DO_ENVIO);
  if (bytes.length === 0) throw new Error("arquivo_vazio");
  if (!envios.permitir()) throw new Error("resposta_muitas");
  if (!estado.porta) throw new Error("gateway_parado");
  const rota = rotaDoEnvio(bytes);
  const tipoDoArquivo = tipoPelosBytes(bytes, rota.midia) ?? "application/octet-stream";
  const formulario = new FormData();
  formulario.set("phone", id);
  if (legenda) formulario.set("caption", legenda);
  formulario.set(rota.campo, new Blob([new Uint8Array(bytes)], { type: tipoDoArquivo }), nome);
  const r = await fetch(urlDoGateway(rota.caminho), {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(estado.acesso).toString("base64")}`, "x-device-id": estado.dispositivo },
    body: formulario,
    signal: AbortSignal.timeout(120_000),
  });
  const corpo = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) throw new Error(codigoDeErro(corpo) || `gateway_${r.status}`);
  const idDaMensagem = (corpo?.results as Record<string, unknown> | undefined)?.message_id;
  const idFinal = typeof idDaMensagem === "string" ? idDaMensagem : `niko-${randomBytes(6).toString("hex")}`;
  const tipo = tipoPelosBytes(bytes, rota.midia);
  if (tipo && rota.midia !== "documento") guardarMidia(`${id}/${idFinal}`, { tipo, bytes });
  caixa.adicionar({ id: idFinal, conversa: id, remetente: estado.eu ?? id, nomeRemetente: "", texto: legenda, midia: rota.midia, nomeDoArquivo: nome, tamanho: bytes.length, data: new Date().toISOString(), minha: true, mencionaMe: false }, estado.config);
  notificarMudancaWhatsapp();
  const conversa = caixa.conversas.get(id);
  return conversa ? resumoDaConversa(conversa) : null;
}

export async function desconectarWhatsapp() {
  await chamarComSucesso("POST", `/devices/${encodeURIComponent(estado.dispositivo)}/logout`).catch(() => undefined);
  caixa.limpar();
  estado.novidades = [];
  estado.historicoCarregado = false;
  estado.qr = null;
  estado.vinculo = "precisa_qr";
  return estadoDoWhatsapp();
}

export async function esquecerWhatsapp() {
  await chamarComSucesso("POST", `/devices/${encodeURIComponent(estado.dispositivo)}/logout`).catch(() => undefined);
  pararTudo(true);
  if (!existeOutraSessaoLigada(idDaSessaoAtual())) await aguardarGowaParar();
  rmSync(arquivoDeRastros(), { force: true });
  rmSync(arquivoDeUnicas(), { force: true });
  rastrosPorSessao.delete(idDaSessaoAtual());
  unicasPorSessao.delete(idDaSessaoAtual());
  unicasEmAndamentoPorSessao.delete(idDaSessaoAtual());
  if (!existeOutraSessaoLigada(idDaSessaoAtual())) {
    await apagarSegredo("whatsapp-acesso").catch(() => undefined);
    await apagarSegredo("whatsapp-webhook").catch(() => undefined);
    acessoLocalCompartilhado = "";
    segredoLocalCompartilhado = "";
  }
  estado.acesso = "";
  estado.segredo = "";
  estado.config = { ...PADRAO };
  salvarConfig(estado.config);
  return estadoDoWhatsapp();
}

const LIMITE_DO_CORPO = 1_000_000;

export function receberWebhookDoWhatsapp(req: IncomingMessage, res: ServerResponse) {
  const partes: Buffer[] = [];
  let tamanho = 0;
  let recusado = false;
  req.on("data", (p: Buffer) => {
    tamanho += p.length;
    if (tamanho > LIMITE_DO_CORPO) {
      recusado = true;
      req.destroy();
      return;
    }
    partes.push(p);
  });
  req.on("end", () => {
    if (recusado) return;
    const corpo = Buffer.concat(partes);
    let lido: unknown;
    try {
      lido = JSON.parse(corpo.toString("utf8"));
    } catch {
      return;
    }
    const raizWebhook = lido as Record<string, unknown> | null;
    // O GOWA envia o JID em device_id e o identificador criado em /devices
    // em session_id. Para contas remotas, a sessão é a chave de roteamento.
    const sessaoWebhook = typeof raizWebhook?.session_id === "string" ? raizWebhook.session_id : raizWebhook?.device_id;
    const usuario = usuarioDaSessaoWhatsapp(sessaoWebhook);
    if (!usuario) {
      res.statusCode = 401;
      return res.end();
    }
    let autenticado = false;
    comWhatsappUsuario(usuario, () => {
      autenticado = estado.config.ligado && webhookAutentico(corpo, req.headers["x-hub-signature-256"], estado.segredo);
    });
    if (!autenticado) {
      res.statusCode = 401;
      return res.end();
    }
    res.statusCode = 200;
    res.end();
    void comWhatsappUsuario(usuario, () => {
      const evento = eventoDoWebhook(lido, estado.eu);
      if (!evento) return;
      estado.ultimoWebhook = Date.now();
      if (evento.tipo !== "mensagem" || estado.historicoCarregado) aplicarEvento(evento);
    });
  });
}
