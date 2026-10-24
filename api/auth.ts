import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loginUsuario, validarSessao, logoutSessao } from "../src/servicos/autenticacao.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const acao = (req.query.acao as string) || "verificar";

  if (req.method === "POST" && acao === "login") {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, erro: "E-mail e senha são obrigatórios." });
    }

    const resultado = await loginUsuario(email, senha);
    if (!resultado.sucesso) {
      return res.status(401).json(resultado);
    }

    res.setHeader(
      "Set-Cookie",
      `kyro_token=${resultado.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`
    );
    return res.status(200).json(resultado);
  }

  if (req.method === "GET" && acao === "verificar") {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = req.cookies?.kyro_token;
    const token = bearerToken || cookieToken;

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
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = req.cookies?.kyro_token;
    const token = bearerToken || cookieToken;

    if (token) {
      await logoutSessao(token);
    }

    res.setHeader("Set-Cookie", "kyro_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
    return res.status(200).json({ sucesso: true });
  }

  return res.status(404).json({ erro: "Ação não encontrada." });
}
