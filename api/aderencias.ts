import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

const ACOES = new Set(["estado", "testar", "enviar", "executar", "configuracao"]);

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

function acaoDaRequisicao(req: VercelRequest): string {
  return typeof req.query.acao === "string" ? req.query.acao : "";
}

function urlDoGateway(): URL | null {
  const bruto = process.env.KYRO_GATEWAY_URL?.trim().replace(/\/+$/, "");
  if (!bruto) return null;
  try {
    const url = new URL(bruto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();

  const acao = acaoDaRequisicao(req);
  if (!ACOES.has(acao)) return res.status(404).json({ erro: "acao_invalida" });
  if (acao === "estado" && req.method !== "GET") return res.status(405).json({ erro: "metodo_nao_permitido" });
  if (acao !== "estado" && acao !== "configuracao" && req.method !== "POST") return res.status(405).json({ erro: "metodo_nao_permitido" });
  if (acao === "configuracao" && req.method !== "GET" && req.method !== "POST") return res.status(405).json({ erro: "metodo_nao_permitido" });

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });
  if (usuario.perfil !== "dono" && !usuario.roboAderencias) return res.status(403).json({ erro: "permissao_negada" });

  const gateway = urlDoGateway();
  const segredo = process.env.KYRO_GATEWAY_SECRET?.trim();
  if (!gateway || !segredo) return res.status(503).json({ erro: "gateway_remoto_nao_configurado" });

  try {
    const resposta = await fetch(new URL(`/gateway/aderencias/${acao}`, gateway), {
      method: req.method,
      headers: {
        "x-kyro-gateway-secret": segredo,
        "x-kyro-user-id": String(usuario.id),
        ...(req.method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: req.method === "POST" ? JSON.stringify(req.body && typeof req.body === "object" ? req.body : {}) : undefined,
      signal: AbortSignal.timeout(270_000),
    });
    const texto = await resposta.text();
    res.statusCode = resposta.status;
    res.setHeader("Content-Type", resposta.headers.get("content-type") ?? "application/json; charset=utf-8");
    return res.end(texto);
  } catch {
    return res.status(502).json({ erro: "gateway_remoto_indisponivel" });
  }
}
