import type { VercelRequest, VercelResponse } from "@vercel/node";
import { alterarAtivoUsuario, criarConviteUsuario, loginUsuario, listarUsuarios, redefinirSenhaComToken, solicitarRedefinicaoSenha, urlPublicaDoAmbiente, validarSessao, logoutSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

function origemDaRequisicao(req: VercelRequest): string {
  const encaminhado = req.headers["x-forwarded-for"];
  if (typeof encaminhado === "string" && encaminhado.trim()) return encaminhado.split(",")[0].trim();
  return "vercel";
}

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  if (typeof valor === "string" && valor.startsWith("Bearer ")) return valor.slice(7).trim();
  return req.cookies?.kyro_token ?? "";
}

function urlPublicaDaRequisicao(req: VercelRequest): string {
  const configurada = urlPublicaDoAmbiente();
  if (configurada) return configurada;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const protocolo = req.headers["x-forwarded-proto"] ?? "https";
  return typeof host === "string" && host ? `${protocolo}://${host}` : "";
}

function definirCookieSessao(res: VercelResponse, token: string) {
  res.setHeader("Set-Cookie", `kyro_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();

  const acao = (req.query.acao as string) || "verificar";

  if (req.method === "POST" && acao === "login") {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: "E-mail e senha são obrigatórios." });
    }

    const resultado = await loginUsuario(email, senha, origemDaRequisicao(req));
    if (!resultado.sucesso) {
      return res.status(401).json(resultado);
    }

    definirCookieSessao(res, resultado.token);
    return res.status(200).json(resultado);
  }

  if (req.method === "POST" && acao === "recuperar") {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    try {
      await solicitarRedefinicaoSenha(email, urlPublicaDaRequisicao(req));
      return res.status(200).json({ sucesso: true, mensagem: "Se o e-mail estiver autorizado, enviaremos um link para redefinir a senha." });
    } catch {
      return res.status(200).json({ sucesso: true, mensagem: "Se o e-mail estiver autorizado, enviaremos um link para redefinir a senha." });
    }
  }

  if (req.method === "POST" && acao === "redefinir") {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const senha = typeof req.body?.senha === "string" ? req.body.senha : "";
    try {
      const resultado = await redefinirSenhaComToken(token, senha);
      definirCookieSessao(res, resultado.token);
      return res.status(200).json(resultado);
    } catch (erro) {
      return res.status(400).json({ sucesso: false, erro: (erro as Error).message });
    }
  }

  const tokenAtual = tokenDaRequisicao(req);
  const usuarioAtual = tokenAtual ? await validarSessao(tokenAtual) : null;

  if (req.method === "POST" && acao === "convite") {
    if (!usuarioAtual || usuarioAtual.perfil !== "dono") return res.status(403).json({ erro: "permissao_negada" });
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    const nome = typeof req.body?.nome === "string" ? req.body.nome : "";
    try {
      await criarConviteUsuario(usuarioAtual, email, nome, urlPublicaDaRequisicao(req));
      return res.status(200).json({ sucesso: true, mensagem: "Convite enviado." });
    } catch (erro) {
      return res.status(400).json({ sucesso: false, erro: (erro as Error).message });
    }
  }

  if (req.method === "GET" && acao === "usuarios") {
    if (!usuarioAtual || usuarioAtual.perfil !== "dono") return res.status(403).json({ erro: "permissao_negada" });
    try {
      return res.status(200).json({ usuarios: await listarUsuarios(usuarioAtual) });
    } catch (erro) {
      return res.status(400).json({ erro: (erro as Error).message });
    }
  }

  if (req.method === "POST" && acao === "usuario") {
    if (!usuarioAtual || usuarioAtual.perfil !== "dono") return res.status(403).json({ erro: "permissao_negada" });
    const id = Number(req.body?.id);
    const ativo = req.body?.ativo === true;
    try {
      return res.status(200).json({ sucesso: true, usuario: await alterarAtivoUsuario(usuarioAtual, id, ativo) });
    } catch (erro) {
      return res.status(400).json({ sucesso: false, erro: (erro as Error).message });
    }
  }

  if (req.method === "GET" && acao === "verificar") {
    const token = tokenDaRequisicao(req);

    if (!token) {
      return res.status(200).json({ autenticado: false });
    }

    const usuario = await validarSessao(token);
    if (!usuario) {
      return res.status(200).json({ autenticado: false });
    }

    return res.status(200).json({ autenticado: true, usuario });
  }

  if (req.method === "POST" && acao === "logout") {
    const token = tokenDaRequisicao(req);

    if (token) {
      await logoutSessao(token);
    }

    res.setHeader("Set-Cookie", "kyro_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
    return res.status(200).json({ sucesso: true });
  }

  return res.status(404).json({ erro: "Ação não encontrada." });
}
