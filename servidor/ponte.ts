import { alterarAtivoUsuario, criarConviteUsuario, getDb, loginUsuario, listarUsuarios, redefinirSenhaComToken, solicitarRedefinicaoSenha, urlPublicaDoAmbiente, validarSessao, logoutSessao } from "../src/servicos/autenticacao.ts";
import { ConflitoDadosUsuario, gravarDadosUsuario, lerBackupsDadosUsuario, lerDadosUsuarioComVersao, lerHistoricoDadosUsuario, restaurarBackupDadosUsuario, validarItensDadosUsuario, zerarDadosUsuario } from "../src/servicos/dadosUsuario.ts";
import type { Plugin, Connect } from "./tiposVite.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { listarProvedores, salvarProvedor, removerProvedor, testarProvedor, conversar, validarMensagens, validarFerramentas } from "./ia.ts";
import { lerConsumo, usoOficial } from "./consumo.ts";
import { lerUltimaVersao } from "./atualizacoes.ts";
import { lerTudo, gravar, backupManual, zerarBanco, reservarConfirmacao } from "./banco.ts";
import { pedirMidia } from "./midia.ts";
import { pedirJanelas } from "./janelas.ts";
import { configPublica, estadoConexoes, lerConexao, salvarChaveConexao, removerChaveConexao, servicoValido, chaveDe, SERVICOS as SERVICOS_CONEXAO } from "./conexoes.ts";
import { buscarGmail, criarRascunhoGmail, enviarGmail } from "./gmail.ts";
import { lerAgendaGoogle } from "./agendaGoogle.ts";
import { lerCotacoes } from "./cotacoes.ts";
import { lerAudio, lerNivelDaSaida, definirVolume, definirMudo, ajustarSessao, lerTema, lerIniciar, definirTema, abrirFerramenta, agirNaEnergia, lerBandeja, abrirDaBandeja, pastaDaBandeja, encerrarDaBandeja, listarApps, iconesDeApps, abrirApp, appDaJanela, abrirComandoDoSistema } from "./controleRapido.ts";
import { ocrDaRequisicao } from "./ocr.ts";
import { receberEventoDoGancho, ehRotaDoGancho, ouvirEventos, decidirPedido, estadoDaInstalacao, previaDaInstalacao, removerGanchos, abrirProjeto, trazerTerminal, terminalNaFrente, ehRotaDaStatus, receberStatusDoClaude } from "./claude.ts";
import { buscarNaWeb, lerPagina } from "./web.ts";
import {
  CAMINHO_DO_WEBHOOK, abrirConversa, definirFiltrosDoWhatsapp, desconectarWhatsapp, enviarMensagem, esquecerWhatsapp, estadoDoWhatsapp, fecharConversa, ignorarConversa,
  enviarArquivoNoWhatsapp, iniciarWhatsapp, instalarWhatsapp, ligarWhatsapp, midiaDaMensagem, novidadesDoWhatsapp, receberWebhookDoWhatsapp,
} from "./whatsapp/whatsapp.ts";
import { ehRotaDeAgente, receberEventoDeAgente, estadoDosAgentes, instalarAgente, previaDoAgente, removerAgente } from "./agentesDeCodigo.ts";
import { listarArquivos, receberArquivo, enviarConteudo, excluirArquivo, excluirArquivosDaMateria, baixarArquivo, abrirArquivoNoPrograma, exportarParaDownloads } from "./arquivos.ts";
import { tipoDoComputador, estadoDoSistema, listarRedes, listarBluetooth, lerComputador, conectarRede, esquecerRede, desconectarRede, definirBrilho, definirRadio, abrirConfiguracoesDoSistema } from "./sistema.ts";
import { instalarSincroniaTempoReal } from "./sincroniaTempoReal.ts";
import { configuracaoSalva, executarAderencias, enviarAderencia, navegadorDeAderenciasDisponivel, salvarConfiguracaoAderencias, testarAderencia } from "./aderencias.ts";

const LIMITE_CORPO = 24 * 1024 * 1024;

function lerCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolver, rejeitar) => {
    let tamanho = 0;
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => {
      tamanho += p.length;
      if (tamanho > LIMITE_CORPO) {
        rejeitar(new Error("corpo_grande"));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on("end", () => {
      try {
        const corpo: unknown = partes.length ? JSON.parse(Buffer.concat(partes).toString("utf8")) : {};
        if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) throw new Error("json_invalido");
        resolver(corpo as Record<string, unknown>);
      } catch {
        rejeitar(new Error("json_invalido"));
      }
    });
    req.on("error", rejeitar);
  });
}

function responder(res: ServerResponse, status: number, dados: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.end(JSON.stringify(dados));
}

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostDaRequisicao(req: IncomingMessage): string {
  const host = req.headers.host ?? "";
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return "";
  }
}

