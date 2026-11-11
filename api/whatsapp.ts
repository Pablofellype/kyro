import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

const ACOES = new Set(["estado", "novidades", "midia", "enviar-arquivo", "historico", "abrir", "fechar", "enviar", "editar", "apagar", "rastros", "limpar-rastros", "agendadas", "agendar", "cancelar-agendada", "ligar", "filtros", "ignorar", "desconectar", "esquecer"]);

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
  const leitura = acao === "estado" || acao === "novidades" || acao === "midia" || acao === "historico" || acao === "rastros" || acao === "agendadas";
  if (req.method !== (leitura ? "GET" : "POST")) return res.status(405).json({ erro: "metodo_nao_permitido" });
  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });
  if (usuario.perfil === "visitante") return res.status(403).json({ erro: "permissao_negada" });
  const gateway = urlDoGateway();
  const segredo = process.env.KYRO_GATEWAY_SECRET?.trim();
  if (!gateway || !segredo) return res.status(503).json({ erro: "gateway_remoto_nao_configurado" });

  try {
    const destino = new URL(`/gateway/whatsapp/${acao}`, gateway);
    for (const [chave, valor] of Object.entries(req.query)) {
      if (chave === "acao") continue;
      if (Array.isArray(valor)) destino.searchParams.set(chave, String(valor[0] ?? ""));
      else if (typeof valor === "string" || typeof valor === "number") destino.searchParams.set(chave, String(valor));
    }
    if (acao === "novidades") destino.searchParams.set("desde", String(Math.max(0, Math.floor(Number(req.query.desde) || 0))));
    const binario = acao === "midia" || acao === "enviar-arquivo";
    const corpoBinario = binario
      ? Buffer.isBuffer(req.body)
        ? req.body
        : req.body instanceof Uint8Array
          ? Buffer.from(req.body)
          : typeof req.body === "string"
            ? Buffer.from(req.body)
            : req.body instanceof ArrayBuffer
              ? Buffer.from(new Uint8Array(req.body))
              : Buffer.alloc(0)
      : undefined;
    const resposta = await fetch(destino, {
      method: req.method,
      headers: {
        "x-kyro-gateway-secret": segredo,
        "x-kyro-user-id": String(usuario.id),
        ...(binario ? { "content-type": String(req.headers["content-type"] ?? "application/octet-stream") } : leitura ? {} : { "content-type": "application/json" }),
      },
      body: binario ? corpoBinario : leitura ? undefined : JSON.stringify(req.body && typeof req.body === "object" ? req.body : {}),
      signal: AbortSignal.timeout(30_000),
    });
    res.statusCode = resposta.status;
    res.setHeader("Content-Type", resposta.headers.get("content-type") ?? "application/json; charset=utf-8");
    return res.end(Buffer.from(await resposta.arrayBuffer()));
  } catch {
    return res.status(502).json({ erro: "gateway_remoto_indisponivel" });
  }
}
