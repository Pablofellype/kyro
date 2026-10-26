import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { objeto } from "../utilitarios/validacoes";
import { endpointTempoReal } from "./tempoReal";

export const PREFIXO = "niko:";
const bancoDeTeste = (() => {
  try {
    const nome = new URLSearchParams(window.location.search).get("banco") ?? "";
    return /^[a-z0-9-]{1,20}$/.test(nome) ? nome : "";
  } catch {
    return "";
  }
})();
const CABECALHOS: Record<string, string> = { "x-niko": "1", "content-type": "application/json", ...(bancoDeTeste ? { "x-niko-banco": bancoDeTeste } : {}) };
const CHAVE_CLIENTE = "kyro_cliente_id";

function tokenDaSessao(): string | null {
  try {
    const token = localStorage.getItem("kyro_token");
    return token?.trim() || null;
  } catch {
    return null;
  }
}

function endpointDosDados(): string {
  return tokenDaSessao() ? "/api/dados" : "/ponte/dados";
}

function clienteDaInstalacao(): string | null {
  try {
    const existente = localStorage.getItem(CHAVE_CLIENTE)?.trim();
    if (existente && /^[a-z0-9:_-]{8,120}$/i.test(existente)) return existente;
    const aleatorio = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    const cliente = `cliente-${aleatorio}`.slice(0, 120);
    localStorage.setItem(CHAVE_CLIENTE, cliente);
    return cliente;
  } catch {
    return null;
  }
}

export function idDoCliente(): string | null {
  return clienteDaInstalacao();
}

function cabecalhosDosDados(): Record<string, string> {
  const token = tokenDaSessao();
  if (!token) return CABECALHOS;
  const cliente = clienteDaInstalacao();
  return { ...CABECALHOS, Authorization: `Bearer ${token}`, ...(cliente ? { "x-niko-cliente": cliente } : {}) };
}

export function cabecalhoDoBanco(): Record<string, string> {
  return bancoDeTeste ? { "x-niko-banco": bancoDeTeste } : {};
}

export type ModoArmazenamento = "banco" | "local";

export interface RegistroHistoricoSincronia {
  versao: string;
  operacao: "alteracao" | "zerar";
  chaves: string[];
  clienteId: string | null;
  criadoEm: string;
}

export interface RegistroBackupSincronia {
  id: number;
  versao: string;
  motivo: "alteracao" | "zerar" | "manual";
  itens: number;
  criadoEm: string;
}

let modo: ModoArmazenamento = "local";
const cache = new Map<string, string>();
const pendentes = new Map<string, string | null>();
const emEnvio = new Map<string, string | null>();
let envioEmAndamento: Promise<void> | null = null;
let ouvintesIniciados = false;
let temporizador = 0;
let versaoRemota = "";
let versaoBaseLocal: string | null = null;
let websocketSincronia: WebSocket | null = null;
let temporizadorReconexaoWebsocket = 0;
let atrasoReconexaoWebsocket = 1000;
let sincroniaTempoRealAtiva = false;
const snapshotRemoto = new Map<string, string>();
const CHAVE_FILA_SINCRONIA = "niko:sincronia-pendente:";
export type EstadoSincronia = "local" | "conectado" | "sincronizando" | "pendente" | "offline" | "conflito";
export interface SituacaoSincronia {
  estado: EstadoSincronia;
  pendentes: number;
  ultimaSincronia: number | null;
}
let situacaoSincronia: SituacaoSincronia = { estado: "local", pendentes: 0, ultimaSincronia: null };
const ouvintesSincronia = new Set<() => void>();

function definirSituacaoSincronia(estado: EstadoSincronia, pendentes = 0, ultimaSincronia = situacaoSincronia.ultimaSincronia) {
  const estadoAnterior = situacaoSincronia.estado;
  const nova = { estado, pendentes, ultimaSincronia } satisfies SituacaoSincronia;
  if (nova.estado === situacaoSincronia.estado && nova.pendentes === situacaoSincronia.pendentes && nova.ultimaSincronia === situacaoSincronia.ultimaSincronia) return;
  situacaoSincronia = nova;
  ouvintesSincronia.forEach((ouvinte) => ouvinte());
  if (estado === "conectado" && (estadoAnterior === "offline" || estadoAnterior === "conflito") && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("niko:sincronizacao-restabelecida"));
  }
}