function ipPrivado(hostname: string): boolean {
  if (hostname === "::1" || hostname === "[::1]" || hostname.startsWith("fc") || hostname.startsWith("fd")) return true;
  const partes = hostname.split(".").map(Number);
  if (partes.length !== 4 || partes.some((parte) => !Number.isInteger(parte) || parte < 0 || parte > 255)) return false;
  const [a, b] = partes;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 169 && b === 254;
}

function hostLocal(req: IncomingMessage): boolean {
  const hostname = hostDaRequisicao(req);
  return HOSTS_LOCAIS.has(hostname) || ipPrivado(hostname);
}

function origemConfiavel(req: IncomingMessage): boolean {
  if (req.headers["x-niko"] !== "1") return false;
  const token = process.env.NIKO_TOKEN;
  if (token && req.headers["x-niko-token"] !== token) return false;
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    const host = new URL(origem).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "tauri.localhost") return true;
    return ipPrivado(host) && host === hostDaRequisicao(req);
  } catch {
    return false;
  }
}

function tokenDaRequisicao(req: IncomingMessage): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

function clienteDaRequisicao(req: IncomingMessage): string | null {
  const valor = req.headers["x-niko-cliente"];
  return typeof valor === "string" ? valor : null;
}

function origemDaRequisicao(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? hostDaRequisicao(req) ?? "local";
}

function urlPublicaDaPonte(req: IncomingMessage): string {
  return urlPublicaDoAmbiente() || `http://${hostDaRequisicao(req)}`;
}

type AcaoAderencia = "estado" | "testar" | "enviar" | "executar" | "configuracao";
type AcaoWhatsappRemota = "estado" | "novidades" | "ligar" | "filtros" | "ignorar" | "desconectar";

function acaoAderencia(caminho: string, prefixo: string): AcaoAderencia | null {
  const acao = caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : "";
  return acao === "estado" || acao === "testar" || acao === "enviar" || acao === "executar" || acao === "configuracao" ? acao : null;
}

async function atenderAderencia(req: IncomingMessage, res: ServerResponse, acao: AcaoAderencia) {
  if (acao === "estado") return responder(res, 200, { disponivel: true, navegador: navegadorDeAderenciasDisponivel() });
  if (acao === "configuracao" && req.method === "GET") return responder(res, 200, { configuracao: configuracaoSalva() });
  if (req.method !== "POST") return responder(res, 405, { erro: "metodo_nao_permitido" });
  const corpo = await lerCorpo(req);
  if (acao === "configuracao") return responder(res, 200, { configuracao: salvarConfiguracaoAderencias(corpo.configuracao) });
  if (acao === "testar") return responder(res, 200, await testarAderencia(corpo.planilha));
  if (acao === "enviar") return responder(res, 200, await enviarAderencia(corpo.configuracao, corpo.planilha));
  iniciarWhatsapp();
  return responder(res, 200, await executarAderencias(corpo.configuracao, typeof corpo.grupoId === "string" ? corpo.grupoId : undefined));
}

async function encaminharAderenciaRemota(req: IncomingMessage, res: ServerResponse, acao: AcaoAderencia) {
  const base = (process.env.KYRO_GATEWAY_URL || process.env.VITE_GATEWAY_URL)?.trim().replace(/\/+$/, "");
  const segredo = process.env.KYRO_GATEWAY_SECRET?.trim();
  if (!base || !segredo) return responder(res, 503, { erro: "gateway_remoto_nao_configurado" });
  if (acao === "estado" && req.method !== "GET") return responder(res, 405, { erro: "metodo_nao_permitido" });
  if (acao !== "estado" && req.method !== "GET" && req.method !== "POST") return responder(res, 405, { erro: "metodo_nao_permitido" });
  try {
    const url = new URL(`/gateway/aderencias/${acao}`, base);
    const enviaCorpo = req.method === "POST";
    const corpo = enviaCorpo ? await lerCorpo(req) : undefined;
    const resposta = await fetch(url, {
      method: req.method,
      headers: {
        "x-kyro-gateway-secret": segredo,
        ...(enviaCorpo ? { "content-type": "application/json" } : {}),
      },
      body: enviaCorpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(55_000),
    });
    const texto = await resposta.text();
    res.statusCode = resposta.status;
    res.setHeader("content-type", resposta.headers.get("content-type") ?? "application/json; charset=utf-8");
    return res.end(texto);
  } catch {
    return responder(res, 502, { erro: "gateway_remoto_indisponivel" });
  }
}

