import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

const ACOES = new Set(["estado", "novidades", "ligar", "filtros", "ignorar", "desconectar"]);

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
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

export const config = { maxDuration: 20 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "OPTIONS") return res.status(204).end();
  const acao = typeof req.query.acao === "string" ? req.query.acao : "";
  if (!ACOES.has(acao)) return res.status(404).json({ erro: "acao_invalida" });
  const leitura = acao === "estado" || acao === "novidades";
  if (req.method !== (leitura ? "GET" : "POST")) return res.status(405).json({ erro: "metodo_nao_permitido" });
  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });
  const gateway = urlDoGateway();
  const segredo = process.env.KYRO_GATEWAY_SECRET?.trim();
  if (!gateway || !segredo) return res.status(503).json({ erro: "gateway_remoto_nao_configurado" });

  try {
    const destino = new URL(`/gateway/whatsapp/${acao}`, gateway);
    if (acao === "novidades") destino.searchParams.set("desde", String(Math.max(0, Math.floor(Number(req.query.desde) || 0))));
    const resposta = await fetch(destino, {
      method: req.method,
      headers: {
        "x-kyro-gateway-secret": segredo,
        "x-kyro-user-id": String(usuario.id),
        ...(leitura ? {} : { "content-type": "application/json" }),
      },
      body: leitura ? undefined : JSON.stringify(req.body && typeof req.body === "object" ? req.body : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const texto = await resposta.text();
    res.statusCode = resposta.status;
    res.setHeader("Content-Type", resposta.headers.get("content-type") ?? "application/json; charset=utf-8");
    return res.end(texto);
  } catch {
    return res.status(502).json({ erro: "gateway_remoto_indisponivel" });
  }
}
