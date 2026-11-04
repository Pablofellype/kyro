import type { VercelRequest, VercelResponse } from "@vercel/node";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { validarSessao } from "../src/servicos/autenticacao.js";
import { configurarCors } from "./cors.js";

const CATEGORIAS = new Set(["perfil", "materiais"]);

function tokenDaRequisicao(req: VercelRequest): string {
  const valor = req.headers.authorization;
  return typeof valor === "string" && valor.startsWith("Bearer ") ? valor.slice(7).trim() : "";
}

function payloadDoCliente(valor: string | null): { categoria: string } {
  if (!valor) throw new Error("categoria_invalida");
  let corpo: unknown;
  try {
    corpo = JSON.parse(valor);
  } catch {
    throw new Error("categoria_invalida");
  }
  const categoria = corpo && typeof corpo === "object" && "categoria" in corpo ? String(corpo.categoria) : "";
  if (!CATEGORIAS.has(categoria)) throw new Error("categoria_invalida");
  return { categoria };
}

function caminhoPermitido(caminho: string, usuarioId: number, categoria: string): boolean {
  const prefixo = `kyro/usuarios/${usuarioId}/${categoria}/`;
  return caminho.startsWith(prefixo) && /^[a-z0-9-]{10,80}\.jpg$/i.test(caminho.slice(prefixo.length));
}

function urlDaFotoPermitida(valor: unknown, usuarioId: number): string {
  if (typeof valor !== "string" || !/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(valor)) throw new Error("foto_invalida");
  const url = new URL(valor);
  if (!url.pathname.startsWith(`/kyro/usuarios/${usuarioId}/`)) throw new Error("foto_invalida");
  return url.toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = tokenDaRequisicao(req);
  const usuario = token ? await validarSessao(token) : null;
  if (!usuario) return res.status(401).json({ erro: "nao_autenticado" });

  try {
    if (req.method === "DELETE") {
      const url = urlDaFotoPermitida(req.query.url, usuario.id);
      await del(url);
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "POST") return res.status(405).json({ erro: "metodo_nao_permitido" });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ erro: "blob_nao_configurado" });

    const resposta = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { categoria } = payloadDoCliente(clientPayload);
        if (!caminhoPermitido(pathname, usuario.id, categoria)) throw new Error("caminho_invalido");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ usuarioId: usuario.id, categoria }),
        };
      },
    });
    return res.status(200).json(resposta);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "foto_invalida";
    return res.status(400).json({ erro: mensagem });
  }
}