function chaveDaFilaSincronia(): string | null {
  try {
    const usuario = JSON.parse(localStorage.getItem("kyro_usuario") ?? "null") as { id?: unknown } | null;
    return typeof usuario?.id === "number" && Number.isSafeInteger(usuario.id) && usuario.id > 0 ? `${CHAVE_FILA_SINCRONIA}${usuario.id}` : null;
  } catch {
    return null;
  }
}

function persistirFilaSincronia() {
  const chave = chaveDaFilaSincronia();
  if (!chave) return;
  try {
    const itens = Object.fromEntries([...emEnvio, ...pendentes]);
    if (Object.keys(itens).length === 0) {
      localStorage.removeItem(chave);
      return;
    }
    localStorage.setItem(chave, JSON.stringify({ versao: versaoBaseLocal ?? versaoRemota, itens }));
  } catch {
    return;
  }
}

function lerFilaSincronia(): { versao: string; itens: Record<string, string | null> } | null {
  const chave = chaveDaFilaSincronia();
  if (!chave) return null;
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chave) ?? "null");
    if (!objeto(bruto) || typeof bruto.versao !== "string" || !objeto(bruto.itens)) return null;
    const itens: Record<string, string | null> = {};
    for (const [nome, valor] of Object.entries(bruto.itens)) {
      if (!/^niko:[a-z0-9_-]{1,60}$/.test(nome) || (valor !== null && (typeof valor !== "string" || valor.length > 20_000_000))) return null;
      itens[nome] = valor;
    }
    return Object.keys(itens).length ? { versao: bruto.versao, itens } : null;
  } catch {
    return null;
  }
}

export function lerSituacaoSincronia(): SituacaoSincronia {
  return situacaoSincronia;
}

export function aoMudarSincronia(ouvinte: () => void): () => void {
  ouvintesSincronia.add(ouvinte);
  return () => ouvintesSincronia.delete(ouvinte);
}

const nomeCanal = bancoDeTeste ? `niko-dados-${bancoDeTeste}` : "niko-dados";
const canal = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(nomeCanal) : null;
const ouvintesDeFora = new Set<(chave: string) => void>();
const preparadoresDeSaida = new Set<() => Promise<void>>();
let tentativaDeSaida = 0;

export function aoPrepararSaida(fn: () => Promise<void>): () => void {
  preparadoresDeSaida.add(fn);
  return () => preparadoresDeSaida.delete(fn);
}
const ORIGEM = Math.random().toString(36).slice(2);
const EVENTO_DADOS = nomeCanal;
const avisosPendentes = new Map<string, string | null>();
let temporizadorAviso = 0;

interface MudancaDeDados {
  banco: string;
  origem: string;
  chave: string;
  valor: string | null;
}

