import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { validarSessao } from "../src/servicos/autenticacao.ts";
import { lerDadosUsuarioComVersao } from "../src/servicos/dadosUsuario.ts";

const CAMINHO = "/api/ws";
const INTERVALO_MS = 1000;
const TEMPO_PARA_AUTENTICAR_MS = 10000;

interface MensagemDeEntrada {
  tipo?: unknown;
  token?: unknown;
}

interface Conexao {
  socket: WebSocket;
  usuarioId: number | null;
  versao: string;
  intervalo: NodeJS.Timeout | null;
  limiteAutenticacao: NodeJS.Timeout;
  consultando: boolean;
  encerrada: boolean;
}

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
  if (conexao.encerrada || conexao.usuarioId === null || conexao.consultando) return;
  conexao.consultando = true;
  try {
    const atual = await lerDadosUsuarioComVersao(conexao.usuarioId);
    if (!forcar && atual.versao === conexao.versao) return;
    if (enviar(conexao, { tipo: "dados", versao: atual.versao, dados: atual.dados })) conexao.versao = atual.versao;
  } catch {
    // A próxima rodada tenta novamente sem derrubar a conexão autenticada.
  } finally {
    conexao.consultando = false;
  }
}

function encerrar(conexao: Conexao) {
  if (conexao.encerrada) return;
  conexao.encerrada = true;
  if (conexao.intervalo) clearInterval(conexao.intervalo);
  clearTimeout(conexao.limiteAutenticacao);
}

function tratarConexao(socket: WebSocket) {
  const conexao: Conexao = {
    socket,
    usuarioId: null,
    versao: "",
    intervalo: null,
    limiteAutenticacao: setTimeout(() => socket.close(1008, "autenticacao_obrigatoria"), TEMPO_PARA_AUTENTICAR_MS),
    consultando: false,
    encerrada: false,
  };

  const autenticar = async (token: string) => {
    const usuario = await validarSessao(token);
    if (!usuario || conexao.encerrada || conexao.usuarioId !== null) {
      socket.close(1008, "sessao_invalida");
      return;
    }
    conexao.usuarioId = usuario.id;
    clearTimeout(conexao.limiteAutenticacao);
    if (!enviar(conexao, { tipo: "pronto" })) return;
    await enviarDadosSeMudaram(conexao, true);
    if (conexao.encerrada) return;
    conexao.intervalo = setInterval(() => void enviarDadosSeMudaram(conexao), INTERVALO_MS);
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

export function instalarSincroniaTempoReal(servidor: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
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