async function atenderWhatsappRemoto(req: IncomingMessage, res: ServerResponse, acao: AcaoWhatsappRemota, desde = 0) {
  const leitura = acao === "estado" || acao === "novidades";
  if (req.method !== (leitura ? "GET" : "POST")) return responder(res, 405, { erro: "metodo_nao_permitido" });
  if (acao === "estado") {
    await iniciarWhatsapp();
    return responder(res, 200, estadoDoWhatsapp());
  }
  if (acao === "novidades") return responder(res, 200, novidadesDoWhatsapp(desde));
  const corpo = await lerCorpo(req);
  if (acao === "ligar") return responder(res, 200, ligarWhatsapp(corpo.ligado === true));
  if (acao === "filtros") return responder(res, 200, definirFiltrosDoWhatsapp(corpo));
  if (acao === "ignorar") return responder(res, 200, ignorarConversa(corpo.jid, corpo.ignorar));
  return responder(res, 200, await desconectarWhatsapp());
}

async function encaminharWhatsappRemoto(req: IncomingMessage, res: ServerResponse, acao: AcaoWhatsappRemota, desde = 0) {
  const base = (process.env.KYRO_GATEWAY_URL || process.env.VITE_GATEWAY_URL)?.trim().replace(/\/+$/, "");
  const segredo = (process.env.KYRO_GATEWAY_SECRET || process.env.NIKO_GATEWAY_SECRET)?.trim();
  if (!base || !segredo) return responder(res, 503, { erro: "gateway_remoto_nao_configurado" });
  const leitura = acao === "estado" || acao === "novidades";
  if (req.method !== (leitura ? "GET" : "POST")) return responder(res, 405, { erro: "metodo_nao_permitido" });
  try {
    const url = new URL(`/gateway/whatsapp/${acao}`, base);
    if (acao === "novidades") url.searchParams.set("desde", String(Math.max(0, Math.floor(desde))));
    const corpo = leitura ? undefined : await lerCorpo(req);
    const resposta = await fetch(url, {
      method: req.method,
      headers: {
        "x-kyro-gateway-secret": segredo,
        ...(leitura ? {} : { "content-type": "application/json" }),
      },
      body: leitura ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    });
    const texto = await resposta.text();
    res.statusCode = resposta.status;
    res.setHeader("content-type", resposta.headers.get("content-type") ?? "application/json; charset=utf-8");
    return res.end(texto);
  } catch {
    return responder(res, 502, { erro: "gateway_remoto_indisponivel" });
  }
}

