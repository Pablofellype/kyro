import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { validarSessao } from "../src/servicos/autenticacao.ts";
import { lerDadosUsuarioComVersao } from "../src/servicos/dadosUsuario.ts";
import { assinarMudancasWhatsapp, comWhatsappUsuario, iniciarWhatsapp, pacoteWhatsapp } from "./whatsapp/whatsapp.ts";

const CAMINHO = "/api/ws";
const TEMPO_PARA_AUTENTICAR_MS = 10000;

interface MensagemDeEntrada {
  tipo?: unknown;
  token?: unknown;
}

interface Conexao {
  socket: WebSocket;
  usuarioId: number | null;
  versao: string;
  limiteAutenticacao: NodeJS.Timeout;
  consultando: boolean;
  consultaPendente: boolean;
  encerrada: boolean;
  cancelarWhatsapp: (() => void) | null;
}

const conexoesPorUsuario = new Map<number, Set<Conexao>>();

function mensagemValida(valor: unknown): valor is MensagemDeEntrada {
  return Boolean(valor && typeof valor === "object" && !Array.isArray(valor));
}

function enviar(conexao: Conexao, valor: unknown): boolean {
  if (conexao.encerrada || conexao.socket.readyState !== WebSocket.OPEN) return false;
  try {
    conexao.socket.send(JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

async function enviarDadosSeMudaram(conexao: Conexao, forcar = false) {
  if (conexao.encerrada || conexao.usuarioId === null) return;
  if (conexao.consultando) {
    conexao.consultaPendente = true;
    return;
  }
  conexao.consultando = true;
  try {
    const atual = await lerDadosUsuarioComVersao(conexao.usuarioId);
    if (!forcar && atual.versao === conexao.versao) return;
    if (enviar(conexao, { tipo: "dados", versao: atual.versao, dados: atual.dados })) conexao.versao = atual.versao;
  } catch {
    // A próxima rodada tenta novamente sem derrubar a conexão autenticada.
  } finally {
    conexao.consultando = false;
    if (conexao.consultaPendente && !conexao.encerrada) {
      conexao.consultaPendente = false;
      queueMicrotask(() => void enviarDadosSeMudaram(conexao));
    }
  }
}

function encerrar(conexao: Conexao) {
  if (conexao.encerrada) return;
  conexao.encerrada = true;
  if (conexao.usuarioId !== null) {
    const conexoes = conexoesPorUsuario.get(conexao.usuarioId);
    conexoes?.delete(conexao);
    if (conexoes?.size === 0) conexoesPorUsuario.delete(conexao.usuarioId);
  }
  conexao.cancelarWhatsapp?.();
  conexao.cancelarWhatsapp = null;
  clearTimeout(conexao.limiteAutenticacao);
}

function tratarConexao(socket: WebSocket) {
  const conexao: Conexao = {
    socket,
    usuarioId: null,
    versao: "",
    limiteAutenticacao: setTimeout(() => socket.close(1008, "autenticacao_obrigatoria"), TEMPO_PARA_AUTENTICAR_MS),
    consultando: false,
    consultaPendente: false,
    encerrada: false,
    cancelarWhatsapp: null,
  };

  const autenticar = async (token: string) => {
    const usuario = await validarSessao(token);
    if (!usuario || conexao.encerrada || conexao.usuarioId !== null) {
      socket.close(1008, "sessao_invalida");
      return;
    }
    conexao.usuarioId = usuario.id;
    clearTimeout(conexao.limiteAutenticacao);
    let conexoes = conexoesPorUsuario.get(usuario.id);
    if (!conexoes) {
      conexoes = new Set();
      conexoesPorUsuario.set(usuario.id, conexoes);
    }
    conexoes.add(conexao);
    conexao.cancelarWhatsapp = assinarMudancasWhatsapp(usuario.id, (pacote) => {
      enviar(conexao, { tipo: "whatsapp", ...pacote });
    });
    await comWhatsappUsuario(usuario.id, () => iniciarWhatsapp());
    if (!enviar(conexao, { tipo: "pronto" })) return;
    await enviarDadosSeMudaram(conexao, true);
    if (conexao.encerrada) return;
    comWhatsappUsuario(usuario.id, () => {
      enviar(conexao, { tipo: "whatsapp", ...pacoteWhatsapp(), inicial: true });
    });
  };

  socket.on("message", (bruto: RawData) => {
    if (conexao.usuarioId !== null) return;
    let mensagem: unknown;
    try {
      mensagem = JSON.parse(bruto.toString("utf8"));
    } catch {
      socket.close(1008, "mensagem_invalida");
      return;
    }
    if (!mensagemValida(mensagem) || mensagem.tipo !== "autenticar" || typeof mensagem.token !== "string" || mensagem.token.length < 32 || mensagem.token.length > 256) {
      socket.close(1008, "autenticacao_obrigatoria");
      return;
    }
    void autenticar(mensagem.token).catch(() => socket.close(1011, "falha_autenticacao"));
  });
  socket.on("close", () => encerrar(conexao));
  socket.on("error", () => encerrar(conexao));
}

export function notificarDadosUsuarioAlterados(usuarioId: number, _versao?: string) {
  for (const conexao of conexoesPorUsuario.get(usuarioId) ?? []) {
    if (!conexao.encerrada) void enviarDadosSeMudaram(conexao);
  }
}

export function instalarSincroniaTempoReal(servidor: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const atualizar = (req: IncomingMessage, socket: Duplex, cabecalho: Buffer) => {
    let caminho = "";
    try {
      caminho = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (caminho !== CAMINHO) return;
    wss.handleUpgrade(req, socket, cabecalho, (cliente) => wss.emit("connection", cliente, req));
  };
  servidor.on("upgrade", atualizar);
  wss.on("connection", (socket) => tratarConexao(socket));
  return () => {
    servidor.off("upgrade", atualizar);
    wss.close();
  };
}
