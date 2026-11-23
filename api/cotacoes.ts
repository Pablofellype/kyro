import type { VercelRequest, VercelResponse } from "@vercel/node";
import { lerCotacoesImportados } from "../servidor/cotacoes.js";
import { configurarCors } from "./cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!configurarCors(req, res)) return res.status(403).json({ erro: "origem_nao_permitida" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ erro: "metodo_nao_permitido" });
  try {
    const cotacoes = await lerCotacoesImportados();
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    return res.status(200).json(cotacoes);
  } catch {
    return res.status(503).json({ erro: "cotacao_indisponivel" });
  }
}