export const rotas: Connect.NextHandleFunction = async (req, res, proximo) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/api/health") {
    if (!hostLocal(req) || !origemConfiavel(req)) return responder(res, 403, { ok: false, erro: "origem_nao_permitida" });
    if (req.method === "OPTIONS") return responder(res, 204, {});
    if (req.method !== "GET") return responder(res, 405, { ok: false, erro: "metodo_nao_permitido" });
    try {
      const sql = getDb();
      await sql`SELECT 1 AS ok`;
      return responder(res, 200, { ok: true, api: "ok", banco: "ok", data: new Date().toISOString() });
    } catch {
      return responder(res, 503, { ok: false, api: "ok", banco: "indisponivel", erro: "banco_indisponivel" });
    }
  }

  if (url.pathname === "/api/auth") {
    if (!hostLocal(req) || !origemConfiavel(req)) return responder(res, 403, { erro: "origem_nao_permitida" });
    const acao = url.searchParams.get("acao") || "verificar";
    try {
      if (req.method === "POST" && acao === "login") {
        const { email, senha } = (await lerCorpo(req)) as { email?: string; senha?: string };
        if (!email || !senha) return responder(res, 400, { sucesso: false, erro: "E-mail e senha são obrigatórios." });
        const resultado = await loginUsuario(String(email), String(senha), origemDaRequisicao(req));
        if (!resultado.sucesso) return responder(res, 401, resultado);
        return responder(res, 200, resultado);
      }
      if (req.method === "POST" && acao === "recuperar") {
        const corpo = await lerCorpo(req);
        try {
          await solicitarRedefinicaoSenha(typeof corpo.email === "string" ? corpo.email : "", urlPublicaDaPonte(req));
          return responder(res, 200, { sucesso: true, mensagem: "Se o e-mail estiver autorizado, enviaremos um link para redefinir a senha." });
        } catch {
          return responder(res, 503, { sucesso: false, erro: "NÃ£o foi possÃ­vel enviar o e-mail agora." });
        }
      }
      if (req.method === "POST" && acao === "redefinir") {
        const corpo = await lerCorpo(req);
        try {
          return responder(res, 200, await redefinirSenhaComToken(typeof corpo.token === "string" ? corpo.token : "", typeof corpo.senha === "string" ? corpo.senha : ""));
        } catch (erro) {
          return responder(res, 400, { sucesso: false, erro: (erro as Error).message });
        }
      }
      const tokenAtual = tokenDaRequisicao(req);
      const usuarioAtual = tokenAtual ? await validarSessao(tokenAtual) : null;
      if (req.method === "POST" && acao === "convite") {
        if (!usuarioAtual || usuarioAtual.perfil !== "dono") return responder(res, 403, { erro: "permissao_negada" });
        const corpo = await lerCorpo(req);
        try {
          await criarConviteUsuario(usuarioAtual, typeof corpo.email === "string" ? corpo.email : "", typeof corpo.nome === "string" ? corpo.nome : "", urlPublicaDaPonte(req));
          return responder(res, 200, { sucesso: true, mensagem: "Convite enviado." });
        } catch (erro) {
          return responder(res, 400, { sucesso: false, erro: (erro as Error).message });
        }
      }
      if (req.method === "GET" && acao === "usuarios") {
        if (!usuarioAtual || usuarioAtual.perfil !== "dono") return responder(res, 403, { erro: "permissao_negada" });
        try {
          return responder(res, 200, { usuarios: await listarUsuarios(usuarioAtual) });
        } catch (erro) {
          return responder(res, 400, { erro: (erro as Error).message });
        }
      }
      if (req.method === "POST" && acao === "usuario") {
        if (!usuarioAtual || usuarioAtual.perfil !== "dono") return responder(res, 403, { erro: "permissao_negada" });
        const corpo = await lerCorpo(req);
        try {
          return responder(res, 200, { sucesso: true, usuario: await alterarAtivoUsuario(usuarioAtual, Number(corpo.id), corpo.ativo === true) });
        } catch (erro) {
          return responder(res, 400, { sucesso: false, erro: (erro as Error).message });
        }
      }
      if (req.method === "GET" && acao === "verificar") {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (url.searchParams.get("token") || "");
        if (!token) return responder(res, 200, { autenticado: false });
        const usuario = await validarSessao(token);
        return responder(res, 200, usuario ? { autenticado: true, usuario } : { autenticado: false });
      }
      if (req.method === "POST" && acao === "logout") {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (token) await logoutSessao(token);
        return responder(res, 200, { sucesso: true });
      }
    } catch (e) {
      return responder(res, 500, { sucesso: false, erro: (e as Error).message });
    }
    return responder(res, 404, { erro: "Ação não encontrada." });
  }

  if (url.pathname === "/api/dados") {
    if (!hostLocal(req) || !origemConfiavel(req)) return responder(res, 403, { erro: "origem_nao_permitida" });
    try {
      const token = tokenDaRequisicao(req);
      const usuario = token ? await validarSessao(token) : null;
      if (!usuario) return responder(res, 401, { erro: "nao_autenticado" });
      if (req.method === "GET") {
        if (url.searchParams.get("acao") === "historico") {
          const limite = Number(url.searchParams.get("limite") ?? "30");
          return responder(res, 200, { registros: await lerHistoricoDadosUsuario(usuario.id, limite) });
        }
        if (url.searchParams.get("acao") === "backups") {
          const limite = Number(url.searchParams.get("limite") ?? "30");
          return responder(res, 200, { backups: await lerBackupsDadosUsuario(usuario.id, limite) });
        }
        const atual = await lerDadosUsuarioComVersao(usuario.id);
        const desde = url.searchParams.get("desde") ?? "";
        if (desde && desde === atual.versao) return responder(res, 200, { alterado: false, versao: atual.versao });
        return responder(res, 200, { alterado: true, ...atual });
      }
      if (req.method === "POST" && url.searchParams.get("acao") === "zerar") {
        const corpo = await lerCorpo(req);
        if (corpo.confirmacao !== "APAGAR") return responder(res, 400, { erro: "confirmacao_invalida" });
        const versao = typeof corpo.versao === "string" ? corpo.versao : null;
        const novaVersao = await zerarDadosUsuario(usuario.id, versao, clienteDaRequisicao(req));
        return responder(res, 200, { ok: true, versao: novaVersao });
      }
      if (req.method === "POST" && url.searchParams.get("acao") === "restaurar") {
        const corpo = await lerCorpo(req);
        const id = typeof corpo.id === "number" ? corpo.id : Number(corpo.id);
        const versao = typeof corpo.versao === "string" ? corpo.versao : null;
        const novaVersao = await restaurarBackupDadosUsuario(usuario.id, id, versao, clienteDaRequisicao(req));
        return responder(res, 200, { ok: true, versao: novaVersao });
      }
      if (req.method === "POST") {
        const corpo = await lerCorpo(req);
        const versao = typeof corpo.versao === "string" ? corpo.versao : null;
        const novaVersao = await gravarDadosUsuario(usuario.id, validarItensDadosUsuario(corpo.itens), versao, clienteDaRequisicao(req));
        return responder(res, 200, { ok: true, versao: novaVersao });
      }
      return responder(res, 405, { erro: "metodo_nao_permitido" });
    } catch (e) {
      if (e instanceof ConflitoDadosUsuario) return responder(res, 409, { erro: "conflito_sincronizacao", versao: e.versao, dados: e.dados });
      return responder(res, 400, { erro: (e as Error).message });
    }
  }

  const gatewayAderencia = /^\/gateway\/aderencias\/(estado|testar|enviar|executar|configuracao)$/.exec(url.pathname);
  if (gatewayAderencia) {
    const esperado = process.env.NIKO_GATEWAY_SECRET?.trim();
    const recebido = typeof req.headers["x-kyro-gateway-secret"] === "string" ? req.headers["x-kyro-gateway-secret"] : "";
    if (!esperado) return responder(res, 503, { erro: "gateway_remoto_nao_configurado" });
    if (!recebido || recebido !== esperado) return responder(res, 401, { erro: "gateway_nao_autorizado" });
    return await atenderAderencia(req, res, gatewayAderencia[1] as AcaoAderencia);
  }
  const gatewayWhatsapp = /^\/gateway\/whatsapp\/(estado|novidades|ligar|filtros|ignorar|desconectar)$/.exec(url.pathname);
  if (gatewayWhatsapp) {
    const esperado = process.env.NIKO_GATEWAY_SECRET?.trim();
    const recebido = typeof req.headers["x-kyro-gateway-secret"] === "string" ? req.headers["x-kyro-gateway-secret"] : "";
    if (!esperado) return responder(res, 503, { erro: "gateway_remoto_nao_configurado" });
    if (!recebido || recebido !== esperado) return responder(res, 401, { erro: "gateway_nao_autorizado" });
    return await atenderWhatsappRemoto(req, res, gatewayWhatsapp[1] as AcaoWhatsappRemota, Number(url.searchParams.get("desde")) || 0);
  }

  if (!url.pathname.startsWith("/ponte/")) return proximo();
  if (!hostLocal(req)) return responder(res, 403, { erro: "host_nao_permitido" });
  if (ehRotaDoGancho(url.pathname) && req.method === "POST") return receberEventoDoGancho(req, res);
  if (ehRotaDaStatus(url.pathname) && req.method === "POST") return receberStatusDoClaude(req, res);
  if (ehRotaDeAgente(url.pathname) && req.method === "POST") return receberEventoDeAgente(req, res, url);
  if (url.pathname === CAMINHO_DO_WEBHOOK && req.method === "POST") return receberWebhookDoWhatsapp(req, res);
  if (!origemConfiavel(req)) return responder(res, 403, { erro: "origem_nao_permitida" });
  const caminho = url.pathname.slice("/ponte".length);

  try {
    const aderenciaRemota = /^\/aderencias-remota\/(estado|testar|enviar|executar|configuracao)$/.exec(caminho);
    if (aderenciaRemota) {
      if (!origemConfiavel(req)) return responder(res, 403, { erro: "origem_nao_permitida" });
      return await encaminharAderenciaRemota(req, res, aderenciaRemota[1] as AcaoAderencia);
    }
    const whatsappRemoto = /^\/whatsapp-remota\/(estado|novidades|ligar|filtros|ignorar|desconectar)$/.exec(caminho);
    if (whatsappRemoto) {
      if (!origemConfiavel(req)) return responder(res, 403, { erro: "origem_nao_permitida" });
      return await encaminharWhatsappRemoto(req, res, whatsappRemoto[1] as AcaoWhatsappRemota, Number(url.searchParams.get("desde")) || 0);
    }
    if (caminho === "/atualizacao" && req.method === "GET") return responder(res, 200, await lerUltimaVersao());
    if (caminho === "/estado" && req.method === "GET") {
      return responder(res, 200, { disponivel: true, plataforma: process.platform, provedores: listarProvedores() });
    }
    if (caminho === "/provedores" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      const provedor = await salvarProvedor(corpo as never);
      return responder(res, 200, provedor);
    }
    const remover = /^\/provedores\/([a-z0-9-]+)$/.exec(caminho);
    if (remover && req.method === "DELETE") {
      await removerProvedor(remover[1]);
      return responder(res, 200, { ok: true });
    }
    const testar = /^\/provedores\/([a-z0-9-]+)\/testar$/.exec(caminho);
    if (testar && req.method === "POST") {
      return responder(res, 200, await testarProvedor(testar[1]));
    }
    if (caminho === "/claude/eventos" && req.method === "GET") return ouvirEventos(req, res);
    if (caminho === "/claude/decisao" && req.method === "POST") return responder(res, 200, decidirPedido(await lerCorpo(req)));
    if (caminho === "/claude/abrir" && req.method === "POST") return responder(res, 200, abrirProjeto(await lerCorpo(req)));
    if (caminho === "/claude/terminal" && req.method === "POST") return responder(res, 200, await trazerTerminal(await lerCorpo(req)));
    if (caminho === "/claude/terminal-na-frente" && req.method === "POST") return responder(res, 200, await terminalNaFrente(await lerCorpo(req)));
    if (caminho === "/claude/instalacao" && req.method === "GET") return responder(res, 200, estadoDaInstalacao());
    if (caminho === "/claude/previa" && req.method === "GET") return responder(res, 200, previaDaInstalacao(url.searchParams.get("acao") === "remover" ? "remover" : "instalar"));
    if (caminho === "/claude/instalar" && req.method === "POST") return responder(res, 200, instalarAgente("claude", await lerCorpo(req)));
    if (caminho === "/claude/remover" && req.method === "POST") return responder(res, 200, removerGanchos(await lerCorpo(req)));
    if (caminho === "/agentes" && req.method === "GET") return responder(res, 200, estadoDosAgentes());
    const previaDeAgente = /^\/agentes\/([a-z]{2,20})\/previa$/.exec(caminho);
    if (previaDeAgente && req.method === "GET") return responder(res, 200, previaDoAgente(previaDeAgente[1], url.searchParams.get("acao") === "remover" ? "remover" : "instalar"));
    const agente = /^\/agentes\/([a-z]{2,20})\/(instalar|remover)$/.exec(caminho);
    if (agente && req.method === "POST") return responder(res, 200, agente[2] === "instalar" ? instalarAgente(agente[1], await lerCorpo(req)) : removerAgente(agente[1], await lerCorpo(req)));
    if (caminho === "/ocr" && req.method === "POST") return responder(res, 200, await ocrDaRequisicao(req));
    if (caminho.startsWith("/aderencias/")) {
      const acao = acaoAderencia(caminho, "/aderencias/");
      if (acao) return await atenderAderencia(req, res, acao);
    }
    if (caminho.startsWith("/whatsapp/")) {
      iniciarWhatsapp();
      const acao = caminho.slice("/whatsapp/".length);
      if (acao === "estado" && req.method === "GET") return responder(res, 200, estadoDoWhatsapp());
      if (acao === "novidades" && req.method === "GET") return responder(res, 200, novidadesDoWhatsapp(Number(url.searchParams.get("desde")) || 0));
      if (acao === "midia" && req.method === "GET") {
        const midia = await midiaDaMensagem(url.searchParams.get("jid"), url.searchParams.get("id"));
        res.statusCode = 200;
        res.setHeader("content-type", midia.tipo);
        res.setHeader("cache-control", "no-store");
        return res.end(midia.bytes);
      }
      if (acao === "enviar-arquivo" && req.method === "POST") return responder(res, 200, await enviarArquivoNoWhatsapp(req, url.searchParams));
      if (req.method === "POST") {
        const corpo = await lerCorpo(req);
        if (acao === "instalar") return responder(res, 200, await instalarWhatsapp());
        if (acao === "ligar") return responder(res, 200, ligarWhatsapp(corpo.ligado === true));
        if (acao === "filtros") return responder(res, 200, definirFiltrosDoWhatsapp(corpo));
        if (acao === "ignorar") return responder(res, 200, ignorarConversa(corpo.jid, corpo.ignorar));
        if (acao === "abrir") return responder(res, 200, await abrirConversa(corpo.jid));
        if (acao === "fechar") return responder(res, 200, fecharConversa());
        if (acao === "enviar") return responder(res, 200, await enviarMensagem(corpo.jid, corpo.texto));
        if (acao === "desconectar") return responder(res, 200, await desconectarWhatsapp());
        if (acao === "esquecer") return responder(res, 200, await esquecerWhatsapp());
      }
    }
    if (caminho === "/web/buscar" && req.method === "POST") return responder(res, 200, await buscarNaWeb(String((await lerCorpo(req)).consulta ?? "")));
    if (caminho === "/web/ler" && req.method === "POST") return responder(res, 200, await lerPagina(String((await lerCorpo(req)).url ?? "")));
    if (caminho === "/exportar" && req.method === "POST") return responder(res, 200, await exportarParaDownloads(req, url.searchParams.get("nome") ?? "", url.searchParams.get("mostrar") !== "0"));
    const arquivo = /^\/arquivos\/([A-Za-z0-9-]{1,64})(?:\/([A-Za-z0-9-]{1,64})(?:\/(baixar|abrir))?)?$/.exec(caminho);
    if (arquivo) {
      const banco = String(req.headers["x-niko-banco"] ?? "");
      const [, materia, id, acao] = arquivo;
      if (!id && req.method === "GET") return responder(res, 200, { arquivos: await listarArquivos(banco, materia) });
      if (!id && req.method === "POST") return responder(res, 200, await receberArquivo(req, banco, materia, url.searchParams.get("nome") ?? ""));
      if (!id && req.method === "DELETE") return responder(res, 200, excluirArquivosDaMateria(banco, materia));
      if (id && !acao && req.method === "GET") return enviarConteudo(res, banco, materia, id);
      if (id && !acao && req.method === "DELETE") return responder(res, 200, excluirArquivo(banco, materia, id));
      if (id && acao === "baixar" && req.method === "POST") return responder(res, 200, await baixarArquivo(banco, materia, id));
      if (id && acao === "abrir" && req.method === "POST") return responder(res, 200, abrirArquivoNoPrograma(banco, materia, id));
    }
    if (caminho === "/janelas" && req.method === "GET") return responder(res, 200, await pedirJanelas("listar"));
    const acaoJanela = /^\/janelas\/(focar|minimizar|fechar)$/.exec(caminho);
    if (acaoJanela && req.method === "POST") {
      const corpo = await lerCorpo(req);
      return responder(res, 200, await pedirJanelas(acaoJanela[1] as "focar", String(corpo.janela ?? "")));
    }
    if (caminho === "/midia" && req.method === "GET") {
      return responder(res, 200, await pedirMidia("estado"));
    }
    if (caminho === "/midia/nivel" && req.method === "GET") return responder(res, 200, await lerNivelDaSaida());
    const acaoMidia = /^\/midia\/(alternar|proxima|anterior|posicao)$/.exec(caminho);
    if (acaoMidia && req.method === "POST") {
      const corpo = await lerCorpo(req);
      return responder(res, 200, await pedirMidia(acaoMidia[1] as "alternar", Number(corpo.segundos)));
    }
    if (caminho === "/conexoes" && req.method === "GET") {
      return responder(res, 200, estadoConexoes());
    }
    if (caminho === "/cotacoes" && req.method === "GET") return responder(res, 200, await lerCotacoes());
    if (caminho === "/google/login-direto" && req.method === "GET") return responder(res, 200, { disponivel: false, emTestes: true });
    if (caminho === "/gmail/buscar" && req.method === "GET") return responder(res, 200, await buscarGmail(await chaveDe("google"), url.searchParams.get("q") ?? ""));
    if (caminho === "/agenda/eventos" && req.method === "GET") return responder(res, 200, await lerAgendaGoogle(await chaveDe("google"), url.searchParams.get("de") ?? "", url.searchParams.get("ate") ?? ""));
    if (caminho === "/gmail/rascunho" && req.method === "POST") return responder(res, 200, await criarRascunhoGmail(await chaveDe("google"), await lerCorpo(req)));
    if (caminho === "/gmail/enviar" && req.method === "POST") return responder(res, 200, await enviarGmail(await chaveDe("google"), await lerCorpo(req)));
    const configDaConexao = /^\/conexoes\/([a-z]+)\/config$/.exec(caminho);
    if (configDaConexao && servicoValido(configDaConexao[1]) && req.method === "GET") return responder(res, 200, await configPublica(configDaConexao[1]));
    const conexao = /^\/conexoes\/([a-z]+)(\/chave)?$/.exec(caminho);
    if (conexao && servicoValido(conexao[1])) {
      const servico = conexao[1];
      if (!conexao[2] && req.method === "GET") return responder(res, 200, await lerConexao(servico, url.searchParams.get("forcar") === "1"));
      if (conexao[2] && req.method === "POST") return responder(res, 200, await salvarChaveConexao(servico, await lerCorpo(req)));
      if (conexao[2] && req.method === "DELETE") return responder(res, 200, await removerChaveConexao(servico));
    }
    if (caminho === "/dados" && req.method === "GET") {
      return responder(res, 200, { dados: lerTudo(String(req.headers["x-niko-banco"] ?? "")) });
    }
    if (caminho === "/dados" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      const itens = corpo.itens;
      if (!itens || typeof itens !== "object" || Array.isArray(itens)) return responder(res, 400, { erro: "itens_invalidos" });
      gravar(itens as Record<string, string | null>, String(req.headers["x-niko-banco"] ?? ""));
      return responder(res, 200, { ok: true });
    }
    if (caminho === "/dados/zerar" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      if (corpo.confirmacao !== "APAGAR") return responder(res, 400, { erro: "confirmacao_invalida" });
      const pasta = zerarBanco(String(req.headers["x-niko-banco"] ?? ""));
      if (corpo.chaves === true) {
        for (const p of listarProvedores()) await removerProvedor(p.id);
        for (const s of SERVICOS_CONEXAO) await removerChaveConexao(s);
      }
      return responder(res, 200, { pasta });
    }
    if (caminho === "/dados/backup" && req.method === "POST") {
      return responder(res, 200, { pasta: backupManual(String(req.headers["x-niko-banco"] ?? "")) });
    }
    if (caminho === "/confirmacoes/reservar" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      if (typeof corpo.id !== "string" || typeof corpo.aceitar !== "boolean") return responder(res, 400, { erro: "confirmacao_invalida" });
      return responder(res, 200, reservarConfirmacao(corpo.id, corpo.aceitar, String(req.headers["x-niko-banco"] ?? "")));
    }
    if (caminho === "/consumo" && req.method === "GET") {
      if (url.searchParams.get("oficial") === "1") return responder(res, 200, usoOficial());
      return responder(res, 200, await lerConsumo(url.searchParams.get("forcar") === "1"));
    }
    if (caminho === "/ia" && req.method === "POST") {
      const corpo = await lerCorpo(req);
      const mensagens = validarMensagens(corpo.mensagens);
      const ferramentas = validarFerramentas(corpo.ferramentas);
      const controle = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) controle.abort();
      });
      res.statusCode = 200;
      res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      for await (const evento of conversar(String(corpo.provedorId ?? ""), String(corpo.sistema ?? "").slice(0, 20000), mensagens, typeof corpo.modelo === "string" ? corpo.modelo : undefined, controle.signal, ferramentas)) {
        res.write(`${JSON.stringify(evento)}\n`);
      }
      return res.end();
    }
    if (caminho.startsWith("/sistema/")) {
      const acao = caminho.slice("/sistema/".length);
      const leitura: Record<string, () => Promise<unknown>> = { tipo: tipoDoComputador, estado: estadoDoSistema, redes: listarRedes, bluetooth: listarBluetooth, computador: lerComputador };
      const escrita: Record<string, (d: Record<string, unknown>) => Promise<unknown>> = {
        conectar: conectarRede,
        esquecer: esquecerRede,
        desconectar: () => desconectarRede(),
        brilho: definirBrilho,
        radio: definirRadio,
        configuracoes: abrirConfiguracoesDoSistema,
      };
      if (req.method === "GET" && leitura[acao]) return responder(res, 200, await leitura[acao]());
      if (req.method === "POST" && escrita[acao]) return responder(res, 200, await escrita[acao](await lerCorpo(req)));
    }
    if (caminho.startsWith("/controle/")) {
      const acao = caminho.slice("/controle/".length);
      const leitura: Record<string, () => Promise<unknown>> = { audio: lerAudio, tema: lerTema, bandeja: lerBandeja, iniciar: lerIniciar };
      const escrita: Record<string, (d: Record<string, unknown>) => Promise<unknown>> = {
        volume: definirVolume,
        mudo: definirMudo,
        sessao: ajustarSessao,
        tema: definirTema,
        ferramenta: abrirFerramenta,
        energia: agirNaEnergia,
        bandeja: abrirDaBandeja,
        bandejaPasta: pastaDaBandeja,
        bandejaEncerrar: encerrarDaBandeja,
        apps: listarApps,
        iconesApps: iconesDeApps,
        abrirApp,
        appDaJanela,
        comandoDoSistema: abrirComandoDoSistema,
      };
      if (req.method === "GET" && leitura[acao]) return responder(res, 200, await leitura[acao]());
      if (req.method === "POST" && escrita[acao]) return responder(res, 200, await escrita[acao](await lerCorpo(req)));
    }
    return responder(res, 404, { erro: "rota_desconhecida" });
  } catch (e) {
    if (!res.headersSent) return responder(res, 400, { erro: (e as Error).message });
    res.end();
  }
};

export function ponteLocal(): Plugin {
  return {
    name: "niko-ponte-local",
    configureServer(servidor) {
      process.env.NIKO_TOKEN ||= randomBytes(32).toString("hex");
      servidor.middlewares.use(rotas);
      if (servidor.httpServer) instalarSincroniaTempoReal(servidor.httpServer);
    },
    transformIndexHtml: {
      order: "pre",
      handler: (html, contexto) => (contexto.server && process.env.NIKO_TOKEN ? html.replace("<head>", `<head>\n    <meta name="niko-token" content="${process.env.NIKO_TOKEN}" />`) : html),
    },
    configurePreviewServer(servidor) {
      servidor.middlewares.use(rotas);
      if (servidor.httpServer) instalarSincroniaTempoReal(servidor.httpServer);
    },
  };
}
