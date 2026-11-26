import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tratarAplicativosEmpresa } from "../src/servicos/aplicativosEmpresa.js";
import { responderArquivoProposta } from "../src/servicos/propostasAplicativos.js";
import { configurarCors } from "./cors.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  if (req.method === "OPTIONS") return res.status(204).end();
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const acao = typeof req.query.acao === "string" ? req.query.acao : null;
  const parametros = new URL(req.url ?? "/", "http://localhost").searchParams;
  const resultado = await tratarAplicativosEmpresa(req.method, acao, token, async () => {
    const corpo = req.body;
    return corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : {};
  }, parametros);
  if (resultado.arquivo) return responderArquivoProposta(res, resultado.arquivo);
  return res.status(resultado.status).json(resultado.dados);
}