function tauriDisponivel(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function avisarOutrasJanelas(chave: string, valor: string | null) {
  canal?.postMessage({ origem: ORIGEM, banco: bancoDeTeste, chave, valor } satisfies MudancaDeDados);
  if (!tauriDisponivel()) return;
  avisosPendentes.set(chave, valor);
  if (temporizadorAviso) return;
  temporizadorAviso = window.setTimeout(async () => {
    temporizadorAviso = 0;
    const itens = [...avisosPendentes];
    avisosPendentes.clear();
    try {
      const { emit } = await import("@tauri-apps/api/event");
      for (const [c, v] of itens) await emit(EVENTO_DADOS, { origem: ORIGEM, banco: bancoDeTeste, chave: c, valor: v } satisfies MudancaDeDados);
    } catch {
      return;
    }
  }, 120);
}

const ORIGEM_DA_PONTE = "ponte";
const TEMPO_PARA_A_PONTE_ALCANCAR_MS = 5000;
const recebidosDeOutraJanela = new Map<string, number>();

function receberDeFora(m: unknown) {
  if (!objeto(m) || m.banco !== bancoDeTeste || typeof m.origem !== "string" || typeof m.chave !== "string" || !/^niko:[a-z0-9_-]{1,60}$/.test(m.chave) || (m.valor !== null && (typeof m.valor !== "string" || m.valor.length > 20_000_000))) return;
  if (m.origem === ORIGEM || pendentes.has(m.chave) || emEnvio.has(m.chave)) return;
  if (m.origem === ORIGEM_DA_PONTE && Date.now() - (recebidosDeOutraJanela.get(m.chave) ?? 0) < TEMPO_PARA_A_PONTE_ALCANCAR_MS) return;
  if (m.origem !== ORIGEM_DA_PONTE) recebidosDeOutraJanela.set(m.chave, Date.now());
  const atual = cache.get(m.chave) ?? null;
  if (atual === m.valor) return;
  if (m.valor === null) cache.delete(m.chave);
  else cache.set(m.chave, m.valor as string);
  const chaveRecebida = m.chave;
  ouvintesDeFora.forEach((f) => f(chaveRecebida));
}

function atualizarSnapshotRemoto(dados: Record<string, string>) {
  const chaves = new Set([...snapshotRemoto.keys(), ...Object.keys(dados)]);
  for (const k of chaves) {
    if (Object.hasOwn(dados, k)) snapshotRemoto.set(k, dados[k]);
    else snapshotRemoto.delete(k);
  }
}

function aplicarDadosRecebidos(dados: Record<string, string>, origem: string) {
  const chaves = new Set([...cache.keys(), ...Object.keys(dados)]);
  for (const k of chaves) receberDeFora({ origem, banco: bancoDeTeste, chave: k, valor: Object.hasOwn(dados, k) ? dados[k] : null });
  if (origem === "remoto") atualizarSnapshotRemoto(dados);
}

async function jsonDaResposta(resposta: { json?: () => Promise<unknown> }): Promise<unknown> {
  if (typeof resposta.json !== "function") return null;
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

function reconciliarConflito(itens: Record<string, string | null>, resposta: unknown) {
  const dados = validarDadosRecebidos(resposta);
  const protegidas = new Set([...Object.keys(itens), ...pendentes.keys()]);
  const conflitos: string[] = [];
  for (const chave of Object.keys(itens)) {
    const anterior = snapshotRemoto.get(chave) ?? null;
    const atual = Object.hasOwn(dados, chave) ? dados[chave] : null;
    if (anterior !== atual) conflitos.push(chave);
  }
  atualizarSnapshotRemoto(dados);
  const chaves = new Set([...cache.keys(), ...Object.keys(dados)]);
  for (const chave of chaves) {
    if (protegidas.has(chave)) continue;
    const valor = Object.hasOwn(dados, chave) ? dados[chave] : null;
    const anterior = cache.get(chave) ?? null;
    if (anterior === valor) continue;
    if (valor === null) cache.delete(chave);
    else cache.set(chave, valor);
    ouvintesDeFora.forEach((f) => f(chave));
  }
  for (const [chave, valor] of Object.entries(itens)) {
    if (!pendentes.has(chave)) pendentes.set(chave, valor);
  }
  const versao = objeto(resposta) && typeof resposta.versao === "string" ? resposta.versao : null;
  if (versao) {
    versaoRemota = versao;
    versaoBaseLocal = versao;
  }
  if (conflitos.length) {
    window.dispatchEvent(new CustomEvent("niko:sincronizacao-conflito", { detail: { chaves: conflitos } }));
  }
}

async function recarregarDaPonte() {
  if (modo !== "banco") return;
  const token = tokenDaSessao();
  try {
    const endpoint = endpointDosDados();
    const desde = token && versaoRemota ? `?desde=${encodeURIComponent(versaoRemota)}` : "";
    const r = await fetch(`${endpoint}${desde}`, { headers: cabecalhosDosDados(), signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
      definirSituacaoSincronia(token ? "offline" : "local", pendentes.size);
      return;
    }
    const resposta: unknown = await r.json();
    if (!objeto(resposta)) return;
    if (typeof resposta.versao === "string") versaoRemota = resposta.versao;
    if (resposta.alterado === false) {
      definirSituacaoSincronia(token ? (pendentes.size ? "pendente" : "conectado") : "local", pendentes.size, token ? Date.now() : situacaoSincronia.ultimaSincronia);
      return;
    }
    const dados = validarDadosRecebidos(resposta);
    aplicarDadosRecebidos(dados, token ? "remoto" : ORIGEM_DA_PONTE);
    definirSituacaoSincronia(token ? (pendentes.size ? "pendente" : "conectado") : "local", pendentes.size, Date.now());
  } catch {
    definirSituacaoSincronia(token ? "offline" : "local", pendentes.size);
    return;
  }
}

function urlDaSincroniaTempoReal(): string | null {
  // Funções serverless/web não oferecem upgrade WebSocket de forma confiável.
  // No navegador, o polling HTTP é o canal oficial; o desktop informa a ponte
  // local explicitamente quando ela está disponível.
  return endpointTempoReal();
}

function agendarReconexaoTempoReal() {
  if (temporizadorReconexaoWebsocket || !tokenDaSessao()) return;
  const atraso = atrasoReconexaoWebsocket;
  atrasoReconexaoWebsocket = Math.min(atrasoReconexaoWebsocket * 2, 30000);
  temporizadorReconexaoWebsocket = window.setTimeout(() => {
    temporizadorReconexaoWebsocket = 0;
    conectarTempoReal();
  }, atraso);
}

function conectarTempoReal() {
  if (modo !== "banco" || !tokenDaSessao() || typeof WebSocket === "undefined") return;
  if (websocketSincronia && (websocketSincronia.readyState === WebSocket.OPEN || websocketSincronia.readyState === WebSocket.CONNECTING)) return;
  const url = urlDaSincroniaTempoReal();
  const token = tokenDaSessao();
  if (!url || !token) return;
  try {
    const socket = new WebSocket(url);
    websocketSincronia = socket;
    socket.addEventListener("open", () => {
      atrasoReconexaoWebsocket = 1000;
      socket.send(JSON.stringify({ tipo: "autenticar", token }));
    });
    socket.addEventListener("message", (evento) => {
      let mensagem: unknown;
      try {
        mensagem = JSON.parse(String(evento.data));
      } catch {
        return;
      }
      if (!objeto(mensagem) || typeof mensagem.tipo !== "string") return;
      if (mensagem.tipo === "pronto") {
        sincroniaTempoRealAtiva = true;
        definirSituacaoSincronia(pendentes.size ? "pendente" : "conectado", pendentes.size, Date.now());
        return;
      }
      if (mensagem.tipo !== "dados" || !objeto(mensagem.dados)) return;
      if (typeof mensagem.versao === "string") versaoRemota = mensagem.versao;
      try {
        aplicarDadosRecebidos(validarDadosRecebidos(mensagem), "remoto");
        if (pendentes.size === 0) definirSituacaoSincronia("conectado", 0, Date.now());
      } catch {
        return;
      }
    });
    socket.addEventListener("close", () => {
      if (websocketSincronia === socket) websocketSincronia = null;
      sincroniaTempoRealAtiva = false;
      // A queda do tempo real não significa que o banco ficou offline. O
      // fallback HTTP confirma a disponibilidade antes de alterar o estado.
      void recarregarDaPonte();
      agendarReconexaoTempoReal();
    });
    socket.addEventListener("error", () => undefined);
  } catch {
    websocketSincronia = null;
    sincroniaTempoRealAtiva = false;
    agendarReconexaoTempoReal();
  }
}

function localSeguro<T>(fn: () => T, reserva: T): T {
  try {
    return fn();
  } catch {
    return reserva;
  }
}

function enviarPendentes(manterViva = false): Promise<void> {
  window.clearTimeout(temporizador);
  temporizador = 0;
  if (envioEmAndamento) return envioEmAndamento;
  envioEmAndamento = (async () => {
    while (pendentes.size > 0) {
      const itens = Object.fromEntries(pendentes);
      definirSituacaoSincronia(tokenDaSessao() ? "sincronizando" : "local", Object.keys(itens).length);
      pendentes.clear();
      for (const [k, v] of Object.entries(itens)) emEnvio.set(k, v);
      persistirFilaSincronia();
      const controle = new AbortController();
      const limite = window.setTimeout(() => controle.abort(), 8000);
      try {
        const corpo = JSON.stringify({ itens, versao: versaoBaseLocal ?? versaoRemota });
        const r = await fetch(endpointDosDados(), { method: "POST", headers: cabecalhosDosDados(), body: corpo, signal: controle.signal, keepalive: manterViva && new TextEncoder().encode(corpo).length < 60000 });
        if (r.status === 409) {
          const resposta: unknown = await jsonDaResposta(r);
          if (objeto(resposta) && resposta.erro === "conflito_sincronizacao" && typeof resposta.versao === "string" && objeto(resposta.dados)) {
            reconciliarConflito(itens, resposta);
            definirSituacaoSincronia("conflito", pendentes.size);
            persistirFilaSincronia();
            continue;
          }
        }
        if (!r.ok) throw new Error(`http_${r.status}`);
        const resposta: unknown = await jsonDaResposta(r);
        if (objeto(resposta) && typeof resposta.versao === "string") {
          versaoRemota = resposta.versao;
          versaoBaseLocal = pendentes.size > 0 ? resposta.versao : null;
        }
        for (const [chave, valor] of Object.entries(itens)) {
          if (valor === null) snapshotRemoto.delete(chave);
          else snapshotRemoto.set(chave, valor);
        }
      } catch (erro) {
        for (const [k, v] of Object.entries(itens)) if (!pendentes.has(k) && (cache.get(k) ?? null) === v) pendentes.set(k, v);
        persistirFilaSincronia();
        definirSituacaoSincronia(tokenDaSessao() ? "offline" : "local", pendentes.size);
        window.dispatchEvent(new CustomEvent("niko:armazenamento-falhou"));
        agendar(4000);
        throw erro;
      } finally {
        window.clearTimeout(limite);
        emEnvio.clear();
        persistirFilaSincronia();
      }
    }
  })().finally(() => {
    envioEmAndamento = null;
    if (pendentes.size === 0 && situacaoSincronia.estado === "sincronizando") {
      definirSituacaoSincronia(tokenDaSessao() ? "conectado" : "local", 0, tokenDaSessao() ? Date.now() : situacaoSincronia.ultimaSincronia);
    }
  });
  return envioEmAndamento;
}

function agendar(ms = 350) {
  if (temporizador) return;
  temporizador = window.setTimeout(() => void enviarPendentes().catch(() => undefined), ms);
}

const armazenamentoSeguro: StateStorage = {
  getItem: (nome) => (modo === "banco" ? cache.get(nome) ?? null : localSeguro(() => localStorage.getItem(nome), cache.get(nome) ?? null)),
  setItem: (nome, valor) => {
    if (travado) return;
    if (modo === "banco") {
      if (cache.get(nome) === valor) return;
      if (versaoBaseLocal === null) versaoBaseLocal = versaoRemota;
      cache.set(nome, valor);
      pendentes.set(nome, valor);
      persistirFilaSincronia();
      definirSituacaoSincronia(tokenDaSessao() ? "pendente" : "local", pendentes.size);
      agendar();
      avisarOutrasJanelas(nome, valor);
      return;
    }
    try {
      localStorage.setItem(nome, valor);
    } catch {
      cache.set(nome, valor);
      window.dispatchEvent(new CustomEvent("niko:armazenamento-cheio"));
    }
  },
  removeItem: (nome) => {
    if (travado) return;
    if (modo === "banco") {
      if (versaoBaseLocal === null) versaoBaseLocal = versaoRemota;
      cache.delete(nome);
      pendentes.set(nome, null);
      persistirFilaSincronia();
      definirSituacaoSincronia(tokenDaSessao() ? "pendente" : "local", pendentes.size);
      agendar();
      avisarOutrasJanelas(nome, null);
      return;
    }
    localSeguro(() => localStorage.removeItem(nome), undefined);
    cache.delete(nome);
  },
};

export const armazenamento = createJSONStorage(() => armazenamentoSeguro);

export function chave(nome: string): string {
  return `${PREFIXO}${nome}`;
}

export function modoArmazenamento(): ModoArmazenamento {
  return modo;
}

export async function buscarHistoricoSincronia(limite = 30): Promise<RegistroHistoricoSincronia[]> {
  if (!tokenDaSessao()) return [];
  const limiteSeguro = Math.max(1, Math.min(100, Math.floor(Number(limite) || 30)));
  const r = await fetch(`${endpointDosDados()}?acao=historico&limite=${limiteSeguro}`, { headers: cabecalhosDosDados(), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  const resposta: unknown = await jsonDaResposta(r);
  if (!objeto(resposta) || !Array.isArray(resposta.registros)) throw new Error("historico_invalido");
  return resposta.registros.flatMap((registro): RegistroHistoricoSincronia[] => {
    if (!objeto(registro) || typeof registro.versao !== "string" || !Array.isArray(registro.chaves) || typeof registro.criadoEm !== "string") return [];
    return [{
      versao: registro.versao,
      operacao: registro.operacao === "zerar" ? "zerar" : "alteracao",
      chaves: registro.chaves.filter((chave): chave is string => typeof chave === "string").slice(0, 500),
      clienteId: typeof registro.clienteId === "string" ? registro.clienteId : null,
      criadoEm: registro.criadoEm,
    }];
  });
}

export async function buscarBackupsSincronia(limite = 30): Promise<RegistroBackupSincronia[]> {
  if (!tokenDaSessao()) return [];
  const limiteSeguro = Math.max(1, Math.min(30, Math.floor(Number(limite) || 30)));
  const r = await fetch(`${endpointDosDados()}?acao=backups&limite=${limiteSeguro}`, { headers: cabecalhosDosDados(), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  const resposta: unknown = await jsonDaResposta(r);
  if (!objeto(resposta) || !Array.isArray(resposta.backups)) throw new Error("backups_invalidos");
  return resposta.backups.flatMap((backup): RegistroBackupSincronia[] => {
    if (!objeto(backup) || typeof backup.id !== "number" || !Number.isSafeInteger(backup.id) || backup.id <= 0 || typeof backup.versao !== "string" || typeof backup.criadoEm !== "string") return [];
    return [{
      id: backup.id,
      versao: backup.versao,
      motivo: backup.motivo === "zerar" ? "zerar" : backup.motivo === "manual" ? "manual" : "alteracao",
      itens: typeof backup.itens === "number" && Number.isSafeInteger(backup.itens) ? Math.max(0, backup.itens) : 0,
      criadoEm: backup.criadoEm,
    }];
  });
}

export async function restaurarBackupSincronia(id: number): Promise<void> {
  if (!tokenDaSessao()) throw new Error("nao_autenticado");
  await salvarAgora();
  const r = await fetch(`${endpointDosDados()}?acao=restaurar`, {
    method: "POST",
    headers: cabecalhosDosDados(),
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ id, versao: versaoBaseLocal ?? versaoRemota }),
  });
  if (!r.ok) {
    if (r.status === 409) window.dispatchEvent(new CustomEvent("niko:sincronizacao-conflito"));
    throw new Error(`http_${r.status}`);
  }
  const resposta: unknown = await jsonDaResposta(r);
  if (!objeto(resposta) || typeof resposta.versao !== "string") throw new Error("resposta_invalida");
  pendentes.clear();
  emEnvio.clear();
  versaoBaseLocal = null;
  versaoRemota = "";
  cache.clear();
  snapshotRemoto.clear();
  persistirFilaSincronia();
  await recarregarDaPonte();
}

function chavesLocais(): string[] {
  return localSeguro(() => Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO)), []);
}

function validarDadosRecebidos(resposta: unknown): Record<string, string> {
  if (!objeto(resposta) || !objeto(resposta.dados)) throw new Error("dados_invalidos");
  const dados: Record<string, string> = {};
  for (const [k, v] of Object.entries(resposta.dados)) {
    if (!/^niko:[a-z0-9_-]{1,60}$/.test(k) || typeof v !== "string" || v.length > 20_000_000) throw new Error("dados_invalidos");
    dados[k] = v;
  }
  return dados;
}

async function lerDadosLegadosDaPonte(): Promise<Record<string, string>> {
  try {
    const r = await fetch("/ponte/dados", { headers: CABECALHOS, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return {};
    return validarDadosRecebidos(await r.json());
  } catch {
    return {};
  }
}

export async function iniciarArmazenamento(): Promise<ModoArmazenamento> {
  let limite = 0;
  try {
    const remoto = Boolean(tokenDaSessao());
    const filaSalva = remoto ? lerFilaSincronia() : null;
    const dadosLegados = remoto ? await lerDadosLegadosDaPonte() : {};
    const controle = new AbortController();
    limite = window.setTimeout(() => controle.abort(), 4000);
    const r = await fetch(endpointDosDados(), { headers: cabecalhosDosDados(), signal: controle.signal });
    window.clearTimeout(limite);
    if (!r.ok) throw new Error(`http_${r.status}`);
    const resposta = await r.json();
    if (remoto && objeto(resposta) && typeof resposta.versao === "string") versaoRemota = resposta.versao;
    const dados = validarDadosRecebidos(resposta);
    for (const [k, v] of Object.entries(dados)) cache.set(k, v);
    if (remoto) atualizarSnapshotRemoto(dados);
    definirSituacaoSincronia(remoto ? "conectado" : "local", 0, remoto ? Date.now() : null);
    modo = "banco";
    if (filaSalva) {
      versaoBaseLocal = filaSalva.versao || versaoRemota;
      for (const [k, v] of Object.entries(filaSalva.itens)) {
        if (v === null) cache.delete(k);
        else cache.set(k, v);
        pendentes.set(k, v);
      }
      persistirFilaSincronia();
      definirSituacaoSincronia("pendente", pendentes.size);
    }
    const locais = chavesLocais().filter((k) => k !== `${PREFIXO}migrado`);
    if (remoto && Object.keys(dados).length === 0 && (Object.keys(dadosLegados).length > 0 || locais.length > 0)) {
      const migrados = { ...dadosLegados };
      for (const k of locais) {
        const v = localStorage.getItem(k);
        if (v != null) migrados[k] = v;
      }
      for (const [k, v] of Object.entries(migrados)) {
        cache.set(k, v);
        pendentes.set(k, v);
      }
      await enviarPendentes();
      if (pendentes.size === 0) for (const k of locais) localSeguro(() => localStorage.removeItem(k), undefined);
    } else if (remoto && Object.keys(dados).length > 0) {
      for (const k of locais) localSeguro(() => localStorage.removeItem(k), undefined);
    }
    if (ouvintesIniciados) return modo;
    if (tauriDisponivel()) {
      const { listen } = await import("@tauri-apps/api/event");
      const { invoke } = await import("@tauri-apps/api/core");
      const desfazer: (() => void)[] = [];
      try {
        desfazer.push(await listen<MudancaDeDados>(EVENTO_DADOS, (e) => receberDeFora(e.payload)));
        desfazer.push(await listen<{ tentativa: number }>("niko://saindo", async (e) => {
          const tentativa = ++tentativaDeSaida;
          if (document.body) document.body.inert = true;
          let sucesso = false;
          let limiteSaida = 0;
          try {
            await Promise.race([
              Promise.all([...preparadoresDeSaida].map((fn) => fn())),
              new Promise<never>((_, rejeitar) => { limiteSaida = window.setTimeout(() => rejeitar(new Error("acoes_pendentes")), 8000); }),
            ]);
            if (tentativa !== tentativaDeSaida) return;
            travado = true;
            await salvarAgora();
            sucesso = true;
          } catch { sucesso = false; }
          finally { window.clearTimeout(limiteSaida); }
          await invoke("confirmar_salvamento", { tentativa: e.payload.tentativa, sucesso }).catch(() => undefined);
        }));
        desfazer.push(await listen("niko://salvar-falhou", () => {
          tentativaDeSaida++;
          travado = false;
          if (document.body) document.body.inert = false;
          window.dispatchEvent(new CustomEvent("niko:armazenamento-falhou"));
        }));
        await invoke("registrar_armazenamento");
      } catch (erro) {
        desfazer.forEach((fn) => fn());
        throw erro;
      }
    }
    canal?.addEventListener("message", (e: MessageEvent<MudancaDeDados>) => receberDeFora(e.data));
    window.addEventListener("focus", () => void recarregarDaPonte());
    window.addEventListener("pagehide", () => void enviarPendentes(true).catch(() => undefined));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void enviarPendentes(true).catch(() => undefined);
      else void recarregarDaPonte();
    });
    ouvintesIniciados = true;
    if (remoto) {
      window.setInterval(() => {
        if (!sincroniaTempoRealAtiva) void recarregarDaPonte();
      }, 2000);
      if (pendentes.size > 0) agendar(0);
      conectarTempoReal();
    }
  } catch {
    modo = "local";
  } finally {
    window.clearTimeout(limite);
  }
  return modo;
}

export function aoMudarDeFora(fn: (chave: string) => void): () => void {
  ouvintesDeFora.add(fn);
  return () => ouvintesDeFora.delete(fn);
}

let travado = false;

export async function zerarTudo(apagarChaves: boolean): Promise<void> {
  travado = true;
  window.clearTimeout(temporizador);
  try {
    if (modo === "banco") {
      await salvarAgora();
      const endpoint = endpointDosDados();
      const r = await fetch(`${endpoint}?acao=zerar`, { method: "POST", headers: cabecalhosDosDados(), signal: AbortSignal.timeout(8000), body: JSON.stringify({ confirmacao: "APAGAR", chaves: apagarChaves, versao: versaoBaseLocal ?? versaoRemota }) });
      if (!r.ok) throw new Error(`http_${r.status}`);
      const resposta: unknown = await jsonDaResposta(r);
      if (objeto(resposta) && typeof resposta.versao === "string") versaoRemota = resposta.versao;
      versaoBaseLocal = null;
      cache.clear();
      snapshotRemoto.clear();
      persistirFilaSincronia();
      definirSituacaoSincronia(tokenDaSessao() ? "conectado" : "local", 0, tokenDaSessao() ? Date.now() : null);
    }
    pendentes.clear();
    for (const k of chavesLocais()) if (k !== `${PREFIXO}migrado`) localSeguro(() => localStorage.removeItem(k), undefined);
    localSeguro(() => localStorage.setItem(`${PREFIXO}migrado`, new Date().toISOString()), undefined);
  } catch (erro) {
    travado = false;
    if (pendentes.size) agendar();
    throw erro;
  }
}

export function salvarAgora(): Promise<void> {
  return enviarPendentes();
}

const CHAVE_AVISADOS = `${PREFIXO}avisados`;

export function marcarSeNovo(codigo: string): boolean {
  let lista: string[] = [];
  try {
    lista = JSON.parse((armazenamentoSeguro.getItem(CHAVE_AVISADOS) as string | null) ?? "[]") as string[];
    if (!Array.isArray(lista)) lista = [];
  } catch {
    lista = [];
  }
  if (lista.includes(codigo)) return false;
  armazenamentoSeguro.setItem(CHAVE_AVISADOS, JSON.stringify([...lista, codigo].slice(-300)));
  return true;
}

export function listarChaves(): string[] {
  if (modo === "banco") return [...cache.keys()].filter((k) => k.startsWith(PREFIXO));
  return chavesLocais();
}

export function lerChave(nome: string): string | null {
  return armazenamentoSeguro.getItem(nome) as string | null;
}

export function gravarChave(nome: string, valor: string) {
  armazenamentoSeguro.setItem(nome, valor);
}

export function apagarChave(nome: string) {
  armazenamentoSeguro.removeItem(nome);
}

export function tamanhoGuardado(): number {
  let total = 0;
  for (const k of listarChaves()) total += (lerChave(k) ?? "").length * 2;
  return total;
}
