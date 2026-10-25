import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { gravarDadosUsuario, lerDadosUsuario, validarItensDadosUsuario, zerarDadosUsuario } from "../src/servicos/dadosUsuario.js";

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Niko");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });

  try {
    if (req.method === "GET") {
      return res.status(200).json({ dados: await lerDadosUsuario(usuario.id) });
    }

    if (req.method === "POST" && req.query.acao === "zerar") {
      if (req.body?.confirmacao !== "APAGAR") return res.status(400).json({ erro: "confirmacao_invalida" });
      await zerarDadosUsuario(usuario.id);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST") {
      const corpo = req.body && typeof req.body === "object" ? req.body : {};
      await gravarDadosUsuario(usuario.id, validarItensDadosUsuario(corpo.itens));
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ erro: "metodo_nao_permitido" });
  } catch (erro) {
    return res.status(400).json({ erro: (erro as Error).message });
  }
}
